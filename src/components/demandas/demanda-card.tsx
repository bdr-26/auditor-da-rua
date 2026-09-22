import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEMANDA_STATUS_LABELS } from "@/lib/constants";
import { demandaTone, isAtrasada } from "@/lib/data/demandas";
import { daysBetween, formatDatePT, todaySP } from "@/lib/dates";
import type { Demanda } from "@/lib/types";
import { cn } from "@/lib/utils";

const BORDER: Record<string, string> = { red: "border-l-red-500", orange: "border-l-orange-500", yellow: "border-l-yellow-400", green: "border-l-green-500", gray: "border-l-gray-300" };

export function DemandaStatusBadge({ d }: { d: Demanda }) {
  const tone = demandaTone(d);
  const atrasada = isAtrasada(d);
  return (
    <Badge tone={tone === "gray" ? "gray" : tone}>
      {d.status === "concluida" && <CheckCircle2 className="h-3 w-3" />}
      {atrasada ? "Atrasada" : DEMANDA_STATUS_LABELS[d.status]}
    </Badge>
  );
}

export function prazoLabel(prazo: string | null, today = todaySP()): string {
  if (!prazo) return "sem prazo";
  const dias = daysBetween(today, prazo);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias < 0) return `venceu há ${-dias} dia${dias === -1 ? "" : "s"}`;
  return `em ${dias} dias · ${formatDatePT(prazo)}`;
}

/** Cartão de demanda para listas (agenda do gerente e painel do proprietário). */
export function DemandaCard({ d, href, unitName, anexos = 0 }: { d: Demanda; href: string; unitName?: string | null; anexos?: number }) {
  const tone = demandaTone(d);
  const encerrada = d.status === "concluida" || d.status === "cancelada";
  return (
    <Link href={href} className={cn("block rounded-2xl border border-line border-l-4 bg-white px-3 py-3 active:scale-[0.99]", BORDER[tone], encerrada && "opacity-80")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {d.prioridade === "alta" && !encerrada && (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> alta
              </Badge>
            )}
            <span className="font-semibold leading-tight">{d.titulo}</span>
            {d.criado_por === d.responsavel_id && <Badge tone="gray">pessoal</Badge>}
          </div>
          {d.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{d.descricao}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className={cn("flex items-center gap-1", isAtrasada(d) && "font-semibold text-red-700")}>
              <CalendarClock className="h-3.5 w-3.5" /> {encerrada && d.prazo ? `prazo ${formatDatePT(d.prazo)}` : prazoLabel(d.prazo)}
            </span>
            {unitName && <span>{unitName}</span>}
            {anexos > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> {anexos}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <DemandaStatusBadge d={d} />
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </Link>
  );
}
