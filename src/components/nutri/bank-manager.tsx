"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { NutriBankItemWithUsage } from "@/lib/data/nutri";
import { formatDateTimePT } from "@/lib/dates";
import { createBankItem, setBankItemActive, updateBankItem } from "@/lib/nutri-actions";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

export function BankManager({ items, areas }: { items: NutriBankItemWithUsage[]; areas: string[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const { run, pending, error, info } = useAction();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => (showInactive || i.ativo) && (!term || i.descricao.toLowerCase().includes(term) || i.area_padrao.toLowerCase().includes(term)));
  }, [items, q, showInactive]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item ou área…" className="pl-9" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" className="h-5 w-5 min-h-0 accent-brand" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          mostrar desativados
        </label>
        <Button onClick={() => setCreating((v) => !v)} variant={creating ? "secondary" : "primary"}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {creating && (
        <NewItemForm
          areas={areas}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => void run(() => createBankItem(v), (r) => r.ok && setCreating(false))}
        />
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{info}</p>}

      <p className="text-xs text-gray-500">
        {filtered.length} de {items.length} itens · Editar o texto cria uma nova versão; auditorias antigas mantêm o texto da época.
      </p>

      <ul className="space-y-2">
        {filtered.map((item) => (
          <BankRow key={item.id} item={item} areas={areas} />
        ))}
      </ul>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado.</p>}
    </div>
  );
}

function NewItemForm({ areas, pending, onCancel, onSubmit }: { areas: string[]; pending: boolean; onCancel: () => void; onSubmit: (v: { descricao: string; area_padrao: string; peso: number }) => void }) {
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState(areas[0] ?? "");
  const [novaArea, setNovaArea] = useState("");
  const [peso, setPeso] = useState("1");
  const areaFinal = area === "__nova__" ? novaArea : area;
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ descricao, area_padrao: areaFinal, peso: Number(peso) || 1 });
      }}
    >
      <h3 className="font-semibold">Novo item do banco</h3>
      <Field label="Texto do item" hint="Redação em negativo: descreva o problema (ex.: “Saleiros sujos”).">
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Área padrão">
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="__nova__">Outra área…</option>
          </Select>
        </Field>
        {area === "__nova__" ? (
          <Field label="Nome da nova área">
            <Input value={novaArea} onChange={(e) => setNovaArea(e.target.value)} required />
          </Field>
        ) : (
          <Field label="Peso">
            <Input type="number" min={0.1} step={0.5} value={peso} onChange={(e) => setPeso(e.target.value)} />
          </Field>
        )}
      </div>
      {area === "__nova__" && (
        <Field label="Peso">
          <Input type="number" min={0.1} step={0.5} value={peso} onChange={(e) => setPeso(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || !descricao.trim() || !areaFinal.trim()}>
          Criar item
        </Button>
      </div>
    </form>
  );
}

function BankRow({ item, areas }: { item: NutriBankItemWithUsage; areas: string[] }) {
  const [editing, setEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [descricao, setDescricao] = useState(item.descricao);
  const [peso, setPeso] = useState(String(item.peso));
  const [area, setArea] = useState(item.area_padrao);
  const { run, pending, error } = useAction();

  const save = () =>
    void run(
      () =>
        updateBankItem(item.id, {
          descricao: descricao.trim() !== item.descricao ? descricao : undefined,
          peso: Number(peso) !== item.peso ? Number(peso) : undefined,
          area_padrao: area.trim() !== item.area_padrao ? area : undefined,
        }),
      (r) => r.ok && setEditing(false),
    );
  const nothingChanged = descricao.trim() === item.descricao && Number(peso) === item.peso && area.trim() === item.area_padrao;

  return (
    <li className={cn("card", !item.ativo && "opacity-60")}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-snug">{item.descricao}</p>
            <button type="button" onClick={() => setEditing(true)} aria-label="Editar" className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <Badge tone="gray">{item.area_padrao}</Badge>
            <span>v{item.versao}</span>
            <span>· peso {item.peso}</span>
            <span>· {item.unidades} unidade(s)</span>
            {!item.ativo && <Badge tone="red">desativado</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {item.versions.length > 1 && (
              <button type="button" onClick={() => setShowVersions((v) => !v)} className="flex min-h-0 items-center gap-1 font-medium text-gray-600 hover:text-ink">
                {showVersions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {item.versions.length} versões
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => setBankItemActive(item.id, !item.ativo))}
              className={cn("min-h-0 font-medium", item.ativo ? "text-red-700" : "text-green-700")}
            >
              {item.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
          {showVersions && (
            <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs text-gray-600">
              {item.versions.map((v) => (
                <li key={v.id}>
                  <span className="font-semibold">v{v.versao}</span> · {formatDateTimePT(v.created_at)} — {v.descricao}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </>
      ) : (
        <div className="space-y-3">
          <Field label="Texto" hint="Editar o texto cria uma nova versão; auditorias antigas mantêm o texto da época.">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área padrão">
              <Input list={`areas-${item.id}`} value={area} onChange={(e) => setArea(e.target.value)} />
              <datalist id={`areas-${item.id}`}>
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
            <Field label="Peso">
              <Input type="number" min={0.1} step={0.5} value={peso} onChange={(e) => setPeso(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDescricao(item.descricao);
                setPeso(String(item.peso));
                setArea(item.area_padrao);
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={pending || nothingChanged || !descricao.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
