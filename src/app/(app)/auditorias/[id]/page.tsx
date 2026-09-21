import { notFound, redirect } from "next/navigation";
import { AuditFill } from "@/components/audit/audit-fill";
import { requireProfile } from "@/lib/auth";
import { getAuditFillData } from "@/lib/data/audit-flow";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preenchimento" };

export default async function AuditFillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const { etapa } = await searchParams;
  const supabase = await createClient();

  const { data: head } = await supabase.from("audits").select("id, tipo, status, auditor_id").eq("id", id).maybeSingle();
  if (!head) notFound();
  if (head.tipo === "nutricional") redirect(`/nutri/auditorias/${id}`);
  if (head.status === "concluida" || head.auditor_id !== profile.id) redirect(`/auditorias/${id}/resumo`);

  const data = await getAuditFillData(supabase, id);
  if (!data) notFound();

  const initialStep = etapa != null && /^\d+$/.test(etapa) ? Number(etapa) : data.audit.etapa_atual;

  return (
    <AuditFill
      auditId={data.audit.id}
      tipo={data.audit.tipo}
      unitNome={data.unit.nome}
      data={data.audit.data}
      blocks={data.blocks}
      initialAnswers={data.answers}
      initialPendings={data.pendings}
      initialStep={initialStep}
    />
  );
}
