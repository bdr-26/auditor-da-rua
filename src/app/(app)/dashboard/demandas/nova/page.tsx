import { DemandaForm } from "@/components/demandas/demanda-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova demanda" };

export default async function NovaDemandaPage() {
  await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const [units, { data: resp }] = await Promise.all([getUnits(supabase), supabase.from("profiles").select("id, nome").eq("role", "auditor_geral").eq("ativo", true).order("nome")]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova demanda" subtitle="Aparece como cartão na agenda do gerente" back="/dashboard/demandas" />
      <DemandaForm units={units} responsaveis={(resp ?? []) as { id: string; nome: string }[]} />
    </div>
  );
}
