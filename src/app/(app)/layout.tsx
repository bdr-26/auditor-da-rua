import { getSessionProfile } from "@/lib/auth";
import { navBadges } from "@/lib/nav-badges";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorPanel } from "@/components/ui/error-panel";
import { redirect } from "next/navigation";
import type { SessionProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let profile: SessionProfile | null = null;
  try {
    profile = await getSessionProfile();
  } catch (error) {
    console.error("[layout] falha ao carregar a sessão", error);
    return (
      <main className="mx-auto max-w-2xl p-6">
        <ErrorPanel title="Não foi possível carregar a sessão" error={error} />
      </main>
    );
  }
  if (!profile) redirect("/login");
  const badges = await navBadges(profile);
  return (
    <AppShell profile={profile} badges={badges}>
      {children}
    </AppShell>
  );
}
