"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Eraser, GripVertical, Plus, Trash2, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/form";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { addScheduleDay, clearMissedDays, moveScheduleDay, removeDayOff, removeScheduleDay, swapScheduleDay, swapScheduleUnits, type ActionResult } from "@/lib/dashboard-actions";
import { addDays, formatDayLabelPT, monthEnd, weekday } from "@/lib/dates";
import type { CalendarDay, DayState } from "@/lib/data/dashboard";
import type { AuditorDayOff, Unit } from "@/lib/types";
import { cn, fmtPct } from "@/lib/utils";

const STATE_CLASS: Record<DayState, string> = {
  feito: "bg-green-100 text-green-900 border-green-200",
  pendente: "bg-gray-100 text-gray-700 border-gray-200",
  hoje: "bg-brand-light text-brand-dark border-brand",
  nao_cumprida: "bg-red-100 text-red-900 border-red-200",
  abertura: "bg-blue-50 text-blue-900 border-blue-200",
};
const STATE_LABEL: Record<DayState, string> = { feito: "feito", pendente: "pendente", hoje: "hoje", nao_cumprida: "não cumprida", abertura: "visita de abertura" };
const WEEK = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const FOLGA_DOMINGO = "Folga de domingo";

type Selection = { kind: "day"; cd: CalendarDay } | { kind: "off"; off: AuditorDayOff } | { kind: "empty"; date: string } | null;

function shortName(nome: string): string {
  return nome.replace("Moema ", "M. ");
}

/** Dia que pode ser trocado/movido: previsto, de hoje em diante, sem auditoria iniciada. */
function canEdit(cd: CalendarDay, today: string): boolean {
  return cd.day.status === "prevista" && cd.day.data >= today && !cd.day.audit_id;
}
/** Dia que pode ser removido: qualquer um sem auditoria registrada (inclui passados "não cumpridos"). */
function canRemove(cd: CalendarDay): boolean {
  return cd.day.status !== "concluida" && !cd.day.audit_id;
}

