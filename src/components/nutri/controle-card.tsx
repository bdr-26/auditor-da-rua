import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { controleResumo } from "@/lib/data/nutri-controles";
import { formatDatePT } from "@/lib/dates";
import { getControleTipo } from "@/lib/nutri/controle-tipos";
import type { NutriControle } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cartão de um controle na lista (tipo, unidade, data, responsável, status e alertas). */
export function ControleCard({ c, unitName, responsavelNome }: { c: NutriControle; unitName: string; responsavelNome?: string }) {
  const tipo = getControleTipo(c.tipo);
  const resumo = controleResumo(c);
  const draft = c.status === "rascunho";
  return (
    <Link href={`/nutri/controles/${c.id}`} className={cn("flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 active:scale-[0.99]", draft ? "border-yellow-200" : "border-line")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{tipo?.nome ?? c.tipo}</span>
          <Badge tone={draft ? "yellow" : "green"}>{draft ? "rascunho" : "finalizado"}</Badge>
          {resumo && resumo.alertas.length > 0 && (
            <Badge tone="red">
              <AlertTriangle className="h-3 w-3" /> {resumo.alertas.length}
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {unitName} · {formatDatePT(c.data)}
          {responsavelNome ? ` · ${responsavelNome}` : ""}
          {resumo ? ` · ${resumo.linhasPreenchidas} linha${resumo.linhasPreenchidas === 1 ? "" : "s"}` : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}
