import { notFound } from "next/navigation";
import { DemandaDetailView } from "@/components/demandas/demanda-detail";
import { DemandaForm } from "@/components/demandas/demanda-form";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getDemanda } from "@/lib/data/demandas";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DemandaOwnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const profile = await requireProfile(["proprietario"]);
  const [{ id }, { editar }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const detail = await getDemanda(supabase, id);
  if (!detail) notFound();
  const encerrada = detail.demanda.status === "concluida" || detail.demanda.status === "cancelada";
  const [units, { data: resp }] = await Promise.all([getUnits(supabase, { ativas: false }), supabase.from("profiles").select("id, nome").eq("role", "auditor_geral").order("nome")]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Demanda"
        back="/dashboard/demandas"
        actions={!encerrada && editar !== "1" ? <a href={`/dashboard/demandas/${id}?editar=1`} className="text-sm font-medium text-brand-dark">Editar</a> : undefined}
      />
      {editar === "1" && !encerrada && (
        <Card className="mb-4">
          <CardTitle>Editar demanda</CardTitle>
          <DemandaForm units={units} responsaveis={(resp ?? []) as { id: string; nome: string }[]} demanda={detail.demanda} />
        </Card>
      )}
      <DemandaDetailView detail={detail} viewerRole="proprietario" viewerId={profile.id} />
    </div>
  );
}
