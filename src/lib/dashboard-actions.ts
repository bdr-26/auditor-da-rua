"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { closeMonth, reopenMonth, regenerateReports } from "./closing";
import { getClosings } from "./data/dashboard";
import { getTemplateById, toScoringBlocks } from "./data/templates";
import { addMonths, monthEnd, monthStart, todaySP, weekday } from "./dates";
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
