"use server";

import { revalidatePath } from "next/cache";
import { isNutriChefe, requireProfile } from "./auth";
import { CATALOGO_LABELS, type CatalogoCategoria } from "./nutri/controle-tipos";
import { createAdminClient } from "./supabase/admin";

export type CatalogoResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): CatalogoResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

async function requireChefe() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe altera os catálogos.");
  return profile;
}

const categoriaValida = (c: string): c is CatalogoCategoria => c in CATALOGO_LABELS;

/** Cria ou altera um item do catálogo. Várias linhas no nome = vários itens de uma vez. */
export async function saveCatalogoItem(input: { id?: string; categoria: string; nome: string; detalhe?: string | null }): Promise<CatalogoResult> {
  try {
    await requireChefe();
    if (!categoriaValida(input.categoria)) throw new Error("Categoria inválida.");
    const admin = createAdminClient();
    const detalhe = input.detalhe?.trim() || null;
    if (input.id) {
      const nome = input.nome.trim();
      if (nome.length < 2) throw new Error("Informe o nome.");
      const { error } = await admin.from("nutri_catalogo").update({ nome, detalhe }).eq("id", input.id);
      if (error) throw error;
      revalidatePath("/nutri", "layout");
      return { ok: true, id: input.id };
    }
    const nomes = Array.from(new Set(input.nome.split(/\n|;/).map((n) => n.trim()).filter((n) => n.length >= 2)));
    if (nomes.length === 0) throw new Error("Informe ao menos um nome.");
    const { data: last } = await admin.from("nutri_catalogo").select("ordem").eq("categoria", input.categoria).order("ordem", { ascending: false }).limit(1).maybeSingle();
    let ordem = Number(last?.ordem) || 0;
    const rows = nomes.map((nome) => ({ categoria: input.categoria, nome, detalhe: nomes.length === 1 ? detalhe : null, ordem: ++ordem, ativo: true }));
    const { error } = await admin.from("nutri_catalogo").upsert(rows, { onConflict: "categoria,nome", ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true, message: nomes.length === 1 ? "Item cadastrado." : `${nomes.length} itens cadastrados.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setCatalogoItemAtivo(id: string, ativo: boolean): Promise<CatalogoResult> {
  try {
    await requireChefe();
    const { error } = await createAdminClient().from("nutri_catalogo").update({ ativo }).eq("id", id);
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCatalogoItem(id: string): Promise<CatalogoResult> {
  try {
    await requireChefe();
    const { error } = await createAdminClient().from("nutri_catalogo").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
