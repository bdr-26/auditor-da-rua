"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/form";
import { SCORE_COLORS } from "@/lib/constants";
import { formatDatePT } from "@/lib/dates";
import type { Score } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LocalPending } from "./fill-types";

export function PendingCard({
  pending,
  onReview,
  onObservacao,
}: {
  pending: LocalPending;
  onReview: (resolvida: boolean) => void;
  onObservacao: (texto: string) => void;
}) {
  const [obsOpen, setObsOpen] = useState(!!pending.observacao);
  const nota = pending.nota_origem as Score | null;
  const c = nota && nota >= 1 && nota <= 5 ? SCORE_COLORS[nota] : null;

  return (
    <div className={cn("card", pending.resolvida === true && "border-green-300", pending.resolvida === false && "border-red-300")}>
      <div className="flex items-start gap-3">
        {c && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-bold", c.bg, c.text)}>{nota}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-snug">{pending.descricao}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {pending.origem_data ? `Apontada em ${formatDatePT(pending.origem_data)}` : "Apontada na visita anterior"}
            {pending.visitas_sem_resolver > 0 && ` · ${pending.visitas_sem_resolver} visita(s) sem resolver`}
            {pending.reincidente && <span className="ml-1 font-semibold text-red-700">· reincidente</span>}
          </p>
          {pending.observacao_origem && <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-gray-700">{pending.observacao_origem}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={pending.resolvida === true}
          onClick={() => onReview(true)}
          className={cn(
            "flex min-h-[56px] items-center justify-center gap-2 rounded-xl text-base font-semibold transition",
            pending.resolvida === true ? "bg-green-600 text-white ring-2 ring-green-500 ring-offset-2" : "bg-green-50 text-green-800 hover:ring-2 hover:ring-green-400",
          )}
        >
          <Check className="h-5 w-5" /> Resolvida
        </button>
        <button
          type="button"
          aria-pressed={pending.resolvida === false}
          onClick={() => onReview(false)}
          className={cn(
            "flex min-h-[56px] items-center justify-center gap-2 rounded-xl text-base font-semibold transition",
            pending.resolvida === false ? "bg-red-600 text-white ring-2 ring-red-500 ring-offset-2" : "bg-red-50 text-red-800 hover:ring-2 hover:ring-red-400",
          )}
        >
          <RotateCcw className="h-5 w-5" /> Mantida
        </button>
      </div>

      <button
        type="button"
        onClick={() => setObsOpen((v) => !v)}
        className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-surface-muted"
      >
        {obsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {obsOpen ? "Ocultar observação" : "Adicionar observação"}
      </button>
      {obsOpen && (
        <Textarea value={pending.observacao} onChange={(e) => onObservacao(e.target.value)} placeholder="Como está o item hoje (opcional)" className="mt-1" />
      )}
    </div>
  );
}
