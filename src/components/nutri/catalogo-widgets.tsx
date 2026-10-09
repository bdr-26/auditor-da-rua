"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { deleteCatalogoItem, saveCatalogoItem, setCatalogoItemAtivo } from "@/lib/nutri-catalogo-actions";
import { CATALOGO_LABELS, type CatalogoCategoria } from "@/lib/nutri/controle-tipos";
import type { NutriCatalogoItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; message?: string; error?: string };

/** Novo item (ou vários, um por linha) numa categoria. */
export function CatalogoNovo({ categoria }: { categoria: CatalogoCategoria }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const meta = CATALOGO_LABELS[categoria];
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Cadastrar
      </Button>
    );
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r: Res = await saveCatalogoItem({ categoria, nome, detalhe: meta.detalhe ? detalhe : null });
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Cadastrado.") : (r.error ?? "Falha.") });
          if (r.ok) {
            setNome("");
            setDetalhe("");
            router.refresh();
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Cadastrar em {meta.nome.toLowerCase()}</h2>
        <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Field label={meta.detalhe ? "Nome" : "Nomes (um por linha para cadastrar vários)"}>
        {meta.detalhe ? <Input id="cat-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /> : <Textarea id="cat-nomes" value={nome} onChange={(e) => setNome(e.target.value)} rows={4} required placeholder={"Ex.:\nAlface\nTomate\nCebola"} />}
      </Field>
      {meta.detalhe && (
        <Field label={meta.detalhe}>
          <Input id="cat-detalhe" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="00.000.000/0000-00" />
        </Field>
      )}
      {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      <Button type="submit" full disabled={pending || !nome.trim()}>
        <Plus className="h-4 w-4" /> {pending ? "Salvando…" : "Cadastrar"}
      </Button>
    </form>
  );
}

export function CatalogoRow({ item }: { item: NutriCatalogoItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(item.nome);
  const [detalhe, setDetalhe] = useState(item.detalhe ?? "");
  const [pending, start] = useTransition();
  const meta = CATALOGO_LABELS[item.categoria];
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  if (editing)
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-3">
        <Field label="Nome" className="min-w-[10rem] flex-1">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        {meta.detalhe && (
          <Field label={meta.detalhe} className="min-w-[10rem] flex-1">
            <Input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
          </Field>
        )}
        <Button size="sm" disabled={pending} onClick={() => run(() => saveCatalogoItem({ id: item.id, categoria: item.categoria, nome, detalhe }))}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    );
  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2.5", !item.ativo && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <span className="font-medium">{item.nome}</span>
        {item.detalhe && <span className="ml-2 text-xs text-gray-500">{item.detalhe}</span>}
        {!item.ativo && (
          <Badge tone="gray" className="ml-2">
            inativo
          </Badge>
        )}
      </div>
      <button type="button" aria-label="Editar" disabled={pending} onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" aria-label={item.ativo ? "Desativar" : "Reativar"} disabled={pending} onClick={() => run(() => setCatalogoItemAtivo(item.id, !item.ativo))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-surface-muted">
        {item.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" aria-label="Excluir" disabled={pending} onClick={() => run(() => deleteCatalogoItem(item.id))} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
