"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ClipboardCheck, CloudOff, Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/score";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import type { FillAnswer, FillPending } from "@/lib/data/audit-flow";
import { formatDatePT } from "@/lib/dates";
import { computeAuditScore, type ScoringBlock, type ScoringItem } from "@/lib/domain/scoring";
import { compressImage } from "@/lib/photos/compress";
import { enqueuePhoto, flushQueue, listQueued, startQueueWorker, type QueuedPhoto } from "@/lib/photos/upload-queue";
import { createClient } from "@/lib/supabase/client";
import type { AuditType, Score } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LocalAnswer, LocalPending, LocalPhoto } from "./fill-types";
import { PendingCard } from "./pending-step";
import { ScoreItem } from "./score-item";
import { buildSteps } from "./steps";

export interface AuditFillProps {
  auditId: string;
  tipo: AuditType;
  unitNome: string;
  data: string;
  blocks: ScoringBlock[];
  initialAnswers: FillAnswer[];
  initialPendings: FillPending[];
  initialStep: number;
}

type Job = () => Promise<void>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function blankAnswer(itemId: string): LocalAnswer {
  return { id: crypto.randomUUID(), item_id: itemId, nota: null, na: false, produto_vencido: false, observacao: "", photos: [] };
}

export function AuditFill({ auditId, tipo, unitNome, data, blocks, initialAnswers, initialPendings, initialStep }: AuditFillProps) {
  const supabase = useMemo(() => createClient(), []);
  const steps = useMemo(() => buildSteps(tipo, blocks), [tipo, blocks]);

  // ---------- estado local ----------
  const answersRef = useRef<Record<string, LocalAnswer>>(
    Object.fromEntries(
      initialAnswers.map((a) => [
        a.item_id,
        {
          id: a.id,
          item_id: a.item_id,
          nota: a.nota,
          na: a.na,
          produto_vencido: a.produto_vencido,
          observacao: a.observacao ?? "",
          photos: a.photos.map((p) => ({ key: p.id, id: p.id, path: p.path, url: null, queued: false })),
        } satisfies LocalAnswer,
      ]),
    ),
  );
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(answersRef.current);
  const pendingsRef = useRef<LocalPending[]>(
    initialPendings.map((p) => ({
      pending_issue_id: p.pending_issue_id,
      resolvida: p.resolvida,
      observacao: p.observacao ?? "",
      descricao: p.descricao,
      nota_origem: p.nota_origem,
      observacao_origem: p.observacao_origem,
      visitas_sem_resolver: p.visitas_sem_resolver,
      reincidente: p.reincidente,
      origem_data: p.origem_data,
    })),
  );
  const [pendings, setPendings] = useState<LocalPending[]>(pendingsRef.current);
  const [step, setStep] = useState(Math.min(Math.max(0, initialStep), steps.length - 1));
  const [busyJobs, setBusyJobs] = useState(0);
  const [offline, setOffline] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<Set<string>>(new Set());
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ---------- fila de gravação com retry (uma vaga por chave, sempre grava o último estado) ----------
  const jobs = useRef(new Map<string, Job>());
  const running = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());

  const refreshBusy = useCallback(() => {
    setBusyJobs(jobs.current.size + running.current.size + timers.current.size);
  }, []);

  const pump = useCallback(
    async (key: string) => {
      if (running.current.has(key)) return;
      running.current.add(key);
      refreshBusy();
      try {
        while (jobs.current.has(key)) {
          const fn = jobs.current.get(key)!;
          jobs.current.delete(key);
          refreshBusy();
          try {
            await fn();
            setOffline(false);
          } catch (e) {
            console.warn("[autosave] falhou, tentando novamente", e);
            if (!jobs.current.has(key)) jobs.current.set(key, fn);
            setOffline(true);
            refreshBusy();
            await sleep(3000);
          }
        }
      } finally {
        running.current.delete(key);
        refreshBusy();
      }
    },
    [refreshBusy],
  );

  const queueSave = useCallback(
    (key: string, fn: Job, delay = 0) => {
      jobs.current.set(key, fn);
      const t = timers.current.get(key);
      if (t) window.clearTimeout(t);
      timers.current.set(
        key,
        window.setTimeout(() => {
          timers.current.delete(key);
          void pump(key);
        }, delay),
      );
      refreshBusy();
    },
    [pump, refreshBusy],
  );

  // ---------- respostas ----------
  const writeAnswer = useCallback(
    async (a: LocalAnswer) => {
      const row = {
        id: a.id,
        audit_id: auditId,
        item_id: a.item_id,
        nota: a.na ? null : a.nota,
        na: a.na,
        produto_vencido: a.produto_vencido,
        observacao: a.observacao.trim() ? a.observacao : null,
      };
      const { error } = await supabase.from("audit_answers").upsert(row, { onConflict: "id" });
      if (!error) return;
      if (error.code === "23505") {
        // já existe resposta deste item (outra aba): adota o id existente
        const { data: existing } = await supabase.from("audit_answers").select("id").eq("audit_id", auditId).eq("item_id", a.item_id).maybeSingle();
        if (existing?.id) {
          const { error: e2 } = await supabase.from("audit_answers").update({ ...row, id: undefined }).eq("id", existing.id);
          if (e2) throw e2;
          updateAnswer(a.item_id, (cur) => ({ ...cur, id: existing.id as string }));
          return;
        }
      }
      throw error;
    },
    [auditId, supabase],
  );

  function updateAnswer(itemId: string, patch: (cur: LocalAnswer) => LocalAnswer): LocalAnswer {
    const cur = answersRef.current[itemId] ?? blankAnswer(itemId);
    const next = patch(cur);
    answersRef.current = { ...answersRef.current, [itemId]: next };
    setAnswers(answersRef.current);
    return next;
  }

  const saveAnswer = useCallback(
    (itemId: string, patch: (cur: LocalAnswer) => LocalAnswer, delay = 0) => {
      const next = updateAnswer(itemId, patch);
      const snapshot: LocalAnswer = { ...next };
      queueSave(`ans:${itemId}`, () => writeAnswer(snapshot), delay);
    },
    [queueSave, writeAnswer],
  );

  const setScore = (item: ScoringItem, nota: Score) =>
    saveAnswer(item.id, (cur) => ({
      ...cur,
      nota,
      na: false,
      produto_vencido: item.produto_vencido && nota === 1 ? (cur.nota === 1 ? cur.produto_vencido : true) : false,
    }));
  const toggleNA = (item: ScoringItem) => saveAnswer(item.id, (cur) => ({ ...cur, na: !cur.na, nota: null, produto_vencido: false }));
  const setObservacao = (item: ScoringItem, texto: string) => saveAnswer(item.id, (cur) => ({ ...cur, observacao: texto }), 600);
  const setProdutoVencido = (item: ScoringItem, v: boolean) => saveAnswer(item.id, (cur) => ({ ...cur, produto_vencido: v }));

  // ---------- pendências ----------
  const savePending = useCallback(
    (id: string, patch: (cur: LocalPending) => LocalPending, delay = 0) => {
      pendingsRef.current = pendingsRef.current.map((p) => (p.pending_issue_id === id ? patch(p) : p));
      setPendings(pendingsRef.current);
      const snap = pendingsRef.current.find((p) => p.pending_issue_id === id);
      if (!snap) return;
      const row = { audit_id: auditId, pending_issue_id: id, resolvida: snap.resolvida, observacao: snap.observacao.trim() ? snap.observacao : null };
      queueSave(
        `pend:${id}`,
        async () => {
          const { error } = await supabase.from("audit_pending_reviews").upsert(row, { onConflict: "audit_id,pending_issue_id" });
          if (error) throw error;
        },
        delay,
      );
    },
    [auditId, queueSave, supabase],
  );

  // ---------- fotos ----------
  const deletedQueued = useRef(new Set<string>());

  const deleteUploaded = useCallback(
    (photoId: string, path: string) => {
      queueSave(`photo:${photoId}`, async () => {
        const { error } = await supabase.from("audit_photos").delete().eq("id", photoId);
        if (error) throw error;
        await supabase.storage.from("audit-photos").remove([path]);
      });
    },
    [queueSave, supabase],
  );

  const onUploaded = useCallback(
    (p: QueuedPhoto, photoId: string) => {
      if (p.audit_id !== auditId) return;
      if (deletedQueued.current.has(p.id)) {
        deletedQueued.current.delete(p.id);
        deleteUploaded(photoId, p.path);
        return;
      }
      const entry = Object.values(answersRef.current).find((a) => a.id === p.answer_id);
      if (!entry) return;
      updateAnswer(entry.item_id, (cur) => ({
        ...cur,
        photos: cur.photos.map((ph) => (ph.key === p.id ? { ...ph, id: photoId, queued: false } : ph)),
      }));
    },
    [auditId, deleteUploaded],
  );
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const addPhotos = async (item: ScoringItem, files: FileList) => {
    setPhotoError(null);
    const answer = answersRef.current[item.id] ?? updateAnswer(item.id, (c) => c);
    setPhotoBusy((s) => new Set(s).add(item.id));
    try {
      for (const file of Array.from(files)) {
        try {
          const blob = await compressImage(file);
          const key = crypto.randomUUID();
          const path = `${auditId}/${answer.id}/${key}.jpg`;
          const url = URL.createObjectURL(blob);
          updateAnswer(item.id, (cur) => ({ ...cur, photos: [...cur.photos, { key, id: null, path, url, queued: true }] }));
          await enqueuePhoto({ id: key, answer_id: answer.id, audit_id: auditId, path, blob });
        } catch (e) {
          console.error("[fotos] falha ao preparar foto", e);
          setPhotoError("Não foi possível preparar a foto. Tente novamente.");
        }
      }
    } finally {
      setPhotoBusy((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
    // garante que a resposta exista antes do upload (FK) e dispara a fila
    const t = timers.current.get(`ans:${item.id}`);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(`ans:${item.id}`);
      void pump(`ans:${item.id}`);
    }
    void flushQueue((p, id) => onUploadedRef.current(p, id));
  };

  const removePhoto = (item: ScoringItem, photo: LocalPhoto) => {
    updateAnswer(item.id, (cur) => ({ ...cur, photos: cur.photos.filter((p) => p.key !== photo.key) }));
    if (photo.url?.startsWith("blob:")) URL.revokeObjectURL(photo.url);
    if (photo.queued) {
      deletedQueued.current.add(photo.key);
      return;
    }
    if (photo.id) deleteUploaded(photo.id, photo.path);
  };

  // fotos na fila local (de sessões anteriores) + URLs assinadas das já enviadas + worker de reenvio
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const queued = await listQueued(auditId);
        for (const q of queued) {
          const entry = Object.values(answersRef.current).find((a) => a.id === q.answer_id);
          if (!entry || entry.photos.some((p) => p.key === q.id)) continue;
          const url = URL.createObjectURL(q.blob);
          updateAnswer(entry.item_id, (cur) => ({ ...cur, photos: [...cur.photos, { key: q.id, id: null, path: q.path, url, queued: true }] }));
        }
      } catch (e) {
        console.warn("[fotos] fila local indisponível", e);
      }
      const paths = Object.values(answersRef.current).flatMap((a) => a.photos.filter((p) => !p.url && !p.queued).map((p) => p.path));
      if (paths.length > 0 && !cancelled) {
        const { data } = await supabase.storage.from("audit-photos").createSignedUrls(paths, 60 * 60);
        const byPath = new Map<string, string>();
        for (const d of (data ?? []) as { path: string | null; signedUrl: string | null }[]) {
          if (d.path && d.signedUrl) byPath.set(d.path, d.signedUrl);
        }
        for (const a of Object.values(answersRef.current)) {
          if (!a.photos.some((p) => !p.url && byPath.has(p.path))) continue;
          updateAnswer(a.item_id, (cur) => ({
            ...cur,
            photos: cur.photos.map((p): LocalPhoto => (!p.url && byPath.has(p.path) ? { ...p, url: byPath.get(p.path) as string } : p)),
          }));
        }
      }
    })();
    const stop = startQueueWorker((p, id) => onUploadedRef.current(p, id));
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  // sem pendências: o item "pendências da visita anterior" é N/A automaticamente
  useEffect(() => {
    if (pendingsRef.current.length > 0) return;
    for (const item of steps[0].items) {
      const a = answersRef.current[item.id];
      if (a && (a.na || a.nota != null)) continue;
      saveAnswer(item.id, (cur) => ({ ...cur, na: true, nota: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mede o cabeçalho e a barra inferior do AppShell para posicionar header/rodapé fixos
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const header = document.querySelector<HTMLElement>("header.sticky");
      const nav = document.querySelector<HTMLElement>("nav.fixed");
      const h = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect().height : 0;
      const n = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
      el.style.setProperty("--fill-top", `${Math.round(h)}px`);
      el.style.setProperty("--fill-nav", `${Math.round(n)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // aviso ao sair com gravação pendente
  useEffect(() => {
    if (busyJobs === 0) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busyJobs]);

  // ---------- navegação ----------
  const goTo = (n: number) => {
    const next = Math.min(Math.max(0, n), steps.length - 1);
    setStep(next);
    queueSave("etapa", async () => {
      const { error } = await supabase.from("audits").update({ etapa_atual: next }).eq("id", auditId);
      if (error) throw error;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- nota parcial ----------
  const result = useMemo(
    () =>
      computeAuditScore(
        tipo,
        blocks,
        Object.values(answers).map((a) => ({ item_id: a.item_id, nota: a.nota, na: a.na, produto_vencido: a.produto_vencido, observacao: a.observacao, fotos: a.photos.length })),
      ),
    [tipo, blocks, answers],
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const pendingsNotReviewed = pendings.filter((p) => p.resolvida == null).length;
  const stepMissing = current.items.filter((i) => result.faltando.includes(i.id)).length + (current.kind === "pendencias" ? pendingsNotReviewed : 0);

  return (
    <div ref={rootRef} className="-mx-4 -mt-5 pb-28 sm:-mx-6 lg:pb-24">
      {/* cabeçalho fixo (abaixo do header do AppShell no celular) */}
      <div className="sticky z-20 border-b border-line bg-white px-4 pb-3 pt-3 shadow-sm sm:px-6" style={{ top: "var(--fill-top, 69px)" }}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-bold">{unitNome}</div>
              <div className="text-xs text-gray-500">
                {AUDIT_TYPE_SHORT[tipo]} · {formatDatePT(data)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <SaveIndicator busy={busyJobs > 0} offline={offline} />
              <span className="rounded-lg bg-surface-muted px-2 py-1 text-sm font-semibold tabular-nums">
                {result.respondidos}/{result.total} itens
              </span>
            </div>
          </div>
          <ProgressBar value={result.respondidos} max={result.total} className="mt-2" />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>
              Etapa {step + 1} de {steps.length}
            </span>
            <span className={cn(stepMissing > 0 ? "text-gray-500" : "font-semibold text-green-700")}>
              {stepMissing > 0 ? `${stepMissing} pendente(s) nesta etapa` : "etapa completa"}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-4 sm:px-6">
        <div>
          <h1 className="text-xl font-bold">{current.titulo}</h1>
          {current.descricao && (
            <p className={cn("mt-1 text-sm", current.chave === "seguranca" ? "font-medium text-red-700" : "text-gray-600")}>
              {current.chave === "seguranca" && <AlertTriangle className="mr-1 inline h-4 w-4" />}
              {current.descricao}
            </p>
          )}
        </div>

        {photoError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {photoError}
          </p>
        )}

        {current.kind === "pendencias" &&
          (pendings.length === 0 ? (
            <div className="card flex items-center gap-3 border-green-200 bg-green-50/50">
              <Check className="h-6 w-6 shrink-0 text-green-700" />
              <div>
                <p className="font-medium">Nenhuma pendência da visita anterior</p>
                <p className="text-sm text-gray-600">O item de pendências foi marcado como N/A automaticamente.</p>
              </div>
            </div>
          ) : (
            <>
              {pendings.map((p) => (
                <PendingCard
                  key={p.pending_issue_id}
                  pending={p}
                  onReview={(v) => savePending(p.pending_issue_id, (cur) => ({ ...cur, resolvida: v }))}
                  onObservacao={(t) => savePending(p.pending_issue_id, (cur) => ({ ...cur, observacao: t }), 600)}
                />
              ))}
              {current.items.length > 0 && (
                <p className="pt-2 text-sm font-medium text-gray-700">Como a loja lidou com as pendências? Dê a nota do item:</p>
              )}
            </>
          ))}

        {(current.kind !== "pendencias" || pendings.length > 0) &&
          current.items.map((item) => (
            <ScoreItem
              key={item.id}
              item={item}
              answer={answers[item.id]}
              photoBusy={photoBusy.has(item.id)}
              onScore={(s) => setScore(item, s)}
              onNA={() => toggleNA(item)}
              onObservacao={(t) => setObservacao(item, t)}
              onProdutoVencido={(v) => setProdutoVencido(item, v)}
              onAddPhotos={(files) => void addPhotos(item, files)}
              onRemovePhoto={(p) => removePhoto(item, p)}
            />
          ))}
      </div>

      {/* rodapé fixo */}
      <div className="fixed inset-x-0 z-20 border-t border-line bg-white px-4 py-3 sm:px-6 lg:left-64" style={{ bottom: "var(--fill-nav, 58px)" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="inline-flex min-h-[52px] items-center justify-center gap-1 rounded-xl border border-line bg-white px-4 font-semibold text-ink disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" /> Anterior
          </button>
          {isLast ? (
            <Link
              href={`/auditorias/${auditId}/revisao`}
              className="btn inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 font-semibold text-white hover:bg-graphite"
            >
              <ClipboardCheck className="h-5 w-5" /> Revisar
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
            >
              Próximo <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ busy, offline }: { busy: boolean; offline: boolean }) {
  if (offline) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
        <CloudOff className="h-3.5 w-3.5" /> sem conexão — tentando novamente
      </span>
    );
  }
  if (busy) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> salvando…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-700">
      <Check className="h-3.5 w-3.5" /> salvo
    </span>
  );
}
