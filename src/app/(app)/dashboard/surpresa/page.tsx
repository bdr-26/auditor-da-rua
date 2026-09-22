import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StartAuditForm } from "@/components/audit/start-audit-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getAuditorAudits } from "@/lib/data/audit-flow";
import { getUnits } from "@/lib/data/units";
import { formatDatePT, todaySP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoria surpresa" };

/**
 * Proprietário inicia uma auditoria (completa/simplificada/produção) na unidade que está visitando.
 * Mesmo fluxo e mesma nota do gerente; entra no relatório e na nota mensal sem mexer na agenda dele.
 */
export default async function AuditoriaSurpresaPage({ searchParams }: { searchParams: Promise<{ erro?: string; unit?: string }> }) {
  const profile = await requireProfile(["proprietario"]);
  const { erro, unit } = await searchParams;
  const supabase = await createClient();
  const [units, minhas] = await Promise.all([getUnits(supabase), getAuditorAudits(supabase, profile.id, 12)]);
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const rascunhos = minhas.filter((a) => a.status === "rascunho");
  const concluidas = minhas.filter((a) => a.status === "concluida").slice(0, 6);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Auditoria surpresa" subtitle="Escolha a unidade e o tipo; o passo a passo é o mesmo do gerente e a nota vale para o mês." back="/dashboard" />

      {rascunhos.length > 0 && (
        <Card className="mb-4 border-yellow-300 bg-yellow-50">
          <CardTitle>Em andamento</CardTitle>
          <ul className="space-y-2">
            {rascunhos.map((a) => (
              <li key={a.id}>
                <Link href={`/auditorias/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{unitName.get(a.unit_id) ?? "Unidade"}</span>
                    <span className="block text-xs text-gray-600">
                      {AUDIT_TYPE_SHORT[a.tipo]} · {formatDatePT(a.data)} · etapa {a.etapa_atual + 1}
                    </span>
                  </span>
                  <Badge tone="yellow">rascunho</Badge>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StartAuditForm units={units.map((u) => ({ id: u.id, nome: u.nome, tipo: u.tipo }))} today={todaySP()} initialError={erro} initialUnitId={unit} submitLabel="Iniciar auditoria surpresa" />

      <p className="mt-3 text-center text-xs text-gray-500">A auditoria surpresa não substitui a rotina do gerente: a visita prevista dele continua na agenda.</p>

      {concluidas.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Suas últimas auditorias</CardTitle>
          <ul className="divide-y divide-line">
            {concluidas.map((a) => (
              <li key={a.id}>
                <Link href={`/auditorias/${a.id}/resumo`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{unitName.get(a.unit_id) ?? "Unidade"}</span>
                    <span className="block text-xs text-gray-600">
                      {AUDIT_TYPE_SHORT[a.tipo]} · {formatDatePT(a.data)}
                    </span>
                  </span>
                  <span className="font-semibold">{fmtPct(a.nota_final)}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
