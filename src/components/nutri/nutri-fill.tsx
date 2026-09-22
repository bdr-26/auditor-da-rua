"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CloudOff, Info, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/score";
import type { NutriArea, NutriFillAnswer, NutriFillPending } from "@/lib/data/nutri";
import { formatDatePT } from "@/lib/dates";
import { compressImage } from "@/lib/photos/compress";
import { enqueuePhoto, flushQueue, listQueued, startQueueWorker, type QueuedPhoto } from "@/lib/photos/upload-queue";
import { createClient } from "@/lib/supabase/client";
import type { Audit, NutriAnswer, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnswerRow, type LocalPhoto } from "./answer-row";

type Step = { kind: "pendings" } | { kind: "area"; area: NutriArea };
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Job = () => Promise<{ error: unknown }>;

export function NutriFill({
  audit,
  unit,
  areas,
  pendings,
  initialStep,
  focusAnswerId,
}: {
  audit: Audit;
  unit: Unit;
  areas: NutriArea[];
  pendings: NutriFillPending[];
  initialStep: number;
  focusAnswerId?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ---------- estado ----------
  const [answers, setAnswers] = useState<Record<string, NutriFillAnswer>>(() => Object.fromEntries(areas.flatMap((a) => a.answers).map((x) => [x.id, x])));
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [pend, setPend] = useState<Record<string, boolean | null>>(() => Object.fromEntries(pendings.map((p) => [p.pending_issue_id, p.resolvida])));
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, LocalPhoto[]>>({});
  const localUrl = useRef(new Map<string, string>());

  const steps: Step[] = useMemo(() => [...(pendings.length > 0 ? [{ kind: "pendings" } as Step] : []), ...areas.map((area) => ({ kind: "area", area }) as Step)], [areas, pendings.length]);
  const [step, setStep] = useState(() => Math.max(0, Math.min(initialStep, steps.length - 1)));
  const [navError, setNavError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // ---------- fila de gravação (autosave com retry) ----------
  const [status, setStatus] = useState<SaveStatus>("idle");
  const jobs = useRef(new Map<string, Job>());
  const timers = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const retryTimer = useRef<number | null>(null);

  const refreshStatus = useCallback(() => {
    if (jobs.current.size === 0) setStatus("saved");
    else if (failed.current.size > 0) setStatus("error");
    else setStatus("saving");
  }, []);

  const runJob = useCallback(
    async (key: string): Promise<boolean> => {
      const job = jobs.current.get(key);
      if (!job || inflight.current.has(key)) return !job;
      inflight.current.add(key);
      let ok = false;
      try {
        const { error } = await job();
        ok = !error;
      } catch {
        ok = false;
      }
      inflight.current.delete(key);
      if (ok) {
        failed.current.delete(key);
        if (jobs.current.get(key) === job) jobs.current.delete(key);
        else return runJob(key); // chegou um patch mais novo enquanto salvava
      } else {
        failed.current.add(key);
        if (retryTimer.current == null) {
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            for (const k of Array.from(jobs.current.keys())) void runJob(k);
          }, 4000);
        }
      }
      refreshStatus();
      return ok;
    },
    [refreshStatus],
  );

  const enqueue = useCallback(
    (key: string, job: Job, delay = 0) => {
      jobs.current.set(key, job);
      const t = timers.current.get(key);
      if (t) window.clearTimeout(t);
      setStatus(failed.current.size > 0 ? "error" : "saving");
      if (delay > 0) {
        timers.current.set(
          key,
          window.setTimeout(() => {
            timers.current.delete(key);
            void runJob(key);
          }, delay),
        );
      } else void runJob(key);
    },
    [runJob],
  );

  /** Tenta gravar tudo que está pendente; true se a fila ficou vazia. */
  const flushAll = useCallback(async (): Promise<boolean> => {
    for (const [k, t] of timers.current) {
      window.clearTimeout(t);
      timers.current.delete(k);
    }
    const results = await Promise.all(Array.from(jobs.current.keys()).map((k) => runJob(k)));
    refreshStatus();
    return results.every(Boolean) && jobs.current.size === 0;
  }, [runJob, refreshStatus]);

  useEffect(() => {
    const onOnline = () => void flushAll();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushAll]);

  // ---------- respostas ----------
  const patches = useRef(new Map<string, { resposta?: NutriAnswer | null; observacao?: string | null }>());
  const saveAnswer = useCallback(
    (id: string, patch: { resposta?: NutriAnswer | null; observacao?: string | null }, delay = 0) => {
      patches.current.set(id, { ...(patches.current.get(id) ?? {}), ...patch });
      enqueue(
        `ans:${id}`,
        async () => {
          const p = patches.current.get(id) ?? {};
          const res = await supabase.from("audit_answers").update(p).eq("id", id);
          if (!res.error && patches.current.get(id) === p) patches.current.delete(id);
          return res;
        },
        delay,
      );
    },
    [enqueue, supabase],
  );

  const setResposta = (id: string, resposta: NutriAnswer) => {
    const current = answersRef.current[id];
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], resposta } }));
    saveAnswer(id, { resposta, observacao: current?.observacao ?? null });
  };
  const setObservacao = (id: string, observacao: string) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], observacao } }));
    saveAnswer(id, { observacao }, 600);
  };

  // ---------- apontamentos da visita anterior ----------
  const setReview = (issueId: string, resolvida: boolean) => {
    setPend((prev) => ({ ...prev, [issueId]: resolvida }));
    enqueue(`pend:${issueId}`, () =>
      supabase.from("audit_pending_reviews").upsert({ audit_id: audit.id, pending_issue_id: issueId, resolvida }, { onConflict: "audit_id,pending_issue_id" }),
    );
  };

  // ---------- fotos ----------
  const onUploaded = useCallback((p: QueuedPhoto, photoId: string) => {
    setUploading((prev) => ({ ...prev, [p.answer_id]: (prev[p.answer_id] ?? []).filter((l) => l.id !== p.id) }));
    setAnswers((prev) => {
      const a = prev[p.answer_id];
      if (!a || a.photos.some((x) => x.id === photoId)) return prev;
      return { ...prev, [p.answer_id]: { ...a, photos: [...a.photos, { id: photoId, path: p.path }] } };
    });
    const url = localUrl.current.get(p.id);
    if (url) setPhotoUrls((prev) => ({ ...prev, [photoId]: url }));
  }, []);

  useEffect(() => {
    // URLs assinadas das fotos já enviadas
    const existing = Object.values(answersRef.current).flatMap((a) => a.photos);
    if (existing.length > 0) {
      void supabase.storage
        .from("audit-photos")
        .createSignedUrls(
          existing.map((p) => p.path),
          60 * 60,
        )
        .then(({ data }: { data: { path: string | null; signedUrl: string }[] | null }) => {
          if (!data) return;
          const byPath = new Map<string, string>(data.filter((d) => d.path).map((d) => [d.path as string, d.signedUrl]));
          setPhotoUrls((prev) => {
            const next = { ...prev };
            for (const p of existing) {
              const u = byPath.get(p.path);
              if (u) next[p.id] = u;
            }
            return next;
          });
        });
    }
    // fotos que ficaram na fila local (sessão anterior)
    void listQueued(audit.id).then((list) => {
      if (list.length === 0) return;
      setUploading((prev) => {
        const next = { ...prev };
        for (const q of list) {
          if (!localUrl.current.has(q.id)) localUrl.current.set(q.id, URL.createObjectURL(q.blob));
          const l = next[q.answer_id] ?? [];
          if (!l.some((x) => x.id === q.id)) next[q.answer_id] = [...l, { id: q.id, url: localUrl.current.get(q.id)! }];
        }
        return next;
      });
    });
    const stop = startQueueWorker(onUploaded);
    return stop;
  }, [audit.id, onUploaded, supabase]);

  const addPhotos = async (answerId: string, files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        const blob = await compressImage(file);
        const id = crypto.randomUUID();
        const path = `${audit.id}/${answerId}/${id}.jpg`;
        localUrl.current.set(id, URL.createObjectURL(blob));
        setUploading((prev) => ({ ...prev, [answerId]: [...(prev[answerId] ?? []), { id, url: localUrl.current.get(id)! }] }));
        await enqueuePhoto({ id, answer_id: answerId, audit_id: audit.id, path, blob });
      } catch (e) {
        console.warn("[fotos] falha ao preparar foto", e);
      }
    }
    void flushQueue(onUploaded);
  };

  const removePhoto = async (answerId: string, photoId: string, path: string) => {
    const { error } = await supabase.from("audit_photos").delete().eq("id", photoId);
    if (error) {
      setNavError("Não foi possível remover a foto. Tente novamente.");
      return;
    }
    setAnswers((prev) => ({ ...prev, [answerId]: { ...prev[answerId], photos: prev[answerId].photos.filter((p) => p.id !== photoId) } }));
    void supabase.storage.from("audit-photos").remove([path]);
  };

  // ---------- navegação entre etapas ----------
  const go = (n: number) => {
    const next = Math.max(0, Math.min(n, steps.length - 1));
    setStep(next);
    setNavError(null);
    window.scrollTo({ top: 0 });
    void supabase.from("audits").update({ etapa_atual: next }).eq("id", audit.id);
  };
  const toReview = async () => {
    setLeaving(true);
    setNavError(null);
    const ok = await flushAll();
    if (!ok) {
      setLeaving(false);
      setNavError("Ainda há respostas não salvas. Verifique a conexão e tente novamente.");
      return;
    }
    router.push(`/nutri/auditorias/${audit.id}/revisao`);
  };

  // ---------- posição das barras (header/nav do app no celular) ----------
  const [inset, setInset] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector<HTMLElement>("header.sticky");
      const nav = document.querySelector<HTMLElement>("nav.fixed");
      setInset({ top: header?.offsetHeight ?? 0, bottom: nav?.offsetHeight ?? 0 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!focusAnswerId) return;
    const el = document.getElementById(`item-${focusAnswerId}`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [focusAnswerId, step]);

  // ---------- derivados ----------
  const all = Object.values(answers);
  const answered = all.filter((a) => a.resposta != null).length;
  const total = all.length;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const stepAnswers = current?.kind === "area" ? current.area.answers.map((a) => answers[a.id]) : [];
  const stepAnswered = stepAnswers.filter((a) => a.resposta != null).length;

  return (
    <div className="-mt-5 pb-28">
      {/* header fixo: linha 1 = voltar + unidade + contador/salvo; linha 2 = barra; linha 3 = chips das áreas */}
      <div className="sticky z-20 -mx-4 border-b border-line bg-white/95 px-4 pt-2 backdrop-blur sm:-mx-6 sm:px-6" style={{ top: inset.top }}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <Link href="/nutri" aria-label="Voltar" className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-surface-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold leading-tight">{unit.nome}</div>
              <div className="truncate text-[11px] text-gray-500">
                {formatDatePT(audit.data)} · {current?.kind === "area" ? current.area.area : "Visita anterior"}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-sm font-bold tabular-nums">
                {answered}<span className="text-gray-400">/{total}</span>
              </span>
              <SaveIndicator status={status} onRetry={() => void flushAll()} />
            </div>
          </div>
          <ProgressBar value={answered} max={total} className="mt-2 h-1.5" />
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {steps.map((st, i) => {
              const label = st.kind === "pendings" ? "Visita anterior" : st.area.area;
              const list = st.kind === "pendings" ? pendings.map((p) => pend[p.pending_issue_id] != null) : st.area.answers.map((a) => answers[a.id]?.resposta != null);
              const done = list.filter(Boolean).length;
              const complete = list.length > 0 && done === list.length;
              const active = i === step;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex min-h-0 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active ? "border-ink bg-ink text-white" : complete ? "border-green-200 bg-green-50 text-green-800" : "border-line bg-white text-gray-600",
                  )}
                >
                  <span className="max-w-[9rem] truncate">{label}</span>
                  <span className={cn("tabular-nums", active ? "text-gray-300" : "text-gray-400")}>
                    {done}/{list.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl pt-4">
        {current?.kind === "pendings" && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Apontamentos da visita anterior</h2>
            <p className="text-sm text-gray-600">Verifique se cada apontamento foi resolvido desde a última visita.</p>
            {pendings.map((p) => {
              const v = pend[p.pending_issue_id];
              return (
                <div key={p.pending_issue_id} className="card">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.reincidente && (
                      <Badge tone="red">
                        <AlertTriangle className="h-3 w-3" /> reincidente
                      </Badge>
                    )}
                    {p.visitas_sem_resolver > 0 && <Badge tone="orange">{p.visitas_sem_resolver} visita(s) sem resolver</Badge>}
                    {p.origem_data && <span className="text-xs text-gray-500">apontado em {formatDatePT(p.origem_data)}</span>}
                  </div>
                  <p className="mt-2 font-medium">{p.descricao}</p>
                  {p.observacao_origem && <p className="mt-1 text-sm text-gray-600">“{p.observacao_origem}”</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={v === true}
                      onClick={() => setReview(p.pending_issue_id, true)}
                      className={cn("min-h-[52px] rounded-xl text-sm font-semibold transition", v === true ? "bg-green-600 text-white ring-2 ring-green-600 ring-offset-1" : "bg-green-50 text-green-800 hover:bg-green-100")}
                    >
                      Resolvido
                    </button>
                    <button
                      type="button"
                      aria-pressed={v === false}
                      onClick={() => setReview(p.pending_issue_id, false)}
                      className={cn("min-h-[52px] rounded-xl text-sm font-semibold transition", v === false ? "bg-red-600 text-white ring-2 ring-red-600 ring-offset-1" : "bg-red-50 text-red-800 hover:bg-red-100")}
                    >
                      Mantido
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {current?.kind === "area" && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{current.area.area}</h2>
              <span className="shrink-0 text-xs text-gray-500">
                {stepAnswered}/{stepAnswers.length} respondidos
              </span>
            </div>
            <p className="flex items-start gap-1.5 rounded-xl bg-brand-light px-3 py-2 text-xs text-brand-dark">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Os itens descrevem o <strong>problema</strong>. <strong>Conforme</strong> = o problema NÃO foi encontrado.
              </span>
            </p>
            {current.area.answers.map((a, i) => (
              <AnswerRow
                key={a.id}
                index={i + 1}
                answer={answers[a.id]}
                photoUrls={photoUrls}
                uploading={uploading[a.id] ?? []}
                highlight={focusAnswerId === a.id}
                onResposta={(r) => setResposta(a.id, r)}
                onObservacao={(t) => setObservacao(a.id, t)}
                onAddPhotos={(files) => void addPhotos(a.id, files)}
                onRemovePhoto={(photoId, path) => void removePhoto(a.id, photoId, path)}
              />
            ))}
          </section>
        )}

        {navError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{navError}</p>}

        <p className="mt-6 text-center text-xs text-gray-500">
          <Link href={`/nutri/auditorias/${audit.id}/revisao`} className="underline">
            Ir para a revisão
          </Link>
        </p>
      </div>

      {/* barra inferior fixa */}
      <div className="fixed inset-x-0 z-20 border-t border-line bg-white px-4 py-3 lg:left-64" style={{ bottom: inset.bottom, paddingBottom: inset.bottom ? undefined : "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
        <div className="mx-auto flex max-w-3xl gap-3">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-white font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" /> Anterior
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => void toReview()}
              disabled={leaving}
              className="flex min-h-[52px] flex-[2] items-center justify-center gap-1 rounded-xl bg-ink font-semibold text-white disabled:opacity-60"
            >
              {leaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Revisar
            </button>
          ) : (
            <button type="button" onClick={() => go(step + 1)} className="flex min-h-[52px] flex-[2] items-center justify-center gap-1 rounded-xl bg-brand font-semibold text-ink">
              {steps[step + 1]?.kind === "area" ? "Próxima área" : "Próximo"} <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" /> salvando…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <Check className="h-3 w-3" /> salvo
      </span>
    );
  if (status === "error")
    return (
      <button type="button" onClick={onRetry} className="flex min-h-0 items-center gap-1 text-xs font-semibold text-red-700">
        <CloudOff className="h-3 w-3" /> sem conexão · tentar <RefreshCw className="h-3 w-3" />
      </button>
    );
  return <span className="text-xs text-gray-400">autosave</span>;
}
