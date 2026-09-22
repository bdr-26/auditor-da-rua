"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Textarea } from "@/components/ui/form";
import { getItemGuidance } from "@/lib/audit-guidance";
import { PHOTO_REQUIRED_MAX_SCORE, SCORE_COLORS, SCORE_LABELS } from "@/lib/constants";
import type { ScoringItem } from "@/lib/domain/scoring";
import type { Score } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LocalAnswer, LocalPhoto } from "./fill-types";
import { PhotoStrip } from "./photo-strip";

const SCORES: Score[] = [1, 2, 3, 4, 5];

export function ScoreItem({
  item,
  answer,
  photoBusy,
  onScore,
  onNA,
  onObservacao,
  onProdutoVencido,
  onAddPhotos,
  onRemovePhoto,
}: {
  item: ScoringItem;
  answer: LocalAnswer | undefined;
  photoBusy?: boolean;
  onScore: (nota: Score) => void;
  onNA: () => void;
  onObservacao: (texto: string) => void;
  onProdutoVencido: (v: boolean) => void;
  onAddPhotos: (files: FileList) => void;
  onRemovePhoto: (p: LocalPhoto) => void;
}) {
  const nota = answer && !answer.na ? answer.nota : null;
  const na = !!answer?.na;
  const low = nota != null && nota <= PHOTO_REQUIRED_MAX_SCORE;
  const [obsOpen, setObsOpen] = useState(false);
  const showObs = low || obsOpen || !!answer?.observacao;
  const guidance = getItemGuidance(item.chave);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className={cn("card", low && "border-orange-300")}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-base font-medium leading-snug">{item.descricao}</p>
        {item.falha_grave && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" /> Falha grave
          </span>
        )}
      </div>

      {guidance && (
        <div className="mb-3">
          <button
            type="button"
            aria-expanded={guideOpen}
            onClick={() => setGuideOpen((v) => !v)}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-dark hover:bg-surface-muted"
          >
            <Info className="h-4 w-4" />
            O que conferir
            {guideOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {guideOpen && (
            <div className="mt-1 rounded-xl bg-surface-muted p-3 text-sm text-gray-700">
              <ul className="list-disc space-y-1 pl-4">
                {guidance.conferir.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <dl className="mt-3 grid gap-1 border-t border-line pt-2 text-xs">
                <div className="flex gap-2">
                  <dt className="w-5 shrink-0 font-bold text-green-700">5</dt>
                  <dd>{guidance.notas[5]}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-5 shrink-0 font-bold text-yellow-700">3</dt>
                  <dd>{guidance.notas[3]}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-5 shrink-0 font-bold text-red-700">1</dt>
                  <dd>{guidance.notas[1]}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {SCORES.map((s) => {
          const c = SCORE_COLORS[s];
          const selected = nota === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => onScore(s)}
              className={cn(
                "flex min-h-[64px] flex-col items-center justify-center rounded-xl px-1 py-2 transition",
                selected ? cn(c.solid, "text-white ring-2 ring-offset-2", c.ring) : cn(c.bg, c.text, "hover:ring-2", c.ring),
              )}
            >
              <span className="text-2xl font-bold leading-none">{s}</span>
              <span className="mt-1 text-[10px] font-medium leading-tight text-center">{SCORE_LABELS[s]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          aria-pressed={na}
          onClick={onNA}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
            na ? "border-ink bg-ink text-white" : "border-line bg-white text-gray-600 hover:bg-surface-muted",
          )}
        >
          N/A
        </button>
        {!low && !na && (
          <button
            type="button"
            onClick={() => setObsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-surface-muted"
          >
            {showObs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showObs ? "Ocultar observação" : "Adicionar observação"}
          </button>
        )}
      </div>

      {na && <p className="mt-2 text-xs text-gray-500">Item não se aplica nesta visita — sai do cálculo da nota.</p>}

      {!na && low && (
        <div className="mt-4 space-y-4 rounded-xl bg-orange-50/60 p-3">
          <PhotoStrip photos={answer?.photos ?? []} required busy={photoBusy} onAdd={onAddPhotos} onRemove={onRemovePhoto} />
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-sm font-medium">
              Observação <span className="text-red-600">*</span>
              {!answer?.observacao?.trim() && <span className="text-xs font-semibold text-red-600">obrigatória</span>}
            </span>
            <Textarea
              value={answer?.observacao ?? ""}
              onChange={(e) => onObservacao(e.target.value)}
              placeholder="O que foi encontrado e o que precisa ser corrigido"
            />
          </label>
          {item.produto_vencido && nota === 1 && (
            <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-white p-3">
              <input
                type="checkbox"
                checked={answer?.produto_vencido ?? true}
                onChange={(e) => onProdutoVencido(e.target.checked)}
                className="mt-1 h-5 w-5 min-h-0 accent-red-600"
              />
              <span>
                <span className="block text-sm font-medium text-red-800">Havia produto vencido em uso</span>
                <span className="block text-xs text-gray-600">Marca a loja como inelegível à premiação do mês.</span>
              </span>
            </label>
          )}
        </div>
      )}

      {!na && !low && showObs && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">Observação (opcional)</span>
          <Textarea value={answer?.observacao ?? ""} onChange={(e) => onObservacao(e.target.value)} placeholder="Algo a registrar sobre este item" />
        </label>
      )}
    </div>
  );
}
