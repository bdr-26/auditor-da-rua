import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogoCategoria } from "../nutri/controle-tipos";
import type { NutriCatalogoItem } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Itens do catálogo (todas as categorias), ativos por padrão. */
export async function getCatalogo(supabase: AnyClient, opts: { ativos?: boolean } = { ativos: true }): Promise<NutriCatalogoItem[]> {
  let q = supabase.from("nutri_catalogo").select("*").order("categoria").order("ordem").order("nome");
  if (opts.ativos) q = q.eq("ativo", true);
  const { data } = await q;
  return (data ?? []) as NutriCatalogoItem[];
}

/** Catálogo agrupado por categoria, no formato que o formulário de controle consome. */
export async function getCatalogosParaForm(supabase: AnyClient): Promise<Partial<Record<CatalogoCategoria, { nome: string; detalhe: string | null }[]>>> {
  const itens = await getCatalogo(supabase);
  const out: Partial<Record<CatalogoCategoria, { nome: string; detalhe: string | null }[]>> = {};
  for (const it of itens) (out[it.categoria] ??= []).push({ nome: it.nome, detalhe: it.detalhe });
  return out;
}
