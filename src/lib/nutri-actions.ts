"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "./auth";
import { todaySP } from "./dates";
import { computeNutriScore } from "./domain/nutri";
import { getOpenPendings } from "./data/audits";
import { findNutriAudit, getActiveComposition, getNutriFillData, getUnitComposition } from "./data/nutri";
import { appUrl, ownerIds, sendPushToUsers } from "./push";
import { getSettings } from "./settings";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { BlockScore, NutriItemStatus } from "./types";

export type ActionResult = { ok: true; info?: string } | { ok: false; error: string };

const CHECKLIST_ROLES = ["auditor_nutricao", "proprietario"] as const;

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateNutri(unitId?: string) {
  revalidatePath("/nutri", "layout");
  if (unitId) revalidatePath(`/dashboard/lojas/${unitId}`);
  revalidatePath("/dashboard");
}

// =====================================================================
// AUDITORIA — iniciar / concluir / descartar
// =====================================================================

/**
 * Cria (ou reabre) a auditoria nutricional de uma unidade em uma data.
 * Pré-cria uma resposta por item ATIVO da composição da unidade, congelando a versão do texto,
 * a área e o peso; e uma avaliação por pendência nutricional em aberto (apontamentos anteriores).
 */
export async function startNutriAudit(input: { unitId: string; data: string }): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_nutricao"]);
  const unitId = String(input.unitId ?? "");
  const data = String(input.data ?? "");
  if (!unitId) return fail("Escolha a unidade.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return fail("Data inválida.");
  if (data > todaySP()) return fail("A data não pode ser futura.");

  const admin = createAdminClient();
  const { data: unit } = await admin.from("units").select("id, nome, ativa").eq("id", unitId).maybeSingle();
  if (!unit || !unit.ativa) return fail("Unidade não encontrada ou inativa.");

  const existing = await findNutriAudit(admin, unitId, data);
  let auditId: string | null = null;
  if (existing) {
    if (existing.status === "concluida") return fail(`Já existe uma auditoria nutricional concluída em ${unit.nome} nesta data.`);
    if (existing.auditor_id !== profile.id) return fail("Já existe um rascunho desta auditoria iniciado por outro usuário.");
    auditId = existing.id;
  } else {
    const entries = await getActiveComposition(admin, unitId);
    if (entries.length === 0) return fail(`O checklist de ${unit.nome} não tem itens ativos. Ajuste a composição em Checklists.`);

    const { data: template } = await admin.from("audit_templates").select("id").eq("tipo", "nutricional").eq("ativo", true).order("versao", { ascending: false }).limit(1).maybeSingle();

    // versão atual de cada item do banco (texto congelado nesta auditoria)
    const bankIds = Array.from(new Set(entries.map((e) => e.bank_item_id)));
    const { data: versions } = await admin.from("nutri_item_versions").select("id, bank_item_id, versao").in("bank_item_id", bankIds);
    const versionId = new Map<string, string>();
    for (const v of versions ?? []) versionId.set(`${v.bank_item_id}:${Number(v.versao)}`, v.id as string);

    const { data: created, error: insErr } = await admin
      .from("audits")
      .insert({ unit_id: unitId, auditor_id: profile.id, template_id: template?.id ?? null, tipo: "nutricional", data, status: "rascunho", etapa_atual: 0 })
      .select("id")
      .single();
    if (insErr || !created) return fail("Não foi possível criar a auditoria. Tente novamente.");
    auditId = created.id as string;

    const answers = entries.map((e) => ({
      audit_id: auditId,
      nutri_entry_id: e.id,
      nutri_item_id: e.bank_item_id,
      nutri_item_version_id: versionId.get(`${e.bank_item_id}:${e.item.versao}`) ?? null,
      nutri_area: e.area,
      nutri_peso: e.item.peso,
      resposta: null,
    }));
    const { error: ansErr } = await admin.from("audit_answers").insert(answers);
    if (ansErr) {
      await admin.from("audits").delete().eq("id", auditId);
      return fail("Não foi possível preparar os itens da auditoria. Tente novamente.");
    }

    const pendings = await getOpenPendings(admin, unitId, "nutri");
    if (pendings.length > 0) {
      await admin.from("audit_pending_reviews").insert(pendings.map((p) => ({ audit_id: auditId, pending_issue_id: p.id, resolvida: null })));
    }
  }

  revalidateNutri(unitId);
  redirect(`/nutri/auditorias/${auditId}`);
}

