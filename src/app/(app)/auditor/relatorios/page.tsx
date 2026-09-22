import { FileText } from "lucide-react";
import { ShareReport } from "@/components/reports/share-report";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { formatDateTimePT, formatMonthPT } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios" };

interface ReportRow {
  id: string;
  mes: string;
  unit_id: string | null;
  tipo: "loja" | "consolidado";
  gerado_em: string;
}

/** Relatórios mensais por unidade gerados no fechamento do mês (leitura do gerente). */
export default async function RelatoriosPage() {
  await requireProfile(["auditor_geral", "proprietario"]);
  const supabase = await createClient();
  const admin = createAdminClient();
  const [units, { data: rows }] = await Promise.all([
    getUnits(supabase, { ativas: false }),
    admin.from("reports").select("id, mes, unit_id, tipo, gerado_em").eq("tipo", "loja").order("mes", { ascending: false }).order("gerado_em", { ascending: false }),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const reports = (rows ?? []) as ReportRow[];
  // um relatório por unidade e mês (o mais recente)
  const seen = new Set<string>();
  const latest = reports.filter((r) => {
    const k = `${r.mes}:${r.unit_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const months = new Map<string, ReportRow[]>();
  for (const r of latest) months.set(r.mes, [...(months.get(r.mes) ?? []), r]);

  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios mensais" subtitle="PDF por unidade, gerado no fechamento de cada mês" back="/auditor" />
      {months.size === 0 ? (
        <EmptyState title="Nenhum mês fechado ainda" description="Quando o proprietário fechar o mês, o relatório de cada unidade aparece aqui para compartilhar e imprimir." />
      ) : (
        Array.from(months.entries()).map(([mes, list]) => (
          <section key={mes}>
            <h2 className="mb-2 text-base font-semibold capitalize">{formatMonthPT(mes)}</h2>
            <div className="space-y-3">
              {list
                .sort((a, b) => (unitName.get(a.unit_id ?? "") ?? "").localeCompare(unitName.get(b.unit_id ?? "") ?? ""))
                .map((r) => {
                  const nome = unitName.get(r.unit_id ?? "") ?? "Unidade";
                  return (
                    <Card key={r.id} className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-brand-dark" />
                        <span className="flex-1 text-sm font-semibold">{nome}</span>
                        <span className="text-xs text-gray-500">gerado em {formatDateTimePT(r.gerado_em)}</span>
                      </div>
                      <ShareReport
                        compact
                        pdfUrl={`/api/reports/${r.id}`}
                        fileName={`relatorio-${nome.toLowerCase().replace(/\s+/g, "-")}-${mes.slice(0, 7)}.pdf`}
                        title={`Relatório mensal · ${nome} · ${formatMonthPT(mes)}`}
                        text={`Relatório mensal de ${nome} (${formatMonthPT(mes)}): nota, ranking, blocos, o que manter e melhorar, apontamentos com fotos.`}
                      />
                    </Card>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
