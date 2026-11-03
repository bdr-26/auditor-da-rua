// Agrupa as não conformidades da nutrição por item do banco (mesmo item em áreas diferentes conta junto)
// para mostrar o que mais se repete no mês. Módulo puro (testado em vitest).
import type { ReportNutriRecorrente } from "./types";

export interface NutriNcLinha {
  audit_id: string;
  item_id: string | null; // nutri_item_id (banco); null em registros antigos
  item: string;
  area: string;
  corrigido: boolean;
}

const chave = (l: NutriNcLinha) =>
  l.item_id ??
  l.item
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * @param linhas não conformidades do mês (uma por resposta)
 * @param totalVisitas auditorias nutricionais concluídas no mês
 * @param anteriores não conformidades do mês anterior (para "também no mês passado")
 */
export function agruparNutriNc(linhas: NutriNcLinha[], totalVisitas: number, anteriores: NutriNcLinha[] = []): ReportNutriRecorrente[] {
  const ant = new Map<string, number>();
  for (const l of anteriores) ant.set(chave(l), (ant.get(chave(l)) ?? 0) + 1);
  const g = new Map<string, { item: string; areas: Set<string>; visitas: Set<string>; ocorrencias: number; corrigidos: number }>();
  for (const l of linhas) {
    const k = chave(l);
    const cur = g.get(k) ?? { item: l.item, areas: new Set<string>(), visitas: new Set<string>(), ocorrencias: 0, corrigidos: 0 };
    cur.areas.add(l.area);
    cur.visitas.add(l.audit_id);
    cur.ocorrencias++;
    if (l.corrigido) cur.corrigidos++;
    g.set(k, cur);
  }
  return Array.from(g.entries())
    .map(([k, v]) => ({
      item: v.item,
      areas: Array.from(v.areas).sort((a, b) => a.localeCompare(b, "pt-BR")),
      ocorrencias: v.ocorrencias,
      visitas: v.visitas.size,
      total_visitas: totalVisitas,
      corrigidos: v.corrigidos,
      ocorrencias_anterior: ant.get(k) ?? 0,
    }))
    .sort((a, b) => b.visitas - a.visitas || b.ocorrencias - a.ocorrencias || a.item.localeCompare(b.item, "pt-BR"));
}

/** Repete de verdade: em 2+ visitas e em pelo menos metade delas, ou 3+ ocorrências no mês. */
export function nutriRecorrenteCritico(r: ReportNutriRecorrente): boolean {
  return (r.visitas >= 2 && r.total_visitas > 0 && r.visitas / r.total_visitas >= 0.5) || r.ocorrencias >= 3;
}
