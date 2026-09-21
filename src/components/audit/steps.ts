import type { ScoringBlock, ScoringItem } from "@/lib/domain/scoring";
import type { AuditType } from "@/lib/types";

/** Etapa do preenchimento: a de pendências (sempre a primeira) ou um bloco pontuado. */
export interface FillStep {
  index: number;
  kind: "pendencias" | "bloco";
  chave: string;
  titulo: string;
  descricao?: string;
  items: ScoringItem[];
}

/**
 * Monta as etapas a partir dos blocos do template.
 * Completa: etapa 0 = pendências (bloco peso 0) + um bloco por etapa.
 * Simplificada/Produção: etapa 0 = pendências (com o item "pendências" pontuado) + o bloco único sem esse item.
 */
export function buildSteps(tipo: AuditType, blocks: ScoringBlock[]): FillStep[] {
  const sorted = blocks.slice().sort((a, b) => a.ordem - b.ordem);
  const pendItems = sorted.flatMap((b) => b.items.filter((i) => i.pendencias));
  const steps: FillStep[] = [
    {
      index: 0,
      kind: "pendencias",
      chave: "pendencias",
      titulo: "Pendências da visita anterior",
      descricao: "Itens com nota 1–2 na última visita a esta unidade. Marque cada um como resolvido ou mantido.",
      items: pendItems,
    },
  ];
  for (const b of sorted) {
    const items = b.items.filter((i) => !i.pendencias);
    if (items.length === 0) continue;
    if (tipo === "completa" && Number(b.peso) <= 0) continue;
    steps.push({
      index: steps.length,
      kind: "bloco",
      chave: b.chave,
      titulo: b.nome,
      descricao: b.chave === "seguranca" || items.some((i) => i.falha_grave) ? "Itens ⚠ são falha grave: nota 1 em qualquer um zera o bloco e limita a nota do dia a 50%." : undefined,
      items,
    });
  }
  return steps;
}

/** Índice da etapa em que um item aparece. */
export function stepForItem(steps: FillStep[], itemId: string): number {
  const s = steps.find((st) => st.items.some((i) => i.id === itemId));
  return s ? s.index : 0;
}
