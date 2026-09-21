import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringAnswer, ScoringBlock } from "../domain/scoring";
import { getTemplateById, toScoringBlocks, type TemplateWithBlocks } from "./templates";
import type { Audit, AuditPendingReview, AuditType, PendingIssue, ScheduleDay, Unit } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

function normalizeAudit(a: Record<string, unknown>): Audit {
  return { ...(a as unknown as Audit), nota_final: a.nota_final == null ? null : Number(a.nota_final) };
}

/** Linhas da agenda no intervalo (inclusive), em ordem de data. */
export async function getScheduleRange(supabase: AnyClient, from: string, to: string): Promise<ScheduleDay[]> {
  const { data } = await supabase.from("schedule_days").select("*").gte("data", from).lte("data", to).order("data");
  return (data ?? []) as ScheduleDay[];
}

/** Linha da agenda de uma data (prefere a do auditor informado). */
export async function getScheduleDay(supabase: AnyClient, data: string, auditorId?: string): Promise<ScheduleDay | null> {
  const { data: rows } = await supabase.from("schedule_days").select("*").eq("data", data);
  const list = (rows ?? []) as ScheduleDay[];
  if (list.length === 0) return null;
  return list.find((r) => r.auditor_id === auditorId) ?? list[0];
}

/** Últimos N dias de agenda antes de `before` (mais recentes primeiro). */
export async function getRecentScheduleDays(supabase: AnyClient, before: string, limit = 7): Promise<ScheduleDay[]> {
  const { data } = await supabase.from("schedule_days").select("*").lt("data", before).order("data", { ascending: false }).limit(limit);
  return (data ?? []) as ScheduleDay[];
}

export async function getAuditsByIds(supabase: AnyClient, ids: string[]): Promise<Audit[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data } = await supabase.from("audits").select("*").in("id", unique);
  return (data ?? []).map(normalizeAudit);
}

/** Auditorias (qualquer status) de um intervalo de datas — respeita RLS (o auditor vê as próprias). */
export async function getAuditsInRange(supabase: AnyClient, from: string, to: string): Promise<Audit[]> {
  const { data } = await supabase.from("audits").select("*").gte("data", from).lte("data", to).order("data");
  return (data ?? []).map(normalizeAudit);
}

/** Auditoria existente para (unidade, tipo, data), se houver. */
export async function findAudit(supabase: AnyClient, unitId: string, tipo: AuditType, data: string): Promise<Audit | null> {
  const { data: row } = await supabase.from("audits").select("*").eq("unit_id", unitId).eq("tipo", tipo).eq("data", data).maybeSingle();
  return row ? normalizeAudit(row) : null;
}

/** Auditorias de um auditor, mais recentes primeiro. */
export async function getAuditorAudits(supabase: AnyClient, auditorId: string, limit = 200): Promise<Audit[]> {
  const { data } = await supabase
    .from("audits")
    .select("*")
    .eq("auditor_id", auditorId)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeAudit);
}

// ---------- preenchimento ----------

export interface FillPhoto {
  id: string;
  path: string;
}

export interface FillAnswer {
  id: string;
  item_id: string;
  nota: number | null;
  na: boolean;
  produto_vencido: boolean;
  observacao: string | null;
  photos: FillPhoto[];
}

export interface FillPending {
  review_id: string | null;
  pending_issue_id: string;
  resolvida: boolean | null;
  observacao: string | null;
  descricao: string;
  nota_origem: number | null;
  observacao_origem: string | null;
  visitas_sem_resolver: number;
  reincidente: boolean;
  origem_data: string | null;
}

export interface AuditFillData {
  audit: Audit;
  unit: Unit;
  template: TemplateWithBlocks;
  blocks: ScoringBlock[];
  answers: FillAnswer[];
  pendings: FillPending[];
  auditorNome: string;
}

