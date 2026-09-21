import { redirect } from "next/navigation";
import { getSessionProfile, homeForRole } from "@/lib/auth";
import { ErrorPanel } from "@/components/ui/error-panel";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  let profile: Awaited<ReturnType<typeof getSessionProfile>>;
  try {
    profile = await getSessionProfile();
  } catch (error) {
    console.error("[root] falha ao carregar a sessão", error);
    return (
      <main className="mx-auto max-w-2xl p-6">
        <ErrorPanel title="Não foi possível carregar a sessão" error={error} />
      </main>
    );
  }
  if (!profile) redirect("/login");
  redirect(homeForRole(profile.role));
}
