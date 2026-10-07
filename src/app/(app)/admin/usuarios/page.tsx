import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { UsersManager } from "./users-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe e acessos" };

export default async function UsuariosPage() {
  const me = await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("role").order("nome");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Equipe e acessos" subtitle="Crie logins para gerente, nutricionistas, estagiárias e proprietários." back="/dashboard" />
      <UsersManager users={(data ?? []) as Profile[]} meId={me.id} />
    </div>
  );
}
