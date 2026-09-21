import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "brand" | "danger" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card flex min-h-[7.5rem] flex-col justify-between",
        tone === "brand" && "border-brand bg-brand-light",
        tone === "danger" && "border-red-200 bg-red-50",
        tone === "success" && "border-green-200 bg-green-50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        {icon && <span className={cn("text-gray-400", tone === "brand" && "text-brand-dark", tone === "danger" && "text-red-600")}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-600 sm:text-sm">{sub}</div>}
    </div>
  );
}
