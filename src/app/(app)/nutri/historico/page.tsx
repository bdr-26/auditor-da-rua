import { NutriAuditRow } from "@/components/nutri/audit-row";
import { MonthlyReportLinks } from "@/components/nutri/monthly-report-links";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getNutriAudits } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NutriHistoricoPage() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const isNutri = profile.role === "auditor_nutricao";
  const supabase = await createClient();
  const [audits, units, { data: profiles }] = await Promise.all([
    getNutriAudits(supabase, { auditorId: isNutri ? profile.id : undefined }),
    getUnits(supabase, { ativas: false }),
    supabase.from("profiles").select("id, nome"),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const auditorName = new Map((profiles ?? []).map((p) => [p.id as string, p.nome as string]));

  const months = new Map<string, typeof audits>();
  for (const a of audits) {
    const k = a.data.slice(0, 7) + "-01";
    months.set(k, [...(months.get(k) ?? []), a]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Histórico" subtitle={isNutri ? "Suas auditorias nutricionais" : "Auditorias nutricionais da rede"} back="/nutri" />
      {audits.length === 0 ? (
        <EmptyState
          title="Nenhuma auditoria ainda"
          description="As auditorias concluídas e os rascunhos aparecem aqui, agrupados por mês."
          action={isNutri ? <ButtonLink href="/nutri/nova">Nova auditoria</ButtonLink> : undefined}
        />
      ) : (
        Array.from(months.entries()).map(([mes, list]) => {
          const concluded = list.filter((a) => a.status === "concluida" && a.nota_final != null);
          const media = concluded.length ? concluded.reduce((s, a) => s + (a.nota_final ?? 0), 0) / concluded.length : null;
          return (
            <section key={mes}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold capitalize text-gray-600">{formatMonthPT(mes)}</h2>
                <span className="text-xs text-gray-500">
                  {concluded.length} concluída(s){media != null ? ` · média ${fmtPct(media)}` : ""}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((a) => (
                  <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} auditorName={isNutri ? undefined : auditorName.get(a.auditor_id)} />
                ))}
              </div>
              <MonthlyReportLinks
                mes={mes}
                units={Array.from(new Set(concluded.map((a) => a.unit_id))).map((id) => ({ id, nome: unitName.get(id) ?? "Unidade" }))}
              />
            </section>
          );
        })
      )}
    </div>
  );
}
