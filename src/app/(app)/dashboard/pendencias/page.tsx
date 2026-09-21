import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getNetworkPendings } from "@/lib/data/dashboard";
import { formatDatePT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PendenciasPage() {
  await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const { units, pendings } = await getNetworkPendings(supabase);
  const reinc = pendings.filter((p) => p.reincidente).length;
  const groups = units.map((u) => ({ unit: u, items: pendings.filter((p) => p.unit_id === u.id) })).filter((g) => g.items.length > 0);
  groups.sort((a, b) => b.items.filter((p) => p.reincidente).length - a.items.filter((p) => p.reincidente).length || b.items.length - a.items.length);

  return (
    <div>
      <PageHeader
        title="Pendências em aberto"
        back="/dashboard"
        subtitle={
          <span className="flex items-center gap-2">
            {pendings.length} na rede
            {reinc > 0 && (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> {reinc} reincidente{reinc === 1 ? "" : "s"}
              </Badge>
            )}
          </span>
        }
      />
      {groups.length === 0 ? (
        <EmptyState title="Nenhuma pendência em aberto" description="Itens com nota 1–2 ou não conformes aparecem aqui até serem resolvidos na próxima visita." />
      ) : (
        <div className="space-y-4">
          {groups.map(({ unit, items }) => (
            <Card key={unit.id}>
              <div className="mb-2 flex items-center justify-between">
                <CardTitle className="mb-0">
                  <Link href={`/dashboard/lojas/${unit.id}`} className="hover:underline">
                    {unit.nome}
                  </Link>
                </CardTitle>
                <span className="text-xs text-gray-500">{items.length} pendência{items.length === 1 ? "" : "s"}</span>
              </div>
              <ul className="divide-y divide-line">
                {items.map((p) => (
                  <li key={p.id} className={cn("py-2.5 text-sm", p.reincidente && "-mx-2 rounded-lg bg-red-50 px-2")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.reincidente && (
                        <Badge tone="red">
                          <AlertTriangle className="h-3 w-3" /> reincidente
                        </Badge>
                      )}
                      {p.nutri_entry_id && <Badge tone="gray">nutri</Badge>}
                      <span className="font-medium">{p.descricao}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span>
                        {p.dias_aberta} dia{p.dias_aberta === 1 ? "" : "s"} em aberto
                      </span>
                      <span>{p.visitas_sem_resolver} visita(s) sem resolver</span>
                      {p.nota_origem != null && <span>nota {p.nota_origem}</span>}
                      <Link href={p.nutri_entry_id ? `/nutri/auditorias/${p.origem_audit_id}/resumo` : `/auditorias/${p.origem_audit_id}/resumo`} className="font-semibold text-brand-dark hover:underline">
                        origem: {p.origem_data ? formatDatePT(p.origem_data) : "auditoria"}
                        {p.origem_tipo && ` · ${AUDIT_TYPE_SHORT[p.origem_tipo]}`} →
                      </Link>
                    </div>
                    {p.observacao_origem && <p className="mt-0.5 text-xs text-gray-500">“{p.observacao_origem}”</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
