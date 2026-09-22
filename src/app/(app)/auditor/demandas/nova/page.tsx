import { DemandaForm } from "@/components/demandas/demanda-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova demanda" };

/** O gerente cria uma demanda para si mesmo (organização própria); entra na agenda junto com as dos proprietários. */
export default async function NovaDemandaAuditorPage() {
  await requireProfile(["auditor_geral"]);
  const supabase = await createClient();
  const units = await getUnits(supabase);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova demanda" subtitle="Para você se organizar; aparece na sua agenda" back="/auditor/demandas" />
      <DemandaForm units={units} mode="self" />
    </div>
  );
}
