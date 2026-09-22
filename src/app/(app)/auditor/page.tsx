import Link from "next/link";
import { AlertTriangle, CalendarPlus, ChevronRight, Coffee } from "lucide-react";
import { AuditStatusBadge, DayStateChip, dayState } from "@/components/audit/status-chip";
import { StartAuditButton } from "@/components/audit/start-audit-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PctBadge } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_LABELS, AUDIT_TYPE_SHORT } from "@/lib/constants";
import { findAudit, getAuditsByIds, getRecentScheduleDays, getScheduleDay, getScheduleRange } from "@/lib/data/audit-flow";
import { getUnits } from "@/lib/data/units";
import { getDaysOff, isDayOff } from "@/lib/data/days-off";
import { getDemandas, isAtrasada } from "@/lib/data/demandas";
import { ClipboardList } from "lucide-react";
import { formatDayLabelPT, formatWeekdayPT, todaySP, weekday } from "@/lib/dates";
import { workWeekRange } from "@/lib/domain/schedule";
import { ensureSchedule } from "@/lib/schedule-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Audit, ScheduleDay, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoje" };

export default async function AuditorHomePage() {
  const profile = await requireProfile(["auditor_geral"]);
  try {
    await ensureSchedule(createAdminClient());
  } catch (e) {
    console.error("[agenda] falha ao materializar", e);
  }

  const supabase = await createClient();
  const today = todaySP();
  const week = workWeekRange(today);

  const [todayRow, weekRows, recentRows, units, daysOff] = await Promise.all([
    getScheduleDay(supabase, today, profile.id),
    getScheduleRange(supabase, week.start, week.end),
    getRecentScheduleDays(supabase, today, 7),
    getUnits(supabase, { ativas: false }),
    getDaysOff(supabase, week.start, week.end, profile.id),
  ]);
  const todayOff = isDayOff(daysOff, today);
  const demandas = await getDemandas(supabase, { responsavelId: profile.id, status: "abertas" });
  const demandasAtrasadas = demandas.filter((d) => isAtrasada(d, today)).length;
  const unitsById = new Map(units.map((u) => [u.id, u]));

  const audits = await getAuditsByIds(
    supabase,
    [...weekRows, ...recentRows, ...(todayRow ? [todayRow] : [])].map((r) => r.audit_id).filter((id): id is string => !!id),
  );
  const auditsById = new Map(audits.map((a) => [a.id, a]));

  // rascunho de hoje mesmo sem vínculo na agenda
  let todayAudit: Audit | null = todayRow?.audit_id ? (auditsById.get(todayRow.audit_id) ?? null) : null;
  if (todayRow && !todayAudit) todayAudit = await findAudit(supabase, todayRow.unit_id, todayRow.tipo, today);

  const todayUnit = todayRow ? unitsById.get(todayRow.unit_id) : undefined;
  const isMonday = weekday(today) === 1;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-gray-500">Olá, {profile.nome.split(" ")[0]}</p>
        <h1 className="text-2xl font-bold capitalize">{formatDayLabelPT(today)}</h1>
      </header>

      {/* auditoria de hoje */}
      {todayRow && todayUnit ? (
        <TodayCard row={todayRow} unit={todayUnit} audit={todayAudit} today={today} />
      ) : (
        <Card className="flex items-center gap-4 py-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-dark">
            <Coffee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">{isMonday ? "Segunda é folga" : todayOff ? "Hoje é sua folga" : "Nada agendado para hoje"}</p>
            <p className="text-sm text-gray-500">
              {isMonday ? "Bom descanso. A semana começa na terça com a produção." : todayOff ? "Domingo de folga do mês. Bom descanso." : "Se houver visita combinada, inicie uma auditoria fora da agenda."}
            </p>
          </div>
        </Card>
      )}

      {demandas.length > 0 && (
        <Link href="/auditor/demandas" className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium", demandasAtrasadas > 0 ? "border-red-200 bg-red-50" : "border-line bg-white")}>
          <ClipboardList className={cn("h-5 w-5", demandasAtrasadas > 0 ? "text-red-700" : "text-brand-dark")} />
          <span className="flex-1">
            {demandas.length} demanda{demandas.length === 1 ? "" : "s"} aberta{demandas.length === 1 ? "" : "s"}
            {demandasAtrasadas > 0 && <span className="text-red-700"> · {demandasAtrasadas} atrasada{demandasAtrasadas === 1 ? "" : "s"}</span>}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      )}

      <Link href="/auditor/nova" className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium hover:bg-surface-muted">
        <span className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-brand-dark" /> Auditoria fora da agenda
        </span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </Link>

      {/* semana */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Esta semana</h2>
          <Link href="/auditor/agenda" className="text-sm font-medium text-brand-dark">
            Ver agenda
          </Link>
        </div>
        <Card className="divide-y divide-line p-0">
          {weekRows.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">Agenda da semana ainda não gerada.</p>}
          {weekRows.map((r) => (
            <DayRow key={r.id} row={r} unit={unitsById.get(r.unit_id)} audit={r.audit_id ? auditsById.get(r.audit_id) : undefined} today={today} />
          ))}
          {daysOff
            .filter((d) => !weekRows.some((r) => r.data === d.data))
            .map((d) => (
              <div key={d.id} className={cn("flex items-center gap-3 px-4 py-3 text-gray-500", d.data === today && "bg-brand-light/40")}>
                <div className="w-14 shrink-0">
                  <div className="text-[11px] font-semibold uppercase text-gray-500">{formatWeekdayPT(d.data, true)}</div>
                  <div className="text-base font-bold tabular-nums">{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">Folga</div>
                  <div className="text-xs text-gray-500">{d.motivo}</div>
                </div>
                <Badge tone="gray">folga</Badge>
              </div>
            ))}
        </Card>
      </section>

      {/* últimos dias */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Últimos dias</h2>
        <Card className="divide-y divide-line p-0">
          {recentRows.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">Ainda não há histórico.</p>}
          {recentRows.map((r) => (
            <DayRow key={r.id} row={r} unit={unitsById.get(r.unit_id)} audit={r.audit_id ? auditsById.get(r.audit_id) : undefined} today={today} />
          ))}
        </Card>
      </section>
    </div>
  );
}

function TodayCard({ row, unit, audit, today }: { row: ScheduleDay; unit: Unit; audit: Audit | null; today: string }) {
  const late = row.status === "nao_cumprida" && !audit;
  const done = audit?.status === "concluida" || row.status === "concluida";
  const draft = audit?.status === "rascunho";
  return (
    <Card className={cn("relative overflow-hidden p-5", late ? "border-red-300" : "border-brand/60")}>
      <div className={cn("absolute inset-x-0 top-0 h-1.5", late ? "bg-red-500" : "bg-brand")} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auditoria de hoje</p>
        {draft && <Badge tone="yellow">rascunho</Badge>}
        {done && <Badge tone="green">concluída</Badge>}
        {late && (
          <Badge tone="red">
            <AlertTriangle className="h-3 w-3" /> não cumprida
          </Badge>
        )}
      </div>
      <h2 className="mt-1 text-2xl font-bold leading-tight">
        {AUDIT_TYPE_LABELS[row.tipo]} <span className="text-gray-400">—</span> {unit.nome}
      </h2>
      {unit.endereco && <p className="mt-1 text-sm text-gray-500">{unit.endereco}</p>}
      {late && <p className="mt-2 text-sm text-red-700">O dia foi marcado como não cumprido, mas você ainda pode registrar a auditoria de hoje.</p>}

      <div className="mt-5">
        {done && audit ? (
          <div className="flex items-center justify-between gap-3">
            <PctBadge value={audit.nota_final} size="lg" />
            <ButtonLink href={`/auditorias/${audit.id}/resumo`} variant="secondary">
              Ver resumo <ChevronRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        ) : draft && audit ? (
          <ButtonLink href={`/auditorias/${audit.id}`} size="lg" full>
            Continuar auditoria <ChevronRight className="h-5 w-5" />
          </ButtonLink>
        ) : (
          <StartAuditButton unitId={unit.id} tipo={row.tipo} data={today}>
            Iniciar auditoria <ChevronRight className="h-5 w-5" />
          </StartAuditButton>
        )}
      </div>
    </Card>
  );
}

function DayRow({ row, unit, audit, today }: { row: ScheduleDay; unit: Unit | undefined; audit: Audit | undefined; today: string }) {
  const state = dayState(row, audit, today);
  const href = audit ? (audit.status === "concluida" ? `/auditorias/${audit.id}/resumo` : `/auditorias/${audit.id}`) : row.data === today ? "/auditor" : null;
  const inner = (
    <div className={cn("flex items-center gap-3 px-4 py-3", row.data === today && "bg-brand-light/40")}>
      <div className="w-14 shrink-0">
        <div className="text-[11px] font-semibold uppercase text-gray-500">{formatWeekdayPT(row.data, true)}</div>
        <div className="text-base font-bold tabular-nums">{row.data.slice(8, 10)}/{row.data.slice(5, 7)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{unit?.nome ?? "Unidade"}</div>
        <div className="text-xs text-gray-500">{AUDIT_TYPE_SHORT[row.tipo]}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {audit?.status === "concluida" && <PctBadge value={audit.nota_final} size="sm" />}
        {audit?.status === "rascunho" ? <AuditStatusBadge status="rascunho" /> : <DayStateChip state={state} />}
        {href && href !== "/auditor" && <ChevronRight className="h-4 w-4 text-gray-400" />}
      </div>
    </div>
  );
  return href && href !== "/auditor" ? (
    <Link href={href} className="block hover:bg-surface-muted">
      {inner}
    </Link>
  ) : (
    inner
  );
}
