"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, FileText, History, Home, ListChecks, Settings, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícones referenciados por nome: componentes de servidor não podem passar funções a componentes de cliente. */
export const NAV_ICONS = { home: Home, calendar: CalendarDays, history: History, checklist: ListChecks, chart: BarChart3, closing: ClipboardList, store: Store, settings: Settings, report: FileText, tasks: ClipboardCheck } as const;
export type NavIconName = keyof typeof NAV_ICONS;

export function NavLink({
  href,
  label,
  icon,
  variant,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  variant: "side" | "bottom";
}) {
  const pathname = usePathname();
  const Icon = NAV_ICONS[icon];
  // raízes "exatas": subrotas que têm item próprio no menu não devem destacar a raiz
  const active = (() => {
    if (href === "/nutri") return pathname === "/nutri" || pathname.startsWith("/nutri/nova") || pathname.startsWith("/nutri/auditorias");
    if (href === "/dashboard") return pathname === "/dashboard" || ["/dashboard/lojas", "/dashboard/auditores", "/dashboard/criterios", "/dashboard/pendencias"].some((p) => pathname.startsWith(p));
    if (href === "/auditor") return pathname === "/auditor" || pathname.startsWith("/auditor/nova") || pathname.startsWith("/auditorias");
    return pathname === href || pathname.startsWith(href + "/");
  })();

  if (variant === "side") {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
          active ? "bg-ink text-white shadow-sm" : "text-gray-700 hover:bg-surface-muted",
        )}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium", active ? "text-ink" : "text-gray-500")}
    >
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-ink text-white")}>
        <Icon className="h-5 w-5" />
      </span>
      {label}
    </Link>
  );
}
