import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  return (
    <div>
      <PageHeader title="Configurações" subtitle="Parâmetros da rotação, da nota mensal e da premiação." />
      <SettingsForm initial={settings} />
    </div>
  );
}
