"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { deleteControle, finalizeControle, reopenControle, saveControle } from "@/lib/nutri-controles-actions";
import { getControleTipo, resumirControle, type Campo, type ControleDados } from "@/lib/nutri/controle-tipos";
import type { NutriControle } from "@/lib/types";
import { cn } from "@/lib/utils";

function CampoInput({ campo, value, onChange, disabled }: { campo: Campo; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const v = value == null ? "" : String(value);
  if (campo.tipo === "select") {
    return (
      <Select value={v} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">—</option>
        {(campo.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  if (campo.tipo === "bool") {
    return (
      <Select value={value === true ? "1" : value === false ? "0" : ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "1")} disabled={disabled}>
        <option value="">—</option>
        <option value="1">Sim</option>
        <option value="0">Não</option>
      </Select>
    );
  }
  if (campo.tipo === "number") {
    return (
      <div className="relative">
        <Input type="number" inputMode="decimal" step="0.1" value={v} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} disabled={disabled} className={campo.sufixo ? "pr-10" : undefined} />
        {campo.sufixo && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500">{campo.sufixo}</span>}
      </div>
    );
  }
  return <Input type={campo.tipo === "date" ? "date" : campo.tipo === "time" ? "time" : "text"} value={v} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={campo.placeholder} />;
}

/** Preenchimento genérico de um controle (planilha digital): cabeçalho + linhas, rascunho e finalização. */
export function ControleForm({ controle, tipoCodigo, inicial, unitName, canEdit, isChefe }: { controle: NutriControle; tipoCodigo: string; inicial: ControleDados; unitName: string; canEdit: boolean; isChefe: boolean }) {
  const router = useRouter();
  // definições (com funções de alerta) são resolvidas no cliente: não podem vir serializadas do servidor
  const tipo = getControleTipo(tipoCodigo)!;
  const [dados, setDados] = useState<ControleDados>(inicial);
  const [observacoes, setObservacoes] = useState(controle.observacoes ?? "");
  const [data, setData] = useState(controle.data);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [pending, start] = useTransition();
  const finalizado = controle.status === "finalizado";
  const disabled = !canEdit || pending;
  const fixas = useMemo(() => new Set(tipo.linhasFixas ?? []), [tipo]);
  const resumo = useMemo(() => resumirControle(tipo, dados), [tipo, dados]);

  const setCab = (k: string, v: unknown) => setDados((d) => ({ ...d, cabecalho: { ...d.cabecalho, [k]: v } }));
  const setLinha = (i: number, k: string, v: unknown) => setDados((d) => ({ ...d, linhas: d.linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const addLinha = () => setDados((d) => ({ ...d, linhas: [...d.linhas, { nome: "" }] }));
  const rmLinha = (i: number) => setDados((d) => ({ ...d, linhas: d.linhas.filter((_, j) => j !== i) }));

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Feito.") : (r.error ?? "Falha.") });
      if (r.ok) {
        setConfirmFinal(false);
        router.refresh();
      }
    });
  }
  const payload = () => ({ dados, observacoes, data });

  return (
    <div className="space-y-4">
      {tipo.base && <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">{tipo.base}</p>}

      {/* status / conferência */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={finalizado ? "green" : "yellow"}>{finalizado ? "finalizado" : "rascunho"}</Badge>
        <span className="text-gray-600">
          {resumo.linhasPreenchidas}/{resumo.linhasTotal} linha{resumo.linhasTotal === 1 ? "" : "s"} preenchida{resumo.linhasPreenchidas === 1 ? "" : "s"}
        </span>
        {resumo.alertas.length > 0 && (
          <Badge tone="red">
            <AlertTriangle className="h-3 w-3" /> {resumo.alertas.length} fora da faixa
          </Badge>
        )}
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Lock className="h-3 w-3" /> somente leitura
          </span>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={disabled} />
          </Field>
          <Field label="Unidade">
            <Input value={unitName} disabled />
          </Field>
          {tipo.cabecalho.map((c) => (
            <Field key={c.key} label={c.label + (c.obrigatorio ? " *" : "")} className={tipo.cabecalho.length === 1 ? "col-span-2" : undefined}>
              <CampoInput campo={c} value={dados.cabecalho[c.key]} onChange={(v) => setCab(c.key, v)} disabled={disabled} />
            </Field>
          ))}
        </div>
      </Card>

      <div className="space-y-2">
        {dados.linhas.map((l, i) => {
          const fixa = fixas.has(l.nome);
          const temValor = tipo.campos.some((c) => l[c.key] != null && l[c.key] !== "");
          return (
            <Card key={i} className={cn("p-3", !temValor && "border-dashed")}>
              <div className="mb-2 flex items-center gap-2">
                {fixa ? (
                  <span className="flex-1 text-sm font-semibold">{l.nome}</span>
                ) : (
                  <Input value={l.nome} onChange={(e) => setLinha(i, "nome", e.target.value)} disabled={disabled} placeholder={tipo.linhaLabel} className="flex-1 font-semibold" />
                )}
                {!fixa && canEdit && (
                  <button type="button" aria-label="Remover linha" onClick={() => rmLinha(i)} className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tipo.campos.map((c) => {
                  const v = l[c.key];
                  const alerta = c.alerta && v != null && v !== "" ? c.alerta(v, l) : null;
                  return (
                    <label key={c.key} className={cn("block", c.tipo === "text" && "col-span-2 sm:col-span-3")}>
                      <span className="mb-0.5 block text-[11px] font-medium text-gray-600">
                        {c.label}
                        {c.obrigatorio ? " *" : ""}
                      </span>
                      <CampoInput campo={c} value={v} onChange={(nv) => setLinha(i, c.key, nv)} disabled={disabled} />
                      {alerta && <span className="mt-0.5 block text-[11px] font-semibold text-red-700">{alerta}</span>}
                    </label>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {tipo.linhasLivres && canEdit && (
          <Button type="button" variant="secondary" full onClick={addLinha} disabled={pending}>
            <Plus className="h-4 w-4" /> Adicionar {tipo.linhaLabel.toLowerCase()}
          </Button>
        )}
      </div>

      <Card>
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} disabled={disabled} placeholder="Ocorrências, ações corretivas, quem acompanhou…" />
        </Field>
      </Card>

      {msg && <p className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p>}

      {canEdit && !finalizado && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => saveControle(controle.id, payload()))}>
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
            <Button type="button" className="flex-1" disabled={pending} onClick={() => setConfirmFinal(true)}>
              <CheckCircle2 className="h-4 w-4" /> Finalizar
            </Button>
          </div>
          {confirmFinal && (
            <div className="rounded-xl border border-line bg-white p-3 text-sm">
              <p>Depois de finalizado, só a nutricionista chefe pode alterar. Confirmar?</p>
              {resumo.alertas.length > 0 && <p className="mt-1 text-xs text-red-700">Há {resumo.alertas.length} valor(es) fora da faixa; registre a ação corretiva nas observações.</p>}
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmFinal(false)} disabled={pending}>
                  Voltar
                </Button>
                <Button type="button" size="sm" className="flex-1" disabled={pending} onClick={() => run(() => finalizeControle(controle.id, payload()))}>
                  {pending ? "Finalizando…" : "Confirmar finalização"}
                </Button>
              </div>
            </div>
          )}
          <button type="button" onClick={() => run(() => deleteControle(controle.id))} disabled={pending} className="mx-auto flex min-h-0 items-center gap-1 text-xs text-gray-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Excluir rascunho
          </button>
        </div>
      )}

      {canEdit && finalizado && isChefe && (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => reopenControle(controle.id))}>
            <RotateCcw className="h-4 w-4" /> Reabrir
          </Button>
          <Button type="button" className="flex-1" disabled={pending} onClick={() => run(() => saveControle(controle.id, payload()))}>
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}
