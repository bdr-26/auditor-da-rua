import { GRAVE_FAILURE_CAP } from "../constants";
import type { AuditType, BlockScore, Score } from "../types";

/** Item do template com o mínimo necessário para pontuar. */
export interface ScoringItem {
  id: string;
  chave: string;
  descricao: string;
  falha_grave: boolean;
  produto_vencido: boolean;
  pendencias: boolean;
  bloco_ref: string | null;
  ordem: number;
}

export interface ScoringBlock {
  chave: string;
  nome: string;
  peso: number;
  ordem: number;
  items: ScoringItem[];
}

export interface ScoringAnswer {
  item_id: string;
  nota: Score | number | null;
  na: boolean;
  produto_vencido?: boolean;
  observacao?: string | null;
  fotos?: number;
}

export interface AuditScoreResult {
  nota_final: number | null;
  notas_blocos: BlockScore[];
  falha_grave: boolean;
  produto_vencido: boolean;
  /** ids dos itens ⚠ com nota 1 */
  itens_falha_grave: string[];
  respondidos: number;
  total: number;
  /** ids dos itens sem resposta (nem nota nem N/A) */
  faltando: string[];
  /** ids dos itens com nota 1–2 sem foto */
  sem_foto: string[];
  /** ids dos itens com nota 1–2 sem observação */
  sem_observacao: string[];
  /** nota antes do teto de falha grave (para transparência) */
  nota_sem_teto: number | null;
}

