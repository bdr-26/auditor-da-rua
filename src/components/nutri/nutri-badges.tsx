import { Badge } from "@/components/ui/badge";
import { nutriBandTone } from "@/lib/domain/nutri";
import { cn, fmtPct } from "@/lib/utils";

/** Badge de classificação nutricional (Excelente / Satisfatório / Insatisfatório / Crítico). */
export function ClassBadge({ classificacao, className }: { classificacao: string | null; className?: string }) {
  return (
    <Badge tone={nutriBandTone(classificacao)} className={className}>
      {classificacao ?? "—"}
    </Badge>
  );
}

/** Nota % grande com a cor da faixa. */
export function NotaNutri({ nota, classificacao, size = "md", className }: { nota: number | null; classificacao: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const tone = nutriBandTone(classificacao);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-bold tabular-nums",
        `tone-${tone}`,
        size === "sm" && "px-2 py-0.5 text-sm",
        size === "md" && "px-2.5 py-1 text-base",
        size === "lg" && "px-4 py-2 text-4xl",
        className,
      )}
    >
      {fmtPct(nota)}
    </span>
  );
}
