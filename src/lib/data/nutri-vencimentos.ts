import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysBetween, todaySP } from "../dates";
import { CONTROLE_TIPOS, parseDados, type ControleTipo } from "../nutri/controle-tipos";
import type { NutriControle, Unit } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface Vencimento {
  controleId: string;
  unitId: string;
  unidade: string;
  tipo: string; // nome curto do controle
  item: string; // documento / colaborador
  campo: string; // "Vencimento", "ASO válido até"
  data: string; // YYYY-MM-DD
  /** negativo = vencido há N dias; 0 = hoje; positivo = vence em N dias */
  dias: number;
}

/** Tipos de controle que têm campo de vencimento. */
export const TIPOS_COM_VENCIMENTO: ControleTipo[] = CONTROLE_TIPOS.filter((t) => t.campos.some((c) => c.vencimento));

/**
 * Vencidos e vencendo nos próximos `horizonte` dias, lidos do último controle FINALIZADO de cada
 * unidade por tipo (pasta de documentação, enxoval de RH). Um registro mais novo substitui o anterior.
 */
export async function getVencimentos(supabase: AnyClient, units: Unit[], horizonte = 30): Promise<Vencimento[]> {
  if (TIPOS_COM_VENCIMENTO.length === 0) return [];
  const today = todaySP();
  const limite = addDays(today, horizonte);
  const { data } = await supabase
    .from("nutri_controles")
    .select("*")
    .in("tipo", TIPOS_COM_VENCIMENTO.map((t) => t.codigo))
    .eq("status", "finalizado")
    .order("data", { ascending: false })
    .order("finalizado_em", { ascending: false });
  const unitName = new Map(units.filter((u) => u.ativa).map((u) => [u.id, u.nome]));
  const vistos = new Set<string>();
  const out: Vencimento[] = [];
  for (const c of (data ?? []) as NutriControle[]) {
    const key = `${c.unit_id}:${c.tipo}`;
    if (vistos.has(key) || !unitName.has(c.unit_id)) continue;
    vistos.add(key);
    const tipo = TIPOS_COM_VENCIMENTO.find((t) => t.codigo === c.tipo)!;
    const dados = parseDados(c.dados, tipo);
    for (const l of dados.linhas) {
      for (const campo of tipo.campos.filter((x) => x.vencimento)) {
        const v = l[campo.key];
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v > limite) continue;
        if (String(l.situacao ?? "") === "N.A.") continue;
        out.push({ controleId: c.id, unitId: c.unit_id, unidade: unitName.get(c.unit_id)!, tipo: tipo.curto, item: l.nome || "(sem nome)", campo: campo.label, data: v, dias: daysBetween(today, v) });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.unidade.localeCompare(b.unidade));
}
