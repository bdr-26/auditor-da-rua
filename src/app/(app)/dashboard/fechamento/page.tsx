import Link from "next/link";
import { ChevronRight, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getClosingMonths } from "@/lib/data/dashboard";
import { formatDateTimePT, formatMonthPT } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FechamentoPage() {
  await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const months = await getClosingMonths(supabase, 12);

  return (
    <div>
      <PageHeader title="Fechamento mensal" subtitle="Indicadores 99Food, ajustes de pontualidade, ranking final e relatórios." />
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {months.map((m) => (
            <li key={m.mes}>
              <Link href={`/dashboard/fechamento/${m.mes}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-muted">
                <span className={m.closed ? "text-ink" : "text-gray-400"}>{m.closed ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold capitalize">{formatMonthPT(m.mes)}</span>
                  {m.closed && m.fechado_em && (
                    <span className="block text-xs text-gray-500">
                      fechado por {m.fechado_por_nome ?? "—"} em {formatDateTimePT(m.fechado_em)} · {m.n_units} unidade(s)
                    </span>
                  )}
                </span>
                <Badge tone={m.closed ? "dark" : "yellow"}>{m.closed ? "fechado" : "aberto"}</Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
