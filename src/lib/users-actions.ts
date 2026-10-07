"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { createAdminClient } from "./supabase/admin";
import type { NutriNivel, UserRole } from "./types";

export type UsersResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): UsersResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const ROLES: UserRole[] = ["proprietario", "auditor_geral", "auditor_nutricao"];

export interface UserInput {
  nome: string;
  email: string;
  senha?: string;
  role: UserRole;
  nutri_nivel?: NutriNivel | null;
}

function validate(input: UserInput) {
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 2) throw new Error("Informe o nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (!ROLES.includes(input.role)) throw new Error("Perfil inválido.");
  const nutri_nivel: NutriNivel | null = input.role === "auditor_nutricao" ? (input.nutri_nivel === "chefe" ? "chefe" : "estagiaria") : null;
  return { nome, email, nutri_nivel };
}

/** Proprietário cria um login (e-mail + senha inicial) com perfil e, para nutrição, o nível. */
export async function createUserAction(input: UserInput): Promise<UsersResult> {
  try {
    await requireProfile(["proprietario"]);
    const { nome, email, nutri_nivel } = validate(input);
    const senha = input.senha ?? "";
    if (senha.length < 8) throw new Error("A senha inicial precisa ter pelo menos 8 caracteres.");
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, role: input.role } });
    if (error) throw new Error(error.message.includes("already") ? "Já existe um usuário com este e-mail." : error.message);
    const id = data.user.id;
    // o trigger cria o perfil; garante nome/nível/ativo mesmo assim
    const { error: pErr } = await admin.from("profiles").upsert({ id, nome, email, role: input.role, nutri_nivel, ativo: true }, { onConflict: "id" });
    if (pErr) throw pErr;
    revalidatePath("/admin/usuarios");
    return { ok: true, id, message: `${nome} criado(a). Envie o e-mail e a senha inicial.` };
  } catch (e) {
    return fail(e);
  }
}

/** Edita nome, perfil e nível (não mexe em e-mail/senha). */
export async function updateUserAction(id: string, input: Omit<UserInput, "senha" | "email"> & { email?: string }): Promise<UsersResult> {
  try {
    const me = await requireProfile(["proprietario"]);
    const { nome, nutri_nivel } = validate({ ...input, email: input.email ?? "x@x.io" });
    if (id === me.id && input.role !== "proprietario") throw new Error("Você não pode tirar o seu próprio perfil de proprietário.");
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ nome, role: input.role, nutri_nivel }).eq("id", id);
    if (error) throw error;
    await admin.auth.admin.updateUserById(id, { user_metadata: { nome, role: input.role } });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário atualizado." };
  } catch (e) {
    return fail(e);
  }
}

/** Desativa/reativa: bloqueia o login no Auth e marca o perfil. */
export async function setUserActiveAction(id: string, ativo: boolean): Promise<UsersResult> {
  try {
    const me = await requireProfile(["proprietario"]);
    if (id === me.id && !ativo) throw new Error("Você não pode desativar o seu próprio acesso.");
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ ativo }).eq("id", id);
    if (error) throw error;
    const { error: aErr } = await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" });
    if (aErr) throw aErr;
    revalidatePath("/admin/usuarios");
    return { ok: true, message: ativo ? "Acesso reativado." : "Acesso desativado." };
  } catch (e) {
    return fail(e);
  }
}

/** Define uma nova senha para o usuário (o proprietário informa ao colaborador). */
export async function resetPasswordAction(id: string, senha: string): Promise<UsersResult> {
  try {
    await requireProfile(["proprietario"]);
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (error) throw error;
    return { ok: true, message: "Senha redefinida." };
  } catch (e) {
    return fail(e);
  }
}
