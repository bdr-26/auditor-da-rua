"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { regenerateFutureSchedule, toggleUnitActive } from "@/lib/admin-actions";
import type { Unit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UnitForm } from "./unit-form";

export function UnitsManager({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Unit | null | "new">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Feito." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nova unidade
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                "Regenerar os dias futuros previstos? Os dias ainda não realizados (a partir de amanhã) serão apagados e gerados de novo com a rotação atual. Trocas manuais de dias futuros serão perdidas.",
              )
            )
              run(regenerateFutureSchedule);
          }}
        >
          <RefreshCw className="h-4 w-4" /> Regenerar dias futuros previstos
        </Button>
        {msg && <span className={cn("text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</span>}
      </div>

      {editing && <UnitForm key={editing === "new" ? "new" : editing.id} unit={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr className="border-b border-line">
                <th className="px-4 py-2">Nome</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2 text-center">Rotação</th>
                <th className="py-2 pr-2">Supervisor</th>
                <th className="py-2 pr-2">Endereço</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className={cn("border-b border-line last:border-0", !u.ativa && "text-gray-400")}>
                  <td className="px-4 py-2.5 font-semibold">
                    {u.nome}
                    <span className="block text-xs font-normal text-gray-400">{u.slug}</span>
                  </td>
                  <td className="py-2.5 pr-2">{u.tipo === "producao" ? "Produção" : "Loja"}</td>
                  <td className="py-2.5 pr-2 text-center tabular-nums">{u.entra_no_ranking ? u.ordem_rotacao : <span className="text-xs text-gray-400">fora</span>}</td>
                  <td className="py-2.5 pr-2">{u.supervisor_nome ?? "—"}</td>
                  <td className="max-w-[14rem] truncate py-2.5 pr-2 text-gray-600">{u.endereco ?? "—"}</td>
                  <td className="py-2.5 pr-2">
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={u.ativa ? "green" : "gray"}>{u.ativa ? "ativa" : "inativa"}</Badge>
                      {u.entra_no_ranking && u.tipo === "loja" && <Badge tone="brand">ranking</Badge>}
                      {u.nutri_checklist_em_revisao && <Badge tone="yellow">nutri em revisão</Badge>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="flex justify-end gap-1">
                      <button type="button" aria-label="Editar" onClick={() => setEditing(u)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-muted">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => toggleUnitActive(u.id, !u.ativa))}>
                        {u.ativa ? "Desativar" : "Reativar"}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