export function RoutineCalendar({ mes, today, days, units, daysOff = [] }: { mes: string; today: string; days: CalendarDay[]; units: Unit[]; daysOff?: AuditorDayOff[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selection>(null);
  const [swapSource, setSwapSource] = useState<CalendarDay | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const offByDate = useMemo(() => new Map(daysOff.map((d) => [d.data, d])), [daysOff]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.day.data, d])), [days]);
  const missed = useMemo(() => days.filter((d) => d.day.data < today && canRemove(d) && d.state === "nao_cumprida"), [days, today]);

  // grade seg–dom
  const cells = useMemo(() => {
    const end = monthEnd(mes);
    const lead = (weekday(mes) + 6) % 7; // seg=0
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = mes; d <= end; d = addDays(d, 1)) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [mes]);

  /** Executa uma ação, mostra o resultado e recarrega os dados. */
  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    setToast(null);
    start(async () => {
      const r = await fn();
      setToast(r.ok ? { ok: true, text: r.message ?? "Feito." } : { ok: false, text: r.error });
      if (r.ok) {
        setSelected(null);
        setSwapSource(null);
        router.refresh();
        after?.();
      }
    });
  }

  // destino de uma troca/movimentação (modo "trocar com outro dia" ou arrastar e soltar)
  function dropOn(sourceId: string, target: { cd?: CalendarDay; date: string }) {
    if (target.cd) {
      if (target.cd.day.id === sourceId) return setSwapSource(null);
      run(() => swapScheduleUnits({ aId: sourceId, bId: target.cd!.day.id }));
    } else {
      run(() => moveScheduleDay({ scheduleDayId: sourceId, newDate: target.date }));
    }
  }
  const dragProps = (target: { cd?: CalendarDay; date: string }, acceptable: boolean) =>
    acceptable
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (dragId) e.preventDefault();
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            if (dragId) dropOn(dragId, target);
            setDragId(null);
          },
        }
      : {};

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div>
        {toast && (
          <div className={cn("mb-3 flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm", toast.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")} role="status">
            <span>{toast.text}</span>
            <button type="button" aria-label="Fechar" onClick={() => setToast(null)} className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full hover:bg-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {swapSource && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-brand bg-brand-light px-3 py-2 text-sm">
            <span>
              <ArrowLeftRight className="mr-1 inline h-4 w-4" />
              Toque no dia de destino para trocar com <strong>{shortName(swapSource.unit?.nome ?? "—")}</strong> ({formatDayLabelPT(swapSource.day.data)}). Dia vazio ou sem visita = mover.
            </span>
            <Button size="sm" variant="secondary" onClick={() => setSwapSource(null)}>
              Cancelar
            </Button>
          </div>
        )}

        {missed.length > 0 && !swapSource && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <span>
              {missed.length} dia{missed.length === 1 ? "" : "s"} não cumprido{missed.length === 1 ? "" : "s"} sem auditoria neste mês.
            </span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => clearMissedDays(mes))}>
              <Eraser className="h-4 w-4" /> Remover da rotina
            </Button>
          </div>
        )}

        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {WEEK.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", pending && "pointer-events-none opacity-60")}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const cd = byDate.get(date);
            const isToday = date === today;
            const off = offByDate.get(date);
            const isMonday = weekday(date) === 1;
            const future = date >= today;
            const base = "flex min-h-[3.5rem] flex-col items-start rounded-lg border p-1 text-left text-xs transition sm:min-h-[4.5rem] sm:p-1.5";

            // --- dia sem linha na agenda: folga / sem visita / vazio ---
            if (!cd) {
              const semVisita = !!off && off.motivo !== FOLGA_DOMINGO;
              const label = off ? (semVisita ? "sem visita" : "folga") : isMonday ? "folga" : future ? "vazio" : "";
              const targetable = future && !!(swapSource || dragId);
              const isSel = (selected?.kind === "off" && selected.off.data === date) || (selected?.kind === "empty" && selected.date === date);
              if (!future) {
                return (
                  <div key={date} title={off?.motivo ?? (isMonday ? "Segunda: folga fixa" : "")} className={cn(base, "border-dashed border-line bg-white text-gray-400")}>
                    <span className="font-bold tabular-nums">{Number(date.slice(8))}</span>
                    <span className="mt-auto text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                  </div>
                );
              }
              return (
                <button
                  key={date}
                  type="button"
                  title={off?.motivo ?? (isMonday ? "Segunda: folga fixa (toque para incluir uma visita)" : "Toque para incluir uma visita")}
                  onClick={() => {
                    if (swapSource) return dropOn(swapSource.day.id, { date });
                    setSelected(off ? { kind: "off", off } : { kind: "empty", date });
                  }}
                  {...dragProps({ date }, future)}
                  className={cn(
                    base,
                    semVisita ? "border-dashed border-gray-300 bg-white text-gray-500" : "border-dashed border-line bg-white text-gray-400",
                    isToday && "border-brand",
                    targetable && "border-brand bg-brand-light/60 text-brand-dark",
                    isSel && "ring-2 ring-ink",
                  )}
                >
                  <span className="font-bold tabular-nums">{Number(date.slice(8))}</span>
                  <span className="mt-auto flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {targetable ? "mover aqui" : label}
                    {!targetable && <Plus className="h-3 w-3 opacity-60" />}
                  </span>
                </button>
              );
            }

            // --- dia com visita prevista/feita ---
            const editable = canEdit(cd, today);
            const isSel = selected?.kind === "day" && selected.cd.day.id === cd.day.id;
            const isSource = swapSource?.day.id === cd.day.id || dragId === cd.day.id;
            const targetable = editable && !!((swapSource && swapSource.day.id !== cd.day.id) || (dragId && dragId !== cd.day.id));
            return (
              <button
                key={date}
                type="button"
                draggable={editable}
                onDragStart={(e) => {
                  setDragId(cd.day.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragId(null)}
                {...dragProps({ cd, date }, editable)}
                onClick={() => {
                  if (swapSource) return editable ? dropOn(swapSource.day.id, { cd, date }) : undefined;
                  setSelected({ kind: "day", cd });
                }}
                className={cn(base, STATE_CLASS[cd.state], editable && "cursor-grab active:cursor-grabbing", isSel && "ring-2 ring-ink", isSource && "opacity-50 ring-2 ring-brand", targetable && "ring-2 ring-brand")}
              >
                <span className="flex w-full items-center justify-between text-xs font-bold tabular-nums">
                  {Number(date.slice(8))}
                  <span className="flex items-center gap-0.5">
                    {cd.day.unit_original_id && <ArrowLeftRight className="h-3 w-3 opacity-70" aria-label="trocado" />}
                    {editable && <GripVertical className="hidden h-3 w-3 opacity-40 lg:block" aria-hidden="true" />}
                  </span>
                </span>
                <span className="mt-auto line-clamp-2 text-[10px] font-semibold leading-tight sm:text-xs">{cd.unit ? shortName(cd.unit.nome) : "—"}</span>
                <span className="text-[9px] uppercase opacity-70 sm:text-[10px]">{cd.state === "abertura" ? "abertura" : AUDIT_TYPE_SHORT[cd.day.tipo]}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(STATE_LABEL) as DayState[]).map((s) => (
            <span key={s} className={cn("rounded-md border px-2 py-0.5", STATE_CLASS[s])}>
              {STATE_LABEL[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-gray-600">
            <ArrowLeftRight className="h-3 w-3" /> trocado
          </span>
          <span className="rounded-md border border-line bg-white px-2 py-0.5 text-gray-400">folga</span>
          <span className="rounded-md border border-dashed border-gray-300 bg-white px-2 py-0.5 text-gray-500">sem visita</span>
        </div>
        <p className="mt-2 hidden text-xs text-gray-500 lg:block">Arraste um dia sobre outro para trocar as lojas, ou sobre um dia vazio para mover a visita.</p>
      </div>

      {selected?.kind === "day" && (
        <DayPanel
          key={selected.cd.day.id}
          cd={selected.cd}
          today={today}
          units={units}
          pending={pending}
          onClose={() => setSelected(null)}
          onSwapMode={() => {
            setSwapSource(selected.cd);
            setSelected(null);
          }}
          run={run}
        />
      )}
      {selected?.kind === "off" && <OffPanel key={selected.off.id} off={selected.off} units={units} pending={pending} onClose={() => setSelected(null)} run={run} />}
      {selected?.kind === "empty" && <EmptyPanel key={selected.date} date={selected.date} units={units} pending={pending} onClose={() => setSelected(null)} run={run} />}
      {!selected && (
        <aside className="card hidden text-sm text-gray-500 lg:block">
          Toque em um dia para trocar a loja, trocar com outro dia, mover, remover ou incluir uma visita. Você também pode arrastar os dias.
        </aside>
      )}
    </div>
  );
}

type Run = (fn: () => Promise<ActionResult>, after?: () => void) => void;

/** Painel do dia: folha inferior por cima da barra de navegação no celular; painel lateral no desktop. */
function Sheet({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        className="card fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-b-none rounded-t-2xl shadow-2xl lg:static lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-2xl lg:shadow-sm"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 lg:hidden" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold capitalize">{title}</div>
            {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

/** Formulário "incluir visita" (loja + tipo) usado em dias vazios, folgas e "sem visita". */
function AddVisitForm({ date, units, pending, run }: { date: string; units: Unit[]; pending: boolean; run: Run }) {
  const lojas = units.filter((u) => u.ativa);
  const wd = weekday(date);
  const [unitId, setUnitId] = useState("");
  const [tipo, setTipo] = useState<"completa" | "simplificada">(wd >= 5 || wd === 0 ? "completa" : "simplificada");
  const unit = lojas.find((u) => u.id === unitId);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addScheduleDay({ data: date, unitId, tipo }));
      }}
    >
      <Field label="Loja">
        <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
          <option value="">Selecione…</option>
          {lojas.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
              {u.em_abertura ? " (em abertura)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {unit?.tipo !== "producao" && (
        <Field label="Tipo de auditoria">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as "completa" | "simplificada")}>
            <option value="simplificada">Simplificada</option>
            <option value="completa">Completa</option>
          </Select>
        </Field>
      )}
      <Button type="submit" full disabled={pending || !unitId}>
        <Plus className="h-4 w-4" /> {pending ? "Salvando…" : "Incluir visita"}
      </Button>
    </form>
  );
}

function EmptyPanel({ date, units, pending, onClose, run }: { date: string; units: Unit[]; pending: boolean; onClose: () => void; run: Run }) {
  return (
    <Sheet title={formatDayLabelPT(date)} subtitle={weekday(date) === 1 ? "Segunda: folga fixa" : "Sem visita prevista"} onClose={onClose}>
      <p className="mb-3 text-sm text-gray-700">Incluir uma visita neste dia?</p>
      <AddVisitForm date={date} units={units} pending={pending} run={run} />
    </Sheet>
  );
}

/** Dia sem rotina (folga de domingo ou visita removida): devolver à rotação ou incluir uma visita. */
function OffPanel({ off, units, pending, onClose, run }: { off: AuditorDayOff; units: Unit[]; pending: boolean; onClose: () => void; run: Run }) {
  const [adding, setAdding] = useState(false);
  const semVisita = off.motivo !== FOLGA_DOMINGO;
  return (
    <Sheet title={formatDayLabelPT(off.data)} subtitle={semVisita ? "Sem visita" : "Folga de domingo"} onClose={onClose}>
      <p className="text-sm text-gray-700">
        {semVisita ? <>Visita removida da rotina{off.motivo && off.motivo !== "Removido da rotina" ? <>: “{off.motivo}”</> : "."}</> : "Domingo de folga do gerente."}
      </p>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <Button full variant="secondary" disabled={pending} onClick={() => run(() => removeDayOff(off.data))}>
          <Undo2 className="h-4 w-4" /> Devolver o dia à rotação
        </Button>
        {!adding ? (
          <Button full variant="ghost" disabled={pending} onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Incluir uma visita específica
          </Button>
        ) : (
          <div className="rounded-xl bg-surface-muted p-3">
            <AddVisitForm date={off.data} units={units} pending={pending} run={run} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function DayPanel({ cd, today, units, pending, onClose, onSwapMode, run }: { cd: CalendarDay; today: string; units: Unit[]; pending: boolean; onClose: () => void; onSwapMode: () => void; run: Run }) {
  const [mode, setMode] = useState<"menu" | "trocar" | "remover">("menu");
  const [unitId, setUnitId] = useState("");
  const [motivo, setMotivo] = useState("");
  const editable = canEdit(cd, today);
  const removable = canRemove(cd);
  const isProd = cd.day.tipo === "producao";
  const compatible = units.filter((u) => u.ativa && !u.somente_nutri && (isProd ? u.tipo === "producao" : u.tipo === "loja") && u.id !== cd.day.unit_id);

  return (
    <Sheet title={formatDayLabelPT(cd.day.data)} subtitle={cd.state === "abertura" ? "Visita de abertura" : AUDIT_TYPE_SHORT[cd.day.tipo]} onClose={onClose}>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-gray-500">Loja: </span>
          <span className="font-semibold">{cd.unit?.nome ?? "—"}</span>
        </div>
        <div>
          <Badge tone={cd.state === "feito" ? "green" : cd.state === "nao_cumprida" ? "red" : cd.state === "hoje" || cd.state === "abertura" ? "brand" : "gray"}>{STATE_LABEL[cd.state]}</Badge>
          {cd.audit?.nota_final != null && <span className="ml-2 tabular-nums">nota {fmtPct(cd.audit.nota_final)}</span>}
        </div>
        {cd.unitOriginal && (
          <p className="rounded-lg bg-surface-muted p-2 text-xs text-gray-600">
            Trocado: era <strong>{cd.unitOriginal.nome}</strong>
            {cd.trocadoPorNome && <> por {cd.trocadoPorNome}</>}
            {cd.day.motivo_troca && <> — “{cd.day.motivo_troca}”</>}
          </p>
        )}
        {cd.audit && (
          <a href={`/auditorias/${cd.audit.id}/resumo`} className="block text-xs font-semibold text-brand-dark hover:underline">
            Ver resumo da auditoria →
          </a>
        )}
      </div>

      {mode === "menu" && (
        <div className="mt-4 space-y-2 border-t border-line pt-3">
          {editable ? (
            <>
              <Button full variant="secondary" disabled={pending} onClick={() => setMode("trocar")}>
                <ArrowLeftRight className="h-4 w-4" /> Trocar a loja deste dia
              </Button>
              <Button full variant="secondary" disabled={pending} onClick={onSwapMode}>
                <GripVertical className="h-4 w-4" /> Trocar com outro dia / mover
              </Button>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              {cd.day.audit_id || cd.day.status === "concluida" ? "Dia com auditoria registrada: não pode ser alterado." : cd.day.data < today ? "Dia passado: só pode ser removido da rotina." : "Só dias ainda previstos podem ser alterados."}
            </p>
          )}
          {removable && (
            <Button full variant="ghost" className="text-red-700" disabled={pending} onClick={() => setMode("remover")}>
              <Trash2 className="h-4 w-4" /> Remover a visita deste dia
            </Button>
          )}
        </div>
      )}

      {mode === "trocar" && (
        <form
          className="mt-4 space-y-3 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => swapScheduleDay({ scheduleDayId: cd.day.id, newUnitId: unitId, motivo }));
          }}
        >
          <div className="text-sm font-semibold">Trocar a loja deste dia</div>
          {compatible.length === 0 ? (
            <p className="rounded-lg bg-surface-muted p-3 text-xs text-gray-600">{isProd ? "Terça é sempre a cozinha central; não há outra unidade de produção." : "Nenhuma outra loja ativa cadastrada."}</p>
          ) : (
            <Field label="Nova loja">
              <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                <option value="">Selecione…</option>
                {compatible.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                    {u.em_abertura ? " (em abertura)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Motivo (obrigatório)">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ex.: loja fechada para reforma" />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("menu")} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" className="flex-1" disabled={pending || !unitId || !motivo.trim()}>
              {pending ? "Salvando…" : "Confirmar troca"}
            </Button>
          </div>
        </form>
      )}

      {mode === "remover" && (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <div className="text-sm font-semibold">Remover a visita deste dia</div>
          <p className="text-xs text-gray-600">O dia fica “sem visita”: não conta como não cumprido e não é regerado pela agenda. Você pode devolvê-lo depois tocando no dia.</p>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo (opcional)" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("menu")} disabled={pending}>
              Voltar
            </Button>
            <Button type="button" variant="danger" className="flex-1" disabled={pending} onClick={() => run(() => removeScheduleDay({ scheduleDayId: cd.day.id, motivo }))}>
              {pending ? "Removendo…" : "Confirmar remoção"}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
