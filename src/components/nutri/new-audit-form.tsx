"use client";

import { useState } from "react";
import { Check, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { formatDatePT } from "@/lib/dates";
import { startNutriAudit } from "@/lib/nutri-actions";
import type { Unit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

export interface UnitOption {
  unit: Unit;
  ultimaData: string | null;
  itensAtivos: number;
  rascunho: boolean;
}

export function NewAuditForm({ units, today }: { units: UnitOption[]; today: string }) {
  const [unitId, setUnitId] = useState<string>("");
  const [data, setData] = useState(today);
  const { run, pending, error } = useAction();

  const submit = () => {
    if (!unitId) return;
    void run(() => startNutriAudit({ unitId, data }));
  };

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">1. Escolha a unidade</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {units.map(({ unit, ultimaData, itensAtivos, rascunho }) => {
            const selected = unit.id === unitId;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => setUnitId(unit.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition",
                  selected ? "border-brand ring-2 ring-brand/40" : "border-line hover:bg-surface-muted",
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", selected ? "bg-brand text-ink" : "bg-surface-muted text-gray-500")}>
                  {selected ? <Check className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{unit.nome}</span>
                    {unit.nutri_checklist_em_revisao && <Badge tone="yellow">checklist em revisão</Badge>}
                    {rascunho && <Badge tone="brand">rascunho hoje</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {itensAtivos} itens ativos · {ultimaData ? `última em ${formatDatePT(ultimaData)}` : "nunca auditada"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">2. Data da visita</h2>
        <Field label="Data" hint="Padrão: hoje. Não é possível lançar datas futuras.">
          <Input type="date" value={data} max={today} onChange={(e) => setData(e.target.value)} />
        </Field>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Button size="lg" full onClick={submit} disabled={!unitId || !data || pending}>
        {pending ? "Preparando…" : "Iniciar auditoria"}
      </Button>
    </div>
  );
}
