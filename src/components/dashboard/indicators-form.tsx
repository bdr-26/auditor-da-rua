"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { Importador99 } from "@/components/dashboard/importador-99";
import { saveExternalIndicators } from "@/lib/dashboard-actions";
import { formatDateTimePT } from "@/lib/dates";
import { type Detalhe99, indicadoresDoDetalhe } from "@/lib/indicadores-99";
import type { ExternalIndicator, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { unitId: string; slug: string; nome: string; nota: string; canc: string; tempo: string; pedidos: string; recado: string; detalhe: Detalhe99 | null; arquivo: string | null; importadoEm: string | null };

function toNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Indicadores do mês por loja (99Food + pedidos) e o recado do mês para a loja.
 * Tudo informativo: não compõe a nota, mas vai para o relatório mensal do supervisor. Somente leitura com o mês fechado.
 */
export function IndicatorsForm({ mes, units, indicators, readOnly }: { mes: string; units: Unit[]; indicators: ExternalIndicator[]; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() =>
    units.map((u) => {
      const i = indicators.find((x) => x.unit_id === u.id);
      return {
        unitId: u.id,
        slug: u.slug,
        nome: u.nome,
        nota: i?.nota_99food != null ? String(i.nota_99food) : "",
        canc: i?.cancelamentos != null ? String(i.cancelamentos) : "",
        tempo: i?.tempo_medio_entrega != null ? String(i.tempo_medio_entrega) : "",
        pedidos: i?.pedidos != null ? String(i.pedidos) : "",
        recado: i?.recado ?? "",
        detalhe: i?.detalhe_99 ?? null,
        arquivo: i?.arquivo_99 ?? null,
        importadoEm: i?.importado_99_em ?? null,
      };
    }),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const field = "block text-[11px] font-medium uppercase tracking-wide text-gray-500";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveExternalIndicators(
            mes,
            rows.map((row) => ({
              unitId: row.unitId,
              nota_99food: toNum(row.nota),
              cancelamentos: toNum(row.canc),
              tempo_medio_entrega: toNum(row.tempo),
              pedidos: toNum(row.pedidos),
              recado: row.recado.trim() || null,
              detalhe_99: row.detalhe,
              arquivo_99: row.arquivo,
            })),
          );
          setMsg(r.ok ? { ok: true, text: r.message ?? "Salvo." } : { ok: false, text: r.error });
        });
      }}
    >
      {!readOnly && (
        <div className="mb-3">
          <Importador99
            mes={mes}
            unidades={units.map((u) => ({ slug: u.slug, nome: u.nome }))}
            onAplicar={(itens, arquivo) => {
              const agora = new Date().toISOString();
              setRows((rs) =>
                rs.map((r) => {
                  const it = itens.find((x) => x.slug === r.slug);
                  if (!it) return r;
                  const i = indicadoresDoDetalhe(it.detalhe);
                  return { ...r, pedidos: String(i.pedidos), canc: String(i.cancelamentos), nota: i.nota_99food == null ? "" : String(i.nota_99food), tempo: i.tempo_medio_entrega == null ? "" : String(i.tempo_medio_entrega), detalhe: it.detalhe, arquivo, importadoEm: agora };
                }),
              );
              setMsg({ ok: true, text: `${itens.length} loja${itens.length === 1 ? "" : "s"} preenchida${itens.length === 1 ? "" : "s"} pelo relatório. Confira e clique em “Salvar indicadores”.` });
            }}
          />
        </div>
      )}
      <div className="divide-y divide-line">
        {rows.map((row, i) => (
          <div key={row.unitId} className="py-3 first:pt-0 last:pb-0" data-testid={`indicadores-${row.unitId}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{row.nome}</span>
              {row.detalhe && (
                <span className="text-[11px] text-green-700" data-testid={`detalhe-99-${row.slug}`}>
                  Relatório da 99{row.arquivo ? ` (${row.arquivo})` : ""}{row.importadoEm ? ` · ${formatDateTimePT(row.importadoEm)}` : ""} · {row.detalhe.avaliacoes} avaliações · {row.detalhe.dias} dias
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="space-y-1">
                <span className={field}>Pedidos no mês</span>
                <Input type="number" inputMode="numeric" min={0} step={1} value={row.pedidos} disabled={readOnly} onChange={(e) => update(i, "pedidos", e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={field}>Nota 99Food (0–5)</span>
                <Input type="number" inputMode="decimal" min={0} max={5} step={0.01} value={row.nota} disabled={readOnly} onChange={(e) => update(i, "nota", e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={field}>Cancelamentos</span>
                <Input type="number" inputMode="numeric" min={0} step={1} value={row.canc} disabled={readOnly} onChange={(e) => update(i, "canc", e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={field}>Tempo médio (min)</span>
                <Input type="number" inputMode="numeric" min={0} step={1} value={row.tempo} disabled={readOnly} onChange={(e) => update(i, "tempo", e.target.value)} />
              </label>
            </div>
            <label className="mt-2 block space-y-1">
              <span className={field}>Recado do mês para a loja (sai no relatório do supervisor)</span>
              <Textarea rows={2} maxLength={600} value={row.recado} disabled={readOnly} onChange={(e) => update(i, "recado", e.target.value)} placeholder="Ex.: Foco de novembro: controle de temperatura e planilhas em dia. Parabéns pelo atendimento!" />
            </label>
          </div>
        ))}
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