/**
 * Conclui a auditoria nutricional: valida bloqueios, grava nota/classificação/decomposição por área,
 * atualiza pendências (resolvidas × mantidas, reincidência), cria pendências para os novos NCs e avisa os proprietários.
 */
export async function concludeNutriAudit(auditId: string): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_nutricao"]);
  const supabase = await createClient();
  const fill = await getNutriFillData(supabase, auditId);
  if (!fill) return fail("Auditoria não encontrada.");
  const { audit, unit, answers, pendings } = fill;
  if (audit.auditor_id !== profile.id) return fail("Esta auditoria não é sua.");
  if (audit.status !== "rascunho") return fail("Auditoria já concluída.");

  const score = computeNutriScore(answers.map((a) => ({ entry_id: a.id, area: a.area, peso: a.peso, resposta: a.resposta })));
  if (score.faltando.length > 0) return fail(`${score.faltando.length} item(ns) sem resposta.`);
  const semApontamento = answers.filter((a) => a.resposta === "nao_conforme" && !(a.observacao ?? "").trim());
  if (semApontamento.length > 0) return fail(`${semApontamento.length} item(ns) não conforme(s) sem apontamento.`);
  if (pendings.some((p) => p.resolvida == null)) return fail("Avalie todos os apontamentos da visita anterior.");
  if (score.nota == null) return fail("Nenhum item aplicável — marque ao menos um item como Conforme ou Não conforme.");

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const notasBlocos: BlockScore[] = score.perdidos_por_area.map((p) => {
    const daArea = answers.filter((a) => a.area === p.area);
    return {
      chave: p.area,
      nome: p.area,
      peso: 0,
      nota: p.nota,
      zerado: false,
      itens_respondidos: daArea.filter((a) => a.resposta != null).length,
      itens_aplicaveis: daArea.filter((a) => a.resposta === "conforme" || a.resposta === "nao_conforme").length,
    };
  });

  const { error: upErr } = await admin
    .from("audits")
    .update({ status: "concluida", nota_final: score.nota, classificacao: score.classificacao, notas_blocos: notasBlocos, concluida_em: now })
    .eq("id", auditId)
    .eq("status", "rascunho");
  if (upErr) return fail("Não foi possível concluir a auditoria. Tente novamente.");

  // ---- pendências avaliadas ----
  const settings = await getSettings(admin);
  const limiteReincidente = Number(settings.pendencia_reincidente_visitas) || 2;
  const owners = await ownerIds(admin);
  for (const p of pendings) {
    const { data: issue } = await admin.from("pending_issues").select("*").eq("id", p.pending_issue_id).maybeSingle();
    if (!issue || issue.status !== "aberta") continue;
    if (p.resolvida) {
      await admin.from("pending_issues").update({ status: "resolvida", resolvida_em_audit_id: auditId, resolvida_em: now }).eq("id", issue.id);
      continue;
    }
    const visitas = Number(issue.visitas_sem_resolver) + 1;
    const viraReincidente = visitas >= limiteReincidente && !issue.reincidente;
    await admin
      .from("pending_issues")
      .update({ visitas_sem_resolver: visitas, ...(viraReincidente ? { reincidente: true, reincidente_notificado_em: now } : {}) })
      .eq("id", issue.id);
    if (viraReincidente) {
      try {
        await sendPushToUsers(admin, owners, "pendencia_reincidente", issue.id as string, {
          titulo: "Pendência reincidente (nutrição)",
          corpo: `${unit.nome}: "${issue.descricao}" segue sem solução há ${visitas} visitas`,
          url: appUrl(`/dashboard/lojas/${unit.id}`),
        });
      } catch (e) {
        console.error("[nutri] push reincidente falhou", e);
      }
    }
  }

  // ---- novas pendências para os NCs desta auditoria ----
  const abertas = await getOpenPendings(admin, unit.id, "nutri");
  const jaAberta = new Set(abertas.map((i) => i.nutri_entry_id));
  const novas = answers
    .filter((a) => a.resposta === "nao_conforme" && !jaAberta.has(a.entry_id))
    .map((a) => ({
      unit_id: unit.id,
      nutri_entry_id: a.entry_id,
      nutri_item_id: a.item_id,
      descricao: a.descricao,
      observacao_origem: (a.observacao ?? "").trim() || null,
      origem_audit_id: auditId,
      status: "aberta",
    }));
  if (novas.length > 0) {
    const { error } = await admin.from("pending_issues").insert(novas);
    if (error) console.error("[nutri] falha ao criar pendências", error);
  }

  // ---- aviso aos proprietários ----
  try {
    const nota = Math.round(score.nota);
    await sendPushToUsers(admin, owners, "auditoria_concluida", auditId, {
      titulo: `${profile.nome} concluiu Auditoria Nutricional em ${unit.nome}`,
      corpo: `Nota ${nota}% · ${score.classificacao}`,
      url: appUrl(`/nutri/auditorias/${auditId}/resumo`),
    });
  } catch (e) {
    console.error("[nutri] push conclusão falhou", e);
  }

  revalidateNutri(unit.id);
  revalidatePath("/dashboard", "layout");
  redirect(`/nutri/auditorias/${auditId}/resumo`);
}

