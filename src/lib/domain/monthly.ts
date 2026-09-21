import { AUDIT_WEIGHTS, ELIGIBILITY_MIN, REDUCED_SAMPLE_MIN } from "../constants";
import type { AuditType, BlockScore } from "../types";
import { MAIN_BLOCKS, round2 } from "./scoring";

export interface MonthlyAuditInput {
  id: string;
  tipo: AuditType;
  data: string;
  nota_final: number | null;
  falha_grave: boolean;
  produto_vencido: boolean;
  notas_blocos: BlockScore[] | null;
}

export interface MonthlySummary {
  nota: number | null;
  n_auditorias: number;
  n_completas: number;
  n_simplificadas: number;
  amostra_reduzida: boolean;
  falhas_graves: number;
  produto_vencido: boolean;
  nota_seguranca: number | null;
  notas_blocos: BlockScore[];
}

/**
 * Nota mensal operacional = Σ(nota × peso) ÷ Σ(pesos), completa ×2, simplificada ×1.
 * Só auditorias concluídas com nota entram; dia não cumprido não penaliza.
 */
export function computeMonthlyOperational(audits: MonthlyAuditInput[], weights = AUDIT_WEIGHTS): MonthlySummary {
  const valid = audits.filter((a) => a.nota_final != null && a.tipo !== "nutricional");
  let sum = 0;
  let wsum = 0;
  for (const a of valid) {
    const w = weights[a.tipo as keyof typeof weights] ?? 1;
    sum += a.nota_final! * w;
    wsum += w;
  }
  const blockAgg = new Map<string, { nome: string; vals: number[]; zerados: number }>();
  for (const a of valid) {
    for (const b of a.notas_blocos ?? []) {
      if (b.nota == null) continue;
      const g = blockAgg.get(b.chave) ?? { nome: b.nome, vals: [], zerados: 0 };
      g.vals.push(b.nota);
      if (b.zerado) g.zerados++;
      blockAgg.set(b.chave, g);
    }
  }
  const notas_blocos: BlockScore[] = (MAIN_BLOCKS as readonly string[]).filter((k) => blockAgg.has(k))
    .concat(Array.from(blockAgg.keys()).filter((k) => !(MAIN_BLOCKS as readonly string[]).includes(k)))
    .map((chave) => {
      const g = blockAgg.get(chave)!;
      return {
        chave,
        nome: g.nome,
        peso: (MAIN_BLOCKS as readonly string[]).includes(chave) ? 20 : 0,
        nota: round2(g.vals.reduce((s, v) => s + v, 0) / g.vals.length),
        zerado: g.zerados > 0,
        itens_respondidos: g.vals.length,
        itens_aplicaveis: g.vals.length,
      };
    });
  const seg = notas_blocos.find((b) => b.chave === "seguranca");
  return {
    nota: wsum > 0 ? round2(sum / wsum) : null,
    n_auditorias: valid.length,
    n_completas: valid.filter((a) => a.tipo === "completa").length,
    n_simplificadas: valid.filter((a) => a.tipo === "simplificada").length,
    amostra_reduzida: valid.length > 0 && valid.length < REDUCED_SAMPLE_MIN,
    falhas_graves: valid.filter((a) => a.falha_grave).length,
    produto_vencido: valid.some((a) => a.produto_vencido),
    nota_seguranca: seg?.nota ?? null,
    notas_blocos,
  };
}

/** Média simples das auditorias nutricionais do mês. */
export function computeMonthlyNutri(notas: (number | null)[]): { nota: number | null; n: number } {
  const v = notas.filter((n): n is number => n != null);
  return { nota: v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null, n: v.length };
}

export interface RankingInput {
  unit_id: string;
  nome: string;
  nota: number | null;
  nota_seguranca: number | null;
  falhas_graves: number;
  produto_vencido: boolean;
  n_auditorias: number;
  amostra_reduzida: boolean;
  entra_no_ranking: boolean;
}

export interface RankingRow extends RankingInput {
  posicao: number | null;
  elegivel: boolean;
  premiada: boolean;
  empate: boolean;
}

/**
 * Ranking mensal: ordena por nota; desempate 1º maior nota em Segurança Alimentar,
 * 2º menor nº de falhas graves; persistindo, empate declarado (prêmio dividido).
 * Elegibilidade: nota ≥ 70% e sem flag de produto vencido. Premiada = 1ª colocada elegível
 * (ou todas as empatadas em 1º que forem elegíveis).
 */
export function rankUnits(rows: RankingInput[], eligibilityMin = ELIGIBILITY_MIN): RankingRow[] {
  const ranked = rows.filter((r) => r.entra_no_ranking && r.nota != null);
  const unranked = rows.filter((r) => !r.entra_no_ranking || r.nota == null);

  const cmp = (a: RankingInput, b: RankingInput) => {
    if (b.nota! !== a.nota!) return b.nota! - a.nota!;
    const sa = a.nota_seguranca ?? -1;
    const sb = b.nota_seguranca ?? -1;
    if (sb !== sa) return sb - sa;
    return a.falhas_graves - b.falhas_graves;
  };
  const tied = (a: RankingInput, b: RankingInput) => cmp(a, b) === 0;

  ranked.sort(cmp);
  const out: RankingRow[] = [];
  let pos = 0;
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    if (i === 0 || !tied(ranked[i - 1], r)) pos = i + 1;
    const empate = (i > 0 && tied(ranked[i - 1], r)) || (i < ranked.length - 1 && tied(ranked[i + 1], r));
    const elegivel = r.nota! >= eligibilityMin && !r.produto_vencido;
    out.push({ ...r, posicao: pos, elegivel, premiada: false, empate });
  }
  // premiação: primeiros colocados (pos 1) elegíveis
  for (const r of out) if (r.posicao === 1 && r.elegivel) r.premiada = true;

  return out.concat(unranked.map((r) => ({ ...r, posicao: null, elegivel: false, premiada: false, empate: false })));
}
