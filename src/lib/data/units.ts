import type { SupabaseClient } from "@supabase/supabase-js";
import type { Unit } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function getUnits(supabase: AnyClient, opts: { ativas?: boolean } = { ativas: true }): Promise<Unit[]> {
  let q = supabase.from("units").select("*").order("tipo").order("ordem_rotacao").order("nome");
  if (opts.ativas) q = q.eq("ativa", true);
  const { data } = await q;
  return (data ?? []) as Unit[];
}

export async function getUnit(supabase: AnyClient, id: string): Promise<Unit | null> {
  const { data } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
  return (data as Unit) ?? null;
}
