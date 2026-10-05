"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { closeMonth, reopenMonth, regenerateReports } from "./closing";
import { getClosings } from "./data/dashboard";
import { getTemplateById, toScoringBlocks } from "./data/templates";
import { addMonths, formatDatePT, monthEnd, monthStart, todaySP, weekday } from "./dates";
import { auditTypeForWeekday } from "./domain/schedule";
import { computeAuditScore, type ScoringAnswer } from "./domain/scoring";
import { ensureSchedule } from "./schedule-sync";
import { createAdminClient } from "./supabase/admin";
import type { Audit, Unit } from "./types";

export type ActionResult = { ok: true; message?: string; warning?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function revalidateDashboard() {
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------------------
// Calendário da rotina
// ---------------------------------------------------------------------------

/** Troca a loja de um dia previsto (hoje ou futuro), registrando a troca. */
export async function swapScheduleDay(input: { scheduleDayId: string; newUnitId: string; motivo: string }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const motivo = input.motivo.trim();
    if (!motivo) return { ok: false, error: "Informe o motivo da troca." };
    const admin = createAdminClient();
    const [{ data: day }, { data: unit }] = await Promise.all([
      admin.from("schedule_days").select("*").eq("id", input.scheduleDayId).maybeSingle(),
      admin.from("units").select("*").eq("id", input.newUnitId).maybeSingle(),
    ]);
    if (!day) return { ok: false, error: "Dia da agenda não encontrado." };
    if (!unit) return { ok: false, error: "Unidade não encontrada." };
    const u = unit as Unit;
    if (day.status !== "prevista") return { ok: false, error: "Só é possível trocar dias ainda previstos." };
    if (day.data < todaySP()) return { ok: false, error: "Não é possível trocar um dia que já passou." };
    if (!u.ativa) return { ok: false, error: "A unidade escolhida está inativa." };
    const compatible = day.tipo === "producao" ? u.tipo === "producao" : u.tipo === "loja";
    if (!compatible) return { ok: false, error: "Unidade incompatível com o tipo de auditoria do dia." };
    if (day.unit_id === u.id) return { ok: false, error: "A unidade escolhida já é a prevista para o dia." };

    const { error } = await admin
      .from("schedule_days")
      .update({
        unit_id: u.id,
        unit_original_id: day.unit_original_id ?? day.unit_id,
        trocado_por: profile.id,
        trocado_em: new Date().toISOString(),
        motivo_troca: motivo,
      })
      .eq("id", day.id);
    if (error) throw error;
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `Dia ${day.data} trocado para ${u.nome}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Gera a agenda do mês informado e do seguinte (não sobrescreve dias existentes). */
export async function generateScheduleAction(mes: string): Promise<ActionResult> {
  try {
    await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const start = monthStart(mes);
    const n = await ensureSchedule(admin, start, monthEnd(addMonths(start, 1)));
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: n === 0 ? "A agenda já estava completa." : `${n} dia(s) gerado(s).` };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Define o domingo de folga do mês (1 por mês): substitui a folga de domingo já registrada no mesmo mês,
 * remove o dia previsto na agenda (se ainda não houver auditoria) e regenera a agenda do mês.
 */
export async function setSundayOff(data: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida.");
    if (weekday(data) !== 0) throw new Error("A folga mensal deve cair num domingo.");
    if (data < todaySP()) throw new Error("Não é possível marcar folga em data passada.");
    const admin = createAdminClient();
    const mes = monthStart(data);
    const { data: linked } = await admin.from("schedule_days").select("id").eq("data", data).not("audit_id", "is", null).limit(1);
    if (linked && linked.length > 0) throw new Error("Já existe auditoria registrada nesse dia.");
    // 1 domingo por mês: remove o anterior do mesmo mês
    await admin.from("auditor_days_off").delete().gte("data", mes).lte("data", monthEnd(mes)).eq("motivo", "Folga de domingo");
    const { error } = await admin.from("auditor_days_off").insert({ data, auditor_id: null, motivo: "Folga de domingo", criado_por: profile.id });
    if (error) throw error;
    await ensureSchedule(admin, mes, monthEnd(mes)); // remove o dia de folga e completa o resto
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: "Domingo de folga definido." };
  } catch (e) {
    return fail(e);
  }
}

const SEM_VISITA = "Removido da rotina";

/**
 * Remove a visita prevista de um dia: registra o dia em auditor_days_off (motivo informado) para a
 * agenda não o regerar e apaga a linha prevista. Só dias previstos, de hoje em diante, sem auditoria.
 * Para devolver o dia à rotação, use removeDayOff(data).
 */
export async function removeScheduleDay(input: { scheduleDayId: string; motivo?: string }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const { data: day } = await admin.from("schedule_days").select("*").eq("id", input.scheduleDayId).maybeSingle();
    if (!day) return { ok: false, error: "Dia da agenda não encontrado." };
    if (day.status === "concluida" || day.audit_id) return { ok: false, error: "Esse dia já tem auditoria registrada; não pode ser removido." };
    const motivo = input.motivo?.trim() || SEM_VISITA;
    await admin.from("auditor_days_off").delete().eq("data", day.data);
    const { error: offErr } = await admin.from("auditor_days_off").insert({ data: day.data, auditor_id: null, motivo, criado_por: profile.id });
    if (offErr) throw offErr;
    const { error } = await admin.from("schedule_days").delete().eq("id", day.id);
    if (error) throw error;
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `Visita de ${formatDatePT(day.data)} removida. O dia fica sem rotina até ser devolvido.` };
  } catch (e) {
    return fail(e);
  }
}

async function activeAuditorId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true).order("created_at").limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

function editable(day: { status: string; data: string; audit_id: string | null }): string | null {
  if (day.status !== "prevista") return "Só dias ainda previstos podem ser alterados.";
  if (day.audit_id) return "Esse dia já tem auditoria iniciada.";
  if (day.data < todaySP()) return "Dias passados não podem ser alterados (só removidos).";
  return null;
}

/** Troca as lojas de dois dias previstos (arrastar e soltar / "trocar com outro dia"). */
export async function swapScheduleUnits(input: { aId: string; bId: string }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    if (input.aId === input.bId) return { ok: false, error: "Escolha dois dias diferentes." };
    const admin = createAdminClient();
    const { data: rows } = await admin.from("schedule_days").select("*").in("id", [input.aId, input.bId]);
    const a = rows?.find((r) => r.id === input.aId);
    const b = rows?.find((r) => r.id === input.bId);
    if (!a || !b) return { ok: false, error: "Dia da agenda não encontrado." };
    for (const d of [a, b]) {
      const why = editable(d);
      if (why) return { ok: false, error: `${formatDatePT(d.data)}: ${why}` };
    }
    if ((a.tipo === "producao") !== (b.tipo === "producao")) return { ok: false, error: "Não dá para trocar a cozinha central com uma loja: a terça é sempre produção." };
    const now = new Date().toISOString();
    const motivo = `Troca entre ${formatDatePT(a.data)} e ${formatDatePT(b.data)}`;
    const upA = admin.from("schedule_days").update({ unit_id: b.unit_id, unit_original_id: a.unit_original_id ?? a.unit_id, trocado_por: profile.id, trocado_em: now, motivo_troca: motivo }).eq("id", a.id);
    const upB = admin.from("schedule_days").update({ unit_id: a.unit_id, unit_original_id: b.unit_original_id ?? b.unit_id, trocado_por: profile.id, trocado_em: now, motivo_troca: motivo }).eq("id", b.id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([upA, upB]);
    if (e1 || e2) throw e1 ?? e2;
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `Lojas trocadas entre ${formatDatePT(a.data)} e ${formatDatePT(b.data)}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Move a visita de um dia previsto para uma data sem rotina (o dia de origem fica "sem visita"). */
export async function moveScheduleDay(input: { scheduleDayId: string; newDate: string }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newDate)) throw new Error("Data inválida.");
    if (input.newDate < todaySP()) return { ok: false, error: "Não é possível mover para uma data passada." };
    const admin = createAdminClient();
    const { data: day } = await admin.from("schedule_days").select("*").eq("id", input.scheduleDayId).maybeSingle();
    if (!day) return { ok: false, error: "Dia da agenda não encontrado." };
    const why = editable(day);
    if (why) return { ok: false, error: why };
    const { data: occupied } = await admin.from("schedule_days").select("id").eq("data", input.newDate).limit(1);
    if (occupied && occupied.length > 0) return { ok: false, error: `${formatDatePT(input.newDate)} já tem visita prevista. Use "trocar" entre os dois dias.` };
    const tipo = day.tipo === "producao" ? "producao" : (auditTypeForWeekday(weekday(input.newDate)) ?? "simplificada");
    const motivo = `Movida de ${formatDatePT(day.data)}`;
    const { error } = await admin
      .from("schedule_days")
      .update({ data: input.newDate, tipo: tipo === "producao" && day.tipo !== "producao" ? "simplificada" : tipo, trocado_por: profile.id, trocado_em: new Date().toISOString(), motivo_troca: motivo })
      .eq("id", day.id);
    if (error) throw error;
    await admin.from("auditor_days_off").delete().eq("data", input.newDate);
    await admin.from("auditor_days_off").delete().eq("data", day.data);
    await admin.from("auditor_days_off").insert({ data: day.data, auditor_id: null, motivo: `Movida para ${formatDatePT(input.newDate)}`, criado_por: profile.id });
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `Visita movida de ${formatDatePT(day.data)} para ${formatDatePT(input.newDate)}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Inclui uma visita numa data sem rotina (dia vazio, folga ou "sem visita"). */
export async function addScheduleDay(input: { data: string; unitId: string; tipo?: "completa" | "simplificada" }): Promise<ActionResult> {
  try {
    await requireProfile(["proprietario"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) throw new Error("Data inválida.");
    if (input.data < todaySP()) return { ok: false, error: "Não é possível incluir visita em data passada." };
    const admin = createAdminClient();
    const [{ data: unit }, { data: occupied }] = await Promise.all([
      admin.from("units").select("*").eq("id", input.unitId).maybeSingle(),
      admin.from("schedule_days").select("id").eq("data", input.data).limit(1),
    ]);
    if (!unit || !(unit as Unit).ativa) return { ok: false, error: "Unidade não encontrada ou inativa." };
    if (occupied && occupied.length > 0) return { ok: false, error: `${formatDatePT(input.data)} já tem visita prevista.` };
    const u = unit as Unit;
    const tipo = u.tipo === "producao" ? "producao" : (input.tipo ?? (auditTypeForWeekday(weekday(input.data)) === "completa" ? "completa" : "simplificada"));
    await admin.from("auditor_days_off").delete().eq("data", input.data);
    const { error } = await admin.from("schedule_days").insert({ data: input.data, unit_id: u.id, tipo, status: "prevista", auditor_id: await activeAuditorId(admin) });
    if (error) throw error;
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `Visita incluída: ${u.nome} em ${formatDatePT(input.data)}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Remove de uma vez os dias passados do mês sem auditoria (previstos ou "não cumprida"). */
export async function clearMissedDays(mesInput: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const mes = monthStart(mesInput);
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("schedule_days")
      .select("id, data")
      .gte("data", mes)
      .lte("data", monthEnd(mes))
      .lt("data", todaySP())
      .in("status", ["prevista", "nao_cumprida"])
      .is("audit_id", null);
    const list = (rows ?? []) as { id: string; data: string }[];
    if (list.length === 0) return { ok: true, message: "Nenhum dia não cumprido sem auditoria para remover." };
    const datas = Array.from(new Set(list.map((r) => r.data)));
    await admin.from("auditor_days_off").delete().in("data", datas);
    const { error: offErr } = await admin.from("auditor_days_off").insert(datas.map((data) => ({ data, auditor_id: null, motivo: SEM_VISITA, criado_por: profile.id })));
    if (offErr) throw offErr;
    const { error } = await admin.from("schedule_days").delete().in("id", list.map((r) => r.id));
    if (error) throw error;
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: `${list.length} dia${list.length === 1 ? "" : "s"} removido${list.length === 1 ? "" : "s"} da rotina.` };
  } catch (e) {
    return fail(e);
  }
}

