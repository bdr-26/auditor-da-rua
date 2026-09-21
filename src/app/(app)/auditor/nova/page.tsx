import { StartAuditForm } from "@/components/audit/start-audit-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { todaySP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoria fora da agenda" };

export default async function NovaAuditoriaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireProfile(["auditor_geral"]);
  const { erro } = await searchParams;
  const supabase = await createClient();
  const units = await getUnits(supabase);
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Auditoria fora da agenda"
        subtitle="Para visitas combinadas com os proprietários que não estão na rotação."
        back="/auditor"
      />
      <StartAuditForm units={units.map((u) => ({ id: u.id, nome: u.nome, tipo: u.tipo }))} today={todaySP()} initialError={erro} />
    </div>
  );
}
