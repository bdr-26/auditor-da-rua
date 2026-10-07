"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isNutriChefe, requireProfile, type SessionProfile } from "./auth";
import { getEquipamentos } from "./data/nutri-equipamentos";
import { dadosIniciais, getControleTipo, parseDados, resumirControle, type ControleDados } from "./nutri/controle-tipos";
import { createAdminClient } from "./supabase/admin";
import type { NutriControle } from "./types";

export type ControleResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): ControleResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function revalidate(id?: string) {
  revalidatePath("/nutri", "layout");
  if (id) revalidatePath(`/nutri/controles/${id}`);
}

function canEdit(profile: SessionProfile, c: NutriControle): boolean {
  if (profile.role === "proprietario" || isNutriChefe(profile)) return true;
  return c.responsavel_id === profile.id && c.status === "rascunho";
}

/** Cria um controle em rascunho (linhas fixas prontas) e abre o preenchimento. */
export async function createControle(input: { tipo: string; unitId: string; data: string }): Promise<ControleResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao"]);
    const tipo = getControleTipo(input.tipo);
    if (!tipo) throw new Error("Tipo de controle inválido.");
    if (!input.unitId) throw new Error("Escolha a unidade.");
    if (!YMD.test(input.data)) throw new Error("Data inválida.");
    const admin = createAdminClient();
    const dados = dadosIniciais(tipo);
    // temperatura/manutenção: linhas vêm do cadastro de equipamentos da unidade (planilha de equipamentos)
    if (tipo.inventario === "equipamentos") {
      const equip = await getEquipamentos(admin, input.unitId);
      if (equip.length > 0) dados.linhas = equip.map((e) => ({ nome: e.nome, tipo_equip: e.tipo, local: e.area ?? "" }));
    }
    const { data, error } = await admin
      .from("nutri_controles")
      .insert({ tipo: tipo.codigo, unit_id: input.unitId, data: input.data, responsavel_id: profile.id, status: "rascunho", dados })
      .select("id")
      .single();
    if (error) throw error;
    revalidate();
    return { ok: true, id: data.id as string };
  } catch (e) {
    return fail(e);
  }
}

export async function createControleAndGo(input: { tipo: string; unitId: string; data: string }): Promise<ControleResult> {
  const r = await createControle(input);
  if (r.ok && r.id) redirect(`/nutri/controles/${r.id}`);
  return r;
}

/** Salva o preenchimento (rascunho ou, para a chefe, um finalizado). */
export async function saveControle(id: string, input: { dados: ControleDados; observacoes?: string; data?: string }): Promise<ControleResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    const admin = createAdminClient();
    const { data: row } = await admin.from("nutri_controles").select("*").eq("id", id).maybeSingle();
    if (!row) throw new Error("Controle não encontrado.");
    const c = row as NutriControle;
    if (!canEdit(profile, c)) throw new Error(c.status === "finalizado" ? "Controle finalizado: só a nutricionista chefe pode editar." : "Sem permissão.");
    const tipo = getControleTipo(c.tipo);
    if (!tipo) throw new Error("Tipo de controle inválido.");
    const dados = parseDados(input.dados, tipo);
    // limita campos ao que o tipo conhece e descarta linhas vazias sem nome
    const keys = new Set(tipo.campos.map((k) => k.key));
    const hkeys = new Set(tipo.cabecalho.map((k) => k.key));
    const limpo: ControleDados = {
      cabecalho: Object.fromEntries(Object.entries(dados.cabecalho).filter(([k]) => hkeys.has(k))),
      linhas: dados.linhas
        .map((l) => ({ ...Object.fromEntries(Object.entries(l).filter(([k]) => keys.has(k))), nome: String(l.nome ?? "").slice(0, 120) }) as ControleDados["linhas"][number])
        .filter((l) => l.nome.trim() !== "" || tipo.campos.some((k) => l[k.key] != null && l[k.key] !== "")),
    };
    const patch: Record<string, unknown> = { dados: limpo, observacoes: input.observacoes?.trim() || null };
    if (input.data && YMD.test(input.data)) patch.data = input.data;
    const { error } = await admin.from("nutri_controles").update(patch).eq("id", id);
    if (error) throw error;
    revalidate(id);
    return { ok: true, message: "Salvo." };
  } catch (e) {
    return fail(e);
  }
}

/** Finaliza: exige obrigatórios preenchidos e ao menos uma linha com valor. */
export async function finalizeControle(id: string, input: { dados: ControleDados; observacoes?: string; data?: string }): Promise<ControleResult> {
  try {
    const saved = await saveControle(id, input);
    if (!saved.ok) return saved;
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    const admin = createAdminClient();
    const { data: row } = await admin.from("nutri_controles").select("*").eq("id", id).maybeSingle();
    const c = row as NutriControle;
    const tipo = getControleTipo(c.tipo)!;
    const resumo = resumirControle(tipo, parseDados(c.dados, tipo));
    if (resumo.linhasPreenchidas === 0) throw new Error("Preencha ao menos uma linha antes de finalizar.");
    if (resumo.faltando.length > 0) throw new Error(`Faltam campos obrigatórios: ${resumo.faltando.slice(0, 3).join("; ")}${resumo.faltando.length > 3 ? "…" : ""}`);
    const { error } = await admin.from("nutri_controles").update({ status: "finalizado", finalizado_em: new Date().toISOString(), finalizado_por: profile.id }).eq("id", id);
    if (error) throw error;
    revalidate(id);
    return { ok: true, message: "Controle finalizado." };
  } catch (e) {
    return fail(e);
  }
}

/** Chefe reabre um controle finalizado para correção. */
export async function reopenControle(id: string): Promise<ControleResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe reabre controles.");
    const admin = createAdminClient();
    const { error } = await admin.from("nutri_controles").update({ status: "rascunho", finalizado_em: null, finalizado_por: null }).eq("id", id);
    if (error) throw error;
    revalidate(id);
    return { ok: true, message: "Controle reaberto como rascunho." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteControle(id: string): Promise<ControleResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    const admin = createAdminClient();
    const { data: row } = await admin.from("nutri_controles").select("*").eq("id", id).maybeSingle();
    if (!row) throw new Error("Controle não encontrado.");
    const c = row as NutriControle;
    const chefe = profile.role === "proprietario" || isNutriChefe(profile);
    if (!chefe && !(c.responsavel_id === profile.id && c.status === "rascunho")) throw new Error("Só rascunhos seus podem ser excluídos.");
    // registro finalizado é histórico (fiscalização): para corrigir, a chefe reabre e salva; não se apaga
    if (c.status === "finalizado") throw new Error("Controle finalizado faz parte do arquivo e não pode ser excluído. Reabra para corrigir.");
    const { error } = await admin.from("nutri_controles").delete().eq("id", id);
    if (error) throw error;
    revalidate();
    redirect("/nutri/controles");
  } catch (e) {
    return fail(e);
  }
}
