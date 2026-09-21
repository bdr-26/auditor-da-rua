import { NewAuditForm, type UnitOption } from "@/components/nutri/new-audit-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getCompositionStats, getLastNutriAuditByUnit, getNutriAudits } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { todaySP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NovaAuditoriaPage() {
  const profile = await requireProfile(["auditor_nutricao"]);
  const supabase = await createClient();
  const today = todaySP();
  const [units, stats, lastByUnit, drafts] = await Promise.all([
    getUnits(supabase),
    getCompositionStats(supabase),
    getLastNutriAuditByUnit(supabase),
    getNutriAudits(supabase, { auditorId: profile.id, status: "rascunho" }),
  ]);
  const draftToday = new Set(drafts.filter((d) => d.data === today).map((d) => d.unit_id));
  const options: UnitOption[] = units.map((unit) => ({
    unit,
    ultimaData: lastByUnit.get(unit.id)?.data ?? null,
    itensAtivos: stats.get(unit.id)?.ativos ?? 0,
    rascunho: draftToday.has(unit.id),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova auditoria" subtitle="Auditoria Nutricional" back="/nutri" />
      {options.length === 0 ? <EmptyState title="Nenhuma unidade ativa" /> : <NewAuditForm units={options} today={today} />}
    </div>
  );
}
