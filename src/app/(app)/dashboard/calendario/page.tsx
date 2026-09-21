import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GenerateScheduleButton } from "@/components/dashboard/close-month-panel";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { RoutineCalendar } from "@/components/dashboard/routine-calendar";
import { requireProfile } from "@/lib/auth";
import { getRoutineCalendar, parseMesParam } from "@/lib/data/dashboard";
import { formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireProfile(["proprietario"]);
  const { mes: mesParam } = await searchParams;
  const mes = parseMesParam(mesParam);
  const supabase = await createClient();
  const cal = await getRoutineCalendar(supabase, mes);
  const pct = cal.summary.planned ? Math.round((cal.summary.done / cal.summary.planned) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Rotina do gerente"
        back="/dashboard"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="capitalize">{formatMonthPT(mes)}</span>
            {cal.summary.planned > 0 && (
              <Badge tone={pct != null && pct < 80 ? "red" : "green"}>
                {cal.summary.done}/{cal.summary.planned} dias cumpridos{pct != null && ` · ${pct}%`}
              </Badge>
            )}
          </span>
        }
        actions={<MonthPicker mes={mes} basePath="/dashboard/calendario" />}
      />
      <Card>
        {cal.days.length === 0 ? (
          <div className="mb-4 rounded-xl bg-surface-muted p-4 text-sm text-gray-600">
            A agenda deste mês ainda não foi gerada.
            <div className="mt-2">
              <GenerateScheduleButton mes={mes} />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>Toque em um dia para ver detalhes ou trocar a loja (somente dias previstos, de hoje em diante).</span>
            <GenerateScheduleButton mes={mes} />
          </div>
        )}
        <RoutineCalendar mes={mes} today={cal.today} days={cal.days} units={cal.units} />
      </Card>
    </div>
  );
}
