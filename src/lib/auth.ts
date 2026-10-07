import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile, UserRole } from "./types";

export type SessionProfile = Profile;

/** Perfil do usuário logado (null se não autenticado). Memoizado por requisição: layout + página fazem 1 consulta, não 2. */
export const getSessionProfile = cache(async function getSessionProfile(): Promise<SessionProfile | null> {
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
});

/** Exige login; opcionalmente exige um dos papéis. Redireciona se não atender. */
export async function requireProfile(roles?: UserRole[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.ativo) redirect("/login?inativo=1");
  if (roles && !roles.includes(profile.role)) redirect(homeForRole(profile.role));
  return profile;
}

/** Nutricionista chefe: vê e edita todo o módulo nutricional (auditorias e controles das estagiárias). */
export function isNutriChefe(p: Pick<SessionProfile, "role" | "nutri_nivel">): boolean {
  return p.role === "auditor_nutricao" && p.nutri_nivel === "chefe";
}

/** Pode conduzir/editar uma auditoria: o próprio auditor, a chefe (nutricionais) ou o proprietário. */
export function canManageAudit(p: Pick<SessionProfile, "id" | "role" | "nutri_nivel">, audit: { auditor_id: string; tipo: string }): boolean {
  return audit.auditor_id === p.id || (audit.tipo === "nutricional" && isNutriChefe(p)) || p.role === "proprietario";
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
