import { GerarAgendaButton, RotinaNewToggle, RotinaRow } from "@/components/nutri/rotina-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getNutriTeam } from "@/lib/data/nutri-agenda";
import { getNutriRotinas } from "@/lib/data/nutri-rotinas";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rotina padrão da nutrição" };

/** Chefe: define quem visita cada unidade e quando; a agenda é gerada sozinha (cron diário + botão). */
export default async function NutriRotinaPage() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  if (!chefe) redirect("/nutri/agenda");
  const supabase = await createClient();
  const [rotinas, team, units] = await Promise.all([getNutriRotinas(supabase), getNutriTeam(supabase), getUnits(supabase)]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const nome = new Map(team.map((m) => [m.id, m.nome]));
  const porUnidade = units.map((u) => ({ unit: u, rotinas: rotinas.filter((r) => r.unit_id === u.id) })).filter((g) => g.rotinas.length > 0);
  const semRotina = units.filter((u) => !rotinas.some((r) => r.unit_id === u.id));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Rotina padrão" subtitle="Quem visita cada unidade e quando. As visitas entram na agenda automaticamente." back="/nutri/agenda" actions={<RotinaNewToggle team={team} units={units} />} />

      <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
        Exemplo da operação: Moema todo dia com a estagiária; Imigrantes, Bela Vista e Mooca uma vez por semana; Café da Rua uma vez por mês. A agenda dos próximos 30 dias é completada todo dia às 8h e a responsável recebe o lembrete do dia. Lojas em abertura só passam a gerar visitas quando forem marcadas como ativas.
      </p>

      <GerarAgendaButton />

      {rotinas.length === 0 && <EmptyState title="Nenhuma rotina definida" description="Use “Nova rotina” para cadastrar a visita padrão de cada unidade." />}

      {porUnidade.map(({ unit, rotinas: rs }) => (
        <section key={unit.id}>
          <h2 className="mb-1.5 text-sm font-semibold">{unit.nome}</h2>
          <div className="space-y-2">
            {rs.map((r) => (
              <RotinaRow key={r.id} rotina={r} unitName={unitById.get(r.unit_id)?.nome ?? "Unidade"} responsavelNome={nome.get(r.responsavel_id) ?? "—"} unitEmAbertura={!!unitById.get(r.unit_id)?.em_abertura} team={team} units={units} />
            ))}
          </div>
        </section>
      ))}

      {rotinas.length > 0 && semRotina.length > 0 && <p className="text-xs text-gray-500">Sem rotina: {semRotina.map((u) => u.nome).join(", ")}.</p>}
    </div>
  );
}
