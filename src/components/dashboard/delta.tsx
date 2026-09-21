import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, fmtDelta } from "@/lib/utils";

/** Variação em pontos percentuais com seta colorida. */
export function Delta({ value, className, digits = 1 }: { value: number | null | undefined; className?: string; digits?: number }) {
  if (value == null) return <span className={cn("text-gray-400", className)}>—</span>;
  const up = value > 0.05;
  const down = value < -0.05;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", up && "text-green-700", down && "text-red-700", !up && !down && "text-gray-500", className)}>
      <Icon className="h-4 w-4" />
      {fmtDelta(value, digits)} pp
    </span>
  );
}
