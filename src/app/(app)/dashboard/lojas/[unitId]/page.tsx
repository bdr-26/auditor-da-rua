import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, ClipboardPen, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MonthlyReportLinks } from "@/components/nutri/monthly-report-links";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge, ScoreBar } from "@/components/ui/score";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { PhotoGrid } from "@/components/dashboard/photo-grid";
import { ScoreTrendChart } from "@/components/dashboard/score-trend-chart";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT, SCORE_COLORS } from "@/lib/constants";
import { getUnitDetail, parseMesParam } from "@/lib/data/dashboard";
import { formatDatePT, formatMonthPT } from "@/lib/dates";
import { nutriBandTone } from "@/lib/domain/nutri";
import { BLOCK_NAMES, MAIN_BLOCKS } from "@/lib/domain/scoring";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

function auditHref(id: string, tipo: string) {
  return tipo === "nutricional" ? `/nutri/auditorias/${id}/resumo` : `/auditorias/${id}/resumo`;
}

export default async function UnitPage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<{ mes?: string }> }) {
  await requireProfile(["proprietario"]);
  const [{ unitId }, { mes: mesParam }] = await Promise.all([params, searchParams]);
  const mes = parseMesParam(mesParam);
  const supabase = await createClient();
  const [d, settings] = await Promise.all([getUnitDetail(supabase, unitId, mes), getSettings(supabase)]);
  if (!d) notFound();

  const isProd = d.unit.tipo === "producao";
  const nota = d.closing?.nota_operacional ?? d.summary.nota;
  const blocks = isProd
    ? d.summary.notas_blocos
    : (MAIN_BLOCKS as readonly string[]).map((k) => d.summary.notas_blocos.find((b) => b.chave === k) ?? { chave: k, nome: k, nota: null, zerado: false, peso: 20, itens_respondidos: 0, itens_aplicaveis: 0 });

  return (
    <div>
      <PageHeader
        title={d.unit.nome}
        back={`/dashboard?mes=${mes}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="capitalize">{formatMonthPT(mes)}</span>
            {isProd && <Badge tone="gray">fora do ranking</Badge>}
            {d.closed && (
              <Badge tone="dark">
                <Lock className="h-3 w-3" /> mês fechado
              </Badge>
            )}
          </span>
        }
        actions={<MonthPicker mes={mes} basePath={`/dashboard/lojas/${unitId}`} />}
      />

      <Link href={`/dashboard/surpresa?unit=${unitId}`} className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm active:scale-[0.99]">
        <ClipboardPen className="h-5 w-5 shrink-0 text-brand-dark" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Auditoria surpresa nesta unidade</span>
          <span className="block text-xs text-gray-600">Está visitando {d.unit.nome}? Faça a auditoria agora; ela entra na nota do mês.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{d.closed ? "Nota fechada" : "Nota parcial"}</div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className={cn("text-5xl font-black tabular-nums", d.summary.falhas_graves > 0 ? "text-red-700" : "text-ink")}>{fmtPct(nota)}</span>
            {d.closing?.posicao_ranking && (
              <span className="mb-1 rounded-lg bg-brand-light px-2 py-1 text-sm font-bold text-brand-dark">{d.closing.posicao_ranking}º no ranking</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm text-gray-600">
            <span>{d.summary.n_auditorias} auditoria{d.summary.n_auditorias === 1 ? "" : "s"}</span>
            {!isProd && d.summary.n_auditorias > 0 && (
              <span className="text-gray-400">
                ({d.summary.n_completas} completa{d.summary.n_completas === 1 ? "" : "s"}, {d.summary.n_simplificadas} simplificada{d.summary.n_simplificadas === 1 ? "" : "s"})
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {d.summary.falhas_graves > 0 && <Badge tone="red">⚠ {d.summary.falhas_graves} falha(s) grave(s)</Badge>}
            {d.summary.produto_vencido && <Badge tone="red">inelegível · produto vencido</Badge>}
            {d.summary.amostra_reduzida && <Badge tone="gray">amostra reduzida</Badge>}
            {d.closing?.premiada && <Badge tone="brand">premiada</Badge>}
            {d.nutri.nota != null && (
              <Badge tone={nutriBandTone(d.nutri.classificacao)}>
                nutri {fmtPct(d.nutri.nota)} · {d.nutri.classificacao}
              </Badge>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Decomposição por bloco</CardTitle>
          {d.summary.n_auditorias === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma auditoria neste mês ainda.</p>
          ) : (
            <div className="space-y-3">
              {blocks.map((b) => (
                <ScoreBar key={b.chave} label={BLOCK_NAMES[b.chave] ?? b.nome} value={b.nota} zerado={b.zerado} hint={b.itens_respondidos ? `${b.itens_respondidos} aud.` : undefined} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Evolução das últimas auditorias</CardTitle>
          {d.trend.length >= 2 ? (
            <ScoreTrendChart data={d.trend} eligibilityMin={settings.elegibilidade_min} />
          ) : (
            <p className="text-sm text-gray-500">A linha aparece a partir da segunda auditoria concluída.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Piores itens recorrentes (3 meses)</CardTitle>
          {d.worstItems.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum item com nota baixa nos últimos 3 meses.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.worstItems.map((it) => {
                const s = Math.min(5, Math.max(1, Math.round(it.media))) as 1 | 2 | 3 | 4 | 5;
                return (
                  <li key={it.chave} className="flex items-center gap-3 py-2 text-sm">
                    <span className={cn("w-10 shrink-0 rounded-md py-1 text-center text-xs font-bold tabular-nums", SCORE_COLORS[s].bg, SCORE_COLORS[s].text)}>{it.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{it.descricao}</span>
                      <span className="block text-xs text-gray-500">
                        {it.bloco} · {it.baixas} nota{it.baixas === 1 ? "" : "s"} ≤ 2 em {it.n}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Pendências em aberto</CardTitle>
          {d.pendings.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma pendência em aberto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.pendings.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <div className="flex items-start gap-2">
                    {p.reincidente && (
                      <Badge tone="red">
                        <AlertTriangle className="h-3 w-3" /> reincidente
                      </Badge>
                    )}
                    <span className="font-medium">{p.descricao}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {p.nota_origem != null ? `nota ${p.nota_origem}` : "não conforme"} · {p.visitas_sem_resolver} visita(s) sem resolver · desde {formatDatePT(p.created_at.slice(0, 10))}
                    {p.observacao_origem && <> · “{p.observacao_origem}”</>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Indicadores 99Food</CardTitle>
          {d.indicators ? (
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="text-xs text-gray-500">Nota média</dt>
                <dd className="text-2xl font-bold tabular-nums">{d.indicators.nota_99food?.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) ?? "—"}</dd>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="text-xs text-gray-500">Cancelamentos</dt>
                <dd className="text-2xl font-bold tabular-nums">{d.indicators.cancelamentos ?? "—"}</dd>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="text-xs text-gray-500">Tempo médio</dt>
                <dd className="text-2xl font-bold tabular-nums">{d.indicators.tempo_medio_entrega != null ? `${d.indicators.tempo_medio_entrega} min` : "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">
              Não lançado.{" "}
              <Link href={`/dashboard/fechamento/${mes}`} className="font-semibold text-brand-dark hover:underline">
                Lançar no fechamento →
              </Link>
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400">Informativo — não compõe a nota.</p>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardTitle>Fotos de não conformidade no mês</CardTitle>
          {d.photos.length === 0 ? <p className="text-sm text-gray-500">Nenhuma foto de item com nota 1–2 neste mês.</p> : <PhotoGrid photos={d.photos} />}
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardTitle>Apontamentos nutricionais</CardTitle>
          {d.nutriAudits.length > 0 && (
            <div className="mb-3">
              <MonthlyReportLinks mes={mes} units={[{ id: d.unit.id, nome: d.unit.nome }]} />
            </div>
          )}
          {d.nutriAudits.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma auditoria nutricional neste mês.</p>
          ) : (
            <div className="space-y-4">
              {d.nutriAudits.map(({ audit, nc }) => (
                <div key={audit.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={auditHref(audit.id, audit.tipo)} className="font-semibold hover:underline">
                      {formatDatePT(audit.data)}
                    </Link>
                    <PctBadge value={audit.nota_final} size="sm" />
                    {audit.classificacao && <Badge tone={nutriBandTone(audit.classificacao)}>{audit.classificacao}</Badge>}
                    <span className="text-xs text-gray-500">{nc.length} não conformidade(s)</span>
                  </div>
                  {nc.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {nc.map((x, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          <span>
                            {x.area && <span className="text-xs font-semibold uppercase text-gray-500">{x.area} · </span>}
                            {x.descricao}
                            {x.observacao && <span className="block text-xs text-gray-500">“{x.observacao}”</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardTitle>Auditorias do mês</CardTitle>
          {d.audits.length === 0 ? (
            <EmptyState title="Nenhuma auditoria neste mês ainda" />
          ) : (
            <ul className="divide-y divide-line">
              {d.audits.map((a) => (
                <li key={a.id}>
                  <Link href={auditHref(a.id, a.tipo)} className="flex items-center gap-3 py-2.5 text-sm hover:bg-surface-muted">
                    <span className="w-16 shrink-0 font-semibold tabular-nums">{formatDatePT(a.data).slice(0, 5)}</span>
                    <span className="flex-1 truncate">{AUDIT_TYPE_SHORT[a.tipo]}</span>
                    {a.falha_grave && <Badge tone="red">⚠</Badge>}
                    {a.status === "concluida" ? <PctBadge value={a.nota_final} size="sm" /> : <Badge tone="yellow">rascunho</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