/** Remove uma folga registrada e devolve o dia à rotação. */
export async function removeDayOff(data: string): Promise<ActionResult> {
  try {
    await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const { error } = await admin.from("auditor_days_off").delete().eq("data", data);
    if (error) throw error;
    await ensureSchedule(admin, data, data);
    revalidateDashboard();
    revalidatePath("/auditor", "layout");
    return { ok: true, message: "Folga removida; o dia voltou para a rotação." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Fechamento
// ---------------------------------------------------------------------------

async function assertOpen(admin: ReturnType<typeof createAdminClient>, mes: string) {
  const closings = await getClosings(admin, mes);
  if (closings.length > 0) throw new Error("O mês está fechado. Reabra o mês para alterar.");
}

export interface IndicatorInput {
  unitId: string;
  nota_99food: number | null;
  cancelamentos: number | null;
  tempo_medio_entrega: number | null;
}

/** Lança/atualiza os indicadores 99Food do mês (uma linha por loja). */
export async function saveExternalIndicators(mesInput: string, rows: IndicatorInput[]): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const mes = monthStart(mesInput);
    const admin = createAdminClient();
    await assertOpen(admin, mes);
    for (const r of rows) {
      if (r.nota_99food != null && (r.nota_99food < 0 || r.nota_99food > 5)) return { ok: false, error: "Nota 99Food deve estar entre 0 e 5." };
      if (r.cancelamentos != null && (r.cancelamentos < 0 || !Number.isInteger(r.cancelamentos))) return { ok: false, error: "Cancelamentos deve ser um inteiro ≥ 0." };
      if (r.tempo_medio_entrega != null && r.tempo_medio_entrega < 0) return { ok: false, error: "Tempo médio deve ser ≥ 0." };
    }
    const payload = rows.map((r) => ({
      mes,
      unit_id: r.unitId,
      nota_99food: r.nota_99food,
      cancelamentos: r.cancelamentos,
      tempo_medio_entrega: r.tempo_medio_entrega,
      lancado_por: profile.id,
      updated_at: new Date().toISOString(),
    }));
    if (payload.length) {
      const { error } = await admin.from("external_indicators").upsert(payload, { onConflict: "mes,unit_id" });
      if (error) throw error;
    }
    revalidateDashboard();
    return { ok: true, message: "Indicadores salvos." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Ajuste do proprietário na componente pontualidade/escala (Control iD):
 * grava a trilha em owner_adjustments, altera a resposta e recalcula a nota da auditoria.
 */
export async function adjustPontualidade(input: { auditId: string; answerId: string; novaNota: number; justificativa: string }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const justificativa = input.justificativa.trim();
    if (!justificativa) return { ok: false, error: "A justificativa é obrigatória." };
    const novaNota = Number(input.novaNota);
    if (!Number.isInteger(novaNota) || novaNota < 1 || novaNota > 5) return { ok: false, error: "A nota deve ser de 1 a 5." };

    const admin = createAdminClient();
    const { data: auditRow } = await admin.from("audits").select("*").eq("id", input.auditId).maybeSingle();
    if (!auditRow) return { ok: false, error: "Auditoria não encontrada." };
    const audit = { ...(auditRow as Audit), nota_final: auditRow.nota_final == null ? null : Number(auditRow.nota_final) };
    if (audit.status !== "concluida") return { ok: false, error: "Só auditorias concluídas podem ser ajustadas." };
    if (audit.tipo !== "completa" && audit.tipo !== "simplificada") return { ok: false, error: "Ajuste disponível apenas para auditorias completa e simplificada." };
    if (!audit.template_id) return { ok: false, error: "Auditoria sem template." };
    await assertOpen(admin, audit.data);

    const { data: answer } = await admin.from("audit_answers").select("id, audit_id, item_id, nota, na, template_items(chave)").eq("id", input.answerId).maybeSingle();
    if (!answer || answer.audit_id !== audit.id) return { ok: false, error: "Resposta não pertence a esta auditoria." };
    const chave = (answer.template_items as unknown as { chave: string } | null)?.chave;
    if (chave !== "pontualidade") return { ok: false, error: "Só o item de pontualidade/escala pode ser ajustado." };
    const original = answer.na ? null : answer.nota == null ? null : Number(answer.nota);
    if (original === novaNota) return { ok: false, error: "A nova nota é igual à atual." };

    const { error: adjErr } = await admin.from("owner_adjustments").insert({
      audit_id: audit.id,
      answer_id: answer.id,
      criterio: "pontualidade",
      valor_original: original,
      valor_novo: novaNota,
      justificativa,
      user_id: profile.id,
    });
    if (adjErr) throw adjErr;

    const { error: ansErr } = await admin.from("audit_answers").update({ nota: novaNota, na: false }).eq("id", answer.id);
    if (ansErr) throw ansErr;

    // recalcula a nota da auditoria com a única implementação de pontuação (lib/domain/scoring)
    const template = await getTemplateById(admin, audit.template_id);
    if (!template) throw new Error("Template da auditoria não encontrado.");
    const { data: answers } = await admin.from("audit_answers").select("item_id, nota, na, produto_vencido, observacao, audit_photos(id)").eq("audit_id", audit.id).not("item_id", "is", null);
    const scoring: ScoringAnswer[] = ((answers ?? []) as { item_id: string; nota: number | null; na: boolean; produto_vencido: boolean; observacao: string | null; audit_photos: { id: string }[] }[]).map((a) => ({
      item_id: a.item_id,
      nota: a.nota,
      na: a.na,
      produto_vencido: a.produto_vencido,
      observacao: a.observacao,
      fotos: a.audit_photos?.length ?? 0,
    }));
    const result = computeAuditScore(audit.tipo, toScoringBlocks(template), scoring);
    const { error: audErr } = await admin
      .from("audits")
      .update({ nota_final: result.nota_final, notas_blocos: result.notas_blocos, falha_grave: result.falha_grave, produto_vencido: result.produto_vencido })
      .eq("id", audit.id);
    if (audErr) throw audErr;

    revalidateDashboard();
    return { ok: true, message: `Nota ajustada. Nova nota da auditoria: ${result.nota_final ?? "—"}%.` };
  } catch (e) {
    return fail(e);
  }
}

export async function closeMonthAction(mes: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const r = await closeMonth(admin, mes, profile.id);
    revalidateDashboard();
    const premiadas = r.closings.filter((c) => c.premiada).length;
    return {
      ok: true,
      message: `Mês fechado: ${r.closings.length} unidade(s), ${premiadas ? `${premiadas} loja(s) premiada(s)` : "sem loja premiada"}.`,
      warning: r.reportWarning ?? undefined,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function reopenMonthAction(mes: string): Promise<ActionResult> {
  try {
    await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const n = await reopenMonth(admin, mes);
    revalidateDashboard();
    return { ok: true, message: n ? `Mês reaberto (${n} registro(s) removido(s)).` : "O mês já estava aberto." };
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateReportsAction(mes: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const r = await regenerateReports(admin, mes, profile.id);
    revalidateDashboard();
    return { ok: true, message: `Relatórios gerados: ${r.loja} por loja, ${r.consolidado} consolidado.` };
  } catch (e) {
    return fail(e);
  }
}
