import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutriAgendaItem, NutriAgendaStatus } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface NutriAgendaFilter {
  from?: string;
  to?: string;
  responsavelId?: string;
  status?: NutriAgendaStatus[];
  limit?: number;
}

/** Tarefas da agenda nutri no intervalo (RLS: estagiária vê as suas; chefe e proprietários veem todas). */
export async function getNutriAgenda(supabase: AnyClient, f: NutriAgendaFilter = {}): Promise<NutriAgendaItem[]> {
  let q = supabase.from("nutri_agenda").select("*").order("data").order("created_at");
  if (f.from) q = q.gte("data", f.from);
  if (f.to) q = q.lte("data", f.to);
  if (f.responsavelId) q = q.eq("responsavel_id", f.responsavelId);
  if (f.status) q = q.in("status", f.status);
  if (f.limit) q = q.limit(f.limit);
  const { data } = await q;
  return (data ?? []) as NutriAgendaItem[];
}

/** Equipe nutri ativa (chefe e estagiárias). */
export async function getNutriTeam(supabase: AnyClient): Promise<{ id: string; nome: string; nutri_nivel: "chefe" | "estagiaria" | null }[]> {
  const { data } = await supabase.from("profiles").select("id, nome, nutri_nivel").eq("role", "auditor_nutricao").eq("ativo", true).order("nutri_nivel").order("nome");
  return (data ?? []) as { id: string; nome: string; nutri_nivel: "chefe" | "estagiaria" | null }[];
}
