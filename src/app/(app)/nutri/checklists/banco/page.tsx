import { BankManager } from "@/components/nutri/bank-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getNutriBank } from "@/lib/data/nutri";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BancoPage() {
  await requireProfile(["auditor_nutricao", "proprietario"]);
  const supabase = await createClient();
  const items = await getNutriBank(supabase);
  const areas = Array.from(new Set(items.map((i) => i.area_padrao))).sort((a, b) => a.localeCompare(b));
  return (
    <div className="space-y-4">
      <PageHeader title="Banco de itens" subtitle={`${items.filter((i) => i.ativo).length} ativos · ${items.filter((i) => !i.ativo).length} desativados`} back="/nutri/checklists" />
      <BankManager items={items} areas={areas} />
    </div>
  );
}
