import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { StartAuditButton } from "@/components/audit/start-audit-button";
import { TIPO_ABBR, dayState, shortUnitName, type DayState } from "@/components/audit/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getAuditsByIds, getAuditsInRange, getScheduleRange } from "@/lib/data/audit-flow";
import { getUnits } from "@/lib/data/units";
import { addDays, addMonths, formatMonthPT, monthEnd, monthStart, todaySP, weekday } from "@/lib/dates";
import { ensureSchedule } from "@/lib/schedule-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Audit, ScheduleDay } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

const WEEK_HEAD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const CELL_TONE: Record<DayState, string> = {
  feito: "bg-green-100 text-green-900 border-green-200",
  hoje: "bg-brand text-ink border-brand",
  rascunho: "bg-yellow-100 text-yellow-900 border-yellow-200",
  pendente: "bg-gray-100 text-gray-700 border-gray-200",
  nao_cumprida: "bg-red-100 text-red-900 border-red-200",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const profile = await requireProfile(["auditor_geral"]);
  const { mes } = await searchParams;
  const today = todaySP();
  const month = mes && /^\d{4}-\d{2}-\d{2}$/.test(mes) ? monthStart(mes) : monthStart(today);
  const start = month;
  const end = monthEnd(month);

  if (month >= monthStart(today)) {
    try {
      await ensureSchedule(createAdminClient(), start, end);
    } catch (e) {
      console.error("[agenda] falha ao materializar", e);
    }
  }

  const supabase = await createClient();
  const [rows, units, monthAudits] = await Promise.all([getScheduleRange(supabase, start, end), getUnits(supabase, { ativas: false }), getAuditsInRange(supabase, start, end)]);
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const linked = await getAuditsByIds(supabase, rows.map((r) => r.audit_id).filter((id): id is string => !!id));
  const auditsById = new Map([...linked, ...monthAudits].map((a) => [a.id, a]));

  const rowsByDate = new Map<string, ScheduleDay>();
  for (const r of rows) if (!rowsByDate.has(r.data) || r.auditor_id === profile.id) rowsByDate.set(r.data, r);
  // auditorias do mês sem vínculo com a agenda (fora da agenda)
  const extrasByDate = new Map<string, Audit[]>();
  for (const a of monthAudits) {
    const r = rowsByDate.get(a.data);
    if (r && (r.audit_id === a.id || (r.unit_id === a.unit_id && r.tipo === a.tipo))) continue;
    extrasByDate.set(a.data, [...(extrasByDate.get(a.data) ?? []), a]);
  }

  // grade seg–dom
  const firstWd = (weekday(start) + 6) % 7; // 0 = segunda
  const cells: (string | null)[] = Array.from({ length: firstWd }, () => null);
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const stats = rows.reduce(
    (acc, r) => {
      const s = dayState(r, r.audit_id ? auditsById.get(r.audit_id) : null, today);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<DayState, number>>,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Agenda"
        subtitle={`${stats.feito ?? 0} feitas · ${stats.nao_cumprida ?? 0} não cumpridas · ${stats.pendente ?? 0} previstas`}
        actions={
          <>
            <Link href={`/auditor/agenda?mes=${prev}`} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-surface-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-semibold capitalize">{formatMonthPT(month)}</span>
            <Link href={`/auditor/agenda?mes=${next}`} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-surface-muted">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </>
        }
      />

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
