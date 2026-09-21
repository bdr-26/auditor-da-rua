"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function signIn(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "E-mail ou senha inválidos." };

  const { data: profile } = await supabase.from("profiles").select("role, ativo").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.ativo) {
    await supabase.auth.signOut();
    return { error: "Usuário sem acesso. Fale com o proprietário." };
  }
  redirect(next && next.startsWith("/") ? next : homeForRole(profile.role as UserRole));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
