import type { SupabaseClient } from "@supabase/supabase-js";
import { todaySP } from "../dates";
import type { Demanda, DemandaAnexo, DemandaComentario, DemandaStatus, Profile, Unit } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface DemandaListFilter {
  responsavelId?: string;
  status?: DemandaStatus[] | "abertas" | "encerradas";
  limit?: number;
}

/** Demandas ordenadas por prazo (mais urgentes primeiro), depois criação. */
export async function getDemandas(supabase: AnyClient, f: DemandaListFilter = {}): Promise<Demanda[]> {
  let q = supabase.from("demandas").select("*").order("prazo", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (f.responsavelId) q = q.eq("responsavel_id", f.responsavelId);
  if (f.status === "abertas") q = q.in("status", ["aberta", "em_andamento"]);
  else if (f.status === "encerradas") q = q.in("status", ["concluida", "cancelada"]);
  else if (Array.isArray(f.status)) q = q.in("status", f.status);
  if (f.limit) q = q.limit(f.limit);
  const { data } = await q;
  return (data ?? []) as Demanda[];
}

export interface DemandaDetail {
  demanda: Demanda;
  unit: Unit | null;
  comentarios: (DemandaComentario & { autor: string })[];
  anexos: (DemandaAnexo & { url: string | null })[];
  responsavel: Pick<Profile, "id" | "nome"> | null;
  criador: Pick<Profile, "id" | "nome"> | null;
}

export async function getDemanda(supabase: AnyClient, id: string): Promise<DemandaDetail | null> {
  const { data: d } = await supabase.from("demandas").select("*").eq("id", id).maybeSingle();
  if (!d) return null;
  const demanda = d as Demanda;
  const [{ data: unit }, { data: coms }, { data: anexos }, { data: pessoas }] = await Promise.all([
    demanda.unit_id ? supabase.from("units").select("*").eq("id", demanda.unit_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("demanda_comentarios").select("*").eq("demanda_id", id).order("created_at"),
    supabase.from("demanda_anexos").select("*").eq("demanda_id", id).order("created_at"),
    supabase.from("profiles").select("id, nome").in("id", [demanda.responsavel_id, demanda.criado_por]),
  ]);
  const nomes = new Map(((pessoas ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));
  const comIds = Array.from(new Set(((coms ?? []) as DemandaComentario[]).map((c) => c.user_id))).filter((u) => !nomes.has(u));
  if (comIds.length) {
    const { data: mais } = await supabase.from("profiles").select("id, nome").in("id", comIds);
    for (const p of (mais ?? []) as { id: string; nome: string }[]) nomes.set(p.id, p.nome);
  }
  const paths = ((anexos ?? []) as DemandaAnexo[]).map((a) => a.storage_path);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("demandas").createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return {
    demanda,
    unit: (unit as Unit | null) ?? null,
    comentarios: ((coms ?? []) as DemandaComentario[]).map((c) => ({ ...c, autor: nomes.get(c.user_id) ?? "Usuário" })),
    anexos: ((anexos ?? []) as DemandaAnexo[]).map((a) => ({ ...a, url: urls.get(a.storage_path) ?? null })),
    responsavel: nomes.has(demanda.responsavel_id) ? { id: demanda.responsavel_id, nome: nomes.get(demanda.responsavel_id)! } : null,
    criador: nomes.has(demanda.criado_por) ? { id: demanda.criado_por, nome: nomes.get(demanda.criado_por)! } : null,
  };
}

export function isAtrasada(d: Demanda, today = todaySP()): boolean {
  return (d.status === "aberta" || d.status === "em_andamento") && !!d.prazo && d.prazo < today;
}

export function demandaTone(d: Demanda, today = todaySP()): "red" | "orange" | "yellow" | "green" | "gray" {
  if (d.status === "concluida") return "green";
  if (d.status === "cancelada") return "gray";
  if (isAtrasada(d, today)) return "red";
  if (d.prazo && d.prazo <= today) return "orange";
  if (d.prioridade === "alta") return "orange";
  return d.status === "em_andamento" ? "yellow" : "gray";
}
