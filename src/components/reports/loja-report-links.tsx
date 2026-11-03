"use client";

import { ShareReport } from "@/components/reports/share-report";
import { formatMonthPT } from "@/lib/dates";

export interface LojaReportUnit {
  id: string;
  nome: string;
  slug: string;
  supervisor_nome?: string | null;
}

/** Texto que acompanha o PDF no WhatsApp (grupo dos supervisores). */
export function lojaReportShareText(nome: string, mes: string, oficial: boolean): string {
  return `${oficial ? "Relatório mensal" : "Prévia do relatório mensal"} de ${nome} · ${formatMonthPT(mes)}: auditorias do mês, nota e ranking, onde acertamos, o que melhorar, o que é recorrente, pendências, pedidos e nota 99Food.`;
}

/**
 * Relatório mensal por loja (PDF) para enviar ao grupo dos supervisores: um bloco por loja com
 * compartilhar (WhatsApp) / abrir / baixar. `oficial=false` enquanto o mês está aberto (prévia).
 */
export function LojaReportLinks({ mes, units, oficial, compact }: { mes: string; units: LojaReportUnit[]; oficial: boolean; compact?: boolean }) {
  if (units.length === 0) return <p className="text-sm text-gray-500">Nenhuma loja com relatório mensal neste mês.</p>;
  const ym = mes.slice(0, 7);
  return (
    <div className={compact ? "space-y-2" : "divide-y divide-line"}>
      {units.map((u) => (
        <div key={u.id} className={compact ? "" : "py-3 first:pt-0 last:pb-0"} data-testid={`relatorio-loja-${u.slug}`}>
          {!compact && (
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{u.nome}</span>
              {u.supervisor_nome && <span className="text-xs text-gray-500">Supervisor: {u.supervisor_nome}</span>}
            </div>
          )}
          <ShareReport
            compact
            pdfUrl={`/api/reports/loja?unit=${u.id}&mes=${ym}`}
            fileName={`relatorio-${u.slug}-${ym}${oficial ? "" : "-previa"}.pdf`}
            title={`Relatório mensal · ${u.nome} · ${formatMonthPT(mes)}`}
            text={lojaReportShareText(u.nome, mes, oficial)}
          />
        </div>
      ))}
    </div>
  );
}
