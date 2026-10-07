"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { copyEquipamentos, deleteEquipamento, saveEquipamento, setEquipamentoAtivo } from "@/lib/nutri-equipamentos-actions";
import { AREAS_EQUIP, FAIXA_EQUIP, TIPOS_EQUIP } from "@/lib/nutri/controle-tipos";
import type { NutriEquipamento } from "@/lib/types";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; message?: string; error?: string };

function faixaLabel(tipo: string): string {
  const f = FAIXA_EQUIP[tipo];
  if (!f) return "";
  return f.max != null ? `até ${f.max} °C` : f.min != null ? `${f.min} °C ou mais` : "";
}

/** Formulário de equipamento (criar/editar). */
export function EquipamentoForm({ unitId, equip, onClose }: { unitId: string; equip?: NutriEquipamento | null; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(equip?.nome ?? "");
  const [tipo, setTipo] = useState(equip?.tipo ?? "Geladeira");
  const [area, setArea] = useState(equip?.area ?? "Cozinha");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r: Res = await saveEquipamento({ id: equip?.id, unitId, nome, tipo, area });
          if (r.ok) {
            router.refresh();
            onClose();
          } else setMsg(r.error ?? "Falha.");
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{equip ? "Editar equipamento" : "Novo equipamento"}</h2>
        <button type="button" aria-label="Fechar" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome / número" className="col-span-2">
          <Input id="equip-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Geladeira nº 02" required />
        </Field>
        <Field label="Tipo" hint={faixaLabel(tipo)}>
          <Select id="equip-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_EQUIP.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Área">
          <Select id="equip-area" value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS_EQUIP.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{msg}</p>}
      <Button type="submit" full disabled={pending || !nome.trim()}>
        <Plus className="h-4 w-4" /> {pending ? "Salvando…" : equip ? "Salvar" : "Cadastrar"}
      </Button>
    </form>
  );
}

export function EquipamentoRow({ equip }: { equip: NutriEquipamento }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
    });
  if (editing) return <EquipamentoForm unitId={equip.unit_id} equip={equip} onClose={() => setEditing(false)} />;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5", !equip.ativo && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{equip.nome}</span>
          {!equip.ativo && <Badge tone="gray">inativo</Badge>}
        </div>
        <p className="text-xs text-gray-500">
          {equip.tipo} · {faixaLabel(equip.tipo)}
          {equip.area ? ` · ${equip.area}` : ""}
        </p>
      </div>
      <button type="button" aria-label="Editar" disabled={pending} onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" aria-label={equip.ativo ? "Desativar" : "Reativar"} disabled={pending} onClick={() => run(() => setEquipamentoAtivo(equip.id, !equip.ativo))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
        {equip.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" aria-label="Excluir" disabled={pending} onClick={() => run(() => deleteEquipamento(equip.id))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EquipamentoNewToggle({ unitId }: { unitId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo equipamento
      </Button>
    );
  return <EquipamentoForm unitId={unitId} onClose={() => setOpen(false)} />;
}

/** Copiar o cadastro de outra unidade. */
export function CopiarEquipamentos({ toUnitId, origens }: { toUnitId: string; origens: { id: string; nome: string; n: number }[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(origens[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (origens.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-line bg-white p-3">
      <Field label="Copiar o cadastro de" className="min-w-[12rem] flex-1">
        <Select id="equip-copiar-de" value={from} onChange={(e) => setFrom(e.target.value)}>
          {origens.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome} ({o.n})
            </option>
          ))}
        </Select>
      </Field>
      <Button
        variant="secondary"
        disabled={pending || !from}
        onClick={() =>
          start(async () => {
            const r: Res = await copyEquipamentos(from, toUnitId);
            setMsg(r.ok ? (r.message ?? "Copiado.") : (r.error ?? "Falha."));
            if (r.ok) router.refresh();
          })
        }
      >
        <Copy className="h-4 w-4" /> Copiar
      </Button>
      {msg && <span className="basis-full text-xs text-gray-600">{msg}</span>}
    </div>
  );
}
