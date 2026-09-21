"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icon: Icon,
  variant,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "side" | "bottom";
}) {
  const pathname = usePathname();
  const exactRoots = ["/auditor", "/nutri", "/dashboard"];
  const active = exactRoots.includes(href)
    ? pathname === href || (href === "/dashboard" && pathname.startsWith("/dashboard/lojas")) || (href === "/dashboard" && pathname.startsWith("/dashboard/auditores")) || (href === "/dashboard" && pathname.startsWith("/dashboard/criterios")) || (href === "/dashboard" && pathname.startsWith("/dashboard/pendencias"))
    : pathname === href || pathname.startsWith(href + "/");

  if (variant === "side") {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active ? "bg-brand-light text-brand-dark" : "text-gray-700 hover:bg-surface-muted",
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
      className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand-dark" : "text-gray-500")}
    >
      <Icon className={cn("h-5 w-5", active && "text-brand-dark")} />
      {label}
    </Link>
  );
}