/** Converte nota 1–5 em % (1 → 0, 5 → 100). */
export function scoreToPct(nota: number): number {
  return ((nota - 1) / 4) * 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula a nota de uma auditoria do gerente (completa, simplificada ou produção).
 *
 * Completa: nota do bloco = média dos itens aplicáveis em %; bloco com item ⚠ nota 1 é zerado;
 *           nota final = média ponderada dos blocos (peso > 0); falha grave limita a 50%.
 * Simplificada/Produção: média simples dos itens aplicáveis em %; com falha grave os itens ⚠
 *           contam 0% e a nota fica limitada a 50%. notas_blocos traz a decomposição por
 *           bloco de referência (informativa, peso 0) para o histórico por critério.
 */
export function computeAuditScore(tipo: AuditType, blocks: ScoringBlock[], answers: ScoringAnswer[]): AuditScoreResult {
  const byItem = new Map(answers.map((a) => [a.item_id, a]));
  const allItems = blocks.flatMap((b) => b.items);

  const faltando: string[] = [];
  const sem_foto: string[] = [];
  const sem_observacao: string[] = [];
  const itens_falha_grave: string[] = [];
  let produto_vencido = false;
  let respondidos = 0;

  for (const item of allItems) {
    const a = byItem.get(item.id);
    const answered = !!a && (a.na || (a.nota != null && a.nota >= 1 && a.nota <= 5));
    if (!answered) {
      faltando.push(item.id);
      continue;
    }
    respondidos++;
    if (a!.na) continue;
    const nota = Number(a!.nota);
    if (nota <= 2) {
      if (!a!.fotos || a!.fotos < 1) sem_foto.push(item.id);
      if (!a!.observacao || a!.observacao.trim().length === 0) sem_observacao.push(item.id);
    }
    if (item.falha_grave && nota === 1) itens_falha_grave.push(item.id);
    if (item.produto_vencido && nota === 1 && a!.produto_vencido) produto_vencido = true;
  }

  const falha_grave = itens_falha_grave.length > 0;

  const itemPct = (item: ScoringItem): number | null => {
    const a = byItem.get(item.id);
    if (!a || a.na || a.nota == null) return null;
    // simplificada/produção: com falha grave, todos os itens ⚠ contam 0%
    if (tipo !== "completa" && falha_grave && item.falha_grave) return 0;
    return scoreToPct(Number(a.nota));
  };

  let notas_blocos: BlockScore[] = [];
  let nota_sem_teto: number | null = null;

  if (tipo === "completa") {
    notas_blocos = blocks
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((b) => {
        const pcts = b.items.map(itemPct).filter((v): v is number => v != null);
        const zerado = b.items.some((it) => itens_falha_grave.includes(it.id));
        const m = mean(pcts);
        return {
          chave: b.chave,
          nome: b.nome,
          peso: Number(b.peso),
          nota: m == null ? null : zerado ? 0 : round2(m),
          zerado,
          itens_respondidos: b.items.filter((it) => byItem.get(it.id) && !faltando.includes(it.id)).length,
          itens_aplicaveis: pcts.length,
        };
      });
    const weighted = notas_blocos.filter((b) => b.peso > 0 && b.nota != null);
    const totalPeso = weighted.reduce((s, b) => s + b.peso, 0);
    nota_sem_teto = totalPeso > 0 ? weighted.reduce((s, b) => s + b.nota! * b.peso, 0) / totalPeso : null;
  } else {
    const pcts = allItems.map(itemPct).filter((v): v is number => v != null);
    nota_sem_teto = mean(pcts);
    // decomposição informativa por bloco de referência
    const groups = new Map<string, { nome: string; pcts: number[]; zerado: boolean; respondidos: number }>();
    for (const b of blocks) {
      for (const it of b.items) {
        const key = it.pendencias ? "pendencias" : it.bloco_ref ?? b.chave;
        const nome = it.pendencias ? "Pendências" : it.bloco_ref ? BLOCK_NAMES[it.bloco_ref] ?? it.bloco_ref : b.nome;
        const g = groups.get(key) ?? { nome, pcts: [], zerado: false, respondidos: 0 };
        const p = itemPct(it);
        if (p != null) g.pcts.push(p);
        if (itens_falha_grave.includes(it.id)) g.zerado = true;
        if (!faltando.includes(it.id)) g.respondidos++;
        groups.set(key, g);
      }
    }
    notas_blocos = Array.from(groups.entries()).map(([chave, g]) => {
      const m = mean(g.pcts);
      return {
        chave,
        nome: g.nome,
        peso: 0,
        nota: m == null ? null : round2(m),
        zerado: g.zerado,
        itens_respondidos: g.respondidos,
        itens_aplicaveis: g.pcts.length,
      };
    });
  }

  let nota_final = nota_sem_teto == null ? null : round2(nota_sem_teto);
  if (nota_final != null && falha_grave) nota_final = Math.min(nota_final, GRAVE_FAILURE_CAP);

  return {
    nota_final,
    notas_blocos,
    falha_grave,
    produto_vencido,
    itens_falha_grave,
    respondidos,
    total: allItems.length,
    faltando,
    sem_foto,
    sem_observacao,
    nota_sem_teto: nota_sem_teto == null ? null : round2(nota_sem_teto),
  };
}

export const BLOCK_NAMES: Record<string, string> = {
  seguranca: "Segurança Alimentar",
  operacao: "Operação e Produto",
  limpeza: "Limpeza e Estrutura",
  atendimento: "Atendimento e Delivery",
  equipe: "Equipe e Gestão",
  pendencias: "Pendências",
  producao: "Cozinha central",
  geral: "Checklist do dia",
};

/** Ordem canônica dos 5 blocos da auditoria completa. */
export const MAIN_BLOCKS = ["seguranca", "operacao", "limpeza", "atendimento", "equipe"] as const;

/** A auditoria pode ser concluída? Retorna a lista de bloqueios (vazia = pode). */
export function concludeBlockers(result: AuditScoreResult): string[] {
  const problems: string[] = [];
  if (result.faltando.length > 0) problems.push(`${result.faltando.length} item(ns) sem resposta`);
  if (result.sem_foto.length > 0) problems.push(`${result.sem_foto.length} item(ns) com nota 1–2 sem foto`);
  if (result.sem_observacao.length > 0) problems.push(`${result.sem_observacao.length} item(ns) com nota 1–2 sem observação`);
  return problems;
}

/** Cor semântica para uma nota em % (semáforo consistente no app). */
export function pctTone(pct: number | null | undefined): "green" | "yellow" | "orange" | "red" | "gray" {
  if (pct == null) return "gray";
  if (pct >= 75) return "green";
  if (pct >= 50) return "yellow";
  if (pct >= 25) return "orange";
  return "red";
}
