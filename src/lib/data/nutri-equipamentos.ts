import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutriEquipamento } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Equipamentos cadastrados (ativos por padrão) de uma unidade, na ordem da planilha. */
export async function getEquipamentos(supabase: AnyClient, unitId?: string, opts: { ativos?: boolean } = { ativos: true }): Promise<NutriEquipamento[]> {
  let q = supabase.from("nutri_equipamentos").select("*").order("ordem").order("nome");
  if (unitId) q = q.eq("unit_id", unitId);
  if (opts.ativos) q = q.eq("ativo", true);
  const { data } = await q;
  return (data ?? []) as NutriEquipamento[];
}
