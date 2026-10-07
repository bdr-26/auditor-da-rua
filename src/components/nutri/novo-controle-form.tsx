"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { createControleAndGo } from "@/lib/nutri-controles-actions";
import { cn } from "@/lib/utils";

export function NovoControleForm({ tipos, units, today, initialTipo, initialUnit }: { tipos: { codigo: string; nome: string; descricao: string }[]; units: { id: string; nome: string }[]; today: string; initialTipo?: string; initialUnit?: string }) {
  const [tipo, setTipo] = useState(tipos.some((t) => t.codigo === initialTipo) ? (initialTipo as string) : tipos[0]?.codigo ?? "");
  const [unitId, setUnitId] = useState(units.some((u) => u.id === initialUnit) ? (initialUnit as string) : units[0]?.id ?? "");
  const [data, setData] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createControleAndGo({ tipo, unitId, data });
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <div className="space-y-2">
        {tipos.map((t) => (
          <label key={t.codigo} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-3", tipo === t.codigo ? "border-ink ring-2 ring-ink/20" : "border-line")}>
            <input type="radio" name="tipo" value={t.codigo} checked={tipo === t.codigo} onChange={() => setTipo(t.codigo)} className="mt-1 h-5 w-5 min-h-0 accent-ink" />
            <span>
              <span className="block font-semibold">{t.nome}</span>
              <span className="block text-xs text-gray-600">{t.descricao}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="card grid grid-cols-2 gap-3">
        <Field label="Unidade">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={data} max={today} onChange={(e) => setData(e.target.value || today)} />
        </Field>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" full disabled={pending || !tipo || !unitId}>
        {pending ? "Abrindo…" : "Começar preenchimento"}
      </Button>
    </form>
  );
}
