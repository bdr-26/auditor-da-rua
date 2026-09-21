import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSchedule } from "./domain/schedule";
import { addMonths, monthEnd, monthStart, todaySP } from "./dates";
import { getSettings } from "./settings";

/**
 * Garante que a agenda do gerente exista para o intervalo (mês atual + próximo por padrão).
 * Não sobrescreve dias já existentes (trocas manuais e dias concluídos são preservados).
 * Deve ser chamada com o cliente admin (service_role).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureSchedule(admin: SupabaseClient<any, any, any>, from?: string, to?: string): Promise<number> {
  const today = todaySP();
  const start = from ?? monthStart(today);
  const end = to ?? monthEnd(addMonths(today, 1));

  const [{ data: units }, { data: auditors }, settings] = await Promise.all([
    admin.from("units").select("id, nome, tipo, ativa, ordem_rotacao, entra_no_ranking").eq("ativa", true),
    admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true).order("created_at").limit(1),
    getSettings(admin),
  ]);
  const auditorId = auditors?.[0]?.id ?? null;
  const rotation = (units ?? []).filter((u) => u.tipo === "loja" && u.entra_no_ranking);
  const production = (units ?? []).find((u) => u.tipo === "producao") ?? null;

  const planned = generateSchedule(start, end, rotation, production?.id ?? null, settings.rotacao_semana_base);
  if (planned.length === 0) return 0;

  const { data: existing } = await admin.from("schedule_days").select("data").gte("data", start).lte("data", end);
  const have = new Set((existing ?? []).map((e) => e.data as string));
  const rows = planned
    .filter((p) => !have.has(p.data))
    .map((p) => ({ data: p.data, unit_id: p.unit_id, tipo: p.tipo, status: "prevista", auditor_id: auditorId }));
  if (rows.length === 0) return 0;
  const { error } = await admin.from("schedule_days").insert(rows);
  if (error) throw error;
  return rows.length;
}
