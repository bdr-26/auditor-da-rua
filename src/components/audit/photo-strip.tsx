"use client";

import { useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import type { LocalPhoto } from "./fill-types";
import { cn } from "@/lib/utils";

/** Miniaturas + botão da câmera para um item com nota 1–2. */
export function PhotoStrip({
  photos,
  required,
  busy,
  onAdd,
  onRemove,
}: {
  photos: LocalPhoto[];
  required: boolean;
  busy?: boolean;
  onAdd: (files: FileList) => void;
  onRemove: (photo: LocalPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const missing = required && photos.length === 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Fotos {required && <span className="text-red-600">*</span>}</span>
        {missing && <span className="text-xs font-semibold text-red-600">foto obrigatória</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.key} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-gray-100">
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="Foto do item" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {p.queued && (
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] font-medium text-white">enviando…</span>
            )}
            <button
              type="button"
              aria-label="Remover foto"
              onClick={() => onRemove(p)}
              className="absolute right-1 top-1 flex h-6 w-6 min-h-0 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-medium",
            missing ? "border-red-400 text-red-600" : "border-line text-gray-600",
            "disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          Câmera
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
