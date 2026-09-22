"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "./auth";
import { formatDatePT } from "./dates";
import { appUrl, ownerIds, sendPushToUsers } from "./push";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Demanda, DemandaStatus } from "./types";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function revalidate(id?: string) {
  revalidatePath("/auditor", "layout");
  revalidatePath("/dashboard/demandas", "layout");
  if (id) {
    revalidatePath(`/auditor/demandas/${id}`);
    revalidatePath(`/dashboard/demandas/${id}`);
  }
}

async function loadDemanda(id: string): Promise<Demanda> {
  const admin = createAdminClient();
  const { data } = await admin.from("demandas").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("Demanda não encontrada.");
  return data as Demanda;
}

async function notify(userIds: string[], tipo: string, chave: string, titulo: string, corpo: string, url: string) {
  try {
    await sendPushToUsers(createAdminClient(), userIds, tipo, chave, { titulo, corpo, url: appUrl(url), tag: chave });
  } catch (e) {
    console.error("[demandas] push falhou", e);
  }
}

export interface DemandaInput {
  titulo: string;
  descricao?: string;
  prazo?: string | null;
  prioridade?: "normal" | "alta";
  unitId?: string | null;
  responsavelId?: string;
}

/** Demanda "pessoal": criada pelo próprio responsável para se organizar (não envolve os proprietários nas notificações). */
const isPessoal = (d: Pick<Demanda, "criado_por" | "responsavel_id">) => d.criado_por === d.responsavel_id;

/** Quem pode editar/cancelar/reabrir: proprietário, ou o gerente nas demandas que ele mesmo criou. */
function canManage(profile: { id: string; role: string }, d: Demanda): boolean {
  return profile.role === "proprietario" || d.criado_por === profile.id;
}

/**
 * Cria uma demanda. Proprietário: para o gerente (responsável padrão: primeiro auditor_geral ativo).
 * Gerente: para si mesmo (demanda pessoal, para se organizar); o responsável é sempre ele.
 */
export async function createDemanda(input: DemandaInput): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario", "auditor_geral"]);
    const titulo = input.titulo.trim();
    if (!titulo) throw new Error("Informe o título.");
    if (input.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(input.prazo)) throw new Error("Prazo inválido.");
    const admin = createAdminClient();
    let responsavelId = profile.role === "auditor_geral" ? profile.id : input.responsavelId;
    if (!responsavelId) {
      const { data: aud } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true).order("created_at").limit(1);
      responsavelId = aud?.[0]?.id as string | undefined;
    }
    if (!responsavelId) throw new Error("Nenhum gerente ativo para receber a demanda.");
    const { data, error } = await admin
      .from("demandas")
      .insert({ titulo, descricao: input.descricao?.trim() || null, prazo: input.prazo || null, prioridade: input.prioridade ?? "normal", unit_id: input.unitId || null, responsavel_id: responsavelId, criado_por: profile.id })
      .select("id")
      .single();
    if (error) throw error;
    if (responsavelId !== profile.id) {
      await notify([responsavelId], "demanda_nova", `demanda:${data.id}:nova`, "Nova demanda", `${titulo}${input.prazo ? ` · prazo ${formatDatePT(input.prazo)}` : ""}`, `/auditor/demandas/${data.id}`);
    }
    revalidate(data.id as string);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return fail(e);
  }
}

