import Link from "next/link";
import { Archive, FileText, Printer } from "lucide-react";
import { ShareReport } from "@/components/reports/share-report";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getControles } from "@/lib/data/nutri-controles";
import { getNutriAudits } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { formatMonthPT, formatMonthShortPT, monthStart, todaySP } from "@/lib/dates";
import { CONTROLE_TIPOS } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arquivo de registros" };

/**
 * Arquivo de registros (fiscalização): por unidade e ano, quantos controles finalizados há em cada mês
 * e tipo, com impressão do mês inteiro (todos os tipos), de um tipo no mês, e do ano.
 */
export default async function ArquivoPage({ searchParams }: { searchParams: Promise<{ loja?: string; ano?: string }> }) {
  await requireProfile(["auditor_nutricao", "proprietario"]);
  const { loja, ano } = await searchParams;
  const today = todaySP();
  const supabase = await createClient();
  const units = (await getUnits(supabase, { ativas: false })).filter((u) => u.ativa || u.id === loja);
  const unit = units.find((u) => u.id === loja) ?? units.find((u) => u.ativa) ?? null;
  const year = /^\d{4}$/.test(ano ?? "") ? Number(ano) : Number(today.slice(0, 4));
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [controles, rascunhos, audits] = unit
    ? await Promise.all([
        getControles(supabase, { unitId: unit.id, status: "finalizado", from, to, limit: 5000 }),
        getControles(supabase, { unitId: unit.id, status: "rascunho", limit: 50 }),
        getNutriAudits(supabase, { unitId: unit.id, status: "concluida" }),
      ])
    : [[], [], []];
  const auditsAno = audits.filter((a) => a.data >= from && a.data <= to);

  // meses do ano com algum registro (ou até o mês atual, no ano corrente)
  const lastMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  const meses = Array.from({ length: lastMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`).reverse();
  const count = (mes: string, tipo?: string) => controles.filter((c) => monthStart(c.data) === mes && (!tipo || c.tipo === tipo)).length;
  const countAud = (mes: string) => auditsAno.filter((a) => monthStart(a.data) === mes).length;
  const anos = Array.from(new Set([Number(today.slice(0, 4)), ...controles.map((c) => Number(c.data.slice(0, 4))), year])).sort((a, b) => b - a);
  const q = (p: { loja?: string; ano?: number }) => `/nutri/arquivo?loja=${p.loja ?? unit?.id ?? ""}&ano=${p.ano ?? year}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Arquivo de registros" subtitle="Tudo que foi finalizado, por unidade e mês, pronto para imprimir numa fiscalização" back="/nutri/controles" />

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {units.map((u) => (
          <Link key={u.id} href={q({ loja: u.id })} className={cn("rounded-full px-3 py-1.5 font-medium", unit?.id === u.id ? "bg-ink text-white" : "border border-line bg-white")}>
            {u.nome}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
        {anos.map((a) => (
          <Link key={a} href={q({ ano: a })} className={cn("rounded-full px-3 py-1.5 font-medium", a === year ? "bg-gray-200" : "border border-line bg-white")}>
            {a}
          </Link>
        ))}
      </div>

      {!unit ? (
        <p className="text-sm text-gray-500">Nenhuma unidade ativa.</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Archive className="h-4 w-4" /> {unit.nome} · {year}
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                <strong>{controles.length}</strong> controle{controles.length === 1 ? "" : "s"} finalizado{controles.length === 1 ? "" : "s"}
              </span>
              <span>
                <strong>{auditsAno.length}</strong> auditoria{auditsAno.length === 1 ? "" : "s"} nutricional{auditsAno.length === 1 ? "" : "is"}
              </span>
              {rascunhos.length > 0 && (
                <Link href={`/nutri/controles?loja=${unit.id}&ver=rascunhos`}>
                  <Badge tone="yellow">
                    {rascunhos.length} rascunho{rascunhos.length === 1 ? "" : "s"} fora do arquivo
                  </Badge>
                </Link>
              )}
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-gray-600">
                <Printer className="mr-1 inline h-3.5 w-3.5" /> Ano inteiro, todos os controles
              </p>
              <ShareReport compact pdfUrl={`/api/nutri/controles/dossie?unit=${unit.id}&from=${from}&to=${to}`} fileName={`arquivo-registros-${unit.slug}-${year}.pdf`} title={`Arquivo de registros · ${unit.nome} · ${year}`} text={`Arquivo de registros de ${unit.nome} em ${year}: todos os controles de qualidade finalizados.`} />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">Registros finalizados não podem ser apagados; para corrigir, a chefe reabre e salva. Rascunhos só entram no arquivo depois de finalizados.</p>
          </Card>

          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[40rem] text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Mês</th>
                  {CONTROLE_TIPOS.map((t) => (
                    <th key={t.codigo} className="px-1 py-2 text-center">
                      {t.curto}
                    </th>
                  ))}
                  <th className="px-1 py-2 text-center">Audit.</th>
                  <th className="px-3 py-2 text-right">Mês inteiro</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((mes) => {
                  const total = count(mes);
                  const ym = mes.slice(0, 7);
                  return (
                    <tr key={mes} className={cn("border-t border-line", total === 0 && countAud(mes) === 0 && "text-gray-400")}>
                      <td className="px-3 py-2 font-medium capitalize">{formatMonthShortPT(mes)}</td>
                      {CONTROLE_TIPOS.map((t) => {
                        const n = count(mes, t.codigo);
                        return (
                          <td key={t.codigo} className="px-1 py-2 text-center">
                            {n > 0 ? (
                              <a href={`/api/nutri/controles/relatorio?unit=${unit.id}&tipo=${t.codigo}&mes=${ym}`} target="_blank" rel="noopener" title={`Imprimir ${t.nome} · ${formatMonthPT(mes)}`} className="inline-block min-w-[1.75rem] rounded-md bg-green-100 px-1.5 py-0.5 font-semibold tabular-nums text-green-800">
                                {n}
                              </a>
                            ) : (
                              <span className="inline-block min-w-[1.75rem] rounded-md bg-gray-100 px-1.5 py-0.5 tabular-nums text-gray-400">0</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-2 text-center">
                        {countAud(mes) > 0 ? (
                          <a href={`/api/nutri/relatorio-mensal?unit=${unit.id}&mes=${ym}`} target="_blank" rel="noopener" title={`Relatório mensal nutricional · ${formatMonthPT(mes)}`} className="inline-block min-w-[1.75rem] rounded-md bg-brand-light px-1.5 py-0.5 font-semibold tabular-nums text-brand-dark">
                            {countAud(mes)}
                          </a>
                        ) : (
                          <span className="inline-block min-w-[1.75rem] rounded-md bg-gray-100 px-1.5 py-0.5 tabular-nums text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {total > 0 ? (
                          <a href={`/api/nutri/controles/dossie?unit=${unit.id}&mes=${ym}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-semibold text-ink hover:bg-surface-muted">
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500">Toque num número para abrir o PDF daquele tipo no mês (imprima pelo navegador). “Mês inteiro” junta todos os controles do mês num único PDF; “Audit.” abre o relatório mensal das auditorias nutricionais.</p>
        </div>
      )}
    </div>
  );
}
