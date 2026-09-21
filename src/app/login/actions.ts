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
  if (error || !data.user) {
    console.error("[login] falha", error?.status, error?.message);
    return { error: translateAuthError(error?.message) };
  }

  const { data: profile } = await supabase.from("profiles").select("role, ativo").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.ativo) {
    await supabase.auth.signOut();
    return { error: "Usuário sem acesso. Fale com o proprietário." };
  }
  redirect(next && next.startsWith("/") ? next : homeForRole(profile.role as UserRole));
}

function translateAuthError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha inválidos.";
  if (m.includes("email not confirmed")) return "E-mail ainda não confirmado. Peça ao proprietário para confirmar o usuário.";
  if (m.includes("invalid api key") || m.includes("jwt") || m.includes("apikey"))
    return "Configuração inválida: a chave do Supabase no servidor está errada (NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("network"))
    return "Configuração inválida: não foi possível conectar ao Supabase (NEXT_PUBLIC_SUPABASE_URL).";
  if (m.includes("email logins are disabled") || m.includes("signups not allowed") || m.includes("provider"))
    return "Login por e-mail está desativado no Supabase (Authentication → Providers → Email).";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  return `Falha no login: ${message ?? "erro desconhecido"}`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
