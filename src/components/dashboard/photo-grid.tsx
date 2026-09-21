"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SCORE_COLORS } from "@/lib/constants";
import { formatDateShortPT } from "@/lib/dates";
import type { NcPhoto } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

/** Grade de fotos das não conformidades com visualização ampliada. */
export function PhotoGrid({ photos }: { photos: NcPhoto[] }) {
  const [open, setOpen] = useState<NcPhoto | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((p, i) => (
          <button key={i} type="button" onClick={() => setOpen(p)} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.item} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            <span className={cn("absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", SCORE_COLORS[p.nota as 1 | 2].bg, SCORE_COLORS[p.nota as 1 | 2].text)}>
              nota {p.nota}
            </span>
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-left text-[10px] text-white">{p.item}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setOpen(null)}>
            <X className="h-6 w-6" />
          </button>
          <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.url} alt={open.item} className="max-h-[75vh] w-auto rounded-xl object-contain" />
            <figcaption className="mt-3 text-sm text-white">
              <span className="font-semibold">{open.item}</span> · nota {open.nota} · {open.data && formatDateShortPT(open.data)}
              {open.observacao && <p className="mt-1 text-gray-300">{open.observacao}</p>}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
