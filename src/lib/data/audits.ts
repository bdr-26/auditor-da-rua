import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, monthStart } from "../dates";
import type { Audit, AuditAnswer, AuditPhoto, PendingIssue } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

function normalizeAudit(a: Record<string, unknown>): Audit {
  return { ...(a as unknown as Audit), nota_final: a.nota_final == null ? null : Number(a.nota_final) };
}

/** Auditorias concluídas do mês (YYYY-MM-01), todas as unidades e tipos. */
export async function getMonthAudits(supabase: AnyClient, mes: string, opts: { unitId?: string; status?: "concluida" | "rascunho" | "todas" } = {}): Promise<Audit[]> {
  const start = monthStart(mes);
  const end = addMonths(start, 1);
  let q = supabase.from("audits").select("*").gte("data", start).lt("data", end).order("data", { ascending: false });
  if (opts.unitId) q = q.eq("unit_id", opts.unitId);
  if (opts.status !== "todas") q = q.eq("status", opts.status ?? "concluida");
  const { data } = await q;
  return (data ?? []).map(normalizeAudit);
}

export async function getAudit(supabase: AnyClient, id: string): Promise<Audit | null> {
  const { data } = await supabase.from("audits").select("*").eq("id", id).maybeSingle();
  return data ? normalizeAudit(data) : null;
}

export interface AnswerWithPhotos extends AuditAnswer {
  audit_photos: AuditPhoto[];
}

export async function getAuditAnswers(supabase: AnyClient, auditId: string): Promise<AnswerWithPhotos[]> {
  const { data } = await supabase.from("audit_answers").select("*, audit_photos(*)").eq("audit_id", auditId);
  return (data ?? []).map((a) => ({ ...(a as AnswerWithPhotos), nutri_peso: a.nutri_peso == null ? null : Number(a.nutri_peso) }));
}

/** Pendências em aberto de uma unidade (itens com nota 1–2 / não conforme ainda não resolvidos). */
export async function getOpenPendings(supabase: AnyClient, unitId: string, origem: "gerente" | "nutri" | "todas" = "gerente"): Promise<PendingIssue[]> {
  let q = supabase.from("pending_issues").select("*").eq("unit_id", unitId).eq("status", "aberta").order("created_at");
  if (origem === "gerente") q = q.not("item_id", "is", null);
  if (origem === "nutri") q = q.not("nutri_entry_id", "is", null);
  const { data } = await q;
  return (data ?? []) as PendingIssue[];
}

/** URL assinada de uma foto (bucket privado). */
export async function signedPhotoUrl(supabase: AnyClient, path: string, expiresIn = 60 * 60): Promise<string | null> {
  const { data } = await supabase.storage.from("audit-photos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
