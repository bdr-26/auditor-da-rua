"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { saveExternalIndicators } from "@/lib/dashboard-actions";
import type { ExternalIndicator, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { unitId: string; nome: string; nota: string; canc: string; tempo: string };

function toNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Indicadores 99Food (uma linha por loja). Somente leitura com o mês fechado. */
export function IndicatorsForm({ mes, units, indicators, readOnly }: { mes: string; units: Unit[]; indicators: ExternalIndicator[]; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() =>
    units.map((u) => {
      const i = indicators.find((x) => x.unit_id === u.id);
      return {
        unitId: u.id,
        nome: u.nome,
        nota: i?.nota_99food != null ? String(i.nota_99food) : "",
        canc: i?.cancelamentos != null ? String(i.cancelamentos) : "",
        tempo: i?.tempo_medio_entrega != null ? String(i.tempo_medio_entrega) : "",
      };
    }),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveExternalIndicators(
            mes,
            rows.map((row) => ({ unitId: row.unitId, nota_99food: toNum(row.nota), cancelamentos: toNum(row.canc), tempo_medio_entrega: toNum(row.tempo) })),
          );
          setMsg(r.ok ? { ok: true, text: r.message ?? "Salvo." } : { ok: false, text: r.error });
        });
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr className="border-b border-line">
              <th className="py-2 pr-2">Loja</th>
              <th className="py-2 pr-2">Nota (0–5)</th>
              <th className="py-2 pr-2">Cancelamentos</th>
              <th className="py-2">Tempo médio (min)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.unitId} className="border-b border-line last:border-0">
                <td className="py-2 pr-2 font-semibold">{row.nome}</td>
                <td className="py-2 pr-2">
                  <Input type="number" inputMode="decimal" min={0} max={5} step={0.1} value={row.nota} disabled={readOnly} onChange={(e) => update(i, "nota", e.target.value)} className="max-w-[7rem]" />
                </td>
                <td className="py-2 pr-2">
                  <Input type="number" inputMode="numeric" min={0} step={1} value={row.canc} disabled={readOnly} onChange={(e) => update(i, "canc", e.target.value)} className="max-w-[7rem]" />
                </td>
                <td className="py-2">
                  <Input type="number" inputMode="numeric" min={0} step={1} value={row.tempo} disabled={readOnly} onChange={(e) => update(i, "tempo", e.target.value)} className="max-w-[7rem]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar indicadores"}
          </Button>
          {msg && <span className={cn("text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</span>}
        </div>
      )}
    </form>
  );
}
