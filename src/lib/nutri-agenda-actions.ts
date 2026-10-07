"use server";

import { revalidatePath } from "next/cache";
import { isNutriChefe, requireProfile } from "./auth";
import { formatDatePT } from "./dates";
import { appUrl, sendPushToUsers } from "./push";
import { createAdminClient } from "./supabase/admin";
import type { NutriAgendaItem, NutriAgendaTipo } from "./types";

export type AgendaResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): AgendaResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function revalidate() {
  revalidatePath("/nutri", "layout");
  revalidatePath("/dashboard", "layout");
}

export interface AgendaInput {
  data: string;
  responsavelId: string;
  unitId?: string | null;
  tipo: NutriAgendaTipo;
  descricao?: string;
}

/** Chefe (ou proprietário) programa uma tarefa para alguém da equipe nutri; o responsável recebe push. */
export async function createNutriAgenda(input: AgendaInput): Promise<AgendaResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe programa a agenda.");
    if (!YMD.test(input.data)) throw new Error("Data inválida.");
    if (!input.responsavelId) throw new Error("Escolha a responsável.");
    const admin = createAdminClient();
    const { data: resp } = await admin.from("profiles").select("id, nome, role, ativo").eq("id", input.responsavelId).maybeSingle();
    if (!resp || resp.role !== "auditor_nutricao" || !resp.ativo) throw new Error("Responsável precisa ser da equipe de nutrição.");
    const { data, error } = await admin
      .from("nutri_agenda")
      .insert({ data: input.data, responsavel_id: input.responsavelId, unit_id: input.unitId || null, tipo: input.tipo, descricao: input.descricao?.trim() || null, criado_por: profile.id })
      .select("id")
      .single();
    if (error) throw error;
    if (input.responsavelId !== profile.id) {
      let unidade = "";
      if (input.unitId) {
        const { data: u } = await admin.from("units").select("nome").eq("id", input.unitId).maybeSingle();
        unidade = u?.nome ? ` · ${u.nome}` : "";
      }
      try {
        await sendPushToUsers(admin, [input.responsavelId], "nutri_agenda", `nutri_agenda:${data.id}`, {
          titulo: `Agenda ${formatDatePT(input.data)}${unidade}`,
          corpo: input.descricao?.trim() || (input.tipo === "auditoria" ? "Auditoria nutricional" : input.tipo === "controles" ? "Preencher controles" : "Tarefa"),
          url: appUrl("/nutri/agenda"),
          tag: `nutri-agenda-${data.id}`,
        });
      } catch (e) {
        console.error("[nutri-agenda] push", e);
      }
    }
    revalidate();
    return { ok: true, id: data.id as string };
  } catch (e) {
    return fail(e);
  }
}

/** Responsável ou chefe marca como concluída; chefe cancela/reabre. */
export async function setNutriAgendaStatus(id: string, status: "concluida" | "cancelada" | "prevista"): Promise<AgendaResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    const admin = createAdminClient();
    const { data: item } = await admin.from("nutri_agenda").select("*").eq("id", id).maybeSingle();
    if (!item) throw new Error("Tarefa não encontrada.");
    const it = item as NutriAgendaItem;
    const chefe = profile.role === "proprietario" || isNutriChefe(profile);
    if (!chefe && it.responsavel_id !== profile.id) throw new Error("Sem permissão.");
    if (!chefe && status !== "concluida") throw new Error("Só a chefe cancela ou reabre tarefas.");
    const { error } = await admin.from("nutri_agenda").update({ status, concluida_em: status === "concluida" ? new Date().toISOString() : null }).eq("id", id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNutriAgenda(id: string): Promise<AgendaResult> {
  try {
    const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
    if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) throw new Error("Só a nutricionista chefe exclui tarefas.");
    const admin = createAdminClient();
    const { error } = await admin.from("nutri_agenda").delete().eq("id", id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