/** Descarta um rascunho (apaga respostas, fotos e avaliações de pendências). */
export async function discardNutriDraft(auditId: string): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_nutricao"]);
  const admin = createAdminClient();
  const { data: audit } = await admin.from("audits").select("id, auditor_id, status, unit_id").eq("id", auditId).eq("tipo", "nutricional").maybeSingle();
  if (!audit) return fail("Auditoria não encontrada.");
  if (audit.auditor_id !== profile.id) return fail("Esta auditoria não é sua.");
  if (audit.status !== "rascunho") return fail("Auditoria concluída não pode ser descartada.");

  const { data: photos } = await admin.from("audit_photos").select("storage_path, audit_answers!inner(audit_id)").eq("audit_answers.audit_id", auditId);
  const paths = (photos ?? []).map((p) => p.storage_path as string);
  if (paths.length > 0) await admin.storage.from("audit-photos").remove(paths);
  const { error } = await admin.from("audits").delete().eq("id", auditId);
  if (error) return fail("Não foi possível descartar o rascunho.");

  revalidateNutri(audit.unit_id as string);
  redirect("/nutri");
}

// =====================================================================
// BANCO DE ITENS
// =====================================================================

export async function createBankItem(input: { descricao: string; area_padrao: string; peso?: number }): Promise<ActionResult & { id?: string }> {
  await requireProfile([...CHECKLIST_ROLES]);
  const descricao = String(input.descricao ?? "").trim();
  const area = String(input.area_padrao ?? "").trim();
  const peso = Number(input.peso ?? 1);
  if (!descricao) return fail("Informe o texto do item.");
  if (!area) return fail("Informe a área padrão.");
  if (!(peso > 0)) return fail("Peso deve ser maior que zero.");
  const supabase = await createClient();
  const { data: dup } = await supabase.from("nutri_item_bank").select("id").ilike("descricao", descricao).limit(1);
  if (dup && dup.length > 0) return fail("Já existe um item com este texto no banco.");
  const { data, error } = await supabase.from("nutri_item_bank").insert({ descricao, area_padrao: area, peso }).select("id").single();
  if (error || !data) return fail("Não foi possível criar o item.");
  revalidateNutri();
  return { ok: true, id: data.id as string };
}

