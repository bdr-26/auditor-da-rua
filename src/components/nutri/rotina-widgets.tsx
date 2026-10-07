"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { NUTRI_AGENDA_TIPO_LABELS } from "@/lib/constants";
import { DIAS_SEMANA_CURTO, descreverFrequencia } from "@/lib/data/nutri-rotinas";
import { deleteNutriRotina, gerarAgendaRotinas, saveNutriRotina, setNutriRotinaAtiva, type RotinaInput } from "@/lib/nutri-rotina-actions";
import type { NutriAgendaTipo, NutriRotina, NutriRotinaFrequencia, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; message?: string; error?: string };
type Membro = { id: string; nome: string };

/** Formulário de rotina padrão (criar/editar): unidade, responsável, tipo, frequência e dias. */
export function RotinaForm({ rotina, team, units, onClose }: { rotina?: NutriRotina | null; team: Membro[]; units: Unit[]; onClose: () => void }) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(rotina?.unit_id ?? units[0]?.id ?? "");
  const [responsavelId, setResponsavelId] = useState(rotina?.responsavel_id ?? team[0]?.id ?? "");
  const [tipo, setTipo] = useState<NutriAgendaTipo>(rotina?.tipo ?? "auditoria");
  const [frequencia, setFrequencia] = useState<NutriRotinaFrequencia>(rotina?.frequencia ?? "semanal");
  const [dias, setDias] = useState<number[]>(rotina?.dias_semana ?? [3]);
  const [diaMes, setDiaMes] = useState<number>(rotina?.dia_mes ?? 10);
  const [descricao, setDescricao] = useState(rotina?.descricao ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggleDia = (d: number) => setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  // segunda = folga padrão das lojas
  const presets: { label: string; dias: number[] }[] = [
    { label: "Ter a dom", dias: [0, 2, 3, 4, 5, 6] },
    { label: "Todos os dias", dias: [0, 1, 2, 3, 4, 5, 6] },
  ];

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const input: RotinaInput = { id: rotina?.id, unitId, responsavelId, tipo, frequencia, diasSemana: dias, diaMes: frequencia === "mensal" ? diaMes : null, descricao };
        start(async () => {
          const r: Res = await saveNutriRotina(input);
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Rotina salva.") : (r.error ?? "Falha.") });
          if (r.ok) {
            router.refresh();
            onClose();
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{rotina ? "Editar rotina" : "Nova rotina"}</h2>
        <button type="button" aria-label="Fechar" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.em_abertura ? " (em abertura)" : ""}
              </option>
            ))}
          </Select>
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
        <Field label="O que fazer">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as NutriAgendaTipo)}>
            {(Object.keys(NUTRI_AGENDA_TIPO_LABELS) as NutriAgendaTipo[]).map((t) => (
              <option key={t} value={t}>
                {NUTRI_AGENDA_TIPO_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Frequência">
          <Select value={frequencia} onChange={(e) => setFrequencia(e.target.value as NutriRotinaFrequencia)}>
            <option value="semanal">Dias da semana</option>
            <option value="mensal">Uma vez por mês</option>
          </Select>
        </Field>
      </div>

      {frequencia === "semanal" ? (
        <div>
          <span className="mb-1 block text-sm font-medium">Dias</span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" aria-pressed={dias.includes(d)} onClick={() => toggleDia(d)} className={cn("min-h-0 rounded-full px-3 py-1.5 text-xs font-semibold", dias.includes(d) ? "bg-ink text-white" : "border border-line bg-white text-gray-700")}>
                {DIAS_SEMANA_CURTO[d]}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3 text-xs">
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => setDias(p.dias)} className="min-h-0 font-medium text-brand-dark">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Field label="Dia do mês (1 a 28)" className="max-w-[12rem]">
          <Input type="number" min={1} max={28} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} required />
        </Field>
      )}

      <Field label="Descrição (opcional)">
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Ex.: planilhas, pasta de documentação e auditoria; relatório no grupo ao final" />
      </Field>
      {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      <Button type="submit" full disabled={pending || !unitId || !responsavelId}>
        <Plus className="h-4 w-4" /> {pending ? "Salvando…" : rotina ? "Salvar alterações" : "Criar rotina"}
      </Button>
    </form>
  );
}

/** Linha de rotina com pausar/reativar, editar e excluir. */
export function RotinaRow({ rotina, unitName, responsavelNome, unitEmAbertura, team, units }: { rotina: NutriRotina; unitName: string; responsavelNome: string; unitEmAbertura: boolean; team: Membro[]; units: Unit[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
    });
  if (editing) return <RotinaForm rotina={rotina} team={team} units={units} onClose={() => setEditing(false)} />;
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border bg-white px-3 py-3", rotina.ativa ? "border-line" : "border-line opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{unitName}</span>
          <span className="text-xs text-gray-500">{NUTRI_AGENDA_TIPO_LABELS[rotina.tipo]}</span>
          {!rotina.ativa && <Badge tone="gray">pausada</Badge>}
          {unitEmAbertura && <Badge tone="yellow">loja em abertura · não gera visitas</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-gray-700">
          <span className="font-medium">{descreverFrequencia(rotina)}</span> · {responsavelNome}
        </p>
        {rotina.descricao && <p className="mt-0.5 text-xs text-gray-500">{rotina.descricao}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label="Editar" title="Editar" disabled={pending} onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" aria-label={rotina.ativa ? "Pausar" : "Reativar"} title={rotina.ativa ? "Pausar" : "Reativar"} disabled={pending} onClick={() => run(() => setNutriRotinaAtiva(rotina.id, !rotina.ativa))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
          {rotina.ativa ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" aria-label="Excluir" title="Excluir" disabled={pending} onClick={() => run(() => deleteNutriRotina(rotina.id))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Botão "Nova rotina" que abre o formulário. */
export function RotinaNewToggle({ team, units }: { team: Membro[]; units: Unit[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova rotina
      </Button>
    );
  return <RotinaForm team={team} units={units} onClose={() => setOpen(false)} />;
}

/** Gera/completa a agenda dos próximos 30 dias a partir das rotinas ativas. */
export function GerarAgendaButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r: Res = await gerarAgendaRotinas();
            setMsg(r.ok ? (r.message ?? "Agenda gerada.") : (r.error ?? "Falha."));
            if (r.ok) router.refresh();
          })
        }
      >
        <CalendarCheck className="h-4 w-4" /> {pending ? "Gerando…" : "Gerar agenda dos próximos 30 dias"}
      </Button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}
