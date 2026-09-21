"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface GalleryPhoto {
  id: string;
  url: string;
}

/** Miniaturas com visualização em tela cheia ao tocar. */
export function PhotoGallery({ photos, size = "md" }: { photos: GalleryPhoto[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (photos.length === 0) return null;
  const dim = size === "sm" ? "h-16 w-16" : "h-24 w-24";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p)} className={`${dim} min-h-0 overflow-hidden rounded-lg bg-gray-200`} aria-label="Ampliar foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setOpen(null)}>
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
