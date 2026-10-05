"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createDemandaAndGo, updateDemanda } from "@/lib/demandas-actions";
import { DEMANDA_CATEGORIA_LABELS } from "@/lib/constants";
import type { Demanda, DemandaCategoria, Unit } from "@/lib/types";

/**
 * Formulário de demanda: criar ou editar.
 * `mode="owner"`: proprietário atribui ao gerente (escolhe o responsável).
 * `mode="self"`: o próprio gerente cria uma demanda pessoal para se organizar (responsável é ele mesmo).
 */
export function DemandaForm({ units, responsaveis = [], demanda, mode = "owner", initialUnitId, initialCategoria }: { units: Unit[]; responsaveis?: { id: string; nome: string }[]; demanda?: Demanda; mode?: "owner" | "self"; initialUnitId?: string; initialCategoria?: DemandaCategoria }) {
  const self = mode === "self";
  const [titulo, setTitulo] = useState(demanda?.titulo ?? "");
  const [descricao, setDescricao] = useState(demanda?.descricao ?? "");
  const [prazo, setPrazo] = useState(demanda?.prazo ?? "");
  const [prioridade, setPrioridade] = useState<"normal" | "alta">(demanda?.prioridade ?? "normal");
  const [unitId, setUnitId] = useState(demanda?.unit_id ?? initialUnitId ?? "");
  const [categoria, setCategoria] = useState<DemandaCategoria>(demanda?.categoria ?? initialCategoria ?? "geral");
  const checklist = categoria === "checklist_abertura";
  const lojasEmAbertura = units.filter((u) => u.em_abertura);
  const [responsavelId, setResponsavelId] = useState(demanda?.responsavel_id ?? responsaveis[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    start(async () => {
      const input = { titulo, descricao, prazo: prazo || null, prioridade, categoria, unitId: unitId || null, responsavelId: responsavelId || undefined };
      const r = demanda ? await updateDemanda(demanda.id, input) : await createDemandaAndGo(input);
      if (!r.ok) setError(r.error);
      else setOk(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tipo" hint={checklist ? "Item do checklist de abertura: aparece na visita de abertura da loja escolhida, na agenda do gerente." : undefined}>
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value as DemandaCategoria)}>
          {(Object.keys(DEMANDA_CATEGORIA_LABELS) as DemandaCategoria[]).map((c) => (
            <option key={c} value={c}>
              {DEMANDA_CATEGORIA_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={120} placeholder={checklist ? "Ex.: Conferir instalação da coifa e exaustão" : self ? "Ex.: Conferir estoque de embalagens da Matriz" : "Ex.: Trocar a borracha da geladeira da chapa"} />
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
      <div className={self ? "" : "grid grid-cols-2 gap-3"}>
        <Field label={checklist ? "Loja em abertura" : "Unidade (opcional)"} hint={checklist && lojasEmAbertura.length === 0 ? "Nenhuma loja marcada como em abertura (Unidades → editar → Em abertura)." : undefined}>
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required={checklist}>
            <option value="">{checklist ? "Escolha a loja…" : "—"}</option>
            {(checklist && lojasEmAbertura.length > 0 ? lojasEmAbertura : units).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {checklist && !u.em_abertura ? " (já ativa)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {!self && (
          <Field label="Responsável">
            <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} disabled={!!demanda}>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {ok && demanda && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Alterações salvas.</p>}
      <Button type="submit" size="lg" full disabled={pending || !titulo.trim() || (checklist && !unitId)}>
        {pending ? "Salvando…" : demanda ? "Salvar alterações" : "Criar demanda"}
      </Button>
      {!demanda && (
        <p className="text-center text-xs text-gray-500">
          {self ? "A demanda entra na sua agenda, junto com as dos proprietários. Depois de criar, você pode anexar fotos ou PDFs." : "Depois de criar, você pode anexar fotos ou PDFs na página da demanda. O gerente recebe uma notificação."}
        </p>
      )}
    </form>
  );
}
