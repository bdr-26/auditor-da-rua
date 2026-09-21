"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { AUDIT_TYPE_SHORT, SCORE_COLORS, SCORE_LABELS } from "@/lib/constants";
import { adjustPontualidade } from "@/lib/dashboard-actions";
import { formatDatePT, formatDateTimePT } from "@/lib/dates";
import type { PontualidadeRow } from "@/lib/data/dashboard";
import { cn, fmtPct } from "@/lib/utils";

function NotaChip({ nota, na }: { nota: number | null; na: boolean }) {
  if (na || nota == null) return <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">N/A</span>;
  const s = nota as 1 | 2 | 3 | 4 | 5;
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", SCORE_COLORS[s].bg, SCORE_COLORS[s].text)}>
      {nota} · {SCORE_LABELS[s]}
    </span>
  );
}

/** Uma auditoria: nota atual de pontualidade, trilha de ajustes e formulário de novo ajuste. */
export function PontualidadeItem({ row, readOnly }: { row: PontualidadeRow; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [nova, setNova] = useState("");
  const [just, setJust] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">{formatDatePT(row.audit.data)}</span>
          <span className="ml-2 text-gray-500">{AUDIT_TYPE_SHORT[row.audit.tipo]}</span>
          <span className="ml-2 text-gray-500">nota da auditoria {fmtPct(row.audit.nota_final)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Pontualidade:</span>
          <NotaChip nota={row.nota} na={row.na} />
          {!readOnly && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
              {open ? "Cancelar" : "Ajustar"}
            </Button>
          )}
        </div>
      </div>

      {row.adjustments.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-gray-600">
          {row.adjustments.map((a) => (
            <li key={a.id}>
              <span className="font-semibold">{a.user_nome}</span> em {formatDateTimePT(a.created_at)}: {a.valor_original ?? "N/A"} → <strong>{a.valor_novo}</strong> — “{a.justificativa}”
            </li>
          ))}
        </ul>
      )}

      {open && !readOnly && (
        <form
          className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            start(async () => {
              const r = await adjustPontualidade({ auditId: row.audit.id, answerId: row.answerId, novaNota: Number(nova), justificativa: just });
              setMsg(r.ok ? { ok: true, text: r.message ?? "Ajustado." } : { ok: false, text: r.error });
              if (r.ok) setOpen(false);
            });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Nova nota</span>
            <Select value={nova} onChange={(e) => setNova(e.target.value)} required>
              <option value="">—</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} · {SCORE_LABELS[n as 1 | 2 | 3 | 4 | 5]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Justificativa (Control iD, obrigatória)</span>
            <Textarea value={just} onChange={(e) => setJust(e.target.value)} required className="min-h-[44px]" rows={2} />
          </label>
          <Button type="submit" disabled={pending || !nova || !just.trim()}>
            {pending ? "Salvando…" : "Salvar ajuste"}
          </Button>
        </form>
      )}
      {msg && <p className={cn("mt-2 text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
    </li>
  );
}
