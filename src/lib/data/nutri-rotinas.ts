import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutriRotina } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Rotina padrão da nutrição (RLS: estagiária vê as suas; chefe e proprietários veem todas). */
export async function getNutriRotinas(supabase: AnyClient, opts: { ativas?: boolean } = {}): Promise<NutriRotina[]> {
  let q = supabase.from("nutri_rotinas").select("*").order("created_at");
  if (opts.ativas) q = q.eq("ativa", true);
  const { data } = await q;
  return ((data ?? []) as NutriRotina[]).map((r) => ({ ...r, dias_semana: (r.dias_semana ?? []).map(Number), dia_mes: r.dia_mes == null ? null : Number(r.dia_mes) }));
}

export const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "ter a dom", "qua", "todo dia 10"… */
export function descreverFrequencia(r: Pick<NutriRotina, "frequencia" | "dias_semana" | "dia_mes">): string {
  if (r.frequencia === "mensal") return `todo dia ${r.dia_mes ?? "—"}`;
  const dias = Array.from(new Set(r.dias_semana)).sort((a, b) => a - b);
  if (dias.length === 7) return "todos os dias";
  if (dias.length === 6 && !dias.includes(1)) return "ter a dom";
  return dias.map((d) => DIAS_SEMANA_CURTO[d] ?? "?").join(", ");
}
