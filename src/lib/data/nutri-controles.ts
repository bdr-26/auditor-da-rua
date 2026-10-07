import type { SupabaseClient } from "@supabase/supabase-js";
import { getControleTipo, parseDados, resumirControle, type ControleResumo } from "../nutri/controle-tipos";
import type { NutriControle, NutriControleStatus } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface ControleFilter {
  unitId?: string;
  tipo?: string;
  responsavelId?: string;
  status?: NutriControleStatus;
  from?: string;
  to?: string;
  limit?: number;
}

export async function getControles(supabase: AnyClient, f: ControleFilter = {}): Promise<NutriControle[]> {
  let q = supabase.from("nutri_controles").select("*").order("data", { ascending: false }).order("created_at", { ascending: false });
  if (f.unitId) q = q.eq("unit_id", f.unitId);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.responsavelId) q = q.eq("responsavel_id", f.responsavelId);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("data", f.from);
  if (f.to) q = q.lte("data", f.to);
  if (f.limit) q = q.limit(f.limit);
  const { data } = await q;
  return (data ?? []) as NutriControle[];
}

export async function getControle(supabase: AnyClient, id: string): Promise<NutriControle | null> {
  const { data } = await supabase.from("nutri_controles").select("*").eq("id", id).maybeSingle();
  return (data as NutriControle) ?? null;
}

/** Resumo de preenchimento (linhas, alertas, faltantes) de um controle já carregado. */
export function controleResumo(c: NutriControle): ControleResumo | null {
  const tipo = getControleTipo(c.tipo);
  if (!tipo) return null;
  return resumirControle(tipo, parseDados(c.dados, tipo));
}
