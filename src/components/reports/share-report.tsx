"use client";

import { useState } from "react";
import { FileText, Loader2, Printer, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ações de um relatório PDF no celular: compartilhar (folha de compartilhamento com o arquivo → WhatsApp),
 * abrir/imprimir e baixar. Sem suporte a compartilhar arquivo, cai para link assinado no WhatsApp.
 */
export function ShareReport({ pdfUrl, fileName, title, text, compact }: { pdfUrl: string; fileName: string; title: string; text: string; compact?: boolean }) {
  const [busy, setBusy] = useState<"share" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    setBusy("share");
    setMsg(null);
    try {
      // 1) folha de compartilhamento nativa com o PDF anexado (iOS 15+/Android): o usuário escolhe o WhatsApp
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const res = await fetch(pdfUrl, { cache: "no-store" });
          if (!res.ok) throw new Error("falha ao gerar o PDF");
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: "application/pdf" });
          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
          if (nav.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title, text });
            return;
          }
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return; // usuário cancelou
        }
      }
      // 2) link assinado (7 dias) direto no WhatsApp
      const res = await fetch(pdfUrl, { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "falha ao gerar o link");
      const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${json.url}`)}`;
      window.open(wa, "_blank", "noopener");
      setMsg("Link válido por 7 dias aberto no WhatsApp.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível compartilhar.");
    } finally {
      setBusy(null);
    }
  }

  const btn = "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-60";
  return (
    <div className={cn(compact ? "" : "card")}>
      <div className="flex gap-2">
        <button type="button" onClick={share} disabled={busy != null} className={cn(btn, "bg-[#25D366] text-white")}>
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Compartilhar
        </button>
        <a href={pdfUrl} target="_blank" rel="noopener" className={cn(btn, "border border-line bg-white text-ink")}>
          <Printer className="h-4 w-4" /> Abrir / imprimir
        </a>
        <a href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`} className={cn(btn, "max-w-[3.25rem] border border-line bg-white text-ink")} aria-label="Baixar PDF" title="Baixar PDF">
          <FileText className="h-4 w-4" />
        </a>
      </div>
      {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
      {!compact && <p className="mt-2 text-xs text-gray-500">PDF padronizado com cabeçalho, nota, áreas, apontamentos e fotos. “Compartilhar” abre a folha do celular com o arquivo anexado (WhatsApp, e-mail…).</p>}
    </div>
  );
}
