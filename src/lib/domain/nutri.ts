import { NUTRI_BANDS } from "../constants";
import type { NutriAnswer } from "../types";
import { round2 } from "./scoring";

export interface NutriScoringAnswer {
  entry_id: string;
  area: string;
  peso: number;
  resposta: NutriAnswer | null;
}

export interface NutriAreaLoss {
  area: string;
  perdidos: number; // Σ pesos não conformes
  aplicaveis: number; // Σ pesos aplicáveis
  nota: number | null; // % da área
}

export interface NutriScoreResult {
  nota: number | null;
  classificacao: string | null;
  conformes: number;
  nao_conformes: number;
  na: number;
  faltando: string[];
  perdidos_por_area: NutriAreaLoss[];
}

/** Faixas idênticas ao Food Checker: Excelente 91–100, Satisfatório 80–90, Insatisfatório 50–79, Crítico < 50. */
export function classifyNutri(nota: number | null): string | null {
  if (nota == null) return null;
  const r = Math.round(nota);
  for (const b of NUTRI_BANDS) if (r >= b.min) return b.nome;
  return "Crítico";
}

/** Nota = Σ pesos conformes ÷ Σ pesos aplicáveis × 100 (N/A fora do cálculo). */
export function computeNutriScore(answers: NutriScoringAnswer[]): NutriScoreResult {
  let conf = 0;
  let apl = 0;
  let conformes = 0;
  let nao_conformes = 0;
  let na = 0;
  const faltando: string[] = [];
  const areas = new Map<string, { perdidos: number; aplicaveis: number }>();
  for (const a of answers) {
    if (!a.resposta) {
      faltando.push(a.entry_id);
      continue;
    }
    const g = areas.get(a.area) ?? { perdidos: 0, aplicaveis: 0 };
    if (a.resposta === "na") {
      na++;
    } else {
      apl += a.peso;
      g.aplicaveis += a.peso;
      if (a.resposta === "conforme") {
        conf += a.peso;
        conformes++;
      } else {
        nao_conformes++;
        g.perdidos += a.peso;
      }
    }
    areas.set(a.area, g);
  }
  const nota = apl > 0 ? round2((conf / apl) * 100) : null;
  return {
    nota,
    classificacao: classifyNutri(nota),
    conformes,
    nao_conformes,
    na,
    faltando,
    perdidos_por_area: Array.from(areas.entries()).map(([area, g]) => ({
      area,
      perdidos: g.perdidos,
      aplicaveis: g.aplicaveis,
      nota: g.aplicaveis > 0 ? round2(((g.aplicaveis - g.perdidos) / g.aplicaveis) * 100) : null,
    })),
  };
}

export function nutriBandTone(classificacao: string | null): "green" | "yellow" | "orange" | "red" | "gray" {
  switch (classificacao) {
    case "Excelente":
      return "green";
    case "Satisfatório":
      return "yellow";
    case "Insatisfatório":
      return "orange";
    case "Crítico":
      return "red";
    default:
      return "gray";
  }
}