/** Editar o texto cria uma nova versão (trigger no banco); auditorias antigas mantêm o texto da época. */
export async function updateBankItem(id: string, input: { descricao?: string; peso?: number; area_padrao?: string }): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const patch: Record<string, unknown> = {};
  if (input.descricao != null) {
    const d = String(input.descricao).trim();
    if (!d) return fail("O texto não pode ficar vazio.");
    patch.descricao = d;
  }
  if (input.peso != null) {
    const p = Number(input.peso);
    if (!(p > 0)) return fail("Peso deve ser maior que zero.");
    patch.peso = p;
  }
  if (input.area_padrao != null) {
    const a = String(input.area_padrao).trim();
    if (!a) return fail("Informe a área padrão.");
    patch.area_padrao = a;
  }
  if (Object.keys(patch).length === 0) return fail("Nada para salvar.");
  const supabase = await createClient();
  const { error } = await supabase.from("nutri_item_bank").update(patch).eq("id", id);
  if (error) return fail("Não foi possível salvar o item.");
  revalidateNutri();
  return { ok: true };
}

/** Desativar esconde o item das listas de "incluir"; composições existentes continuam como estão. */
export async function setBankItemActive(id: string, ativo: boolean): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const supabase = await createClient();
  const { error } = await supabase.from("nutri_item_bank").update({ ativo }).eq("id", id);
  if (error) return fail("Não foi possível atualizar o item.");
  revalidateNutri();
  return { ok: true };
}

// =====================================================================
// COMPOSIÇÃO POR UNIDADE
// =====================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

async function nextAreaOrdem(supabase: Db, unitId: string, area: string): Promise<number> {
  const { data: same } = await supabase.from("unit_nutri_checklist").select("area_ordem").eq("unit_id", unitId).eq("area", area).limit(1);
  if (same && same.length > 0) return Number(same[0].area_ordem);
  const { data: max } = await supabase.from("unit_nutri_checklist").select("area_ordem").eq("unit_id", unitId).order("area_ordem", { ascending: false }).limit(1);
  return (max && max.length > 0 ? Number(max[0].area_ordem) : 0) + 1;
}

async function nextOrdem(supabase: Db, unitId: string, area: string): Promise<number> {
  const { data: max } = await supabase.from("unit_nutri_checklist").select("ordem").eq("unit_id", unitId).eq("area", area).order("ordem", { ascending: false }).limit(1);
  return (max && max.length > 0 ? Number(max[0].ordem) : 0) + 1;
}

/** Inclui um item do banco na composição da unidade (área existente ou nova). */
export async function addBankItemToUnit(input: { unitId: string; bankItemId: string; area: string }): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const area = String(input.area ?? "").trim();
  if (!area) return fail("Informe a área.");
  const supabase = await createClient();
  const { data: dup } = await supabase.from("unit_nutri_checklist").select("id").eq("unit_id", input.unitId).eq("bank_item_id", input.bankItemId).eq("area", area).limit(1);
  if (dup && dup.length > 0) return fail("Este item já está nesta área.");
  const [area_ordem, ordem] = await Promise.all([nextAreaOrdem(supabase, input.unitId, area), nextOrdem(supabase, input.unitId, area)]);
  const { error } = await supabase.from("unit_nutri_checklist").insert({ unit_id: input.unitId, bank_item_id: input.bankItemId, area, area_ordem, ordem, status: "ativo" });
  if (error) return fail("Não foi possível incluir o item.");
  revalidateNutri(input.unitId);
  return { ok: true };
}

