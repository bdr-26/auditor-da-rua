import { notFound } from "next/navigation";
import { ControleForm } from "@/components/nutri/controle-form";
import { ShareReport } from "@/components/reports/share-report";
import { PageHeader } from "@/components/ui/page-header";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { getCatalogosParaForm } from "@/lib/data/nutri-catalogo";
import { getControle } from "@/lib/data/nutri-controles";
import { getUnit } from "@/lib/data/units";
import { formatDatePT } from "@/lib/dates";
import { fotosDoRegistro, getControleTipo, parseDados } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Controle" };

export default async function ControlePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const { id } = await params;
  const supabase = await createClient();
  const c = await getControle(supabase, id);
  if (!c) notFound();
  const tipo = getControleTipo(c.tipo);
  if (!tipo) notFound();
  const [unit, { data: resp }, catalogos] = await Promise.all([getUnit(supabase, c.unit_id), supabase.from("profiles").select("nome").eq("id", c.responsavel_id).maybeSingle(), getCatalogosParaForm(supabase)]);
  const dados = parseDados(c.dados, tipo);
  const fotoUrls: Record<string, string> = {};
  const paths = fotosDoRegistro(tipo, dados);
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("audit-photos").createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) fotoUrls[s.path] = s.signedUrl;
  }
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  const canEdit = chefe || (c.responsavel_id === profile.id && c.status === "rascunho");
  const unitName = unit?.nome ?? "Unidade";
  const slug = unit?.slug ?? "unidade";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={tipo.nome} subtitle={`${unitName} · ${formatDatePT(c.data)} · ${(resp?.nome as string | undefined) ?? "—"}`} back="/nutri/controles" />
      {c.status === "finalizado" && (
        <ShareReport
          compact
          pdfUrl={`/api/nutri/controles/${c.id}/pdf`}
          fileName={`controle-${tipo.codigo}-${slug}-${c.data}.pdf`}
          title={`${tipo.nome} · ${unitName} · ${formatDatePT(c.data)}`}
          text={`${tipo.nome} de ${unitName} em ${formatDatePT(c.data)}.`}
        />
      )}
      <ControleForm controle={c} tipoCodigo={tipo.codigo} inicial={dados} unitName={unitName} canEdit={canEdit} isChefe={chefe} catalogos={catalogos} fotoUrls={fotoUrls} />
    </div>
  );
}
