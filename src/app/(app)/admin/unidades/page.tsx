import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { createClient } from "@/lib/supabase/server";
import { UnitsManager } from "./units-manager";

export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  await requireProfile(["proprietario"]);
  const supabase = await createClient();
  const units = await getUnits(supabase, { ativas: false });
  return (
    <div>
      <PageHeader title="Unidades" subtitle="Lojas ranqueadas entram na rotação qua–dom; a cozinha central é auditada às terças." />
      <UnitsManager units={units} />
    </div>
  );
}