/** Cria um item novo no banco (área padrão = área escolhida) e já inclui na unidade. */
export async function createItemForUnit(input: { unitId: string; descricao: string; area: string; peso?: number }): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const descricao = String(input.descricao ?? "").trim();
  const area = String(input.area ?? "").trim();
  const peso = Number(input.peso ?? 1);
  if (!descricao) return fail("Informe o texto do item.");
  if (!area) return fail("Informe a área.");
  if (!(peso > 0)) return fail("Peso deve ser maior que zero.");
  const supabase = await createClient();
  // reaproveita item já existente com o mesmo texto (evita duplicar o banco)
  const { data: existing } = await supabase.from("nutri_item_bank").select("id").ilike("descricao", descricao).limit(1);
  let bankItemId = existing && existing.length > 0 ? (existing[0].id as string) : null;
  if (!bankItemId) {
    const { data, error } = await supabase.from("nutri_item_bank").insert({ descricao, area_padrao: area, peso }).select("id").single();
    if (error || !data) return fail("Não foi possível criar o item.");
    bankItemId = data.id as string;
  }
  return addBankItemToUnit({ unitId: input.unitId, bankItemId, area });
}

/** Pausar / reativar uma entrada (preserva histórico). */
export async function setEntryStatus(entryId: string, status: NutriItemStatus): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("unit_nutri_checklist").update({ status }).eq("id", entryId).select("unit_id").maybeSingle();
  if (error || !data) return fail("Não foi possível atualizar o item.");
  revalidateNutri(data.unit_id as string);
  return { ok: true };
}

/**
 * Retira a entrada da composição. Se alguma resposta histórica referencia a entrada,
 * ela é pausada em vez de removida (mantém a integridade do histórico).
 */
export async function removeEntry(entryId: string): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const supabase = await createClient();
  const { data: entry } = await supabase.from("unit_nutri_checklist").select("id, unit_id").eq("id", entryId).maybeSingle();
  if (!entry) return fail("Item não encontrado.");
  const admin = createAdminClient();
  const [{ count: answers }, { count: pendings }] = await Promise.all([
    admin.from("audit_answers").select("id", { count: "exact", head: true }).eq("nutri_entry_id", entryId),
    admin.from("pending_issues").select("id", { count: "exact", head: true }).eq("nutri_entry_id", entryId),
  ]);
  if ((answers ?? 0) > 0 || (pendings ?? 0) > 0) {
    const { error } = await supabase.from("unit_nutri_checklist").update({ status: "pausado" }).eq("id", entryId);
    if (error) return fail("Não foi possível pausar o item.");
    revalidateNutri(entry.unit_id as string);
    return { ok: true, info: "Item com histórico foi pausado em vez de removido." };
  }
  const { error } = await supabase.from("unit_nutri_checklist").delete().eq("id", entryId);
  if (error) return fail("Não foi possível retirar o item.");
  revalidateNutri(entry.unit_id as string);
  return { ok: true };
}

/** Move a entrada uma posição para cima ou para baixo dentro da área (renumera a área). */
export async function moveEntry(entryId: string, dir: "up" | "down"): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const supabase = await createClient();
  const { data: entry } = await supabase.from("unit_nutri_checklist").select("id, unit_id, area").eq("id", entryId).maybeSingle();
  if (!entry) return fail("Item não encontrado.");
  const { data: rows } = await supabase.from("unit_nutri_checklist").select("id, ordem").eq("unit_id", entry.unit_id).eq("area", entry.area).order("ordem").order("created_at");
  const ids = (rows ?? []).map((r) => r.id as string);
  const i = ids.indexOf(entryId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) {
    const { error } = await supabase.from("unit_nutri_checklist").update({ ordem: k + 1 }).eq("id", ids[k]);
    if (error) return fail("Não foi possível reordenar.");
  }
  revalidateNutri(entry.unit_id as string);
  return { ok: true };
}

