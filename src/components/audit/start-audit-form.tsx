"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { startAudit } from "@/lib/audit-actions";
import { AUDIT_TYPE_LABELS } from "@/lib/constants";
import type { AuditType, Unit } from "@/lib/types";

type Tipo = Exclude<AuditType, "nutricional">;

/** Formulário "auditoria fora da agenda": unidade + tipo (+ data, hoje por padrão). */
export function StartAuditForm({ units, today, initialError }: { units: Pick<Unit, "id" | "nome" | "tipo">[]; today: string; initialError?: string }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [tipo, setTipo] = useState<Tipo>("simplificada");
  const [data, setData] = useState(today);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, start] = useTransition();

  const unit = units.find((u) => u.id === unitId);
  const tipos = useMemo<Tipo[]>(() => (unit?.tipo === "producao" ? ["producao"] : ["simplificada", "completa"]), [unit]);
  const tipoEfetivo: Tipo = tipos.includes(tipo) ? tipo : tipos[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await startAudit({ unitId, tipo: tipoEfetivo, data });
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <Field label="Unidade">
        <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tipo de auditoria" hint={unit?.tipo === "producao" ? "Cozinha central: só auditoria de produção." : "Lojas: simplificada ou completa."}>
        <Select value={tipoEfetivo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {AUDIT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Data" hint="Normalmente hoje. Só altere se estiver lançando uma visita de outro dia.">
        <Input type="date" value={data} max={today} onChange={(e) => setData(e.target.value || today)} />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" full disabled={pending || !unitId}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {pending ? "Abrindo…" : "Iniciar auditoria"}
      </Button>
    </form>
  );
}
