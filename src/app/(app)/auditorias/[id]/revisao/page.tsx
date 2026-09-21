import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Camera, ChevronRight, HelpCircle, MessageSquare } from "lucide-react";
import { ReviewActions } from "@/components/audit/review-actions";
import { buildSteps, stepForItem } from "@/components/audit/steps";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge, ScoreBar } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT, GRAVE_FAILURE_CAP } from "@/lib/constants";
import { getAuditFillData, toScoringAnswers } from "@/lib/data/audit-flow";
import { formatDatePT } from "@/lib/dates";
import { computeAuditScore, concludeBlockers, type ScoringItem } from "@/lib/domain/scoring";
import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisão" };

export default async function RevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["auditor_geral"]);
  const { id } = await params;
  const supabase = await createClient();
  const data = await getAuditFillData(supabase, id);
  if (!data) notFound();
  if (data.audit.status === "concluida" || data.audit.auditor_id !== profile.id) redirect(`/auditorias/${id}/resumo`);

  const { audit, unit, blocks, answers, pendings } = data;
  const result = computeAuditScore(audit.tipo, blocks, toScoringAnswers(answers));
  const steps = buildSteps(audit.tipo, blocks);
  const itemsById = new Map(blocks.flatMap((b) => b.items).map((i) => [i.id, i]));
  const pendNotReviewed = pendings.filter((p) => p.resolvida == null);

  const blockers = concludeBlockers(result);
  if (pendNotReviewed.length > 0) blockers.push(`${pendNotReviewed.length} pendência(s) da visita anterior sem avaliação`);
  if (blockers.length === 0 && result.nota_final == null) blockers.push("Nenhum item aplicável foi avaliado");

  const groupByStep = (ids: string[]) => {
    const g = new Map<number, ScoringItem[]>();
    for (const itemId of ids) {
      const item = itemsById.get(itemId);
      if (!item) continue;
      const s = stepForItem(steps, itemId);
      g.set(s, [...(g.get(s) ?? []), item]);
    }
    return Array.from(g.entries()).sort((a, b) => a[0] - b[0]);
  };

  const sections: { titulo: string; icon: React.ReactNode; groups: [number, ScoringItem[]][] }[] = [
    { titulo: "Itens sem resposta", icon: <HelpCircle className="h-4 w-4" />, groups: groupByStep(result.faltando) },
    { titulo: "Nota 1–2 sem foto", icon: <Camera className="h-4 w-4" />, groups: groupByStep(result.sem_foto) },
    { titulo: "Nota 1–2 sem observação", icon: <MessageSquare className="h-4 w-4" />, groups: groupByStep(result.sem_observacao) },
  ].filter((s) => s.groups.length > 0);

  const barBlocks = audit.tipo === "completa" ? result.notas_blocos.filter((b) => b.peso > 0) : result.notas_blocos;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Revisão" subtitle={`${AUDIT_TYPE_SHORT[audit.tipo]} · ${unit.nome} · ${formatDatePT(audit.data)}`} back={`/auditorias/${id}?etapa=${steps.length - 1}`} />

      {/* prévia da nota */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="mb-0">Nota prevista</CardTitle>
            <p className="text-xs text-gray-500">
              {result.respondidos}/{result.total} itens respondidos
              {result.falha_grave && result.nota_sem_teto != null && result.nota_sem_teto > GRAVE_FAILURE_CAP && ` · nota sem teto: ${fmtPct(result.nota_sem_teto)}`}
            </p>
          </div>
          <PctBadge value={result.nota_final} size="lg" />
        </div>
        {result.falha_grave && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Falha grave — nota limitada a {GRAVE_FAILURE_CAP}%
          </div>
        )}
        {result.produto_vencido && <p className="mt-2 text-xs font-medium text-red-700">Produto vencido em uso: loja inelegível à premiação do mês.</p>}
        <div className="mt-4 space-y-3">
          {barBlocks.map((b) => (
            <ScoreBar key={b.chave} label={b.nome} value={b.nota} zerado={b.zerado} hint={`${b.itens_aplicaveis} item(ns)`} />
          ))}
        </div>
      </Card>

      {/* pendências avaliadas */}
      {pendings.length > 0 && (
        <Card>
          <CardTitle>Pendências da visita anterior</CardTitle>
          <p className="text-sm text-gray-600">
            {pendings.filter((p) => p.resolvida === true).length} resolvida(s) · {pendings.filter((p) => p.resolvida === false).length} mantida(s)
            {pendNotReviewed.length > 0 && <span className="font-semibold text-red-700"> · {pendNotReviewed.length} sem avaliação</span>}
          </p>
          {pendNotReviewed.length > 0 && (
            <Link href={`/auditorias/${id}?etapa=0`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
              Avaliar pendências <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </Card>
      )}

      {/* o que falta */}
      {sections.length === 0 ? (
        <Card className="border-green-200 bg-green-50/50">
          <p className="font-medium text-green-800">Tudo preenchido. Pode concluir.</p>
        </Card>
      ) : (
        sections.map((s) => (
          <Card key={s.titulo}>
            <CardTitle className="flex items-center gap-2 text-red-800">
              {s.icon} {s.titulo}
            </CardTitle>
            <div className="space-y-3">
              {s.groups.map(([stepIdx, items]) => (
                <div key={stepIdx}>
                  <Link href={`/auditorias/${id}?etapa=${stepIdx}`} className="mb-1 flex items-center justify-between text-sm font-semibold text-brand-dark">
                    {steps[stepIdx]?.titulo ?? "Etapa"} <ChevronRight className="h-4 w-4" />
                  </Link>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                    {items.map((i) => (
                      <li key={i.id}>{i.descricao}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <ReviewActions auditId={id} blockers={blockers} />
    </div>
  );
}