/** Move a área inteira uma posição para cima/baixo (renumera area_ordem de todas as áreas da unidade). */
export async function moveArea(unitId: string, area: string, dir: "up" | "down"): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const supabase = await createClient();
  const areas = (await getUnitComposition(supabase, unitId)).map((a) => a.area);
  const i = areas.indexOf(area);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= areas.length) return { ok: true };
  [areas[i], areas[j]] = [areas[j], areas[i]];
  for (let k = 0; k < areas.length; k++) {
    const { error } = await supabase.from("unit_nutri_checklist").update({ area_ordem: k + 1 }).eq("unit_id", unitId).eq("area", areas[k]);
    if (error) return fail("Não foi possível reordenar as áreas.");
  }
  revalidateNutri(unitId);
  return { ok: true };
}

/** Renomeia a área (todas as entradas da unidade nessa área). */
export async function renameArea(unitId: string, from: string, to: string): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  const novo = String(to ?? "").trim();
  if (!novo) return fail("Informe o nome da área.");
  if (novo === from) return { ok: true };
  const supabase = await createClient();
  const { data: clash } = await supabase.from("unit_nutri_checklist").select("id").eq("unit_id", unitId).eq("area", novo).limit(1);
  if (clash && clash.length > 0) return fail("Já existe uma área com este nome nesta unidade.");
  const { error } = await supabase.from("unit_nutri_checklist").update({ area: novo }).eq("unit_id", unitId).eq("area", from);
  if (error) return fail("Não foi possível renomear a área.");
  revalidateNutri(unitId);
  return { ok: true };
}

/** Marca/desmarca "checklist em revisão" da unidade. */
export async function setUnitRevisao(unitId: string, emRevisao: boolean): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  // RLS de units só permite escrita do proprietário; a nutricionista também pode validar → service_role após checar o papel
  const admin = createAdminClient();
  const { error } = await admin.from("units").update({ nutri_checklist_em_revisao: emRevisao }).eq("id", unitId);
  if (error) return fail("Não foi possível atualizar a unidade.");
  revalidateNutri(unitId);
  revalidatePath("/admin/unidades");
  return { ok: true };
}

/** Copia a composição de outra unidade (adiciona só o que ainda não existe). */
export async function copyComposition(targetUnitId: string, sourceUnitId: string): Promise<ActionResult> {
  await requireProfile([...CHECKLIST_ROLES]);
  if (targetUnitId === sourceUnitId) return fail("Escolha uma unidade diferente.");
  const supabase = await createClient();
  const [source, target] = await Promise.all([getUnitComposition(supabase, sourceUnitId), getUnitComposition(supabase, targetUnitId)]);
  const present = new Set(target.flatMap((a) => a.entries.map((e) => `${e.bank_item_id}|${e.area}`)));
  const targetAreaOrdem = new Map(target.map((a) => [a.area, a.area_ordem]));
  const targetMaxOrdem = new Map(target.map((a) => [a.area, Math.max(0, ...a.entries.map((e) => e.ordem))]));
  let nextArea = Math.max(0, ...target.map((a) => a.area_ordem)) + 1;
  const inserts: Record<string, unknown>[] = [];
  for (const area of source) {
    let areaOrdem = targetAreaOrdem.get(area.area);
    if (areaOrdem == null) {
      areaOrdem = nextArea++;
      targetAreaOrdem.set(area.area, areaOrdem);
    }
    let ordem = targetMaxOrdem.get(area.area) ?? 0;
    for (const e of area.entries) {
      const key = `${e.bank_item_id}|${e.area}`;
      if (present.has(key)) continue;
      present.add(key);
      ordem++;
      inserts.push({ unit_id: targetUnitId, bank_item_id: e.bank_item_id, area: e.area, area_ordem: areaOrdem, ordem, status: "ativo" });
    }
    targetMaxOrdem.set(area.area, ordem);
  }
  if (inserts.length === 0) return { ok: true, info: "Nada a copiar: todos os itens já estavam na composição." };
  const { error } = await supabase.from("unit_nutri_checklist").insert(inserts);
  if (error) return fail("Não foi possível copiar a composição.");
  revalidateNutri(targetUnitId);
  return { ok: true, info: `${inserts.length} item(ns) adicionado(s).` };
}
