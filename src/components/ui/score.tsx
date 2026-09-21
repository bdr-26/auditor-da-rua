import { pctTone } from "@/lib/domain/scoring";
import { cn, fmtPct } from "@/lib/utils";

/** Nota em % com cor de semáforo. */
export function PctBadge({ value, className, size = "md" }: { value: number | null | undefined; className?: string; size?: "sm" | "md" | "lg" }) {
  const tone = pctTone(value);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-bold tabular-nums",
        `tone-${tone}`,
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "md" && "px-2 py-1 text-sm",
        size === "lg" && "px-3 py-1.5 text-xl",
        className,
      )}
    >
      {fmtPct(value)}
    </span>
  );
}

/** Barra horizontal de nota (0–100) com rótulo. */
export function ScoreBar({ label, value, zerado, hint }: { label: string; value: number | null | undefined; zerado?: boolean; hint?: string }) {
  const tone = zerado ? "red" : pctTone(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className={cn("font-medium", zerado && "text-red-700")}>
          {label}
          {zerado && <span className="ml-1 text-xs font-semibold text-red-700">⚠ zerado</span>}
        </span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-xs text-gray-500">{hint}</span>}
          <span className="font-semibold tabular-nums">{fmtPct(value)}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={cn("h-full rounded-full transition-all", `tone-bar-${tone}`)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-200", className)} aria-valuenow={value} aria-valuemax={max} role="progressbar">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
