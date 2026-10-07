import { NovoControleForm } from "@/components/nutri/novo-controle-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getUnits } from "@/lib/data/units";
import { todaySP } from "@/lib/dates";
import { CONTROLE_TIPOS } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo controle" };

export default async function NovoControlePage({ searchParams }: { searchParams: Promise<{ tipo?: string; loja?: string }> }) {
  await requireProfile(["auditor_nutricao"]);
  const { tipo, loja } = await searchParams;
  const supabase = await createClient();
  const units = await getUnits(supabase);
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Novo controle" subtitle="Escolha a planilha, a unidade e a data. O preenchimento fica em rascunho até você finalizar." back="/nutri/controles" />
      <NovoControleForm tipos={CONTROLE_TIPOS.map((t) => ({ codigo: t.codigo, nome: t.nome, descricao: t.descricao }))} units={units.map((u) => ({ id: u.id, nome: u.nome }))} today={todaySP()} initialTipo={tipo} initialUnit={loja} />
    </div>
  );
}
