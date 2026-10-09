import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogoNovo, CatalogoRow } from "@/components/nutri/catalogo-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getCatalogo } from "@/lib/data/nutri-catalogo";
import { CATALOGO_LABELS, type CatalogoCategoria } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogos da nutrição" };

const CATEGORIAS = Object.keys(CATALOGO_LABELS) as CatalogoCategoria[];

/** Chefe: listas para escolher nos controles (fornecedores com CNPJ, produtos, marcas, preparações, hortifrútis). */
export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  if (profile.role === "auditor_nutricao" && !isNutriChefe(profile)) redirect("/nutri");
  const { cat } = await searchParams;
  const categoria: CatalogoCategoria = CATEGORIAS.includes(cat as CatalogoCategoria) ? (cat as CatalogoCategoria) : "fornecedor";
  const supabase = await createClient();
  const todos = await getCatalogo(supabase, { ativos: false });
  const lista = todos.filter((i) => i.categoria === categoria);
  const meta = CATALOGO_LABELS[categoria];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Catálogos" subtitle="Listas para escolher nos controles, sem digitar: fornecedores, produtos, marcas, preparações e hortifrútis." back="/nutri" actions={<CatalogoNovo categoria={categoria} />} />

      <div className="flex flex-wrap gap-1.5 text-xs">
        {CATEGORIAS.map((c) => (
          <Link key={c} href={`/nutri/catalogo?cat=${c}`} className={cn("rounded-full px-3 py-1.5 font-medium", categoria === c ? "bg-ink text-white" : "border border-line bg-white")}>
            {CATALOGO_LABELS[c].nome} <span className="opacity-60">({todos.filter((i) => i.categoria === c && i.ativo).length})</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-gray-500">{meta.ajuda}</p>

      {lista.length === 0 ? <EmptyState title={`Nenhum item em ${meta.nome.toLowerCase()}`} description="Use “Cadastrar”. Nos controles a pessoa ainda pode escolher “Outro…” e digitar." /> : <div className="space-y-2">{lista.map((i) => <CatalogoRow key={i.id} item={i} />)}</div>}
    </div>
  );
}
