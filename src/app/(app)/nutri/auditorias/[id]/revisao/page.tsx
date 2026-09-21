import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ClassBadge, NotaNutri } from "@/components/nutri/nutri-badges";
import { ReviewActions } from "@/components/nutri/review-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { getNutriFillData } from "@/lib/data/nutri";
import { formatDatePT } from "@/lib/dates";
import { computeNutriScore } from "@/lib/domain/nutri";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NutriRevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(["auditor_nutricao"]);
  const supabase = await createClient();
  const fill = await getNutriFillData(supabase, id);
  if (!fill) notFound();
  const { audit, unit, areas, answers, pendings } = fill;
  if (audit.status === "concluida" || audit.auditor_id !== profile.id) redirect(`/nutri/auditorias/${id}/resumo`);

  const score = computeNutriScore(answers.map((a) => ({ entry_id: a.id, area: a.area, peso: a.peso, resposta: a.resposta })));
  const stepOffset = pendings.length > 0 ? 1 : 0;
  const stepOf = new Map(areas.map((a, i) => [a.area, i + stepOffset]));
  const semResposta = areas.map((a) => ({ area: a.area, step: stepOf.get(a.area)!, itens: a.answers.filter((x) => x.resposta == null) })).filter((g) => g.itens.length > 0);
  const semApontamento = answers.filter((a) => a.resposta === "nao_conforme" && !(a.observacao ?? "").trim());
  const pendNaoAvaliadas = pendings.filter((p) => p.resolvida == null);

  const blockers: string[] = [];
  if (score.faltando.length > 0) blockers.push(`${score.faltando.length} item(ns) sem resposta`);
  if (semApontamento.length > 0) blockers.push(`${semApontamento.length} não conforme(s) sem apontamento`);
  if (pendNaoAvaliadas.length > 0) blockers.push(`${pendNaoAvaliadas.length} apontamento(s) da visita anterior sem avaliação`);
  if (score.faltando.length === 0 && score.nota == null) blockers.push("nenhum item aplicável (todos N/A)");

  const link = (step: number, item?: string) => `/nutri/auditorias/${id}?etapa=${step}${item ? `&item=${item}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Revisão" subtitle={`${unit.nome} · ${formatDatePT(audit.data)}`} back={`/nutri/auditorias/${id}`} />

      {pendNaoAvaliadas.length > 0 && (
        <Card className="border-orange-200">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="h-4 w-4" /> Apontamentos anteriores sem avaliação
          </CardTitle>
          <ul className="space-y-1 text-sm">
            {pendNaoAvaliadas.map((p) => (
              <li key={p.pending_issue_id}>
                <Link href={link(0)} className="underline">
                  {p.descricao}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {semResposta.length > 0 && (
        <Card className="border-orange-200">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="h-4 w-4" /> Itens sem resposta
          </CardTitle>
          <div className="space-y-3">
            {semResposta.map((g) => (
              <div key={g.area}>
                <Link href={link(g.step)} className="text-sm font-semibold underline">
                  {g.area} ({g.itens.length})
                </Link>
                <ul className="mt-1 space-y-1 text-sm text-gray-700">
                  {g.itens.map((i) => (
                    <li key={i.id}>
                      <Link href={link(g.step, i.id)} className="hover:underline">
                        {i.descricao}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {semApontamento.length > 0 && (
        <Card className="border-red-200">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" /> Não conformes sem apontamento
          </CardTitle>
          <ul className="space-y-1 text-sm">
            {semApontamento.map((i) => (
              <li key={i.id}>
                <Link href={link(stepOf.get(i.area) ?? 0, i.id)} className="hover:underline">
                  <span className="text-gray-500">{i.area} · </span>
                  {i.descricao}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>Prévia da nota</CardTitle>
        <div className="flex items-center gap-4">
          <NotaNutri nota={score.nota} classificacao={score.classificacao} size="lg" />
          <div>
            <ClassBadge classificacao={score.classificacao} />
            <p className="mt-1 text-xs text-gray-500">
              {score.conformes} conforme · {score.nao_conformes} não conforme · {score.na} N/A
              {score.faltando.length > 0 && ` · ${score.faltando.length} pendente(s)`}
            </p>
          </div>
        </div>
        {score.perdidos_por_area.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1 font-medium">Pontos perdidos por área</th>
                <th className="pb-1 text-right font-medium">perdidos</th>
                <th className="pb-1 text-right font-medium">% área</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {score.perdidos_por_area.map((p) => (
                <tr key={p.area} className={p.perdidos > 0 ? "text-red-800" : ""}>
                  <td className="py-1.5 pr-2">{p.area}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {p.perdidos}/{p.aplicaveis}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPct(p.nota)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ReviewActions auditId={id} blockers={blockers} />
    </div>
  );
}
