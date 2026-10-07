import type { SupabaseClient } from "@supabase/supabase-js";
import type { Unit } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function getUnits(supabase: AnyClient, opts: { ativas?: boolean; gerente?: boolean } = { ativas: true }): Promise<Unit[]> {
  let q = supabase.from("units").select("*").order("tipo").order("ordem_rotacao").order("nome");
  if (opts.ativas) q = q.eq("ativa", true);
  // `gerente`: só unidades da auditoria do gerente (exclui as "somente nutrição", ex.: Café da Rua)
  if (opts.gerente) q = q.eq("somente_nutri", false);
  const { data } = await q;
  return (data ?? []) as Unit[];
}

/** Unidades que entram na auditoria do gerente (lojas e produção; exclui as "somente nutrição"). */
export function unitsDoGerente<T extends { somente_nutri: boolean }>(units: T[]): T[] {
  return units.filter((u) => !u.somente_nutri);
}

export async function getUnit(supabase: AnyClient, id: string): Promise<Unit | null> {
  const { data } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
  return (data as Unit) ?? null;
}
