import "server-only";
import type { SessionProfile } from "./auth";
import { todaySP } from "./dates";
import { createClient } from "./supabase/server";

/**
 * Contadores exibidos na navegação (aba Demandas): gerente vê quantas demandas abertas tem;
 * proprietário vê quantas estão atrasadas. Uma consulta leve por página; falha vira 0.
 */
export async function navBadges(profile: SessionProfile): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    if (profile.role === "auditor_geral") {
      const { count } = await supabase.from("demandas").select("id", { count: "exact", head: true }).eq("responsavel_id", profile.id).in("status", ["aberta", "em_andamento"]);
      return { "/auditor/demandas": count ?? 0 };
    }
    if (profile.role === "proprietario") {
      const { count } = await supabase.from("demandas").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_andamento"]).lt("prazo", todaySP());
      return { "/dashboard/demandas": count ?? 0 };
    }
  } catch (e) {
    console.warn("[nav] contadores indisponíveis", e);
  }
  return {};
}
