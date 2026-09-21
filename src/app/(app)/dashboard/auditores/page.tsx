import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { NutriHistogram, ScoreHistogram } from "@/components/dashboard/histogram";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { getAuditorProfile, parseMesParam } from "@/lib/data/dashboard";
import { formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditoresPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireProfile(["proprietario"]);
  const { mes: mesParam } = await searchParams;
  const mes = parseMesParam(mesParam);
  const supabase = await createClient();
  const stats = await getAuditorProfile(supabase, mes);

  return (
    <div>
      <PageHeader title="Perfil dos auditores" back="/dashboard" subtitle={<span className="capitalize">{formatMonthPT(mes)}</span>} actions={<MonthPicker mes={mes} basePath="/dashboard/auditores" />} />
      {stats.length === 0 ? (
        <EmptyState title="Nenhum auditor ativo" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {stats.map((s) => {
            const total = Object.values(s.histogram).reduce((a, b) => a + b, 0);
            return (
              <Card key={s.profile.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="mb-0">{s.profile.nome}</CardTitle>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[s.profile.role]}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold tabular-nums">{s.n_auditorias} auditoria{s.n_auditorias === 1 ? "" : "s"}</div>
                    <div className="text-gray-500">média {fmtPct(s.media)}</div>
                  </div>
                </div>
                {s.n_auditorias === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">Nenhuma auditoria concluída neste mês.</p>
                ) : s.nutri ? (
                  <>
                    <NutriHistogram counts={s.nutri} />
                    <p className="mt-2 text-xs text-gray-500">
                      {s.nutri.conforme} conforme · {s.nutri.nao_conforme} não conforme · {s.nutri.na} N/A
                    </p>
                  </>
                ) : (
                  <>
                    <ScoreHistogram histogram={s.histogram} />
                    <p className="mt-2 text-xs text-gray-500">
                      {total} nota{total === 1 ? "" : "s"} dadas · {s.na} N/A
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Distribuição concentrada em 5 pode indicar leniência; em 1–2, rigor excessivo.</p>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
