"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createDemandaAndGo, updateDemanda } from "@/lib/demandas-actions";
import type { Demanda, Unit } from "@/lib/types";

/** Formulário do proprietário: criar ou editar uma demanda. */
export function DemandaForm({ units, responsaveis, demanda }: { units: Unit[]; responsaveis: { id: string; nome: string }[]; demanda?: Demanda }) {
  const [titulo, setTitulo] = useState(demanda?.titulo ?? "");
  const [descricao, setDescricao] = useState(demanda?.descricao ?? "");
  const [prazo, setPrazo] = useState(demanda?.prazo ?? "");
  const [prioridade, setPrioridade] = useState<"normal" | "alta">(demanda?.prioridade ?? "normal");
  const [unitId, setUnitId] = useState(demanda?.unit_id ?? "");
  const [responsavelId, setResponsavelId] = useState(demanda?.responsavel_id ?? responsaveis[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    start(async () => {
      const input = { titulo, descricao, prazo: prazo || null, prioridade, unitId: unitId || null, responsavelId: responsavelId || undefined };
      const r = demanda ? await updateDemanda(demanda.id, input) : await createDemandaAndGo(input);
      if (!r.ok) setError(r.error);
      else setOk(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Título">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={120} placeholder="Ex.: Trocar a borracha da geladeira da chapa" />
      </Field>
      <Field label="Descrição" hint="O que precisa ser feito, onde e como você espera o resultado.">
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prazo">
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </Field>
        <Field label="Prioridade">
          <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as "normal" | "alta")}>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade (opcional)">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} disabled={!!demanda}>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {ok && demanda && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Alterações salvas.</p>}
      <Button type="submit" size="lg" full disabled={pending || !titulo.trim()}>
        {pending ? "Salvando…" : demanda ? "Salvar alterações" : "Criar demanda"}
      </Button>
      {!demanda && <p className="text-center text-xs text-gray-500">Depois de criar, você pode anexar fotos ou PDFs na página da demanda. O gerente recebe uma notificação.</p>}
    </form>
  );
}