/** Respostas da auditoria com fotos (só itens do gerente). */
export async function getFillAnswers(supabase: AnyClient, auditId: string): Promise<FillAnswer[]> {
  const { data } = await supabase.from("audit_answers").select("id, item_id, nota, na, produto_vencido, observacao, audit_photos(id, storage_path)").eq("audit_id", auditId).not("item_id", "is", null);
  return (data ?? []).map((a) => {
    const row = a as {
      id: string;
      item_id: string;
      nota: number | null;
      na: boolean;
      produto_vencido: boolean;
      observacao: string | null;
      audit_photos: { id: string; storage_path: string }[] | null;
    };
    return {
      id: row.id,
      item_id: row.item_id,
      nota: row.nota == null ? null : Number(row.nota),
      na: !!row.na,
      produto_vencido: !!row.produto_vencido,
      observacao: row.observacao,
      photos: (row.audit_photos ?? []).map((p) => ({ id: p.id, path: p.storage_path })),
    };
  });
}

/** Avaliações de pendências da auditoria, com os dados da pendência. */
export async function getFillPendings(supabase: AnyClient, auditId: string): Promise<FillPending[]> {
  const { data: reviews } = await supabase.from("audit_pending_reviews").select("*").eq("audit_id", auditId).order("updated_at");
  const list = (reviews ?? []) as AuditPendingReview[];
  if (list.length === 0) return [];
  const ids = list.map((r) => r.pending_issue_id);
  const { data: issues } = await supabase.from("pending_issues").select("*").in("id", ids);
  const byId = new Map((issues ?? []).map((i) => [i.id as string, i as PendingIssue]));
  const origemIds = Array.from(new Set((issues ?? []).map((i) => i.origem_audit_id as string)));
  const { data: origens } = origemIds.length ? await supabase.from("audits").select("id, data").in("id", origemIds) : { data: [] };
  const origemData = new Map((origens ?? []).map((o) => [o.id as string, o.data as string]));
  const out: FillPending[] = [];
  for (const r of list) {
    const issue = byId.get(r.pending_issue_id);
    if (!issue) continue;
    out.push({
        review_id: r.id,
        pending_issue_id: r.pending_issue_id,
        resolvida: r.resolvida,
        observacao: r.observacao,
        descricao: issue.descricao,
        nota_origem: issue.nota_origem,
        observacao_origem: issue.observacao_origem,
        visitas_sem_resolver: issue.visitas_sem_resolver,
        reincidente: issue.reincidente,
        origem_data: origemData.get(issue.origem_audit_id) ?? null,
    });
  }
  return out.sort((a, b) => (a.origem_data ?? "").localeCompare(b.origem_data ?? ""));
}

/** Tudo que o fluxo de preenchimento/revisão/resumo precisa de uma auditoria do gerente. */
export async function getAuditFillData(supabase: AnyClient, auditId: string): Promise<AuditFillData | null> {
  const { data: a } = await supabase.from("audits").select("*").eq("id", auditId).maybeSingle();
  if (!a) return null;
  const audit = normalizeAudit(a);
  const [{ data: unit }, template, answers, pendings, { data: auditor }] = await Promise.all([
    supabase.from("units").select("*").eq("id", audit.unit_id).maybeSingle(),
    audit.template_id ? getTemplateById(supabase, audit.template_id) : Promise.resolve(null),
    getFillAnswers(supabase, auditId),
    getFillPendings(supabase, auditId),
    supabase.from("profiles").select("nome").eq("id", audit.auditor_id).maybeSingle(),
  ]);
  if (!unit || !template) return null;
  return {
    audit,
    unit: unit as Unit,
    template,
    blocks: toScoringBlocks(template),
    answers,
    pendings,
    auditorNome: (auditor?.nome as string | undefined) ?? "Auditor",
  };
}

export function toScoringAnswers(answers: FillAnswer[]): ScoringAnswer[] {
  return answers.map((a) => ({
    item_id: a.item_id,
    nota: a.nota,
    na: a.na,
    produto_vencido: a.produto_vencido,
    observacao: a.observacao,
    fotos: a.photos.length,
  }));
}
