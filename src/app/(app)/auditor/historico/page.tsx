import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { AuditStatusBadge } from "@/components/audit/status-chip";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getAuditorAudits } from "@/lib/data/audit-flow";
import { getUnits } from "@/lib/data/units";
import { formatDayLabelPT, formatMonthPT, monthStart } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Audit } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  const profile = await requireProfile(["auditor_geral"]);
  const supabase = await createClient();
  const [audits, units] = await Promise.all([getAuditorAudits(supabase, profile.id), getUnits(supabase, { ativas: false })]);
  const unitsById = new Map(units.map((u) => [u.id, u]));

  const groups = new Map<string, Audit[]>();
  for (const a of audits) {
    const m = monthStart(a.data);
    groups.set(m, [...(groups.get(m) ?? []), a]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Histórico" subtitle={`${audits.length} auditoria(s)`} />
      {audits.length === 0 && (
        <EmptyState title="Nenhuma auditoria ainda" description="As auditorias que você iniciar aparecem aqui, agrupadas por mês." />
      )}
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([m, list]) => (
          <section key={m}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{formatMonthPT(m)}</h2>
            <Card className="divide-y divide-line p-0">
              {list.map((a) => (
                <Link key={a.id} href={a.status === "concluida" ? `/auditorias/${a.id}/resumo` : `/auditorias/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{unitsById.get(a.unit_id)?.nome ?? "Unidade"}</div>
                    <div className="text-xs text-gray-500">
                      {AUDIT_TYPE_SHORT[a.tipo]} · {formatDayLabelPT(a.data)}
                      {a.falha_grave && (
                        <span className="ml-2 inline-flex items-center gap-0.5 font-semibold text-red-700">
                          <AlertTriangle className="h-3 w-3" /> falha grave
                        </span>
                      )}
                    </div>
                  </div>
                  {a.status === "concluida" ? <PctBadge value={a.nota_final} /> : null}
                  <AuditStatusBadge status={a.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
