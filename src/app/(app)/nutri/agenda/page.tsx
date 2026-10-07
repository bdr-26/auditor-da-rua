import Link from "next/link";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { AgendaItemRow, AgendaNewToggle } from "@/components/nutri/agenda-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getNutriAgenda, getNutriTeam } from "@/lib/data/nutri-agenda";
import { getUnits } from "@/lib/data/units";
import { addDays, formatDayLabelPT, formatWeekdayPT, todaySP, weekday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda da nutrição" };

/** Semana seg–dom que contém a data. */
function weekOf(d: string): { start: string; end: string } {
  const wd = (weekday(d) + 6) % 7; // seg=0
  const start = addDays(d, -wd);
  return { start, end: addDays(start, 6) };
}

export default async function NutriAgendaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const { semana } = await searchParams;
  const today = todaySP();
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  const base = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today;
  const week = weekOf(base);
  const supabase = await createClient();
  const [items, atrasadas, team, units] = await Promise.all([
    getNutriAgenda(supabase, { from: week.start, to: week.end }),
    getNutriAgenda(supabase, { to: addDays(today, -1), status: ["prevista"] }),
    getNutriTeam(supabase),
    getUnits(supabase),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const nome = new Map(team.map((m) => [m.id, m.nome]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const byDay = new Map<string, typeof items>();
  for (const it of items) byDay.set(it.data, [...(byDay.get(it.data) ?? []), it]);
  const prev = addDays(week.start, -7);
  const next = addDays(week.start, 7);
  const isCurrent = today >= week.start && today <= week.end;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Agenda da nutrição"
        subtitle={chefe ? "Programe as visitas e tarefas da equipe" : "Suas visitas e tarefas da semana"}
        back="/nutri"
        actions={chefe ? <AgendaNewToggle team={team} units={units} today={today} /> : undefined}
      />
      {chefe && (
        <Link href="/nutri/agenda/rotina" className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm hover:bg-surface-muted">
          <Repeat className="h-4 w-4 text-gray-500" />
          <span className="flex-1">
            <span className="font-semibold">Rotina padrão</span>
            <span className="block text-xs text-gray-500">Quem visita cada unidade e quando; a agenda é gerada sozinha.</span>
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      )}

      {atrasadas.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-red-700">Atrasadas ({atrasadas.length})</h2>
          <div className="space-y-2">
            {atrasadas.map((it) => (
              <AgendaItemRow key={it.id} item={it} unitName={it.unit_id ? unitName.get(it.unit_id) ?? null : null} responsavelNome={chefe ? nome.get(it.responsavel_id) ?? null : null} isChefe={chefe} isMine={it.responsavel_id === profile.id} today={today} atalhos={profile.role === "auditor_nutricao"} />
            ))}
          </div>
        </section>
      )}

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-white px-2 py-1.5">
        <Link href={`/nutri/agenda?semana=${prev}`} aria-label="Semana anterior" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <div className="text-sm font-semibold">
            {week.start.slice(8, 10)}/{week.start.slice(5, 7)} a {week.end.slice(8, 10)}/{week.end.slice(5, 7)}
          </div>
          <div className="text-[11px] text-gray-500">{isCurrent ? "esta semana" : <Link href="/nutri/agenda" className="font-medium text-brand-dark">voltar para hoje</Link>}</div>
        </div>
        <Link href={`/nutri/agenda?semana=${next}`} aria-label="Próxima semana" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-muted">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {items.length === 0 && atrasadas.length === 0 && <EmptyState title="Nada programado nesta semana" description={chefe ? "Use “Programar tarefa” para definir as visitas e os controles de cada estagiária." : "A nutricionista chefe programa suas visitas aqui; você também pode iniciar auditorias e controles pelo Início."} />}

      <div className="space-y-3">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          if (list.length === 0) return null;
          const isToday = d === today;
          return (
            <section key={d}>
              <h2 className={cn("mb-1.5 flex items-baseline gap-2 text-sm font-semibold capitalize", isToday && "text-brand-dark")}>
                {formatDayLabelPT(d)}
                <span className="text-xs font-normal text-gray-500">{formatWeekdayPT(d, true)}</span>
                {isToday && <span className="text-xs font-normal">· hoje</span>}
              </h2>
              <div className="space-y-2">
                {list.map((it) => (
                  <AgendaItemRow key={it.id} item={it} unitName={it.unit_id ? unitName.get(it.unit_id) ?? null : null} responsavelNome={chefe ? nome.get(it.responsavel_id) ?? null : null} isChefe={chefe} isMine={it.responsavel_id === profile.id} today={today} atalhos={profile.role === "auditor_nutricao"} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
