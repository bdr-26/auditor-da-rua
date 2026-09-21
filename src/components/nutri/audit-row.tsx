import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDatePT } from "@/lib/dates";
import type { Audit } from "@/lib/types";
import { ClassBadge, NotaNutri } from "./nutri-badges";

/** Linha de lista de auditoria nutricional (home / histórico). */
export function NutriAuditRow({ audit, unitName, auditorName }: { audit: Audit; unitName: string; auditorName?: string }) {
  const draft = audit.status === "rascunho";
  const href = draft ? `/nutri/auditorias/${audit.id}` : `/nutri/auditorias/${audit.id}/resumo`;
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 hover:bg-surface-muted">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{unitName}</span>
          {draft && <Badge tone="brand">rascunho</Badge>}
        </div>
        <div className="text-xs text-gray-500">
          {formatDatePT(audit.data)}
          {auditorName ? ` · ${auditorName}` : ""}
        </div>
      </div>
      {draft ? (
        <span className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-ink">Continuar</span>
      ) : (
        <div className="flex items-center gap-2">
          <NotaNutri nota={audit.nota_final} classificacao={audit.classificacao} size="sm" />
          <ClassBadge classificacao={audit.classificacao} className="hidden sm:inline-flex" />
        </div>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}
