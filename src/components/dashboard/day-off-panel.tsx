"use client";

import { useState, useTransition } from "react";
import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { removeDayOff, setSundayOff } from "@/lib/dashboard-actions";
import { formatDayLabelPT } from "@/lib/dates";
import { sundaysOfMonth } from "@/lib/domain/schedule";
import type { AuditorDayOff } from "@/lib/types";

/** Escolha do domingo de folga do mês (1 por mês), antes ou depois de gerar a rotina. */
export function DayOffPanel({ mes, today, daysOff }: { mes: string; today: string; daysOff: AuditorDayOff[] }) {
  const router = useRouter();
  const current = daysOff.find((d) => d.motivo === "Folga de domingo") ?? null;
  const sundays = sundaysOfMonth(mes).filter((d) => d >= today || d === current?.data);
  const [choice, setChoice] = useState(current?.data ?? sundays[0] ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Feito.") : (r.error ?? "Falha.") });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-muted p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Coffee className="h-4 w-4 text-brand-dark" /> Folga do mês
        </div>
        <p className="text-xs text-gray-500">Segundas são folga fixa. Escolha também 1 domingo de folga: ele sai da rotação e não conta na rotina.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem]">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={pending || sundays.length === 0} aria-label="Domingo de folga">
            {sundays.length === 0 && <option value="">Nenhum domingo disponível</option>}
            {sundays.map((d) => (
              <option key={d} value={d}>
                {formatDayLabelPT(d)}
                {current?.data === d ? " · atual" : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" disabled={pending || !choice || choice === current?.data} onClick={() => run(() => setSundayOff(choice))}>
          {current ? "Trocar folga" : "Definir folga"}
        </Button>
        {current && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => removeDayOff(current.data))}>
            Remover folga
          </Button>
        )}
      </div>
      {current && <p className="mt-2 text-xs text-gray-600">Folga atual: <strong className="capitalize">{formatDayLabelPT(current.data)}</strong></p>}
      {msg && <p className={msg.ok ? "mt-2 text-xs text-green-700" : "mt-2 text-xs text-red-700"}>{msg.text}</p>}
    </div>
  );
}
