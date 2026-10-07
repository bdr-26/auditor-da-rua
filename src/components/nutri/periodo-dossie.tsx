"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { ShareReport } from "@/components/reports/share-report";
import { Field, Input } from "@/components/ui/form";
import { formatDatePT } from "@/lib/dates";

/** Dossiê de um período livre (até 1 ano): escolhe início e fim e abre/compartilha o PDF. */
export function PeriodoDossie({ unitId, unitNome, unitSlug, today }: { unitId: string; unitNome: string; unitSlug: string; today: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 89);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to && (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 366;
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
      <p className="mb-2 text-xs font-medium text-gray-600">
        <CalendarRange className="mr-1 inline h-3.5 w-3.5" /> Período específico (ex.: pedido da fiscalização)
      </p>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Field label="De">
          <Input id="dossie-de" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <Input id="dossie-ate" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {ok ? (
        <ShareReport
          compact
          pdfUrl={`/api/nutri/controles/dossie?unit=${unitId}&from=${from}&to=${to}`}
          fileName={`arquivo-registros-${unitSlug}-${from}_${to}.pdf`}
          title={`Arquivo de registros · ${unitNome} · ${formatDatePT(from)} a ${formatDatePT(to)}`}
          text={`Arquivo de registros de ${unitNome} de ${formatDatePT(from)} a ${formatDatePT(to)}: todos os controles de qualidade finalizados.`}
        />
      ) : (
        <p className="text-xs text-red-700">Escolha um período válido de até 1 ano.</p>
      )}
    </div>
  );
}
