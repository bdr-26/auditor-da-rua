import { notFound, redirect } from "next/navigation";
import { DemandaDetailView } from "@/components/demandas/demanda-detail";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getDemanda } from "@/lib/data/demandas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DemandaAuditorPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["auditor_geral", "proprietario"]);
  const { id } = await params;
  if (profile.role === "proprietario") redirect(`/dashboard/demandas/${id}`);
  const supabase = await createClient();
  const detail = await getDemanda(supabase, id);
  if (!detail) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Demanda" back="/auditor/demandas" />
      <DemandaDetailView detail={detail} viewerRole="auditor_geral" viewerId={profile.id} />
    </div>
  );
}
