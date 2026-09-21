import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { requireProfile } from "@/lib/auth";
import { SCORE_COLORS } from "@/lib/constants";
import { getNetworkWorstCriteria, parseMesParam } from "@/lib/data/dashboard";
import { addMonths, formatMonthPT, formatMonthShortPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CriteriosPage({ searchParams }: { searchParams: Promise<{ mes?: string; periodo?: string }> }) {
  await requireProfile(["proprietario"]);
  const { mes: mesParam, periodo } = await searchParams;
  const mes = parseMesParam(mesParam);
  const tres = periodo === "3m";
  const supabase = await createClient();
  const data = await getNetworkWorstCriteria(supabase, mes);
  const rows = (tres ? data.tresMeses : data.mes).slice(0, 30);

  return (
    <div>
      <PageHeader
        title="Piores critérios da rede"
        back="/dashboard"
        subtitle={tres ? `${formatMonthShortPT(addMonths(mes, -2))} a ${formatMonthShortPT(mes)}` : <span className="capitalize">{formatMonthPT(mes)}</span>}
        actions={<MonthPicker mes={mes} basePath="/dashboard/criterios" query={tres ? { periodo: "3m" } : undefined} />}
      />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-white p-1 text-sm">
        <Link href={`/dashboard/criterios?mes=${mes}`} className={cn("rounded-lg px-4 py-2 font-semibold", !tres ? "bg-ink text-white" : "text-gray-600")}>
          Mês
        </Link>
        <Link href={`/dashboard/criterios?mes=${mes}&periodo=3m`} className={cn("rounded-lg px-4 py-2 font-semibold", tres ? "bg-ink text-white" : "text-gray-600")}>
          Últimos 3 meses
        </Link>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma auditoria no período" description="Os critérios aparecem a partir das respostas das auditorias concluídas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr className="border-b border-line">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2">Bloco</th>
                  <th className="py-2 pr-2 text-center">Média</th>
                  <th className="py-2 pr-2 text-center">Notas ≤ 2</th>
                  <th className="py-2 text-center">Lojas afetadas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = Math.min(5, Math.max(1, Math.round(r.media))) as 1 | 2 | 3 | 4 | 5;
                  return (
                    <tr key={r.chave} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-2 font-medium">{r.descricao}</td>
                      <td className="py-2.5 pr-2 text-gray-600">{r.bloco}</td>
                      <td className="py-2.5 pr-2 text-center">
                        <span className={cn("inline-block w-12 rounded-md py-0.5 text-xs font-bold tabular-nums", SCORE_COLORS[s].bg, SCORE_COLORS[s].text)}>
                          {r.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">/ {r.n}</span>
                      </td>
                      <td className={cn("py-2.5 pr-2 text-center font-semibold tabular-nums", r.baixas > 0 && "text-red-700")}>{r.baixas}</td>
                      <td className="py-2.5 text-center tabular-nums">{r.lojas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
