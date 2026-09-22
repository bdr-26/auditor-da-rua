import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditorDayOff } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Folgas registradas no intervalo [from, to] (todas as de auditor_id null + as do auditor informado). */
export async function getDaysOff(supabase: AnyClient, from: string, to: string, auditorId?: string | null): Promise<AuditorDayOff[]> {
  let q = supabase.from("auditor_days_off").select("*").gte("data", from).lte("data", to).order("data");
  if (auditorId) q = q.or(`auditor_id.is.null,auditor_id.eq.${auditorId}`);
  const { data } = await q;
  return (data ?? []) as AuditorDayOff[];
}

export function isDayOff(daysOff: { data: string }[], ymd: string): boolean {
  return daysOff.some((d) => d.data === ymd);
}
