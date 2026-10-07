"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { NUTRI_AGENDA_TIPO_LABELS } from "@/lib/constants";
import { createNutriAgenda, deleteNutriAgenda, setNutriAgendaStatus } from "@/lib/nutri-agenda-actions";
import type { NutriAgendaItem, NutriAgendaTipo, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; message?: string; error?: string };

/** Formulário da chefe: programar uma tarefa para alguém da equipe. */
export function AgendaForm({ team, units, today, defaultDate, onClose }: { team: { id: string; nome: string }[]; units: Unit[]; today: string; defaultDate?: string; onClose?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState(defaultDate ?? today);
  const [responsavelId, setResponsavelId] = useState(team[0]?.id ?? "");
  const [unitId, setUnitId] = useState("");
  const [tipo, setTipo] = useState<NutriAgendaTipo>("auditoria");
  const [descricao, setDescricao] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r: Res = await createNutriAgenda({ data, responsavelId, unitId: unitId || null, tipo, descricao });
          setMsg({ ok: r.ok, text: r.ok ? "Tarefa programada." : (r.error ?? "Falha.") });
          if (r.ok) {
            setDescricao("");
            router.refresh();
            onClose?.();
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Programar tarefa</h2>
        {onClose && (
          <button type="button" aria-label="Fechar" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input type="date" value={data} min={today} onChange={(e) => setData(e.target.value)} required />
        </Field>
        <Field label="Responsável">
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} required>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unidade">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as NutriAgendaTipo)}>
            {(Object.keys(NUTRI_AGENDA_TIPO_LABELS) as NutriAgendaTipo[]).map((t) => (
              <option key={t} value={t}>
                {NUTRI_AGENDA_TIPO_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição (opcional)" className="col-span-2">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Ex.: auditoria completa + planilhas de temperatura e óleo" />
        </Field>
      </div>
      {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      <Button type="submit" full disabled={pending || !responsavelId}>
        <Plus className="h-4 w-4" /> {pending ? "Salvando…" : "Programar"}
      </Button>
    </form>
  );
}

/** Linha de tarefa com ações (concluir; chefe: cancelar/reabrir/excluir). */
export function AgendaItemRow({ item, unitName, responsavelNome, isChefe, isMine, today }: { item: NutriAgendaItem; unitName: string | null; responsavelNome: string | null; isChefe: boolean; isMine: boolean; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
    });
  const atrasada = item.status === "prevista" && item.data < today;
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border bg-white px-3 py-3", atrasada ? "border-red-200 bg-red-50/40" : item.status === "concluida" ? "border-green-200 opacity-80" : item.status === "cancelada" ? "border-line opacity-60" : "border-line")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{unitName ?? NUTRI_AGENDA_TIPO_LABELS[item.tipo]}</span>
          {unitName && <span className="text-xs text-gray-500">{NUTRI_AGENDA_TIPO_LABELS[item.tipo]}</span>}
          {atrasada ? <Badge tone="red">atrasada</Badge> : item.status === "concluida" ? <Badge tone="green">concluída</Badge> : item.status === "cancelada" ? <Badge tone="gray">cancelada</Badge> : null}
          {item.rotina_id && <span className="text-[10px] uppercase tracking-wide text-gray-400">rotina</span>}
        </div>
        {item.descricao && <p className="mt-0.5 text-sm text-gray-700">{item.descricao}</p>}
        {responsavelNome && <p className="mt-0.5 text-xs text-gray-500">{responsavelNome}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status === "prevista" && (isMine || isChefe) && (
          <button type="button" aria-label="Concluir" title="Concluir" disabled={pending} onClick={() => run(() => setNutriAgendaStatus(item.id, "concluida"))} className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700">
            <Check className="h-4 w-4" />
          </button>
        )}
        {isChefe && item.status === "prevista" && (
          <button type="button" aria-label="Cancelar" title="Cancelar" disabled={pending} onClick={() => run(() => setNutriAgendaStatus(item.id, "cancelada"))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        )}
        {isChefe && item.status !== "prevista" && (
          <button type="button" aria-label="Reabrir" title="Reabrir" disabled={pending} onClick={() => run(() => setNutriAgendaStatus(item.id, "prevista"))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        {isChefe && (
          <button type="button" aria-label="Excluir" title="Excluir" disabled={pending} onClick={() => run(() => deleteNutriAgenda(item.id))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Botão que abre o formulário de programação (chefe). */
export function AgendaNewToggle({ team, units, today }: { team: { id: string; nome: string }[]; units: Unit[]; today: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Programar tarefa
      </Button>
    );
  return <AgendaForm team={team} units={units} today={today} onClose={() => setOpen(false)} />;
}
