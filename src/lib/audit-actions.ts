"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getAuditAnswers, getOpenPendings } from "@/lib/data/audits";
import { findAudit } from "@/lib/data/audit-flow";
import { getActiveTemplate, getTemplateById, toScoringBlocks } from "@/lib/data/templates";
import { getUnit } from "@/lib/data/units";
import { todaySP } from "@/lib/dates";
import { computeAuditScore, concludeBlockers } from "@/lib/domain/scoring";
import { appUrl, ownerIds, sendPushToUsers } from "@/lib/push";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Audit, AuditPendingReview, AuditType, PendingIssue } from "@/lib/types";

export type ActionResult = { error?: string };

const MANAGER_TYPES: AuditType[] = ["completa", "simplificada", "producao"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAuditorRoutes(auditId?: string) {
  revalidatePath("/auditor");
  revalidatePath("/auditor/agenda");
  revalidatePath("/auditor/historico");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendario");
  if (auditId) {
    revalidatePath(`/auditorias/${auditId}`);
    revalidatePath(`/auditorias/${auditId}/revisao`);
    revalidatePath(`/auditorias/${auditId}/resumo`);
  }
}

/**
 * Inicia (ou retoma) a auditoria de uma unidade/tipo/data. Cria o rascunho, carrega as
 * pendências abertas da unidade como avaliações e vincula a linha da agenda. Redireciona
 * para o preenchimento.
 */
export async function startAudit(input: { unitId: string; tipo: AuditType; data?: string }): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_geral"]);
  const tipo = input.tipo;
  const data = input.data && YMD.test(input.data) ? input.data : todaySP();
  if (!MANAGER_TYPES.includes(tipo)) return { error: "Tipo de auditoria inválido." };
  if (!input.unitId) return { error: "Escolha a unidade." };

  const admin = createAdminClient();
  const unit = await getUnit(admin, input.unitId);
  if (!unit || !unit.ativa) return { error: "Unidade não encontrada ou inativa." };
  if (tipo === "producao" && unit.tipo !== "producao") return { error: "A auditoria de produção só se aplica à cozinha central." };
  if (tipo !== "producao" && unit.tipo !== "loja") return { error: "Na cozinha central só é possível fazer a auditoria de produção." };

  const existing = await findAudit(admin, unit.id, tipo, data);
  let auditId: string;

  if (existing) {
    if (existing.status === "concluida") {
      return { error: `Já existe auditoria ${AUDIT_TYPE_SHORT[tipo].toLowerCase()} concluída em ${unit.nome} nesta data.` };
    }
    if (existing.auditor_id !== profile.id) return { error: "Já existe um rascunho desta auditoria iniciado por outro auditor." };
    auditId = existing.id;
  } else {
    const template = await getActiveTemplate(admin, tipo);
    if (!template) return { error: "Template da auditoria não encontrado. Fale com o proprietário." };

    const { data: created, error } = await admin
      .from("audits")
      .insert({ unit_id: unit.id, auditor_id: profile.id, template_id: template.id, tipo, data, status: "rascunho", etapa_atual: 0 })
      .select("id")
      .single();
    if (error || !created) {
      // corrida: outra aba criou a mesma auditoria
      const again = await findAudit(admin, unit.id, tipo, data);
      if (again && again.status === "rascunho" && again.auditor_id === profile.id) {
        auditId = again.id;
      } else {
        return { error: "Não foi possível criar a auditoria. Tente novamente." };
      }
    } else {
      auditId = created.id as string;
    }

    const pendings = await getOpenPendings(admin, unit.id, "gerente");
    if (pendings.length > 0) {
      await admin
        .from("audit_pending_reviews")
        .upsert(
          pendings.map((p) => ({ audit_id: auditId, pending_issue_id: p.id, resolvida: null })),
          { onConflict: "audit_id,pending_issue_id", ignoreDuplicates: true },
        );
    }
  }

  // vincula a linha da agenda do dia, se a unidade/tipo baterem
  const { data: days } = await admin.from("schedule_days").select("id, unit_id, tipo, auditor_id, audit_id").eq("data", data);
  const day = (days ?? []).find((d) => d.unit_id === unit.id && d.tipo === tipo && (d.auditor_id == null || d.auditor_id === profile.id));
  if (day && day.audit_id !== auditId) {
    await admin.from("schedule_days").update({ audit_id: auditId, auditor_id: profile.id }).eq("id", day.id);
  }

  revalidateAuditorRoutes(auditId);
  redirect(`/auditorias/${auditId}`);
}

