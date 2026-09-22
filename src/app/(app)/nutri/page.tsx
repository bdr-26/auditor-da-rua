import Link from "next/link";
import { ChevronRight, ClipboardPlus, ListChecks, PlayCircle, Store } from "lucide-react";
import { NutriAuditRow } from "@/components/nutri/audit-row";
import { ClassBadge } from "@/components/nutri/nutri-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { getDraftProgress, getLastNutriAuditByUnit, getNutriAudits } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { daysBetween, formatDayLabelPT, monthStart, todaySP } from "@/lib/dates";
import { computeMonthlyNutri } from "@/lib/domain/monthly";
import { classifyNutri, nutriBandTone } from "@/lib/domain/nutri";
import { createClient } from "@/lib/supabase/server";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE_RING: Record<string, string> = {
  green: "border-green-200 bg-green-50",
  yellow: "border-yellow-200 bg-yellow-50",
  orange: "border-orange-200 bg-orange-50",
  red: "border-red-200 bg-red-50",
  gray: "border-line bg-white",
};

export default async function NutriHome() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const isNutri = profile.role === "auditor_nutricao";
  const supabase = await createClient();
  const today = todaySP();
  const [units, drafts, recent, lastByUnit, monthAudits] = await Promise.all([
    getUnits(supabase),
    isNutri ? getNutriAudits(supabase, { auditorId: profile.id, status: "rascunho" }) : Promise.resolve([]),
    getNutriAudits(supabase, { status: "concluida", limit: 5, auditorId: isNutri ? profile.id : undefined }),
    getLastNutriAuditByUnit(supabase),
    getNutriAudits(supabase, { status: "concluida", auditorId: isNutri ? profile.id : undefined }),
  ]);
  const progress = await getDraftProgress(supabase, drafts.map((d) => d.id));
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const mes = monthStart(today);
  const doMes = monthAudits.filter((a) => a.data >= mes);
  const media = computeMonthlyNutri(doMes.map((a) => a.nota_final));
  const semVisita = units.filter((u) => {
    const last = lastByUnit.get(u.id);
    return !last || daysBetween(last.data, today) > 7;
  }).length;

  return (
    <div className="space-y-5">
      {/* cabeçalho */}
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-500 capitalize">{formatDayLabelPT(today)}</p>
          <h1 className="text-2xl font-bold">{isNutri ? `Olá, ${profile.nome.split(" ")[0]}` : "Nutrição"}</h1>
        </div>
        <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">Food Checker</span>
      </header>

      {/* continuar rascunho */}
      {drafts.map((a) => {
        const pr = progress.get(a.id) ?? { answered: 0, total: 0 };
        return (
          <Link key={a.id} href={`/nutri/auditorias/${a.id}`} className="block rounded-2xl bg-ink p-4 text-white shadow-lg shadow-black/10 active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-ink">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand">Continuar rascunho</div>
                <div className="truncate text-base font-bold">{unitName.get(a.unit_id) ?? "Unidade"}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={pr.answered} max={pr.total || 1} className="bg-white/15" />
              <span className="shrink-0 text-xs tabular-nums text-gray-300">
                {pr.answered}/{pr.total}
              </span>
            </div>
          </Link>
        );
      })}

      {/* ação principal */}
      {isNutri && (
        <Link href="/nutri/nova" className="flex items-center gap-4 rounded-2xl bg-brand p-4 text-ink shadow-md shadow-brand/30 active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/10">
            <ClipboardPlus className="h-7 w-7" />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold leading-tight">Nova auditoria</span>
            <span className="block text-sm text-ink/70">Escolha a loja e comece o checklist</span>
          </span>
          <ChevronRight className="h-6 w-6 text-ink/60" />
        </Link>
      )}

      {/* indicadores rápidos */}
      <section className="grid grid-cols-3 gap-2">
        <Stat label="No mês" value={String(doMes.length)} sub={doMes.length === 1 ? "auditoria" : "auditorias"} />
        <Stat label="Média do mês" value={fmtPct(media.nota)} sub={media.nota != null ? "conformidade" : "sem nota"} tone={nutriBandTone(classifyNutri(media.nota))} />
        <Stat label="Sem visita" value={String(semVisita)} sub="há mais de 7 dias" tone={semVisita > 0 ? "orange" : "green"} />
      </section>

      {/* unidades */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Unidades</h2>
          <span className="text-xs text-gray-500">toque para auditar</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {units.map((u) => {
            const last = lastByUnit.get(u.id);
            const dias = last ? daysBetween(last.data, today) : null;
            const tone = last ? nutriBandTone(last.classificacao) : "gray";
            const href = isNutri ? `/nutri/nova?unit=${u.id}` : `/dashboard/lojas/${u.id}`;
            return (
              <Link key={u.id} href={href} className={cn("flex min-h-[6.5rem] flex-col rounded-2xl border p-3 active:scale-[0.99]", TONE_RING[tone])}>
                <div className="flex items-start justify-between gap-1">
                  <Store className="h-4 w-4 shrink-0 text-gray-500" />
                  {last && <span className="text-sm font-bold tabular-nums">{fmtPct(last.nota_final)}</span>}
                </div>
                <div className="mt-auto">
                  <div className="truncate text-sm font-semibold leading-tight">{u.nome}</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    {last ? (dias === 0 ? "auditada hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`) : "nunca auditada"}
                  </div>
                  {last && <ClassBadge classificacao={last.classificacao} className="mt-1" />}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* últimas */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Últimas auditorias</h2>
          <Link href="/nutri/historico" className="text-sm font-medium text-brand-dark">
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Nenhuma auditoria concluída ainda" description={isNutri ? "Toque em “Nova auditoria” para começar a primeira visita." : undefined} />
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} />
            ))}
          </div>
        )}
      </section>

      <Link href="/nutri/checklists" className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 active:bg-surface-muted">
        <ListChecks className="h-5 w-5 text-brand-dark" />
        <span className="flex-1 text-sm font-medium">Checklists por unidade</span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </Link>
    </div>
  );
}

function Stat({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={cn("rounded-2xl border p-3", TONE_RING[tone] ?? TONE_RING.gray)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}
