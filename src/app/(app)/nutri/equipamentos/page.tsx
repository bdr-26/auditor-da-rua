import Link from "next/link";
import { redirect } from "next/navigation";
import { CopiarEquipamentos, EquipamentoNewToggle, EquipamentoRow } from "@/components/nutri/equipamentos-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getEquipamentos } from "@/lib/data/nutri-equipamentos";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipamentos por unidade" };

/** Chefe: cadastro dos equipamentos de cada unidade (vira as linhas do controle de temperatura e de manutenção). */
export default async function EquipamentosPage({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) redirect("/nutri");
  const { loja } = await searchParams;
  const supabase = await createClient();
  const [units, todos] = await Promise.all([getUnits(supabase), getEquipamentos(supabase, undefined, { ativos: false })]);
  const unit = units.find((u) => u.id === loja) ?? units[0] ?? null;
  const lista = unit ? todos.filter((e) => e.unit_id === unit.id) : [];
  const porUnidade = units.map((u) => ({ id: u.id, nome: u.nome, n: todos.filter((e) => e.unit_id === u.id && e.ativo).length }));
  const areas = Array.from(new Set(lista.map((e) => e.area ?? "Sem área")));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Equipamentos por unidade" subtitle="Geladeiras, freezers e pistas de cada loja. Viram as linhas do controle de temperatura e de manutenção." back="/nutri" actions={unit ? <EquipamentoNewToggle unitId={unit.id} /> : undefined} />

      <div className="flex flex-wrap gap-1.5 text-xs">
        {porUnidade.map((u) => (
          <Link key={u.id} href={`/nutri/equipamentos?loja=${u.id}`} className={cn("rounded-full px-3 py-1.5 font-medium", unit?.id === u.id ? "bg-ink text-white" : "border border-line bg-white")}>
            {u.nome} <span className="opacity-60">({u.n})</span>
          </Link>
        ))}
      </div>

      {unit && lista.length === 0 && (
        <>
          <EmptyState title={`${unit.nome} sem equipamentos cadastrados`} description="Cadastre um a um ou copie o cadastro de outra unidade. Enquanto não houver cadastro, o controle de temperatura abre com linhas em branco." />
          <CopiarEquipamentos toUnitId={unit.id} origens={porUnidade.filter((u) => u.id !== unit.id && u.n > 0)} />
        </>
      )}

      {areas.map((area) => (
        <section key={area}>
          <h2 className="mb-1.5 text-sm font-semibold">{area}</h2>
          <div className="space-y-2">
            {lista
              .filter((e) => (e.area ?? "Sem área") === area)
              .map((e) => (
                <EquipamentoRow key={e.id} equip={e} />
              ))}
          </div>
        </section>
      ))}
      <p className="text-[11px] text-gray-500">Faixas: geladeira, pista fria e câmara até 5 °C · freezer -12 °C ou menos · pista quente, estufa e banho-maria 60 °C ou mais. Desativar mantém o histórico dos controles já feitos.</p>
    </div>
  );
}
