import Link from "next/link";
import { notFound } from "next/navigation";
import { ClassBadge, NotaNutri } from "@/components/nutri/nutri-badges";
import { PhotoGallery } from "@/components/nutri/photo-gallery";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getNutriFillData } from "@/lib/data/nutri";
import { formatDatePT, formatDateTimePT } from "@/lib/dates";
import { computeNutriScore } from "@/lib/domain/nutri";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NutriResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const fill = await getNutriFillData(supabase, id);
  if (!fill) notFound();
  const { audit, unit, areas, answers, pendings, auditorNome } = fill;
  const draft = audit.status === "rascunho";
  const score = computeNutriScore(answers.map((a) => ({ entry_id: a.id, area: a.area, peso: a.peso, resposta: a.resposta })));
  const nota = draft ? score.nota : audit.nota_final;
  const classificacao = draft ? score.classificacao : audit.classificacao;

  // URLs assinadas das fotos (bucket privado)
  const paths = answers.flatMap((a) => a.photos.map((p) => p.path));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("audit-photos").createSignedUrls(paths, 60 * 60);
    for (const d of data ?? []) if (d.path && d.signedUrl) urlByPath.set(d.path, d.signedUrl);
  }

  const ncPorArea = areas.map((a) => ({ area: a.area, itens: a.answers.filter((x) => x.resposta === "nao_conforme") })).filter((g) => g.itens.length > 0);
  const resolvidas = pendings.filter((p) => p.resolvida === true);
  const mantidas = pendings.filter((p) => p.resolvida === false);
  const backHref = profile.role === "proprietario" ? `/dashboard/lojas/${unit.id}` : "/nutri";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Resumo da auditoria" subtitle="Auditoria Nutricional" back={backHref} />

      <Card className="text-center">
        <div className="flex flex-col items-center gap-2">
          {draft && <Badge tone="brand">rascunho · prévia</Badge>}
          <NotaNutri nota={nota} classificacao={classificacao} size="lg" className="px-6 py-3 text-5xl" />
          <ClassBadge classificacao={classificacao} className="text-sm" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-gray-500">Unidade</div>
            <div className="font-semibold">{unit.nome}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Data</div>
            <div className="font-semibold">{formatDatePT(audit.data)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Auditora</div>
            <div className="font-semibold">{auditorNome}</div>
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-2 text-xs">
          <Badge tone="green">{score.conformes} conforme</Badge>
          <Badge tone="red">{score.nao_conformes} não conforme</Badge>
          <Badge tone="gray">{score.na} N/A</Badge>
        </div>
        {audit.concluida_em && <p className="mt-2 text-xs text-gray-400">concluída em {formatDateTimePT(audit.concluida_em)}</p>}
        {draft && profile.id === audit.auditor_id && (
          <div className="mt-4">
            <ButtonLink href={`/nutri/auditorias/${id}`} full>
              Continuar preenchendo
            </ButtonLink>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Pontos perdidos por grupo</CardTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="pb-1 font-medium">Área</th>
              <th className="pb-1 text-right font-medium">perdidos / aplicáveis</th>
              <th className="pb-1 text-right font-medium">% da área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {score.perdidos_por_area.map((p) => (
              <tr key={p.area} className={p.perdidos > 0 ? "font-medium text-red-800" : ""}>
                <td className="py-1.5 pr-2">{p.area}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {p.perdidos}/{p.aplicaveis}
                </td>
                <td className="py-1.5 text-right tabular-nums">{fmtPct(p.nota)}</td>
              </tr>
            ))}
            {score.perdidos_por_area.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-center text-gray-500">
                  Sem itens respondidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardTitle>Apontamentos</CardTitle>
        {ncPorArea.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma não conformidade encontrada.</p>
        ) : (
          <div className="space-y-4">
            {ncPorArea.map((g) => (
              <div key={g.area}>
                <h3 className="mb-1.5 text-sm font-semibold text-gray-700">{g.area}</h3>
                <ul className="space-y-3">
                  {g.itens.map((i) => (
                    <li key={i.id} className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                      <p className="text-sm font-medium">{i.descricao}</p>
                      {i.observacao && <p className="mt-1 text-sm text-gray-700">{i.observacao}</p>}
                      {i.photos.length > 0 && (
                        <div className="mt-2">
                          <PhotoGallery size="sm" photos={i.photos.map((p) => ({ id: p.id, url: urlByPath.get(p.path) ?? "" })).filter((p) => p.url)} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {pendings.length > 0 && (
        <Card>
          <CardTitle>
            Apontamentos da visita anterior{" "}
            <span className="text-sm font-normal text-gray-500">
              · {resolvidas.length} resolvido(s) × {mantidas.length} mantido(s)
            </span>
          </CardTitle>
          <ul className="space-y-2 text-sm">
            {pendings.map((p) => (
              <li key={p.pending_issue_id} className="flex items-start gap-2">
                <Badge tone={p.resolvida === true ? "green" : p.resolvida === false ? "red" : "gray"} className="mt-0.5 shrink-0">
                  {p.resolvida === true ? "resolvido" : p.resolvida === false ? "mantido" : "não avaliado"}
                </Badge>
                <span>
                  {p.descricao}
                  {p.origem_data && <span className="text-xs text-gray-500"> · apontado em {formatDatePT(p.origem_data)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-xs text-gray-500">
        <Link href={backHref} className="underline">
          Voltar
        </Link>
      </p>
    </div>
  );
}
