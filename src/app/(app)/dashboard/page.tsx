import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarCheck, CalendarDays, ClipboardList, Factory, ListChecks, Lock, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorPanel } from "@/components/ui/error-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge } from "@/components/ui/score";
import { Delta } from "@/components/dashboard/delta";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getMonthOverview, parseMesParam } from "@/lib/data/dashboard";
import { getDemandas, isAtrasada } from "@/lib/data/demandas";
import { ClipboardCheck, ClipboardPen, Play, Plus } from "lucide-react";
import { formatDateShortPT, formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn, fmtBRL, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const profile = await requireProfile(["proprietario"]);
  const { mes: mesParam } = await searchParams;
  const mes = parseMesParam(mesParam);
  const supabase = await createClient();
  let ov: Awaited<ReturnType<typeof getMonthOverview>>;
  try {
    ov = await getMonthOverview(supabase, mes);
  } catch (error) {
    console.error("[dashboard] falha ao carregar", error);
    return (
      <div>
        <PageHeader title="Dashboard" subtitle={formatMonthPT(mes)} />
        <ErrorPanel title="Não foi possível carregar o dashboard" error={error} />
      </div>
    );
  }

  const [demandas, { data: meusRascunhos }] = await Promise.all([
    getDemandas(supabase, { status: "abertas" }),
    supabase.from("audits").select("id").eq("auditor_id", profile.id).eq("status", "rascunho"),
  ]);
  const rascunhosSurpresa = (meusRascunhos ?? []).length;
  const demandasAtrasadas = demandas.filter((d) => isAtrasada(d)).length;

  const hasAudits = ov.ranking.length > 0 || (ov.production?.summary.n_auditorias ?? 0) > 0;
  const avgDelta = ov.networkAvg != null && ov.prevNetworkAvg != null ? ov.networkAvg - ov.prevNetworkAvg : null;

  const links = [
    { href: `/dashboard/criterios?mes=${mes}`, label: "Piores critérios da rede", icon: ListChecks },
    { href: `/dashboard/auditores?mes=${mes}`, label: "Perfil dos auditores", icon: Users },
    { href: `/dashboard/calendario?mes=${mes}`, label: "Calendário da rotina", icon: CalendarDays },
    { href: `/dashboard/fechamento/${mes}`, label: "Fechamento", icon: ClipboardList },
    { href: "/dashboard/demandas", label: "Demandas para o gerente", icon: ListChecks },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="capitalize">{formatMonthPT(mes)}</span>
            {ov.closed && (
              <Badge tone="dark">
                <Lock className="h-3 w-3" /> mês fechado
              </Badge>
            )}
          </span>
        }
        actions={<MonthPicker mes={mes} basePath="/dashboard" />}
      />

      {/* Nível 1 — KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Líder do mês"
          tone="brand"
          icon={<Trophy className="h-5 w-5" />}
          value={ov.leader ? <span className="line-clamp-2 text-xl sm:text-2xl">{ov.leader.nome}</span> : <span className="text-base font-semibold text-gray-500">sem líder ainda</span>}
          sub={ov.leader ? <span className="font-semibold tabular-nums text-brand-dark">{fmtPct(ov.leader.nota)}{ov.leader.empate && " · empate"}</span> : "nenhuma loja com nota"}
        />
        <KpiCard
          label="Média da rede"
          icon={<BarChart3 className="h-5 w-5" />}
          value={<span className="tabular-nums">{fmtPct(ov.networkAvg)}</span>}
          sub={
            <span className="flex items-center gap-1">
              <Delta value={avgDelta} /> <span className="text-gray-400">vs. mês anterior</span>
            </span>
          }
        />
        <KpiCard
          label="Falhas graves no mês"
          tone={ov.falhasGraves > 0 ? "danger" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
          value={<span className={cn("tabular-nums", ov.falhasGraves > 0 && "text-red-700")}>{ov.falhasGraves}</span>}
          sub={ov.falhasGraves > 0 ? "auditorias com item ⚠ nota 1" : "nenhuma falha grave"}
        />
        <KpiCard
          label="Rotina cumprida"
          icon={<CalendarCheck className="h-5 w-5" />}
          tone={ov.rotina.pct != null && ov.rotina.pct < 80 ? "danger" : ov.rotina.pct != null && ov.rotina.pct >= 95 ? "success" : "default"}
          value={
            ov.rotina.planned > 0 ? (
              <span className="tabular-nums">
                {ov.rotina.done}/{ov.rotina.planned} dias <span className="text-lg text-gray-500">· {ov.rotina.pct}%</span>
              </span>
            ) : (
              <span className="text-base font-semibold text-gray-500">sem dias previstos</span>
            )
          }
          sub={`${ov.nutriAuditorNome ?? "Nutricionista"}: ${ov.nutriTotal} auditoria${ov.nutriTotal === 1 ? "" : "s"} no mês`}
        />
      </section>

      {/* Ações dos proprietários: demandas para o gerente e auditoria surpresa */}
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", rascunhosSurpresa > 0 ? "border-yellow-300 bg-yellow-50" : "border-line bg-white")}>
          <ClipboardPen className="h-5 w-5 shrink-0 text-brand-dark" />
          <Link href="/dashboard/surpresa" className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Auditoria surpresa</div>
            <div className="text-xs text-gray-600">
              {rascunhosSurpresa > 0 ? `${rascunhosSurpresa} em andamento · toque para continuar` : "Visitou uma unidade? Faça a auditoria agora; vale como qualquer outra."}
            </div>
          </Link>
          <Link href="/dashboard/surpresa" className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-brand px-3 text-sm font-semibold text-white">
            <Play className="h-4 w-4" /> {rascunhosSurpresa > 0 ? "Continuar" : "Iniciar"}
          </Link>
        </div>
        <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", demandasAtrasadas > 0 ? "border-red-200 bg-red-50" : "border-line bg-white")}>
          <ClipboardCheck className={cn("h-5 w-5 shrink-0", demandasAtrasadas > 0 ? "text-red-700" : "text-brand-dark")} />
          <Link href="/dashboard/demandas" className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Demandas para o gerente</div>
            <div className="text-xs text-gray-600">
              {demandas.length === 0 ? "nenhuma aberta" : `${demandas.length} aberta${demandas.length === 1 ? "" : "s"}`}
              {demandasAtrasadas > 0 && <span className="font-semibold text-red-700"> · {demandasAtrasadas} atrasada{demandasAtrasadas === 1 ? "" : "s"}</span>}
            </div>
          </Link>
          <Link href="/dashboard/demandas/nova" className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-brand px-3 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nova
          </Link>
        </div>
      </section>

      {/* Nível 2 — Ranking */}
      <section className="mt-6">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="mb-0">Ranking das lojas</CardTitle>
            <span className="text-xs text-gray-500">elegibilidade ≥ {ov.settings.elegibilidade_min}%</span>
          </div>
          {hasAudits || ov.semAuditorias.length ? (
            <RankingTable ranking={ov.ranking} semAuditorias={ov.semAuditorias} mes={mes} closed={ov.closed} />
          ) : (
            <EmptyState title="Nenhuma auditoria neste mês ainda" description="O ranking aparece assim que a primeira auditoria do gerente for concluída." />
          )}
          {ov.closed && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm">
              <Trophy className="h-4 w-4 text-brand-dark" />
              {ov.premiadas.length > 0 ? (
                <span>
                  <strong>Loja premiada:</strong> {ov.premiadas.map((p) => p.unit.nome).join(" e ")} ({fmtBRL(ov.settings.premio_valor)}
                  {ov.premiadas.length > 1 ? " dividido" : ""} ao supervisor)
                </span>
              ) : (
                <span>Sem loja premiada este mês.</span>
              )}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <CardTitle className="mb-0 flex items-center gap-2">
              <Factory className="h-4 w-4 text-gray-500" /> {ov.production?.unit.nome ?? "Produção"}
            </CardTitle>
            <Badge tone="gray">fora do ranking</Badge>
          </div>
          {ov.production && ov.production.summary.n_auditorias > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <PctBadge value={ov.production.closing?.nota_operacional ?? ov.production.summary.nota} size="lg" />
              <div className="text-sm text-gray-600">
                <div>
                  {ov.production.summary.n_auditorias} auditoria{ov.production.summary.n_auditorias === 1 ? "" : "s"} · média das terças
                </div>
                {ov.production.summary.falhas_graves > 0 && <div className="font-semibold text-red-700">⚠ {ov.production.summary.falhas_graves} falha(s) grave(s)</div>}
                {ov.production.lastAudit && (
                  <Link href={`/auditorias/${ov.production.lastAudit.id}/resumo`} className="text-brand-dark hover:underline">
                    Última: {formatDateShortPT(ov.production.lastAudit.data)} · {AUDIT_TYPE_SHORT[ov.production.lastAudit.tipo]} · {fmtPct(ov.production.lastAudit.nota_final)} →
                  </Link>
                )}
              </div>
              <Link href={`/dashboard/lojas/${ov.production.unit.id}?mes=${mes}`} className="ml-auto text-sm font-semibold text-brand-dark hover:underline">
                Ver detalhes →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma auditoria de produção neste mês ainda.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Pendências em aberto na rede</CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-3xl font-bold tabular-nums">{ov.pendings.open}</span>
            {ov.pendings.reincidentes > 0 ? (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> {ov.pendings.reincidentes} reincidente{ov.pendings.reincidentes === 1 ? "" : "s"}
              </Badge>
            ) : (
              <span className="text-sm text-gray-500">nenhuma reincidente</span>
            )}
            <Link href="/dashboard/pendencias" className="ml-auto text-sm font-semibold text-brand-dark hover:underline">
              Ver todas →
            </Link>
          </div>
        </Card>
      </section>

      <nav className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="card flex items-center gap-3 py-3 text-sm font-semibold transition hover:border-brand hover:bg-brand-light/40">
            <Icon className="h-5 w-5 text-brand-dark" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
