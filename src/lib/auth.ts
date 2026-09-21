import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, UserRole } from "./types";

export type SessionProfile = Profile;

/** Perfil do usuário logado (null se não autenticado). */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) console.error("[auth] getUser", userError.message);
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) console.error("[auth] profiles", error.message, error.code, error.details);
  if (!data) return null;
  return data as SessionProfile;
}

/** Exige login; opcionalmente exige um dos papéis. Redireciona se não atender. */
export async function requireProfile(roles?: UserRole[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (roles && !roles.includes(profile.role)) redirect(homeForRole(profile.role));
  return profile;
}

export function homeForRole(role: UserRole): string {
  switch (role) {
    case "auditor_geral":
      return "/auditor";
    case "auditor_nutricao":
      return "/nutri";
    case "proprietario":
      return "/dashboard";
  }
}
