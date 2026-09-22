"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, Paperclip, Play, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { addDemandaComment, cancelDemanda, concludeDemanda, registerDemandaAttachment, removeDemandaAttachment, reopenDemanda, setDemandaStatus } from "@/lib/demandas-actions";
import { compressImage } from "@/lib/photos/compress";
import { createClient } from "@/lib/supabase/client";
import type { Demanda, DemandaAnexo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Res>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Falha.");
      else {
        after?.();
        router.refresh();
      }
    });
  };
  return { run, pending, error };
}

/** Botões de andamento do gerente: iniciar / voltar para aberta. */
export function StatusButtons({ d }: { d: Demanda }) {
  const { run, pending, error } = useRun();
  if (d.status === "concluida" || d.status === "cancelada") return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending || d.status === "aberta"}
          onClick={() => run(() => setDemandaStatus(d.id, "aberta"))}
          className={cn("min-h-[48px] rounded-xl border text-sm font-semibold", d.status === "aberta" ? "border-ink bg-ink text-white" : "border-line bg-white")}
        >
          Aberta
        </button>
        <button
          type="button"
          disabled={pending || d.status === "em_andamento"}
          onClick={() => run(() => setDemandaStatus(d.id, "em_andamento"))}
          className={cn("flex min-h-[48px] items-center justify-center gap-1 rounded-xl border text-sm font-semibold", d.status === "em_andamento" ? "border-yellow-500 bg-yellow-400 text-ink" : "border-line bg-white")}
        >
          <Play className="h-4 w-4" /> Em andamento
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Comentário de andamento. */
export function CommentForm({ demandaId }: { demandaId: string }) {
  const [texto, setTexto] = useState("");
  const { run, pending, error } = useRun();
  return (
    <div>
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Atualização, dúvida ou combinado…" />
      <div className="mt-2 flex items-center justify-between gap-2">
        {error ? <p className="text-xs text-red-700">{error}</p> : <span />}
        <Button size="sm" disabled={pending || !texto.trim()} onClick={() => run(() => addDemandaComment(demandaId, texto), () => setTexto(""))}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Comentar
        </Button>
      </div>
    </div>
  );
}

/** Conclusão: obriga o relato do que foi feito. */
export function ConcludeForm({ d }: { d: Demanda }) {
  const [texto, setTexto] = useState("");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useRun();
  if (d.status === "concluida" || d.status === "cancelada") return null;
  if (!open)
    return (
      <Button size="lg" full onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-5 w-5" /> Marcar como feito
      </Button>
    );
  const valido = texto.trim().length >= 10;
  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-3">
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-sm font-semibold">
          <span>O que foi feito?</span>
          <span className="text-xs font-semibold text-red-700">obrigatório</span>
        </span>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Descreva o que foi feito, quando e o resultado. Anexe fotos se ajudar." autoFocus />
      </label>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Voltar
        </Button>
        <Button full disabled={pending || !valido} onClick={() => run(() => concludeDemanda(d.id, texto))}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir demanda
        </Button>
      </div>
      {!valido && <p className="mt-1 text-xs text-gray-600">Mínimo de 10 caracteres.</p>}
    </div>
  );
}

/** Ações do proprietário: cancelar (com motivo) ou reabrir. */
export function OwnerActions({ d }: { d: Demanda }) {
  const [motivo, setMotivo] = useState("");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useRun();
  if (d.status === "concluida" || d.status === "cancelada")
    return (
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => reopenDemanda(d.id))}>
        <RotateCcw className="h-4 w-4" /> Reabrir demanda
      </Button>
    );
  return (
    <div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-0 items-center gap-1 text-sm text-gray-500 hover:text-red-700">
          <XCircle className="h-4 w-4" /> Cancelar demanda
        </button>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo do cancelamento" />
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Voltar
            </Button>
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => cancelDemanda(d.id, motivo))}>
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Anexos: envio direto ao bucket `demandas` (imagens comprimidas, PDFs como estão) + registro na tabela. */
export function Attachments({ d, anexos, canEdit }: { d: Demanda; anexos: (DemandaAnexo & { url: string | null })[]; canEdit: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { run, pending, error } = useRun();
  const router = useRouter();
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(files: FileList) {
    setBusy(true);
    setUploadError(null);
    const supabase = createClient();
    try {
      for (const f of Array.from(files)) {
        const isImg = f.type.startsWith("image/");
        const blob = isImg ? await compressImage(f) : f;
        const ext = isImg ? "jpg" : (f.name.split(".").pop() ?? "bin").toLowerCase();
        const path = `${d.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("demandas").upload(path, blob, { contentType: isImg ? "image/jpeg" : f.type || "application/octet-stream" });
        if (upErr) throw upErr;
        const r = await registerDemandaAttachment(d.id, { path, nome: f.name, mime: isImg ? "image/jpeg" : f.type, tamanho: blob.size });
        if (!r.ok) throw new Error(r.error);
      }
      router.refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {anexos.length === 0 && <p className="text-sm text-gray-500">Nenhum anexo.</p>}
      <ul className="space-y-2">
        {anexos.map((a) => {
          const isImg = (a.mime ?? "").startsWith("image/");
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2">
              {isImg && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-muted text-gray-500">
                  <FileText className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.nome}</div>
                <div className="text-xs text-gray-500">{a.tamanho ? `${Math.round(a.tamanho / 1024)} KB` : ""}</div>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener" className="rounded-lg px-2 py-1 text-sm font-medium text-brand-dark">
                  Abrir
                </a>
              )}
              {canEdit && (
                <button type="button" aria-label="Remover anexo" disabled={pending} onClick={() => run(() => removeDemandaAttachment(a.id))} className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white text-sm font-medium text-gray-600 hover:border-brand hover:text-brand-dark disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} {busy ? "Enviando…" : "Anexar foto ou PDF"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
        </>
      )}
      {(uploadError || error) && <p className="mt-2 text-xs text-red-700">{uploadError ?? error}</p>}
    </div>
  );
}
