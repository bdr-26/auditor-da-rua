import Link from "next/link";
import { ClipboardPlus, ListChecks } from "lucide-react";
import { NutriAuditRow } from "@/components/nutri/audit-row";
import { ClassBadge } from "@/components/nutri/nutri-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getLastNutriAuditByUnit, getNutriAudits } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { daysBetween, formatDatePT, todaySP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NutriHome() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const isNutri = profile.role === "auditor_nutricao";
  const supabase = await createClient();
  const [units, drafts, recent, lastByUnit] = await Promise.all([
    getUnits(supabase),
    isNutri ? getNutriAudits(supabase, { auditorId: profile.id, status: "rascunho" }) : Promise.resolve([]),
    getNutriAudits(supabase, { status: "concluida", limit: 5, auditorId: isNutri ? profile.id : undefined }),
    getLastNutriAuditByUnit(supabase),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const today = todaySP();

  return (
    <div className="space-y-6">
      <PageHeader title={isNutri ? `Olá, ${profile.nome.split(" ")[0]}` : "Auditorias nutricionais"} subtitle="Auditoria Nutricional · Food Checker" />

      {isNutri && (
        <ButtonLink href="/nutri/nova" size="lg" full className="text-xl">
          <ClipboardPlus className="h-6 w-6" /> Nova auditoria
        </ButtonLink>
      )}

      {drafts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-600">Rascunhos</h2>
          <div className="space-y-2">
            {drafts.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Últimas concluídas</h2>
        {recent.length === 0 ? (
          <EmptyState title="Nenhuma auditoria concluída ainda" description={isNutri ? "Toque em “Nova auditoria” para começar a primeira visita." : undefined} />
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} />
            ))}
          </div>
        )}
        <div className="mt-2 text-right">
          <Link href="/nutri/historico" className="text-sm font-medium text-brand-dark underline">
            Ver histórico completo
          </Link>
        </div>
      </section>

      <Card>
        <CardTitle>Por unidade</CardTitle>
        <ul className="divide-y divide-line">
          {units.map((u) => {
            const last = lastByUnit.get(u.id);
            const dias = last ? daysBetween(last.data, today) : null;
            return (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.nome}</div>
                  <div className="text-xs text-gray-500">
                    {last ? (dias === 0 ? "auditada hoje" : `última auditoria há ${dias} dia${dias === 1 ? "" : "s"} (${formatDatePT(last.data)})`) : "nunca auditada"}
                  </div>
                </div>
                {last && (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmtPct(last.nota_final)}</span>
                    <ClassBadge classificacao={last.classificacao} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <ButtonLink href="/nutri/checklists" variant="secondary" full>
        <ListChecks className="h-5 w-5" /> Checklists por unidade
      </ButtonLink>
    </div>
  );
}
