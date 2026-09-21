import { notFound, redirect } from "next/navigation";
import { NutriFill } from "@/components/nutri/nutri-fill";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireProfile } from "@/lib/auth";
import { getNutriFillData } from "@/lib/data/nutri";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NutriFillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string; item?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const profile = await requireProfile();
  const supabase = await createClient();
  const fill = await getNutriFillData(supabase, id);
  if (!fill) notFound();
  if (fill.audit.status === "concluida" || fill.audit.auditor_id !== profile.id) redirect(`/nutri/auditorias/${id}/resumo`);
  if (profile.role !== "auditor_nutricao") redirect(`/nutri/auditorias/${id}/resumo`);

  if (fill.areas.length === 0) {
    return (
      <EmptyState
        title="Esta auditoria não tem itens"
        description="A composição da unidade não tinha itens ativos quando o rascunho foi criado."
        action={<ButtonLink href={`/nutri/auditorias/${id}/revisao`}>Ir para a revisão</ButtonLink>}
      />
    );
  }

  const etapa = sp.etapa != null && /^\d+$/.test(sp.etapa) ? Number(sp.etapa) : fill.audit.etapa_atual;
  return <NutriFill audit={fill.audit} unit={fill.unit} areas={fill.areas} pendings={fill.pendings} initialStep={etapa} focusAnswerId={sp.item} />;
}
