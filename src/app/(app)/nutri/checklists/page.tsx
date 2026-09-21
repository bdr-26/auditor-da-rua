import Link from "next/link";
import { ChevronRight, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getCompositionStats } from "@/lib/data/nutri";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const supabase = await createClient();
  const [units, stats] = await Promise.all([getUnits(supabase), getCompositionStats(supabase)]);

  return (
    <div className="space-y-5">
      <PageHeader title="Checklists nutricionais" subtitle="Composição por unidade e banco central de itens" back={profile.role === "proprietario" ? "/dashboard" : "/nutri"} />

      <Link href="/nutri/checklists/banco" className="flex items-center gap-3 rounded-2xl border border-line bg-ink px-4 py-4 text-white hover:bg-graphite">
        <Database className="h-6 w-6 text-brand" />
        <div className="flex-1">
          <div className="font-semibold">Banco de itens</div>
          <div className="text-xs text-gray-300">Textos, versões, pesos e itens desativados</div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Unidades</h2>
        <div className="space-y-2">
          {units.map((u) => {
            const s = stats.get(u.id);
            return (
              <Link key={u.id} href={`/nutri/checklists/${u.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 hover:bg-surface-muted">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{u.nome}</span>
                    {u.nutri_checklist_em_revisao && <Badge tone="yellow">em revisão</Badge>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s ? `${s.ativos} ativos · ${s.pausados} pausados · ${s.areas} áreas` : "sem composição"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