/** Variante para uso em <form action>. */
export async function startAuditForm(formData: FormData): Promise<void> {
  const res = await startAudit({
    unitId: String(formData.get("unitId") ?? ""),
    tipo: String(formData.get("tipo") ?? "") as AuditType,
    data: formData.get("data") ? String(formData.get("data")) : undefined,
  });
  if (res?.error) redirect(`/auditor/nova?erro=${encodeURIComponent(res.error)}`);
}

/**
 * Conclui a auditoria: valida bloqueios, grava a nota, atualiza pendências (resolvidas /
 * mantidas / reincidentes), cria novas pendências para itens 1–2, marca a agenda e avisa
 * os proprietários. Concluída, a auditoria fica imutável.
 */
export async function concludeAudit(auditId: string): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_geral"]);
  const supabase = await createClient();

  const { data: a } = await supabase.from("audits").select("*").eq("id", auditId).maybeSingle();
  if (!a) return { error: "Auditoria não encontrada." };
  const audit = a as Audit;
  if (audit.auditor_id !== profile.id) return { error: "Esta auditoria não é sua." };
  if (audit.status !== "rascunho") return { error: "Esta auditoria já foi concluída." };
  if (!MANAGER_TYPES.includes(audit.tipo)) return { error: "Tipo de auditoria não suportado aqui." };

  const admin = createAdminClient();
  const template = audit.template_id ? await getTemplateById(admin, audit.template_id) : await getActiveTemplate(admin, audit.tipo);
  if (!template) return { error: "Template da auditoria não encontrado." };
  const blocks = toScoringBlocks(template);

  const [answers, { data: reviewRows }, unit] = await Promise.all([
    getAuditAnswers(admin, auditId),
    admin.from("audit_pending_reviews").select("*").eq("audit_id", auditId),
    getUnit(admin, audit.unit_id),
  ]);
  if (!unit) return { error: "Unidade não encontrada." };

  const scoringAnswers = answers
    .filter((ans) => ans.item_id)
    .map((ans) => ({
      item_id: ans.item_id as string,
      nota: ans.nota,
      na: ans.na,
      produto_vencido: ans.produto_vencido,
      observacao: ans.observacao,
      fotos: ans.audit_photos?.length ?? 0,
    }));
  const result = computeAuditScore(audit.tipo, blocks, scoringAnswers);

  const blockers = concludeBlockers(result);
  const reviews = (reviewRows ?? []) as AuditPendingReview[];
  const naoAvaliadas = reviews.filter((r) => r.resolvida == null).length;
  if (naoAvaliadas > 0) blockers.push(`${naoAvaliadas} pendência(s) da visita anterior sem avaliação`);
  if (blockers.length > 0) return { error: `Ainda não dá para concluir: ${blockers.join("; ")}.` };
  if (result.nota_final == null) return { error: "Nenhum item aplicável foi avaliado." };

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("audits")
    .update({
      status: "concluida",
      nota_final: result.nota_final,
      notas_blocos: result.notas_blocos,
      falha_grave: result.falha_grave,
      produto_vencido: result.produto_vencido,
      concluida_em: now,
    })
    .eq("id", auditId)
    .eq("status", "rascunho");
  if (updErr) return { error: "Não foi possível concluir a auditoria. Tente novamente." };

  // ---- pendências avaliadas ----
  const settings = await getSettings(admin);
  const owners = await ownerIds(admin);
  if (reviews.length > 0) {
    const { data: issueRows } = await admin.from("pending_issues").select("*").in("id", reviews.map((r) => r.pending_issue_id));
    const issues = new Map((issueRows ?? []).map((i) => [i.id as string, i as PendingIssue]));
    for (const r of reviews) {
      const issue = issues.get(r.pending_issue_id);
      if (!issue || issue.status !== "aberta") continue;
      if (r.resolvida) {
        await admin.from("pending_issues").update({ status: "resolvida", resolvida_em_audit_id: auditId, resolvida_em: now }).eq("id", issue.id);
        continue;
      }
      const visitas = (issue.visitas_sem_resolver ?? 0) + 1;
      const patch: Record<string, unknown> = { visitas_sem_resolver: visitas };
      const viraReincidente = visitas >= settings.pendencia_reincidente_visitas && !issue.reincidente;
      if (viraReincidente) {
        patch.reincidente = true;
        patch.reincidente_notificado_em = now;
      }
      await admin.from("pending_issues").update(patch).eq("id", issue.id);
      if (viraReincidente) {
        try {
          await sendPushToUsers(admin, owners, "pendencia_reincidente", `${issue.id}`, {
            titulo: "Pendência reincidente",
            corpo: `${unit.nome}: "${issue.descricao}" segue sem solução há ${visitas} visitas`,
            url: appUrl(`/dashboard/lojas/${unit.id}`),
          });
        } catch (e) {
          console.error("[push] pendência reincidente", e);
        }
      }
    }
  }

  // ---- novas pendências (itens 1–2, exceto o item de pendências) ----
  const itemsById = new Map(blocks.flatMap((b) => b.items).map((i) => [i.id, i]));
  const lowAnswers = scoringAnswers.filter((ans) => !ans.na && ans.nota != null && Number(ans.nota) <= 2 && !itemsById.get(ans.item_id)?.pendencias);
  if (lowAnswers.length > 0) {
    const stillOpen = await getOpenPendings(admin, unit.id, "gerente");
    const openItems = new Set(stillOpen.map((p) => p.item_id));
    const rows = lowAnswers
      .filter((ans) => !openItems.has(ans.item_id))
      .map((ans) => ({
        unit_id: unit.id,
        item_id: ans.item_id,
        descricao: itemsById.get(ans.item_id)?.descricao ?? "Item",
        nota_origem: Number(ans.nota),
        observacao_origem: ans.observacao ?? null,
        origem_audit_id: auditId,
        status: "aberta",
      }));
    if (rows.length > 0) {
      const { error } = await admin.from("pending_issues").insert(rows);
      if (error) console.error("[pendências] falha ao criar", error);
    }
  }

  // ---- agenda ----
  await admin.from("schedule_days").update({ status: "concluida", audit_id: auditId }).eq("data", audit.data).eq("unit_id", unit.id).eq("tipo", audit.tipo);

  // ---- push aos proprietários ----
  try {
    const nota = Math.round(result.nota_final);
    await sendPushToUsers(admin, owners, "auditoria_concluida", auditId, {
      titulo: `${profile.nome} concluiu ${AUDIT_TYPE_SHORT[audit.tipo]} em ${unit.nome}`,
      corpo: `Nota ${nota}%${result.falha_grave ? " · ⚠ falha grave" : ""}`,
      url: appUrl(`/auditorias/${auditId}/resumo`),
    });
  } catch (e) {
    console.error("[push] auditoria concluída", e);
  }

  revalidateAuditorRoutes(auditId);
  revalidatePath(`/dashboard/lojas/${unit.id}`);
  revalidatePath("/dashboard/pendencias");
  redirect(`/auditorias/${auditId}/resumo`);
}

