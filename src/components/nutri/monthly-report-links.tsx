"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { ShareReport } from "@/components/reports/share-report";
import { formatMonthPT } from "@/lib/dates";

/** Relatório mensal nutricional por unidade (PDF) num mês: lista expansível com as ações de compartilhar/imprimir. */
export function MonthlyReportLinks({ mes, units }: { mes: string; units: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  if (units.length === 0) return null;
  const ym = mes.slice(0, 7);
  return (
    <div className="mt-2 rounded-2xl border border-line bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
        <FileText className="h-4 w-4 text-brand-dark" />
        <span className="flex-1">Relatório mensal em PDF · {formatMonthPT(mes)}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {units.map((u) => (
            <div key={u.id}>
              <div className="mb-1.5 text-sm font-semibold">{u.nome}</div>
              <ShareReport
                compact
                pdfUrl={`/api/nutri/relatorio-mensal?unit=${u.id}&mes=${ym}`}
                fileName={`nutricional-${u.nome.toLowerCase().replace(/\s+/g, "-")}-${ym}.pdf`}
                title={`Relatório mensal nutricional · ${u.nome} · ${formatMonthPT(mes)}`}
                text={`Relatório mensal nutricional de ${u.nome} (${formatMonthPT(mes)}), com todas as auditorias, resultado por área e apontamentos.`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
