"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { todaySP } from "./dates";
import { ensureSchedule } from "./schedule-sync";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings";
import { createAdminClient } from "./supabase/admin";
import type { UnitKind } from "./types";
import { slugify } from "./utils";

export type AdminResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

function fail(e: unknown): AdminResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function revalidateAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/auditor", "layout");
  revalidatePath("/nutri", "layout");
}

export interface UnitInput {
  id?: string;
  nome: string;
  tipo: UnitKind;
  ativa: boolean;
  entra_no_ranking: boolean;
  ordem_rotacao: number | null;
  supervisor_nome: string | null;
  endereco: string | null;
}

/** Cria ou edita uma unidade. Nova loja: slug a partir do nome, ordem = máx + 1, clona o checklist nutricional de Imigrantes. */
export async function saveUnit(input: UnitInput): Promise<AdminResult> {
  try {
    await requireProfile(["proprietario"]);
    const nome = input.nome.trim();
    if (!nome) return { ok: false, error: "Informe o nome da unidade." };
    const admin = createAdminClient();
    const base = {
      nome,
      tipo: input.tipo,
      ativa: input.ativa,
      entra_no_ranking: input.tipo === "producao" ? false : input.entra_no_ranking,
      supervisor_nome: input.supervisor_nome?.trim() || null,
      endereco: input.endereco?.trim() || null,
    };

    if (input.id) {
      const { error } = await admin
        .from("units")
        .update({ ...base, ordem_rotacao: input.ordem_rotacao ?? 0 })
        .eq("id", input.id);
      if (error) throw error;
      revalidateAll();
      return { ok: true, id: input.id, message: "Unidade atualizada." };
    }

    // slug único
    const { data: all } = await admin.from("units").select("slug, ordem_rotacao");
    const slugs = new Set((all ?? []).map((u) => u.slug as string));
    let slug = slugify(nome) || "unidade";
    for (let i = 2; slugs.has(slug); i++) slug = `${slugify(nome)}-${i}`;
    const maxOrdem = Math.max(0, ...(all ?? []).map((u) => Number(u.ordem_rotacao) || 0));
    const ordem = input.ordem_rotacao ?? maxOrdem + 1;

    const { data: created, error } = await admin
      .from("units")
      .insert({ ...base, slug, ordem_rotacao: ordem, nutri_checklist_em_revisao: true })
      .select("id")
      .single();
    if (error) throw error;
    const newId = created.id as string;

    // clona a composição do checklist nutricional de Imigrantes (Anexo C, "em revisão")
    const { data: ref } = await admin.from("units").select("id").eq("slug", "imigrantes").maybeSingle();
    let clonados = 0;
    if (ref) {
      const { data: entries } = await admin.from("unit_nutri_checklist").select("bank_item_id, area, area_ordem, ordem, status").eq("unit_id", ref.id);
      if (entries && entries.length) {
        const { error: cloneErr } = await admin
          .from("unit_nutri_checklist")
          .insert(entries.map((e) => ({ unit_id: newId, bank_item_id: e.bank_item_id, area: e.area, area_ordem: e.area_ordem, ordem: e.ordem, status: e.status })));
        if (cloneErr) throw cloneErr;
        clonados = entries.length;
      }
    }

    revalidateAll();
    return {
      ok: true,
      id: newId,
      message: `Unidade criada (ordem de rotação ${ordem}). Ela entra na rotação nos dias ainda não gerados${clonados ? ` e recebeu ${clonados} itens do checklist nutricional (em revisão)` : ""}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleUnitActive(id: string, ativa: boolean): Promise<AdminResult> {
  try {
    await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const { error } = await admin.from("units").update({ ativa }).eq("id", id);
    if (error) throw error;
    revalidateAll();
    return { ok: true, message: ativa ? "Unidade reativada." : "Unidade desativada." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Apaga os dias FUTUROS ainda previstos e regera a agenda (mês atual + próximo)
 * com a rotação atual. Trocas manuais de dias futuros são perdidas.
 */
export async function regenerateFutureSchedule(): Promise<AdminResult> {
  try {
    await requireProfile(["proprietario"]);
    const admin = createAdminClient();
    const { data: removed, error } = await admin.from("schedule_days").delete().eq("status", "prevista").gt("data", todaySP()).select("id");
    if (error) throw error;
    const n = await ensureSchedule(admin);
    revalidateAll();
    return { ok: true, message: `${removed?.length ?? 0} dia(s) removido(s), ${n} dia(s) gerado(s).` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

const NUMERIC_KEYS: (keyof AppSettings)[] = [
  "premio_valor",
  "elegibilidade_min",
  "amostra_reduzida_min",
  "peso_completa",
  "peso_simplificada",
  "nutri_peso",
  "food99_peso",
  "pendencia_reincidente_visitas",
];
const BOOLEAN_KEYS: (keyof AppSettings)[] = ["nutri_compoe_ranking", "food99_compoe_ranking"];

export async function saveSettings(values: AppSettings): Promise<AdminResult> {
  try {
    await requireProfile(["proprietario"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.rotacao_semana_base)) return { ok: false, error: "Data base da rotação inválida." };
    for (const k of NUMERIC_KEYS) {
      const v = Number(values[k]);
      if (!Number.isFinite(v) || v < 0) return { ok: false, error: `Valor inválido em "${k}".` };
    }
    if (values.elegibilidade_min > 100) return { ok: false, error: "Elegibilidade mínima deve ser ≤ 100%." };
    if (values.peso_completa <= 0 || values.peso_simplificada <= 0) return { ok: false, error: "Os pesos das auditorias devem ser maiores que zero." };

    const admin = createAdminClient();
    const rows = (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]).map((chave) => {
      let valor: unknown = values[chave];
      if (NUMERIC_KEYS.includes(chave)) valor = Number(valor);
      else if (BOOLEAN_KEYS.includes(chave)) valor = Boolean(valor);
      else valor = String(valor);
      return { chave, valor, updated_at: new Date().toISOString() };
    });
    const { error } = await admin.from("app_settings").upsert(rows, { onConflict: "chave" });
    if (error) throw error;
    revalidateAll();
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return fail(e);
  }
}

