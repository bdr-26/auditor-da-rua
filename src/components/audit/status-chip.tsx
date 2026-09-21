import { Badge, type Tone } from "@/components/ui/badge";
import type { Audit, ScheduleDay } from "@/lib/types";

export type DayState = "feito" | "hoje" | "rascunho" | "pendente" | "nao_cumprida";

/** Estado visual de um dia da agenda, combinando a linha da agenda e a auditoria vinculada. */
export function dayState(day: ScheduleDay, audit: Audit | null | undefined, today: string): DayState {
  if (day.status === "concluida" || audit?.status === "concluida") return "feito";
  if (audit?.status === "rascunho") return "rascunho";
  if (day.status === "nao_cumprida") return "nao_cumprida";
  if (day.data === today) return "hoje";
  if (day.data < today) return "nao_cumprida";
  return "pendente";
}

const LABELS: Record<DayState, { label: string; tone: Tone }> = {
  feito: { label: "feito", tone: "green" },
  hoje: { label: "hoje", tone: "brand" },
  rascunho: { label: "rascunho", tone: "yellow" },
  pendente: { label: "pendente", tone: "gray" },
  nao_cumprida: { label: "não cumprida", tone: "red" },
};

export function DayStateChip({ state }: { state: DayState }) {
  const s = LABELS[state];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function AuditStatusBadge({ status }: { status: Audit["status"] }) {
  return status === "concluida" ? <Badge tone="green">concluída</Badge> : <Badge tone="yellow">rascunho</Badge>;
}

/** Abreviação do tipo para células compactas. */
export const TIPO_ABBR: Record<string, string> = {
  completa: "COMP",
  simplificada: "SIMP",
  producao: "PROD",
  nutricional: "NUTRI",
};

/** Nome curto da unidade (primeiras palavras) para células do calendário. */
export function shortUnitName(nome: string): string {
  return nome.replace("Moema ", "M. ").replace("Produção", "Prod.").replace("Delivery", "Deliv.");
}
