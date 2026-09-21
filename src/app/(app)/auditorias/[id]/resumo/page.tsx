import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Check, ChevronRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge, ProgressBar, ScoreBar } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_LABELS, GRAVE_FAILURE_CAP, SCORE_COLORS, SCORE_LABELS } from "@/lib/constants";
import { getAuditFillData, toScoringAnswers } from "@/lib/data/audit-flow";
import { signedPhotoUrl } from "@/lib/data/audits";
import { formatDateTimePT, formatDayLabelPT } from "@/lib/dates";
import { computeAuditScore, pctTone } from "@/lib/domain/scoring";
import { createClient } from "@/lib/supabase/server";
import type { BlockScore, Score } from "@/lib/types";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resumo da auditoria" };

const CLASSIFICACAO: Record<ReturnType<typeof pctTone>, { label: string; cls: string }> = {
  green: { label: "Dentro do padrão", cls: "text-green-700" },
  yellow: { label: "Atenção", cls: "text-yellow-700" },
  orange: { label: "Não conforme", cls: "text-orange-700" },
  red: { label: "Crítico", cls: "text-red-700" },
  gray: { label: "Sem nota", cls: "text-gray-500" },
};

export default async function ResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: head } = await supabase.from("audits").select("id, tipo").eq("id", id).maybeSingle();
  if (!head) notFound();
  if (head.tipo === "nutricional") redirect(`/nutri/auditorias/${id}/resumo`);

  const data = await getAuditFillData(supabase, id);
  if (!data) notFound();
  const { audit, unit, blocks, answers, pendings, auditorNome } = data;
  const isDraft = audit.status === "rascunho";
  const mine = audit.auditor_id === profile.id;
  const backHref = profile.role === "proprietario" ? `/dashboard/lojas/${unit.id}` : profile.role === "auditor_geral" ? "/auditor/historico" : "/";

  const result = computeAuditScore(audit.tipo, blocks, toScoringAnswers(answers));
  const notaFinal = isDraft ? null : (audit.nota_final ?? result.nota_final);
  const notasBlocos: BlockScore[] = (!isDraft && audit.notas_blocos ? audit.notas_blocos : result.notas_blocos).map((b) => ({ ...b, nota: b.nota == null ? null : Number(b.nota), peso: Number(b.peso) }));
  const bars = audit.tipo === "completa" ? notasBlocos.filter((b) => b.peso > 0) : notasBlocos;
  const falhaGrave = isDraft ? result.falha_grave : audit.falha_grave;
  const produtoVencido = isDraft ? result.produto_vencido : audit.produto_vencido;
  const tone = pctTone(notaFinal);

  // itens com nota ≤ 3, com fotos assinadas
  const itemsById = new Map(blocks.flatMap((b) => b.items.map((i) => [i.id, { item: i, bloco: b.nome }])));
  const low = answers
    .filter((a) => !a.na && a.nota != null && a.nota <= 3 && itemsById.has(a.item_id))
    .sort((a, b) => (a.nota ?? 0) - (b.nota ?? 0));
  const lowWithPhotos = await Promise.all(
    low.map(async (a) => ({
      ...a,
      photoUrls: (await Promise.all(a.photos.map((p) => signedPhotoUrl(supabase, p.path)))).filter((u): u is string => !!u),
    })),
  );

  const resolvidas = pendings.filter((p) => p.resolvida === true);
  const mantidas = pendings.filter((p) => p.resolvida === false);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={unit.nome}
        subtitle={
          <>
            {AUDIT_TYPE_LABELS[audit.tipo]} · <span className="capitalize">{formatDayLabelPT(audit.data)}</span> · {auditorNome}
          </>
        }
        back={backHref}
        actions={isDraft && mine ? <ButtonLink href={`/auditorias/${id}`} size="sm">Continuar</ButtonLink> : undefined}
      />

      {isDraft ? (
        <Card className="border-yellow-300">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Badge tone="yellow">rascunho em andamento</Badge>
              <p className="mt-2 font-medium">
                {result.respondidos}/{result.total} itens respondidos
              </p>
              <p className="text-xs text-gray-500">A nota só é calculada quando o auditor conclui a auditoria.</p>
            </div>
          </div>
          <ProgressBar value={result.respondidos} max={result.total} className="mt-3" />
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nota final</p>
              <p className={cn("mt-0.5 text-lg font-bold", CLASSIFICACAO[tone].cls)}>{CLASSIFICACAO[tone].label}</p>
              <p className="text-xs text-gray-500">Concluída em {audit.concluida_em ? formatDateTimePT(audit.concluida_em) : "—"}</p>
            </div>
            <PctBadge value={notaFinal} size="lg" className="px-4 py-2 text-3xl" />
          </div>
          {falhaGrave && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Falha grave — nota limitada a {GRAVE_FAILURE_CAP}%
                {produtoVencido && (
                  <span className="ml-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs">produto vencido em uso · inelegível à premiação</span>
                )}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* blocos */}
      <Card>
        <CardTitle>{audit.tipo === "completa" ? "Blocos (20% cada)" : "Por área"}</CardTitle>
        <div className="space-y-3">
          {bars.map((b) => (
            <ScoreBar key={b.chave} label={b.nome} value={isDraft ? null : b.nota} zerado={!isDraft && b.zerado} hint={`${b.itens_aplicaveis} item(ns)`} />
          ))}
        </div>
      </Card>

      {/* itens ≤ 3 */}
      <Card>
        <CardTitle>Pontos de atenção {lowWithPhotos.length > 0 && <span className="text-gray-400">({lowWithPhotos.length})</span>}</CardTitle>
        {lowWithPhotos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item com nota 3 ou menor{isDraft ? " até agora" : ""}.</p>
        ) : (
          <div className="divide-y divide-line">
            {lowWithPhotos.map((a) => {
              const meta = itemsById.get(a.item_id)!;
              const s = a.nota as Score;
              const c = SCORE_COLORS[s];
              return (
                <div key={a.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg font-bold", c.bg, c.text)}>
                    <span className="text-lg leading-none">{s}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{meta.item.descricao}</p>
                    <p className="text-xs text-gray-500">
                      {meta.bloco} · {SCORE_LABELS[s]}
                      {meta.item.falha_grave && s === 1 && <span className="ml-1 font-semibold text-red-700">· falha grave</span>}
                      {meta.item.produto_vencido && a.produto_vencido && <span className="ml-1 font-semibold text-red-700">· produto vencido</span>}
                    </p>
                    {a.observacao && <p className="mt-1.5 rounded-lg bg-surface-muted px-3 py-2 text-sm text-gray-700">{a.observacao}</p>}
                    {a.photoUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.photoUrls.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt={`Foto ${i + 1} — ${meta.item.descricao}`} className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* pendências avaliadas */}
      <Card>
        <CardTitle>
          Pendências avaliadas{" "}
          {pendings.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              · {resolvidas.length} resolvida(s) × {mantidas.length} mantida(s)
            </span>
          )}
        </CardTitle>
        {pendings.length === 0 ? (
          <p className="text-sm text-gray-500">Não havia pendências da visita anterior.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pendings.map((p) => (
              <li key={p.pending_issue_id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                {p.resolvida === true ? (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                ) : p.resolvida === false ? (
                  <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                ) : (
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-gray-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.descricao}</p>
                  <p className="text-xs text-gray-500">
                    {p.resolvida === true ? "resolvida" : p.resolvida === false ? "mantida" : "não avaliada"}
                    {p.reincidente && <span className="ml-1 font-semibold text-red-700">· reincidente</span>}
                    {p.observacao && ` · ${p.observacao}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!isDraft && result.falha_grave && result.nota_sem_teto != null && result.nota_sem_teto > GRAVE_FAILURE_CAP && (
        <p className="text-center text-xs text-gray-500">Nota sem o teto de falha grave: {fmtPct(result.nota_sem_teto)}</p>
      )}

      {profile.role === "proprietario" && (
        <Link href={`/dashboard/lojas/${unit.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium hover:bg-surface-muted">
          Ver página de {unit.nome} <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      )}
    </div>
  );
}
