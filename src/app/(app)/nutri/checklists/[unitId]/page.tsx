import { notFound } from "next/navigation";
import { CompositionEditor } from "@/components/nutri/composition-editor";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getNutriBank, getUnitComposition } from "@/lib/data/nutri";
import { getUnit, getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UnitChecklistPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  const supabase = await createClient();
  const [unit, areas, bank, units] = await Promise.all([getUnit(supabase, unitId), getUnitComposition(supabase, unitId), getNutriBank(supabase), getUnits(supabase, { ativas: false })]);
  if (!unit) notFound();
  const ativos = areas.reduce((n, a) => n + a.entries.filter((e) => e.status === "ativo").length, 0);
  const pausados = areas.reduce((n, a) => n + a.entries.filter((e) => e.status === "pausado").length, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={unit.nome} subtitle={`Composição do checklist · ${ativos} ativos · ${pausados} pausados · ${areas.length} áreas`} back="/nutri/checklists" />
      {chefe ? (
        <CompositionEditor unit={unit} areas={areas} bank={bank} otherUnits={units.filter((u) => u.id !== unit.id)} />
      ) : (
        <div className="space-y-4">
          {areas.map((a) => (
            <section key={a.area} className="rounded-2xl border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">{a.area}</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {a.entries
                  .filter((e) => e.status === "ativo")
                  .map((e) => (
                    <li key={e.id}>
                      {e.item.descricao}
                      {e.item.peso !== 1 && <span className="ml-1 text-xs text-gray-500">(peso {e.item.peso})</span>}
                    </li>
                  ))}
              </ol>
            </section>
          ))}
          <p className="text-xs text-gray-500">Consulta: os itens descrevem o problema a procurar. Para alterar itens ou pesos, fale com a nutricionista chefe.</p>
        </div>
      )}
    </div>
  );
}
