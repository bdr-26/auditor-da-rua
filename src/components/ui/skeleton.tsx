import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-200/80", className)} />;
}

/** Esqueleto genérico de página: título + cartões. */
export function PageSkeleton({ cards = 3, tall = false }: { cards?: number; tall?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className={tall ? "h-40" : "h-24"} />
      ))}
    </div>
  );
}