/** Descarta um rascunho próprio (respostas, fotos e avaliações de pendências vão junto). */
export async function deleteDraft(auditId: string): Promise<ActionResult> {
  const profile = await requireProfile(["auditor_geral"]);
  const admin = createAdminClient();
  const { data: a } = await admin.from("audits").select("id, auditor_id, status").eq("id", auditId).maybeSingle();
  if (!a) return { error: "Auditoria não encontrada." };
  if (a.auditor_id !== profile.id) return { error: "Esta auditoria não é sua." };
  if (a.status !== "rascunho") return { error: "Auditoria concluída não pode ser descartada." };

  // remove os arquivos do bucket antes das linhas (cascade apaga audit_photos)
  const { data: answers } = await admin.from("audit_answers").select("id, audit_photos(storage_path)").eq("audit_id", auditId);
  const paths = (answers ?? []).flatMap((ans) => ((ans.audit_photos ?? []) as { storage_path: string }[]).map((p) => p.storage_path));
  if (paths.length > 0) {
    const { error } = await admin.storage.from("audit-photos").remove(paths);
    if (error) console.warn("[fotos] falha ao remover do storage", error);
  }

  await admin.from("schedule_days").update({ audit_id: null }).eq("audit_id", auditId);
  const { error } = await admin.from("audits").delete().eq("id", auditId).eq("status", "rascunho");
  if (error) return { error: "Não foi possível descartar o rascunho." };

  revalidateAuditorRoutes(auditId);
  redirect("/auditor");
}
