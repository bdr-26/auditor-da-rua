import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonthPT } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Seletor de mês por links (?mes=YYYY-MM-01). Funciona em server components. */
export function MonthPicker({ mes, basePath, className, maxMes, query }: { mes: string; basePath: string; className?: string; maxMes?: string; query?: Record<string, string> }) {
  const prev = addMonths(mes, -1);
  const next = addMonths(mes, 1);
  const extra = query ? Object.entries(query).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("") : "";
  const nextDisabled = !!maxMes && next > maxMes;
  return (
    <div className={cn("inline-flex items-center rounded-xl border border-line bg-white", className)}>
      <Link href={`${basePath}?mes=${prev}${extra}`} aria-label="Mês anterior" className="flex h-11 w-11 items-center justify-center rounded-l-xl hover:bg-surface-muted">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <span className="min-w-[9rem] px-1 text-center text-sm font-semibold capitalize">{formatMonthPT(mes)}</span>
      {nextDisabled ? (
        <span className="flex h-11 w-11 items-center justify-center text-gray-300">
          <ChevronRight className="h-5 w-5" />
        </span>
      ) : (
        <Link href={`${basePath}?mes=${next}${extra}`} aria-label="Próximo mês" className="flex h-11 w-11 items-center justify-center rounded-r-xl hover:bg-surface-muted">
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}
