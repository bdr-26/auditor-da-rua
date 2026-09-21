import { notFound } from "next/navigation";
import { CompositionEditor } from "@/components/nutri/composition-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getNutriBank, getUnitComposition } from "@/lib/data/nutri";
import { getUnit, getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UnitChecklistPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  await requireProfile(["auditor_nutricao", "proprietario"]);
  const supabase = await createClient();
  const [unit, areas, bank, units] = await Promise.all([getUnit(supabase, unitId), getUnitComposition(supabase, unitId), getNutriBank(supabase), getUnits(supabase, { ativas: false })]);
  if (!unit) notFound();
  const ativos = areas.reduce((n, a) => n + a.entries.filter((e) => e.status === "ativo").length, 0);
  const pausados = areas.reduce((n, a) => n + a.entries.filter((e) => e.status === "pausado").length, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={unit.nome} subtitle={`Composição do checklist · ${ativos} ativos · ${pausados} pausados · ${areas.length} áreas`} back="/nutri/checklists" />
      <CompositionEditor unit={unit} areas={areas} bank={bank} otherUnits={units.filter((u) => u.id !== unit.id)} />
    </div>
  );
}