/** Edita título/descrição/prazo/prioridade/unidade de uma demanda ainda aberta (proprietário, ou gerente na demanda que criou). */
export async function updateDemanda(id: string, input: DemandaInput): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario", "auditor_geral"]);
    const d = await loadDemanda(id);
    if (!canManage(profile, d)) throw new Error("Sem permissão.");
    if (d.status === "concluida" || d.status === "cancelada") throw new Error("Demanda encerrada não pode ser editada.");
    const titulo = input.titulo.trim();
    if (!titulo) throw new Error("Informe o título.");
    const admin = createAdminClient();
    const { error } = await admin
      .from("demandas")
      .update({ titulo, descricao: input.descricao?.trim() || null, prazo: input.prazo || null, prioridade: input.prioridade ?? d.prioridade, unit_id: input.unitId || null })
      .eq("id", id);
    if (error) throw error;
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Gerente (ou proprietário) muda o status corrente: aberta ↔ em andamento. Conclusão e cancelamento têm ações próprias. */
export async function setDemandaStatus(id: string, status: Exclude<DemandaStatus, "concluida" | "cancelada">, comentario?: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["auditor_geral", "proprietario"]);
    const d = await loadDemanda(id);
    if (profile.role !== "proprietario" && d.responsavel_id !== profile.id) throw new Error("Sem permissão.");
    if (d.status === "concluida" || d.status === "cancelada") throw new Error("Demanda encerrada.");
    const admin = createAdminClient();
    const { error } = await admin.from("demandas").update({ status }).eq("id", id);
    if (error) throw error;
    const texto = comentario?.trim() || (status === "em_andamento" ? "Demanda iniciada." : "Demanda reaberta.");
    await admin.from("demanda_comentarios").insert({ demanda_id: id, user_id: profile.id, texto, status_novo: status });
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Comentário/atualização de andamento; notifica a outra parte. */
export async function addDemandaComment(id: string, texto: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["auditor_geral", "proprietario"]);
    const d = await loadDemanda(id);
    if (profile.role !== "proprietario" && d.responsavel_id !== profile.id) throw new Error("Sem permissão.");
    const t = texto.trim();
    if (!t) throw new Error("Escreva o comentário.");
    const admin = createAdminClient();
    const { data, error } = await admin.from("demanda_comentarios").insert({ demanda_id: id, user_id: profile.id, texto: t }).select("id").single();
    if (error) throw error;
    const targets = (profile.role === "proprietario" ? [d.responsavel_id] : isPessoal(d) ? [] : await ownerIds(admin)).filter((u) => u !== profile.id);
    const url = profile.role === "proprietario" ? `/auditor/demandas/${id}` : `/dashboard/demandas/${id}`;
    if (targets.length) await notify(targets, "demanda_comentario", `demanda:${id}:c:${data.id}`, `Comentário em "${d.titulo}"`, `${profile.nome}: ${t.slice(0, 120)}`, url);
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Conclusão: exige o relato do que foi feito. Notifica os proprietários. */
export async function concludeDemanda(id: string, conclusao: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["auditor_geral", "proprietario"]);
    const d = await loadDemanda(id);
    if (profile.role !== "proprietario" && d.responsavel_id !== profile.id) throw new Error("Sem permissão.");
    if (d.status === "concluida") throw new Error("Demanda já concluída.");
    if (d.status === "cancelada") throw new Error("Demanda cancelada.");
    const texto = conclusao.trim();
    if (texto.length < 10) throw new Error("Descreva o que foi feito (mínimo de 10 caracteres).");
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin.from("demandas").update({ status: "concluida", conclusao_texto: texto, concluida_em: now, concluida_por: profile.id }).eq("id", id);
    if (error) throw error;
    await admin.from("demanda_comentarios").insert({ demanda_id: id, user_id: profile.id, texto: `Concluída: ${texto}`, status_novo: "concluida" });
    if (!isPessoal(d)) await notify(await ownerIds(admin), "demanda_concluida", `demanda:${id}:concluida`, `Demanda concluída: ${d.titulo}`, `${profile.nome}: ${texto.slice(0, 120)}`, `/dashboard/demandas/${id}`);
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Cancela (com motivo) uma demanda: proprietário, ou o gerente na demanda que ele mesmo criou. */
export async function cancelDemanda(id: string, motivo: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario", "auditor_geral"]);
    const d = await loadDemanda(id);
    if (!canManage(profile, d)) throw new Error("Sem permissão.");
    const admin = createAdminClient();
    const { error } = await admin.from("demandas").update({ status: "cancelada" }).eq("id", id);
    if (error) throw error;
    await admin.from("demanda_comentarios").insert({ demanda_id: id, user_id: profile.id, texto: `Cancelada: ${motivo.trim() || "sem motivo informado"}`, status_novo: "cancelada" });
    if (d.responsavel_id !== profile.id) {
      await notify([d.responsavel_id], "demanda_cancelada", `demanda:${id}:cancelada`, `Demanda cancelada: ${d.titulo}`, motivo.trim() || "Cancelada pelo proprietário.", `/auditor/demandas/${id}`);
    }
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Reabre uma demanda encerrada: proprietário, ou o gerente na demanda que ele mesmo criou. */
export async function reopenDemanda(id: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["proprietario", "auditor_geral"]);
    const d = await loadDemanda(id);
    if (!canManage(profile, d)) throw new Error("Sem permissão.");
    const admin = createAdminClient();
    const { error } = await admin.from("demandas").update({ status: "aberta", conclusao_texto: null, concluida_em: null, concluida_por: null }).eq("id", id);
    if (error) throw error;
    await admin.from("demanda_comentarios").insert({ demanda_id: id, user_id: profile.id, texto: profile.role === "proprietario" ? "Demanda reaberta pelo proprietário." : "Demanda reaberta.", status_novo: "aberta" });
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Registra um anexo já enviado ao bucket `demandas` pelo navegador. */
export async function registerDemandaAttachment(id: string, file: { path: string; nome: string; mime: string; tamanho: number }): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["auditor_geral", "proprietario"]);
    const d = await loadDemanda(id);
    if (profile.role !== "proprietario" && d.responsavel_id !== profile.id) throw new Error("Sem permissão.");
    if (!file.path.startsWith(`${id}/`)) throw new Error("Caminho inválido.");
    const supabase = await createClient();
    const { error } = await supabase.from("demanda_anexos").insert({ demanda_id: id, storage_path: file.path, nome: file.nome, mime: file.mime, tamanho: file.tamanho, user_id: profile.id });
    if (error) throw error;
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeDemandaAttachment(anexoId: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile(["auditor_geral", "proprietario"]);
    const admin = createAdminClient();
    const { data: a } = await admin.from("demanda_anexos").select("*").eq("id", anexoId).maybeSingle();
    if (!a) throw new Error("Anexo não encontrado.");
    if (profile.role !== "proprietario" && a.user_id !== profile.id) throw new Error("Sem permissão.");
    await admin.storage.from("demandas").remove([a.storage_path as string]);
    await admin.from("demanda_anexos").delete().eq("id", anexoId);
    revalidate(a.demanda_id as string);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Formulário de criação com redirect para a demanda criada (no painel de quem criou). */
export async function createDemandaAndGo(input: DemandaInput): Promise<ActionResult> {
  const r = await createDemanda(input);
  if (r.ok && r.id) {
    const profile = await requireProfile(["proprietario", "auditor_geral"]);
    redirect(profile.role === "auditor_geral" ? `/auditor/demandas/${r.id}` : `/dashboard/demandas/${r.id}`);
  }
  return r;
}
