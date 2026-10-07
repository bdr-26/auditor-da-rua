"use server";

import { revalidatePath } from "next/cache";
import { isNutriChefe, requireProfile } from "./auth";
import { addDays, todaySP } from "./dates";
import { materializeNutriRotinas } from "./nutri/rotinas-sync";
import { createAdminClient } from "./supabase/admin";
import type { NutriAgendaTipo, NutriRotinaFrequencia } from "./types";

export type RotinaResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): RotinaResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/** Dias à frente que a rotina padrão mantém materializados na agenda. */
const HORIZONTE_DIAS = 30;

function revalidate() {
  revalidatePath("/nutri", "layout");
  revalidatePath("/dashboard", "layout");
}

async function requireChefe() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe define a rotina padrão.");
  return profile;
}

export interface RotinaInput {
  id?: string;
  unitId: string;
  responsavelId: string;
  tipo: NutriAgendaTipo;
  frequencia: NutriRotinaFrequencia;
  diasSemana: number[];
  diaMes: number | null;
  descricao?: string;
}

/** Cria ou altera uma rotina padrão e já gera as tarefas dos próximos dias. */
export async function saveNutriRotina(input: RotinaInput): Promise<RotinaResult> {
  try {
    const profile = await requireChefe();
    if (!input.unitId) throw new Error("Escolha a unidade.");
    if (!input.responsavelId) throw new Error("Escolha a responsável.");
    const dias = Array.from(new Set((input.diasSemana ?? []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
    const diaMes = input.diaMes == null ? null : Number(input.diaMes);
    if (input.frequencia === "semanal" && dias.length === 0) throw new Error("Marque ao menos um dia da semana.");
    if (input.frequencia === "mensal" && (diaMes == null || diaMes < 1 || diaMes > 28)) throw new Error("Informe o dia do mês (1 a 28).");

    const admin = createAdminClient();
    const { data: resp } = await admin.from("profiles").select("id, role, ativo").eq("id", input.responsavelId).maybeSingle();
    if (!resp || resp.role !== "auditor_nutricao" || !resp.ativo) throw new Error("Responsável precisa ser da equipe de nutrição.");
    const row = {
      unit_id: input.unitId,
      responsavel_id: input.responsavelId,
      tipo: input.tipo,
      frequencia: input.frequencia,
      dias_semana: input.frequencia === "semanal" ? dias : [],
      dia_mes: input.frequencia === "mensal" ? diaMes : null,
      descricao: input.descricao?.trim() || null,
      ativa: true,
    };
    let id = input.id;
    if (id) {
      const { error } = await admin.from("nutri_rotinas").update(row).eq("id", id);
      if (error) throw error;
      // tarefas futuras ainda previstas desta rotina são refeitas conforme a nova regra
      await admin.from("nutri_agenda").delete().eq("rotina_id", id).eq("status", "prevista").gte("data", todaySP());
    } else {
      const { data, error } = await admin.from("nutri_rotinas").insert({ ...row, criado_por: profile.id }).select("id").single();
      if (error) throw error;
      id = data.id as string;
    }
    const today = todaySP();
    const r = await materializeNutriRotinas(admin, today, addDays(today, HORIZONTE_DIAS), profile.id);
    revalidate();
    return { ok: true, id, message: `Rotina salva${r.criadas ? ` · ${r.criadas} visita${r.criadas === 1 ? "" : "s"} programada${r.criadas === 1 ? "" : "s"}` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Pausa/reativa a rotina. Pausar remove as tarefas futuras ainda previstas geradas por ela. */
export async function setNutriRotinaAtiva(id: string, ativa: boolean): Promise<RotinaResult> {
  try {
    const profile = await requireChefe();
    const admin = createAdminClient();
    const { error } = await admin.from("nutri_rotinas").update({ ativa }).eq("id", id);
    if (error) throw error;
    const today = todaySP();
    if (!ativa) await admin.from("nutri_agenda").delete().eq("rotina_id", id).eq("status", "prevista").gte("data", today);
    else await materializeNutriRotinas(admin, today, addDays(today, HORIZONTE_DIAS), profile.id);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Exclui a rotina e as tarefas futuras ainda previstas geradas por ela (o histórico fica). */
export async function deleteNutriRotina(id: string): Promise<RotinaResult> {
  try {
    await requireChefe();
    const admin = createAdminClient();
    await admin.from("nutri_agenda").delete().eq("rotina_id", id).eq("status", "prevista").gte("data", todaySP());
    const { error } = await admin.from("nutri_rotinas").delete().eq("id", id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Gera (ou completa) a agenda da rotina padrão para os próximos dias. */
export async function gerarAgendaRotinas(): Promise<RotinaResult> {
  try {
    const profile = await requireChefe();
    const today = todaySP();
    const r = await materializeNutriRotinas(createAdminClient(), today, addDays(today, HORIZONTE_DIAS), profile.id);
    revalidate();
    return { ok: true, message: r.rotinas === 0 ? "Nenhuma rotina ativa." : r.criadas === 0 ? "Agenda já estava completa para os próximos 30 dias." : `${r.criadas} visita${r.criadas === 1 ? "" : "s"} programada${r.criadas === 1 ? "" : "s"}.` };
  } catch (e) {
    return fail(e);
  }
}
