import Link from "next/link";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { ControleCard } from "@/components/nutri/controle-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getNutriTeam } from "@/lib/data/nutri-agenda";
import { getControles } from "@/lib/data/nutri-controles";
import { getUnits } from "@/lib/data/units";
import { CONTROLE_TIPOS_ATIVOS } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Controles" };

export default async function ControlesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; loja?: string; ver?: string }> }) {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const { tipo, loja, ver } = await searchParams;
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  const supabase = await createClient();
  const [controles, units, team] = await Promise.all([
    getControles(supabase, { tipo: tipo || undefined, unitId: loja || undefined, status: ver === "finalizados" ? "finalizado" : ver === "rascunhos" ? "rascunho" : undefined, limit: 200 }),
    getUnits(supabase, { ativas: false }),
    getNutriTeam(supabase),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const nome = new Map(team.map((m) => [m.id, m.nome]));
  const q = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ tipo, loja, ver, ...p })) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/nutri/controles${s ? `?${s}` : ""}`;
  };
  const isNutri = profile.role === "auditor_nutricao";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Controles"
        subtitle="Planilhas digitais: temperatura, óleo, recebimento, transporte, hortifrúti, amostras, pasta, RH e manutenção"
        back="/nutri"
        actions={
          isNutri ? (
            <Link href="/nutri/controles/novo" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Novo
            </Link>
          ) : undefined
        }
      />

      <Link href={`/nutri/arquivo${loja ? `?loja=${loja}` : ""}`} className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm hover:bg-surface-muted">
        <Archive className="h-4 w-4 text-gray-500" />
        <span className="flex-1">
          <span className="font-semibold">Arquivo de registros</span>
          <span className="block text-xs text-gray-500">Por unidade e mês, com impressão de tudo para fiscalização.</span>
        </span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </Link>

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 text-xs">
        <Link href={q({ tipo: undefined })} className={cn("shrink-0 rounded-full px-3 py-1.5 font-medium", !tipo ? "bg-ink text-white" : "border border-line bg-white")}>
          Todos
        </Link>
        {CONTROLE_TIPOS_ATIVOS.map((t) => (
          <Link key={t.codigo} href={q({ tipo: t.codigo })} className={cn("shrink-0 rounded-full px-3 py-1.5 font-medium", tipo === t.codigo ? "bg-ink text-white" : "border border-line bg-white")}>
            {t.curto}
          </Link>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Link href={q({ ver: undefined })} className={cn("rounded-full px-3 py-1.5 font-medium", !ver ? "bg-gray-200" : "border border-line bg-white")}>
          Tudo
        </Link>
        <Link href={q({ ver: "rascunhos" })} className={cn("rounded-full px-3 py-1.5 font-medium", ver === "rascunhos" ? "bg-gray-200" : "border border-line bg-white")}>
          Rascunhos
        </Link>
        <Link href={q({ ver: "finalizados" })} className={cn("rounded-full px-3 py-1.5 font-medium", ver === "finalizados" ? "bg-gray-200" : "border border-line bg-white")}>
          Finalizados
        </Link>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Link href={q({ loja: undefined })} className={cn("rounded-full px-2.5 py-1", !loja ? "bg-brand-light text-brand-dark font-semibold" : "text-gray-600")}>
          Todas as unidades
        </Link>
        {units
          .filter((u) => u.ativa)
          .map((u) => (
            <Link key={u.id} href={q({ loja: u.id })} className={cn("rounded-full px-2.5 py-1", loja === u.id ? "bg-brand-light text-brand-dark font-semibold" : "text-gray-600")}>
              {u.nome}
            </Link>
          ))}
      </div>

      {controles.length === 0 ? (
        <EmptyState title="Nenhum controle" description={isNutri ? "Toque em “Novo” para preencher uma planilha digital na visita." : "Os controles preenchidos pela equipe de nutrição aparecem aqui."} />
      ) : (
        <div className="space-y-2">
          {controles.map((c) => (
            <ControleCard key={c.id} c={c} unitName={unitName.get(c.unit_id) ?? "Unidade"} responsavelNome={chefe ? nome.get(c.responsavel_id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
