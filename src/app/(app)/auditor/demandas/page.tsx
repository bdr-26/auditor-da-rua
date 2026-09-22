import Link from "next/link";
import { Plus } from "lucide-react";
import { DemandaCard } from "@/components/demandas/demanda-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getDemandas, isAtrasada } from "@/lib/data/demandas";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandas" };

export default async function DemandasAuditorPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const profile = await requireProfile(["auditor_geral"]);
  const { ver } = await searchParams;
  const supabase = await createClient();
  const [abertas, encerradas, units] = await Promise.all([
    getDemandas(supabase, { responsavelId: profile.id, status: "abertas" }),
    getDemandas(supabase, { responsavelId: profile.id, status: "encerradas", limit: 30 }),
    getUnits(supabase, { ativas: false }),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const atrasadas = abertas.filter((d) => isAtrasada(d)).length;
  const list = ver === "encerradas" ? encerradas : abertas;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Demandas"
        subtitle={`${abertas.length} aberta${abertas.length === 1 ? "" : "s"}${atrasadas ? ` · ${atrasadas} atrasada${atrasadas === 1 ? "" : "s"}` : ""}`}
        back="/auditor/agenda"
        actions={
          <Link href="/auditor/demandas/nova" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nova
          </Link>
        }
      />
      <div className="mb-3 flex gap-2 text-sm">
        <Link href="/auditor/demandas" className={`rounded-full px-3 py-1.5 font-medium ${ver !== "encerradas" ? "bg-ink text-white" : "border border-line bg-white"}`}>
          Abertas ({abertas.length})
        </Link>
        <Link href="/auditor/demandas?ver=encerradas" className={`rounded-full px-3 py-1.5 font-medium ${ver === "encerradas" ? "bg-ink text-white" : "border border-line bg-white"}`}>
          Concluídas
        </Link>
      </div>
      {list.length === 0 ? (
        <EmptyState title={ver === "encerradas" ? "Nenhuma demanda concluída" : "Nenhuma demanda aberta"} description="As demandas dos proprietários aparecem aqui e na sua agenda. Você também pode criar as suas, para se organizar." />
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <DemandaCard key={d.id} d={d} href={`/auditor/demandas/${d.id}`} unitName={d.unit_id ? unitName.get(d.unit_id) : null} />
          ))}
        </div>
      )}
    </div>
  );
}
