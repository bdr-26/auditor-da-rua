import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import type { SessionProfile } from "@/lib/auth";
import { APP_NAME, ROLE_LABELS } from "@/lib/constants";
import { signOut } from "@/app/login/actions";
import { NavLink, type NavIconName } from "./nav-link";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import { InstallBanner } from "@/components/pwa/install-banner";

interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

function navFor(role: SessionProfile["role"]): NavItem[] {
  switch (role) {
    case "auditor_geral":
      return [
        { href: "/auditor", label: "Hoje", icon: "home" },
        { href: "/auditor/agenda", label: "Agenda", icon: "calendar" },
        { href: "/auditor/historico", label: "Histórico", icon: "history" },
        { href: "/auditor/relatorios", label: "Relatórios", icon: "report" },
      ];
    case "auditor_nutricao":
      return [
        { href: "/nutri", label: "Início", icon: "home" },
        { href: "/nutri/historico", label: "Histórico", icon: "history" },
        { href: "/nutri/checklists", label: "Checklists", icon: "checklist" },
      ];
    case "proprietario":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "chart" },
        { href: "/dashboard/calendario", label: "Rotina", icon: "calendar" },
        { href: "/dashboard/fechamento", label: "Fechamento", icon: "closing" },
        { href: "/nutri/checklists", label: "Nutri", icon: "checklist" },
        { href: "/admin/unidades", label: "Unidades", icon: "store" },
        { href: "/admin/configuracoes", label: "Ajustes", icon: "settings" },
      ];
  }
}

/** Layout com navegação: barra inferior no celular, lateral no desktop. */
export function AppShell({ profile, children }: { profile: SessionProfile; children: React.ReactNode }) {
  const nav = navFor(profile.role);
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
          <div>
            <div className="text-sm font-bold leading-tight">{APP_NAME}</div>
            <div className="text-xs text-gray-500">Burger da Rua</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="side" />
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <div className="truncate text-sm font-medium">{profile.nome}</div>
          <div className="text-xs text-gray-500">{ROLE_LABELS[profile.role]}</div>
          <div className="mt-3 flex items-center gap-2">
            <PushOptIn compact />
            <form action={signOut}>
              <button type="submit" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-surface-muted">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink px-4 py-3 text-white lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-1">
            <PushOptIn compact dark />
            <form action={signOut}>
              <button type="submit" aria-label="Sair" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 hover:bg-graphite">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <InstallBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {nav.slice(0, 5).map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="bottom" />
          ))}
        </nav>
      </div>
    </div>
  );
}

