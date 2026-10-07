"use server";

import { revalidatePath } from "next/cache";
import { isNutriChefe, requireProfile } from "./auth";
import { TIPOS_EQUIP } from "./nutri/controle-tipos";
import { createAdminClient } from "./supabase/admin";

export type EquipResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): EquipResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

async function requireChefe() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe cadastra equipamentos.");
  return profile;
}

export interface EquipamentoInput {
  id?: string;
  unitId: string;
  nome: string;
  tipo: string;
  area?: string | null;
}

/** Cria ou altera um equipamento da unidade. */
export async function saveEquipamento(input: EquipamentoInput): Promise<EquipResult> {
  try {
    await requireChefe();
    const nome = input.nome.trim();
    if (!input.unitId) throw new Error("Escolha a unidade.");
    if (nome.length < 2) throw new Error("Informe o nome do equipamento (ex.: Geladeira nº 02).");
    if (!TIPOS_EQUIP.includes(input.tipo)) throw new Error("Tipo inválido.");
    const admin = createAdminClient();
    const row = { unit_id: input.unitId, nome, tipo: input.tipo, area: input.area?.trim() || null };
    if (input.id) {
      const { error } = await admin.from("nutri_equipamentos").update(row).eq("id", input.id);
      if (error) throw error;
      revalidatePath("/nutri", "layout");
      return { ok: true, id: input.id };
    }
    const { data: last } = await admin.from("nutri_equipamentos").select("ordem").eq("unit_id", input.unitId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin
      .from("nutri_equipamentos")
      .insert({ ...row, ordem: (Number(last?.ordem) || 0) + 1 })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return fail(e);
  }
}

/** Desativa/reativa (histórico dos controles antigos fica intacto). */
export async function setEquipamentoAtivo(id: string, ativo: boolean): Promise<EquipResult> {
  try {
    await requireChefe();
    const { error } = await createAdminClient().from("nutri_equipamentos").update({ ativo }).eq("id", id);
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEquipamento(id: string): Promise<EquipResult> {
  try {
    await requireChefe();
    const { error } = await createAdminClient().from("nutri_equipamentos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Copia o cadastro de uma unidade para outra (ex.: nova loja igual a Imigrantes). */
export async function copyEquipamentos(fromUnitId: string, toUnitId: string): Promise<EquipResult> {
  try {
    await requireChefe();
    if (!fromUnitId || !toUnitId || fromUnitId === toUnitId) throw new Error("Escolha unidades diferentes.");
    const admin = createAdminClient();
    const { data: src } = await admin.from("nutri_equipamentos").select("nome, tipo, area, ordem").eq("unit_id", fromUnitId).eq("ativo", true).order("ordem");
    if (!src || src.length === 0) throw new Error("A unidade de origem não tem equipamentos cadastrados.");
    const { error } = await admin.from("nutri_equipamentos").insert(src.map((e) => ({ ...e, unit_id: toUnitId })));
    if (error) throw error;
    revalidatePath("/nutri", "layout");
    return { ok: true, message: `${src.length} equipamento${src.length === 1 ? "" : "s"} copiado${src.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return fail(e);
  }
}
