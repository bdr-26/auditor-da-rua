"use client";

import { useRef } from "react";
import { Camera, Check, Loader2, Minus, X } from "lucide-react";
import { Textarea } from "@/components/ui/form";
import type { NutriFillAnswer } from "@/lib/data/nutri";
import type { NutriAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface LocalPhoto {
  id: string;
  url: string;
}

const OPTIONS: { value: NutriAnswer; label: string; icon: typeof Check; on: string; off: string }[] = [
  { value: "conforme", label: "Conforme", icon: Check, on: "bg-green-600 text-white ring-green-600", off: "bg-green-50 text-green-800 hover:bg-green-100" },
  { value: "nao_conforme", label: "Não conforme", icon: X, on: "bg-red-600 text-white ring-red-600", off: "bg-red-50 text-red-800 hover:bg-red-100" },
  { value: "na", label: "N/A", icon: Minus, on: "bg-gray-700 text-white ring-gray-700", off: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
];

export function AnswerRow({
  index,
  answer,
  photoUrls,
  uploading,
  highlight,
  onResposta,
  onObservacao,
  onAddPhotos,
  onRemovePhoto,
}: {
  index: number;
  answer: NutriFillAnswer;
  photoUrls: Record<string, string>;
  uploading: LocalPhoto[];
  highlight?: boolean;
  onResposta: (resposta: NutriAnswer) => void;
  onObservacao: (texto: string) => void;
  onAddPhotos: (files: FileList) => void;
  onRemovePhoto: (photoId: string, path: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const nc = answer.resposta === "nao_conforme";
  const semApontamento = nc && !(answer.observacao ?? "").trim();

  return (
    <div id={`item-${answer.id}`} className={cn("card scroll-mt-40", highlight && "ring-2 ring-brand", answer.resposta == null && "border-l-4 border-l-brand")}>
      <div className="flex gap-2.5">
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", answer.resposta ? "bg-ink text-white" : "bg-surface-muted text-gray-500")}>{index}</span>
        <p className="text-[15px] font-medium leading-snug">{answer.descricao}</p>
      </div>
      {answer.peso !== 1 && <p className="mt-1 text-xs text-gray-500">peso {answer.peso}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const selected = answer.resposta === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onResposta(o.value)}
              className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold leading-tight transition", selected ? cn(o.on, "ring-2 ring-offset-1") : o.off)}
            >
              <o.icon className="h-5 w-5" />
              {o.label}
            </button>
          );
        })}
      </div>

      {nc && (
        <div className="mt-3 space-y-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-sm font-medium">
              <span>Apontamento</span>
              {semApontamento && <span className="text-xs font-semibold text-red-700">obrigatório</span>}
            </span>
            <Textarea
              value={answer.observacao ?? ""}
              onChange={(e) => onObservacao(e.target.value)}
              placeholder="Descreva o que foi encontrado…"
              className={cn(semApontamento && "border-red-300")}
            />
          </label>

          <div>
            <div className="flex flex-wrap gap-2">
              {answer.photos.map((p) => (
                <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200">
                  {photoUrls[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrls[p.id]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <Camera className="h-5 w-5" />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => onRemovePhoto(p.id, p.path)}
                    className="absolute right-1 top-1 flex h-7 w-7 min-h-0 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {uploading.map((u) => (
                <div key={u.id} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.url} alt="" className="h-full w-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">enviando…</span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white text-xs font-medium text-gray-600 hover:border-brand hover:text-brand-dark"
              >
                <Camera className="h-5 w-5" />
                Foto
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) onAddPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="mt-1 text-xs text-gray-500">Foto opcional. Fica na fila e reenvia sozinha se a conexão cair.</p>
          </div>
        </div>
      )}
    </div>
  );
}
