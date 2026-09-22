import { notFound, redirect } from "next/navigation";
import { DemandaDetailView } from "@/components/demandas/demanda-detail";
import { DemandaForm } from "@/components/demandas/demanda-form";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getDemanda } from "@/lib/data/demandas";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DemandaAuditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const profile = await requireProfile(["auditor_geral", "proprietario"]);
  const [{ id }, { editar }] = await Promise.all([params, searchParams]);
  if (profile.role === "proprietario") redirect(`/dashboard/demandas/${id}`);
  const supabase = await createClient();
  const detail = await getDemanda(supabase, id);
  if (!detail) notFound();
  const encerrada = detail.demanda.status === "concluida" || detail.demanda.status === "cancelada";
  const minha = detail.demanda.criado_por === profile.id; // demanda pessoal: o gerente pode editar
  const units = minha && !encerrada ? await getUnits(supabase, { ativas: false }) : [];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={minha ? "Minha demanda" : "Demanda"}
        back="/auditor/demandas"
        actions={minha && !encerrada && editar !== "1" ? <a href={`/auditor/demandas/${id}?editar=1`} className="text-sm font-medium text-brand-dark">Editar</a> : undefined}
      />
      {minha && editar === "1" && !encerrada && (
        <Card className="mb-4">
          <CardTitle>Editar demanda</CardTitle>
          <DemandaForm units={units} demanda={detail.demanda} mode="self" />
        </Card>
      )}
      <DemandaDetailView detail={detail} viewerRole="auditor_geral" viewerId={profile.id} />
    </div>
  );
}
