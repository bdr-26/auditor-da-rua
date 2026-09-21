import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText, Lock, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CloseMonthButton, RegenerateReportsButton, ReopenMonthButton } from "@/components/dashboard/close-month-panel";
import { IndicatorsForm } from "@/components/dashboard/indicators-form";
import { PontualidadeItem } from "@/components/dashboard/pontualidade-form";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { requireProfile } from "@/lib/auth";
import { closingBlocker } from "@/lib/closing";
import { getClosingWorkbench } from "@/lib/data/dashboard";
import { formatDateTimePT, formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FechamentoMesPage({ params }: { params: Promise<{ mes: string }> }) {
  await requireProfile(["proprietario"]);
  const { mes } = await params;
  if (!/^\d{4}-\d{2}-01$/.test(mes)) notFound();
  const supabase = await createClient();
  const wb = await getClosingWorkbench(supabase, mes);
  const ov = wb.overview;
  const closed = ov.closed;
  const lojas = wb.units.filter((u) => u.tipo === "loja");
  const blocker = closed ? null : closingBlocker(mes);
  const hasPontualidade = Array.from(wb.pontualidade.values()).some((rows) => rows.length > 0);

  return (
    <div>
      <PageHeader
        title={`Fechamento — ${formatMonthPT(mes)}`}
        back="/dashboard/fechamento"
        subtitle={
          closed ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="dark">
                <Lock className="h-3 w-3" /> fechado
              </Badge>
              {ov.closings[0] && (
                <span>
                  por {wb.fechadoPorNome ?? "—"} em {formatDateTimePT(ov.closings[0].fechado_em)}
                </span>
              )}
            </span>
          ) : (
            <Badge tone="yellow">aberto</Badge>
          )
        }
      />

      <div className="space-y-4">
        {/* Indicadores 99Food */}
        <Card>
          <CardTitle>Indicadores 99Food</CardTitle>
          <p className="mb-3 text-xs text-gray-500">Um lançamento por loja no mês. Informativo — não compõe a nota. {closed && "Somente leitura com o mês fechado."}</p>
          <IndicatorsForm mes={mes} units={lojas} indicators={wb.indicators} readOnly={closed} />
        </Card>

        {/* Ajustes de pontualidade */}
        <Card>
          <CardTitle>Ajuste de pontualidade/escala (Control iD)</CardTitle>
          <p className="mb-3 text-xs text-gray-500">
            Única componente ajustável pelo proprietário. Cada ajuste exige justificativa, fica registrado com autor e data e recalcula a nota da auditoria.
            {closed && " Bloqueado com o mês fechado."}
          </p>
          {!hasPontualidade ? (
            <p className="text-sm text-gray-500">Nenhuma auditoria completa ou simplificada concluída neste mês.</p>
          ) : (
            <div className="space-y-4">
              {lojas.map((u) => {
                const rows = wb.pontualidade.get(u.id) ?? [];
                if (rows.length === 0) return null;
                return (
                  <div key={u.id}>
                    <h3 className="mb-2 text-sm font-semibold">{u.nome}</h3>
                    <ul className="space-y-2">
                      {rows.map((r) => (
                        <PontualidadeItem key={r.answerId} row={r} readOnly={closed} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Fechar mês */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="mb-0">{closed ? "Ranking final" : "Prévia do ranking"}</CardTitle>
            <span className="text-xs text-gray-500">
              elegível ≥ {ov.settings.elegibilidade_min}% · prêmio {fmtBRL(ov.settings.premio_valor)}
            </span>
          </div>
          {ov.ranking.length === 0 && ov.semAuditorias.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma auditoria neste mês.</p>
          ) : (
            <RankingTable ranking={ov.ranking} semAuditorias={ov.semAuditorias} mes={mes} closed={closed} />
          )}
          {ov.production && (
            <p className="mt-3 text-xs text-gray-500">
              {ov.production.unit.nome} (fora do ranking): nota {ov.production.closing?.nota_operacional ?? ov.production.summary.nota ?? "—"}% em {ov.production.summary.n_auditorias} auditoria(s).
            </p>
          )}

          <div className="mt-4 rounded-xl bg-brand-light px-4 py-3 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <Trophy className="h-4 w-4 text-brand-dark" />
              {closed ? (
                ov.premiadas.length > 0 ? (
                  <span>
                    <strong>Loja premiada:</strong> {ov.premiadas.map((p) => p.unit.nome).join(" e ")} — {fmtBRL(ov.settings.premio_valor)}
                    {ov.premiadas.length > 1 ? " dividido entre os supervisores" : " ao supervisor"}
                  </span>
                ) : (
                  <span>Sem loja premiada este mês.</span>
                )
              ) : ov.ranking.some((r) => r.premiada) ? (
                <span>
                  Se fechado agora: <strong>{ov.ranking.filter((r) => r.premiada).map((r) => r.nome).join(" e ")}</strong> premiada ({fmtBRL(ov.settings.premio_valor)} ao supervisor)
                </span>
              ) : (
                <span>Se fechado agora: sem loja premiada (nenhuma 1ª colocada elegível).</span>
              )}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-start gap-3">
            {closed ? (
              <>
                <ReopenMonthButton mes={mes} />
                <span className="self-center text-xs text-gray-500">Reabrir apaga o ranking gravado para corrigir ajustes ou indicadores.</span>
              </>
            ) : (
              <CloseMonthButton mes={mes} blocker={blocker} disabled={ov.ranking.length === 0 && !ov.production?.summary.n_auditorias} />
            )}
          </div>
        </Card>

        {/* Relatórios */}
        {closed && (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="mb-0">Relatórios PDF</CardTitle>
              <RegenerateReportsButton mes={mes} />
            </div>
            {wb.reports.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-orange-700">
                <AlertTriangle className="h-4 w-4" /> Nenhum relatório gerado ainda para este mês.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {wb.reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/api/reports/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-surface-muted" target="_blank" rel="noopener">
                      <FileText className="h-5 w-5 text-brand-dark" />
                      <span className="flex-1 font-medium">{r.tipo === "consolidado" ? "Consolidado do grupo" : `Loja — ${r.unit_nome ?? "—"}`}</span>
                      <span className="text-xs text-gray-500">{formatDateTimePT(r.gerado_em)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
