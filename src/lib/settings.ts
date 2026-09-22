import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { AUDIT_WEIGHTS, ELIGIBILITY_MIN, PRIZE_VALUE, RECURRENCE_VISITS, REDUCED_SAMPLE_MIN } from "./constants";

export interface AppSettings {
  rotacao_semana_base: string;
  premio_valor: number;
  elegibilidade_min: number;
  amostra_reduzida_min: number;
  peso_completa: number;
  peso_simplificada: number;
  nutri_compoe_ranking: boolean;
  nutri_peso: number;
  food99_compoe_ranking: boolean;
  food99_peso: number;
  pendencia_reincidente_visitas: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  rotacao_semana_base: "2026-09-22",
  premio_valor: PRIZE_VALUE,
  elegibilidade_min: ELIGIBILITY_MIN,
  amostra_reduzida_min: REDUCED_SAMPLE_MIN,
  peso_completa: AUDIT_WEIGHTS.completa,
  peso_simplificada: AUDIT_WEIGHTS.simplificada,
  nutri_compoe_ranking: false,
  nutri_peso: 0,
  food99_compoe_ranking: false,
  food99_peso: 0,
  pendencia_reincidente_visitas: RECURRENCE_VISITS,
};

/** Memoizado por requisição para o mesmo cliente (React cache). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSettings = cache(async function getSettings(supabase: SupabaseClient<any, any, any>): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("chave, valor");
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) out[row.chave] = row.valor;
  return out as unknown as AppSettings;
});
