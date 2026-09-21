"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { saveUnit, type UnitInput } from "@/lib/admin-actions";
import type { Unit } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";

export function UnitForm({ unit, onClose }: { unit?: Unit | null; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<UnitInput>({
    id: unit?.id,
    nome: unit?.nome ?? "",
    tipo: unit?.tipo ?? "loja",
    ativa: unit?.ativa ?? true,
    entra_no_ranking: unit?.entra_no_ranking ?? true,
    ordem_rotacao: unit?.ordem_rotacao ?? null,
    supervisor_nome: unit?.supervisor_nome ?? "",
    endereco: unit?.endereco ?? "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof UnitInput>(k: K, v: UnitInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveUnit(form);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Salvo." } : { ok: false, text: r.error });
          if (r.ok) {
            router.refresh();
            if (!unit) onClose();
          }
        });
      }}
    >
      <h2 className="text-base font-semibold">{unit ? `Editar ${unit.nome}` : "Nova unidade"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" hint={!unit ? `slug: ${slugify(form.nome) || "—"}` : `slug: ${unit.slug}`}>
          <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => set("tipo", e.target.value as UnitInput["tipo"])}>
            <option value="loja">Loja</option>
            <option value="producao">Produção (cozinha central)</option>
          </Select>
        </Field>
        <Field label="Supervisor(a)">
          <Input value={form.supervisor_nome ?? ""} onChange={(e) => set("supervisor_nome", e.target.value)} />
        </Field>
        <Field label="Ordem na rotação" hint={unit ? "Posição na escala qua–dom" : "Vazio = última posição (máx + 1)"}>
          <Input type="number" min={0} step={1} value={form.ordem_rotacao ?? ""} onChange={(e) => set("ordem_rotacao", e.target.value === "" ? null : Number(e.target.value))} />
        </Field>
        <Field label="Endereço" className="sm:col-span-2">
          <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.ativa} onChange={(e) => set("ativa", e.target.checked)} className="h-5 w-5 accent-brand" /> Ativa
        </label>
        <label className={cn("flex items-center gap-2", form.tipo === "producao" && "opacity-50")}>
          <input type="checkbox" checked={form.tipo === "producao" ? false : form.entra_no_ranking} disabled={form.tipo === "producao"} onChange={(e) => set("entra_no_ranking", e.target.checked)} className="h-5 w-5 accent-brand" /> Entra no ranking e na rotação
        </label>
      </div>
      {!unit && (
        <p className="rounded-lg bg-surface-muted p-3 text-xs text-gray-600">
          A nova loja entra automaticamente na rotação nos dias ainda não gerados da agenda e recebe uma cópia do checklist nutricional de Imigrantes, marcado como “em revisão”. Para incluí-la já nos dias futuros previstos, use “Regenerar dias futuros”.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : unit ? "Salvar" : "Criar unidade"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
        {msg && <span className={cn("text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</span>}
      </div>
    </form>
  );
}
