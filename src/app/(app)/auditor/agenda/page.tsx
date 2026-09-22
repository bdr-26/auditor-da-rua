import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Coffee, Play, Plus } from "lucide-react";
import { StartAuditButton } from "@/components/audit/start-audit-button";
import { AuditStatusBadge, DayStateChip, TIPO_ABBR, dayState, shortUnitName, type DayState } from "@/components/audit/status-chip";
import { Badge } from "@/components/ui/badge";
import { PctBadge } from "@/components/ui/score";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getAuditsByIds, getAuditsInRange, getScheduleRange } from "@/lib/data/audit-flow";
import { getUnits } from "@/lib/data/units";
import { getDaysOff } from "@/lib/data/days-off";
import { getDemandas, isAtrasada } from "@/lib/data/demandas";
import { DemandaCard } from "@/components/demandas/demanda-card";
import { ClipboardList } from "lucide-react";
import { addDays, addMonths, formatMonthPT, formatWeekdayPT, monthEnd, monthStart, todaySP, weekday } from "@/lib/dates";
import { workWeekRange } from "@/lib/domain/schedule";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { ensureScheduleThrottled } from "@/lib/schedule-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Audit, ScheduleDay } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const WEEK_HEAD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const CELL_TONE: Record<DayState, string> = {
  feito: "bg-green-100 text-green-900 border-green-200",
  hoje: "bg-brand text-ink border-brand",
  rascunho: "bg-yellow-100 text-yellow-900 border-yellow-200",
  pendente: "bg-gray-100 text-gray-700 border-gray-200",
  nao_cumprida: "bg-red-100 text-red-900 border-red-200",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; semana?: string; ver?: string }> }) {
  const profile = await requireProfile(["auditor_geral"]);
  const sp = await searchParams;
  const today = todaySP();
  const verMes = sp.ver === "mes";
  const isYmd = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

  // semana de trabalho (ter–dom) selecionada; mês selecionado no modo expandido
  const week = workWeekRange(isYmd(sp.semana) ? sp.semana! : today);
  const month = isYmd(sp.mes) ? monthStart(sp.mes!) : monthStart(verMes ? today : week.start);
  const start = verMes ? month : week.start;
  const end = verMes ? monthEnd(month) : week.end;

  if (end >= today) {
    try {
      await ensureScheduleThrottled(createAdminClient(), start > today ? start : monthStart(today), monthEnd(addMonths(end, 0)));
    } catch (e) {
      console.error("[agenda] falha ao materializar", e);
    }
  }

  const supabase = await createClient();
  const [rows, units, rangeAudits, daysOff, demandas] = await Promise.all([
    getScheduleRange(supabase, start, end),
    getUnits(supabase, { ativas: false }),
    getAuditsInRange(supabase, start, end),
    getDaysOff(supabase, start, end, profile.id),
    verMes ? Promise.resolve([]) : getDemandas(supabase, { responsavelId: profile.id, status: "abertas" }),
  ]);
  const demandasAtrasadas = demandas.filter((d) => isAtrasada(d, today)).length;
  const offByDate = new Map(daysOff.map((d) => [d.data, d]));
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const linked = await getAuditsByIds(supabase, rows.map((r) => r.audit_id).filter((id): id is string => !!id));
  const auditsById = new Map([...linked, ...rangeAudits].map((a) => [a.id, a]));

  const rowsByDate = new Map<string, ScheduleDay>();
  for (const r of rows) if (!rowsByDate.has(r.data) || r.auditor_id === profile.id) rowsByDate.set(r.data, r);
  // auditorias sem vínculo com a agenda (fora da agenda)
  const extrasByDate = new Map<string, Audit[]>();
  for (const a of rangeAudits) {
    if (a.tipo === "nutricional") continue;
    const r = rowsByDate.get(a.data);
    if (r && (r.audit_id === a.id || (r.unit_id === a.unit_id && r.tipo === a.tipo))) continue;
    extrasByDate.set(a.data, [...(extrasByDate.get(a.data) ?? []), a]);
  }

  const stats = rows.reduce(
    (acc, r) => {
      const s = dayState(r, r.audit_id ? auditsById.get(r.audit_id) : null, today);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<DayState, number>>,
  );
  const subtitle = `${stats.feito ?? 0} feitas · ${stats.nao_cumprida ?? 0} não cumpridas · ${stats.pendente ?? 0} previstas`;

  // ---------------- modo semana ----------------
  if (!verMes) {
    const days: string[] = [];
    for (let d = week.start; d <= week.end; d = addDays(d, 1)) days.push(d);
    const prevWeek = addDays(week.start, -7);
    const nextWeek = addDays(week.start, 7);
    const label = `${Number(week.start.slice(8))} a ${Number(week.end.slice(8))} de ${MESES_CURTO[Number(week.end.slice(5, 7)) - 1]}`;
    const isCurrent = today >= week.start && today <= week.end;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Agenda"
          subtitle={subtitle}
          actions={
            <Link href={`/auditor/agenda?ver=mes&mes=${monthStart(week.start)}`} className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-surface-muted">
              <CalendarRange className="h-4 w-4" /> Ver mês
            </Link>
          }
        />
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-white px-2 py-1.5">
          <Link href={`/auditor/agenda?semana=${prevWeek}`} aria-label="Semana anterior" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-[11px] text-gray-500">{isCurrent ? "esta semana" : <Link href="/auditor/agenda" className="font-medium text-brand-dark">voltar para hoje</Link>}</div>
          </div>
          <Link href={`/auditor/agenda?semana=${nextWeek}`} aria-label="Próxima semana" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>

        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-brand-dark" /> Demandas
              {demandas.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  · {demandas.length} aberta{demandas.length === 1 ? "" : "s"}
                  {demandasAtrasadas > 0 && <span className="font-semibold text-red-700"> · {demandasAtrasadas} atrasada{demandasAtrasadas === 1 ? "" : "s"}</span>}
                </span>
              )}
            </h2>
            <div className="flex shrink-0 items-center gap-3">
              {demandas.length > 0 && (
                <Link href="/auditor/demandas" className="text-sm font-medium text-brand-dark">
                  Ver todas
                </Link>
              )}
              <Link href="/auditor/demandas/nova" className="inline-flex min-h-9 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" /> Nova
              </Link>
            </div>
          </div>
          {demandas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-3 text-sm text-gray-500">Nenhuma demanda aberta. Use “Nova” para anotar o que você precisa fazer; as demandas dos proprietários também aparecem aqui.</p>
          ) : (
            <div className="space-y-2">
              {demandas.slice(0, 4).map((d) => (
                <DemandaCard key={d.id} d={d} href={`/auditor/demandas/${d.id}`} unitName={d.unit_id ? unitsById.get(d.unit_id)?.nome : null} />
              ))}
              {demandas.length > 4 && (
                <Link href="/auditor/demandas" className="block text-center text-sm font-medium text-brand-dark">
                  + {demandas.length - 4} demanda{demandas.length - 4 === 1 ? "" : "s"}
                </Link>
              )}
            </div>
          )}
        </section>

        <h2 className="mb-2 text-base font-semibold">Auditorias da semana</h2>
        <div className="space-y-2">
          {days.map((d) => {
            const row = rowsByDate.get(d);
            const audit = row?.audit_id ? auditsById.get(row.audit_id) : null;
            const extras = extrasByDate.get(d) ?? [];
            const isToday = d === today;
            const off = offByDate.get(d);
            const isMonday = weekday(d) === 1;
            const dateCol = (
              <div className="w-14 shrink-0 text-center">
                <div className={cn("text-[11px] font-semibold uppercase", isToday ? "text-brand-dark" : "text-gray-500")}>{formatWeekdayPT(d, true)}</div>
                <div className={cn("text-2xl font-bold leading-none tabular-nums", isToday && "text-brand-dark")}>{Number(d.slice(8))}</div>
              </div>
            );
            if (!row && (off || isMonday)) {
              return (
                <div key={d} className={cn("flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white px-3 py-3 text-gray-500", isToday && "ring-2 ring-brand")}>
                  {dateCol}
                  <Coffee className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 text-sm font-medium">Folga</div>
                  <span className="text-xs text-gray-400">{off?.motivo ?? "segunda"}</span>
                </div>
              );
            }
            if (!row) {
              return (
                <div key={d} className={cn("flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white px-3 py-3 text-gray-400", isToday && "ring-2 ring-brand")}>
                  {dateCol}
                  <div className="flex-1 text-sm">Sem auditoria prevista</div>
                </div>
              );
            }
            const state = dayState(row, audit, today);
            const unitName = unitsById.get(row.unit_id)?.nome ?? "Unidade";
            const href = audit ? (audit.status === "concluida" ? `/auditorias/${audit.id}/resumo` : `/auditorias/${audit.id}`) : null;
            const inner = (
              <div className={cn("flex items-center gap-3 rounded-2xl border bg-white px-3 py-3", isToday ? "border-brand ring-2 ring-brand/50" : "border-line", state === "nao_cumprida" && "border-red-200 bg-red-50/40")}>
                {dateCol}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{unitName}</div>
                  <div className="text-xs text-gray-500">{AUDIT_TYPE_SHORT[row.tipo]}{row.unit_original_id ? " · trocada" : ""}</div>
                  {extras.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {extras.map((a) => (
                        <Badge key={a.id} tone={a.status === "concluida" ? "green" : "yellow"}>
                          extra · {shortUnitName(unitsById.get(a.unit_id)?.nome ?? "—")} {TIPO_ABBR[a.tipo]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {audit?.status === "concluida" && <PctBadge value={audit.nota_final} size="sm" />}
                  {audit?.status === "rascunho" ? <AuditStatusBadge status="rascunho" /> : state !== "hoje" ? <DayStateChip state={state} /> : null}
                  {isToday && !audit && (
                    <StartAuditButton unitId={row.unit_id} tipo={row.tipo} data={today} unstyled className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-brand px-3 text-sm font-semibold text-ink">
                      <Play className="h-4 w-4" /> Iniciar
                    </StartAuditButton>
                  )}
                </div>
              </div>
            );
            return href ? (
              <Link key={d} href={href} className="block active:scale-[0.99]">
                {inner}
              </Link>
            ) : (
              <div key={d}>{inner}</div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------- modo mês (expandido) ----------------
  const firstWd = (weekday(start) + 6) % 7; // 0 = segunda
  const cells: (string | null)[] = Array.from({ length: firstWd }, () => null);
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Agenda"
        subtitle={subtitle}
        actions={
          <Link href={`/auditor/agenda?semana=${month >= monthStart(today) && month <= today ? today : month}`} className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-surface-muted">
            <CalendarDays className="h-4 w-4" /> Ver semana
          </Link>
        }
      />
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-white px-2 py-1.5">
        <Link href={`/auditor/agenda?ver=mes&mes=${prev}`} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold capitalize">{formatMonthPT(month)}</span>
        <Link href={`/auditor/agenda?ver=mes&mes=${next}`} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-gray-500">
        {WEEK_HEAD.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="min-h-[76px] rounded-xl bg-transparent" />;
          const row = rowsByDate.get(d);
          const audit = row?.audit_id ? auditsById.get(row.audit_id) : null;
          const extras = extrasByDate.get(d) ?? [];
          const isToday = d === today;
          return (
            <div key={d} className={cn("flex min-h-[76px] flex-col gap-1 rounded-xl border border-line bg-white p-1", isToday && "ring-2 ring-brand")}>
              <div className={cn("text-right text-xs font-semibold tabular-nums", isToday ? "text-brand-dark" : "text-gray-500")}>{d.slice(8, 10)}</div>
              {!row && (offByDate.has(d) || weekday(d) === 1) && (
                <div className="rounded-lg border border-dashed border-line px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400" title={offByDate.get(d)?.motivo ?? "Segunda: folga fixa"}>
                  folga
                </div>
              )}
              {row && <DayCell row={row} audit={audit ?? null} today={today} unitName={unitsById.get(row.unit_id)?.nome ?? "—"} />}
              {extras.map((a) => (
                <Link
                  key={a.id}
                  href={a.status === "concluida" ? `/auditorias/${a.id}/resumo` : `/auditorias/${a.id}`}
                  className={cn("rounded-lg border px-1 py-0.5 text-[10px] font-medium leading-tight", CELL_TONE[a.status === "concluida" ? "feito" : "rascunho"])}
                >
                  <span className="block truncate">{shortUnitName(unitsById.get(a.unit_id)?.nome ?? "—")}</span>
                  <span className="opacity-70">{TIPO_ABBR[a.tipo]} · extra</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {(["feito", "hoje", "rascunho", "pendente", "nao_cumprida"] as DayState[]).map((s) => (
          <span key={s} className={cn("rounded-full border px-2 py-0.5 font-medium", CELL_TONE[s])}>
            {s === "feito" ? "concluída" : s === "nao_cumprida" ? "não cumprida" : s === "pendente" ? "prevista" : s}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayCell({ row, audit, today, unitName }: { row: ScheduleDay; audit: Audit | null; today: string; unitName: string }) {
  const state = dayState(row, audit, today);
  const content = (
    <>
      <span className="block truncate">{shortUnitName(unitName)}</span>
      <span className="flex items-center gap-1 opacity-80">
        {TIPO_ABBR[row.tipo]}
        {state === "hoje" && !audit && <Play className="h-2.5 w-2.5" />}
      </span>
    </>
  );
  const cls = cn("block w-full rounded-lg border px-1 py-1 text-left text-[10px] font-medium leading-tight", CELL_TONE[state]);
  if (audit) {
    return (
      <Link href={audit.status === "concluida" ? `/auditorias/${audit.id}/resumo` : `/auditorias/${audit.id}`} className={cls}>
        {content}
      </Link>
    );
  }
  if (row.data === today) {
    return (
      <StartAuditButton unitId={row.unit_id} tipo={row.tipo} data={today} unstyled className={cn(cls, "min-h-0")}>
        {content}
      </StartAuditButton>
    );
  }
  return <div className={cls}>{content}</div>;
}
