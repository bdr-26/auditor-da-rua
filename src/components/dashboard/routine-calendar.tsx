"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/form";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { removeDayOff, removeScheduleDay, swapScheduleDay } from "@/lib/dashboard-actions";
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

function shortName(nome: string): string {
  return nome.replace("Moema ", "M. ");
}

export function RoutineCalendar({ mes, today, days, units, daysOff = [] }: { mes: string; today: string; days: CalendarDay[]; units: Unit[]; daysOff?: AuditorDayOff[] }) {
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [selectedOff, setSelectedOff] = useState<AuditorDayOff | null>(null);
  const offByDate = useMemo(() => new Map(daysOff.map((d) => [d.data, d])), [daysOff]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.day.data, d])), [days]);

  // grade seg–dom
  const cells = useMemo(() => {
    const end = monthEnd(mes);
    const lead = (weekday(mes) + 6) % 7; // seg=0
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = mes; d <= end; d = addDays(d, 1)) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [mes]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {WEEK.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const cd = byDate.get(date);
            const isToday = date === today;
            const off = offByDate.get(date);
            const isMonday = weekday(date) === 1;
            if (!cd && (off || isMonday)) {
              const semVisita = !!off && off.motivo !== "Folga de domingo";
              const label = off ? (semVisita ? "sem visita" : "folga") : "folga";
              if (off && off.data >= today) {
                return (
                  <button
                    key={date}
                    type="button"
                    title={off.motivo}
                    onClick={() => { setSelected(null); setSelectedOff(off); }}
                    className={cn("flex min-h-[3.5rem] flex-col items-start rounded-lg border p-1 text-left text-xs sm:min-h-[4.5rem]", semVisita ? "border-dashed border-gray-300 bg-white text-gray-500" : "border-line bg-white text-gray-400", isToday && "border-brand", selectedOff?.id === off.id && "ring-2 ring-ink")}
                  >
                    <span className="font-bold tabular-nums">{Number(date.slice(8))}</span>
                    <span className="mt-auto text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                  </button>
                );
              }
              return (
                <div key={date} title={off?.motivo ?? "Segunda: folga fixa"} className={cn("flex min-h-[3.5rem] flex-col rounded-lg border border-line bg-white p-1 text-xs text-gray-400 sm:min-h-[4.5rem]", isToday && "border-brand")}>
                  <span className="font-bold tabular-nums">{Number(date.slice(8))}</span>
                  <span className="mt-auto text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
                </div>
              );
            }
            if (!cd) {
              return (
                <div key={date} className={cn("min-h-[3.5rem] rounded-lg border border-dashed border-line p-1 text-xs text-gray-400 sm:min-h-[4.5rem]", isToday && "border-brand")}>
                  {Number(date.slice(8))}
                </div>
              );
            }
            const active = selected?.day.id === cd.day.id;
            return (
              <button
                key={date}
                type="button"
                onClick={() => { setSelectedOff(null); setSelected(cd); }}
                className={cn(
                  "flex min-h-[3.5rem] flex-col items-start rounded-lg border p-1 text-left transition sm:min-h-[4.5rem] sm:p-1.5",
                  STATE_CLASS[cd.state],
                  active && "ring-2 ring-ink",
                )}
              >
                <span className="flex w-full items-center justify-between text-xs font-bold tabular-nums">
                  {Number(date.slice(8))}
                  {cd.day.unit_original_id && <ArrowLeftRight className="h-3 w-3 opacity-70" aria-label="trocado" />}
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
      </div>

      {selectedOff ? (
        <OffPanel key={selectedOff.id} off={selectedOff} onClose={() => setSelectedOff(null)} />
      ) : (
        <DayPanel key={selected?.day.id ?? "none"} day={selected} today={today} units={units} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}


/** Painel do dia: folha inferior por cima da barra de navegação no celular; painel lateral no desktop. */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
        {children}
      </aside>
    </>
  );
}

/** Dia sem rotina (folga de domingo ou visita removida): devolver à rotação. */
function OffPanel({ off, onClose }: { off: AuditorDayOff; onClose: () => void }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const semVisita = off.motivo !== "Folga de domingo";
  return (
    <Sheet onClose={onClose}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold capitalize">{formatDayLabelPT(off.data)}</div>
          <div className="text-xs text-gray-500">{semVisita ? "Sem visita" : "Folga de domingo"}</div>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-gray-700">
        {semVisita ? <>Visita removida da rotina{off.motivo && off.motivo !== "Removido da rotina" ? <>: “{off.motivo}”</> : "."}</> : "Domingo de folga do gerente."}
      </p>
      <div className="mt-4 border-t border-line pt-3">
        <Button
          full
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const r = await removeDayOff(off.data);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Feito." } : { ok: false, text: r.error ?? "Falha." });
              if (r.ok) {
                router.refresh();
                onClose();
              }
            });
          }}
        >
          {pending ? "Salvando…" : "Devolver o dia à rotação"}
        </Button>
        {msg && <p className={cn("mt-2 text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      </div>
    </Sheet>
  );
}

function DayPanel({ day, today, units, onClose }: { day: CalendarDay | null; today: string; units: Unit[]; onClose: () => void }) {
  const router = useRouter();
  const [unitId, setUnitId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [removing, setRemoving] = useState(false);
  const [motivoRemocao, setMotivoRemocao] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!day) {
    return (
      <aside className="card hidden text-sm text-gray-500 lg:block">
        Toque em um dia para ver os detalhes, trocar a loja prevista ou remover a visita.
      </aside>
    );
  }
  const canSwap = day.day.status === "prevista" && day.day.data >= today;
  const compatible = units.filter((u) => (day.day.tipo === "producao" ? u.tipo === "producao" : u.tipo === "loja") && u.id !== day.day.unit_id);

  return (
    <Sheet onClose={onClose}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold capitalize">{formatDayLabelPT(day.day.data)}</div>
          <div className="text-xs text-gray-500">{AUDIT_TYPE_SHORT[day.day.tipo]}</div>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-gray-500">Loja: </span>
          <span className="font-semibold">{day.unit?.nome ?? "—"}</span>
        </div>
        <div>
          <Badge tone={day.state === "feito" ? "green" : day.state === "nao_cumprida" ? "red" : day.state === "hoje" ? "brand" : "gray"}>{STATE_LABEL[day.state]}</Badge>
          {day.audit?.nota_final != null && <span className="ml-2 tabular-nums">nota {fmtPct(day.audit.nota_final)}</span>}
        </div>
        {day.unitOriginal && (
          <p className="rounded-lg bg-surface-muted p-2 text-xs text-gray-600">
            Trocado: era <strong>{day.unitOriginal.nome}</strong>
            {day.trocadoPorNome && <> por {day.trocadoPorNome}</>}
            {day.day.motivo_troca && <> — “{day.day.motivo_troca}”</>}
          </p>
        )}
        {day.audit && (
          <a href={`/auditorias/${day.audit.id}/resumo`} className="block text-xs font-semibold text-brand-dark hover:underline">
            Ver resumo da auditoria →
          </a>
        )}
      </div>

      {canSwap ? (
        <form
          className="mt-4 space-y-3 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            start(async () => {
              const r = await swapScheduleDay({ scheduleDayId: day.day.id, newUnitId: unitId, motivo });
              setMsg(r.ok ? { ok: true, text: r.message ?? "Troca registrada." } : { ok: false, text: r.error });
              if (r.ok) {
                setUnitId("");
                setMotivo("");
                router.refresh();
              }
            });
          }}
        >
          <div className="text-sm font-semibold">Trocar a loja deste dia</div>
          {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}
          <Field label="Nova loja">
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
              <option value="">Selecione…</option>
              {compatible.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Motivo (obrigatório)">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ex.: loja fechada para reforma" />
          </Field>
          <Button type="submit" full disabled={pending || !unitId || !motivo.trim()}>
            {pending ? "Salvando…" : "Confirmar troca"}
          </Button>
          {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}

          <div className="border-t border-line pt-3">
            {!removing ? (
              <button type="button" onClick={() => setRemoving(true)} className="flex min-h-0 items-center gap-1 text-sm text-gray-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" /> Remover a visita deste dia
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-800">O dia fica sem rotina (não conta como não cumprido) e não é regerado. Você pode devolvê-lo depois tocando no dia.</p>
                <Textarea className="mt-2" value={motivoRemocao} onChange={(e) => setMotivoRemocao(e.target.value)} rows={2} placeholder="Motivo (opcional)" />
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setRemoving(false)} disabled={pending}>
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setMsg(null);
                      start(async () => {
                        const r = await removeScheduleDay({ scheduleDayId: day.day.id, motivo: motivoRemocao });
                        setMsg(r.ok ? { ok: true, text: r.message ?? "Visita removida." } : { ok: false, text: r.error });
                        if (r.ok) {
                          router.refresh();
                          onClose();
                        }
                      });
                    }}
                  >
                    Confirmar remoção
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-gray-500">
          {day.day.status === "prevista" ? "Dias passados não podem ser trocados." : "Só dias ainda previstos podem ser trocados."}
        </p>
      )}
    </Sheet>
  );
}
