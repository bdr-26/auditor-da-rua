import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { PhotoGallery } from "@/components/nutri/photo-gallery";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ShareReport } from "@/components/reports/share-report";
import { PctBadge, ProgressBar, ScoreBar } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_LABELS, GRAVE_FAILURE_CAP, SCORE_COLORS, SCORE_LABELS } from "@/lib/constants";
import { getAuditFillData, toScoringAnswers } from "@/lib/data/audit-flow";
import { signedPhotoUrl } from "@/lib/data/audits";
import { formatDatePT, formatDateTimePT, formatDayLabelPT } from "@/lib/dates";
import { computeAuditScore, pctTone } from "@/lib/domain/scoring";
import { createClient } from "@/lib/supabase/server";
import type { BlockScore, Score } from "@/lib/types";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resumo da auditoria" };

const CLASSIFICACAO: Record<ReturnType<typeof pctTone>, { label: string; tone: "green" | "yellow" | "orange" | "red" | "gray" }> = {
  green: { label: "Dentro do padrão", tone: "green" },
  yellow: { label: "Atenção", tone: "yellow" },
  orange: { label: "Não conforme", tone: "orange" },
  red: { label: "Crítico", tone: "red" },
  gray: { label: "Sem nota", tone: "gray" },
};

/** Fundo/borda do cartão de um ponto de atenção conforme a nota. */
const LOW_CARD: Record<number, string> = { 1: "border-red-200 bg-red-50/70", 2: "border-orange-200 bg-orange-50/70", 3: "border-yellow-200 bg-yellow-50/70" };

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

  // distribuição das notas dadas (itens aplicáveis) e N/A
  const scored = answers.filter((a) => !a.na && a.nota != null && itemsById.has(a.item_id));
  const dist: Record<Score, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const a of scored) dist[a.nota as Score]++;
  const naCount = answers.filter((a) => a.na && itemsById.has(a.item_id)).length;
  const tipoLabel = AUDIT_TYPE_LABELS[audit.tipo];
  const surpresa = audit.tipo !== "nutricional" && profile.role === "proprietario" && mine;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Resumo da auditoria" subtitle={tipoLabel} back={backHref} />

      {/* nota */}
      <Card className="text-center">
        <div className="flex flex-col items-center gap-2">
          {isDraft ? (
            <Badge tone="yellow">rascunho · prévia</Badge>
          ) : (
            <Badge tone="dark">{surpresa ? "auditoria surpresa" : "concluída"}</Badge>
          )}
          <PctBadge value={isDraft ? null : notaFinal} size="lg" className="rounded-xl px-6 py-3 text-5xl" />
          {!isDraft && <Badge tone={CLASSIFICACAO[tone].tone} className="text-sm">{CLASSIFICACAO[tone].label}</Badge>}
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
            <div className="text-xs text-gray-500">Auditor</div>
            <div className="font-semibold leading-tight">{auditorNome}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-xs">
          {([5, 4, 3, 2, 1] as Score[]).map((sc) => (
            <span key={sc} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", SCORE_COLORS[sc].bg, SCORE_COLORS[sc].text)}>
              <span>{sc}</span>
              <span className="font-normal opacity-80">× {dist[sc]}</span>
            </span>
          ))}
          {naCount > 0 && <Badge tone="gray">{naCount} N/A</Badge>}
        </div>
        {isDraft ? (
          <div className="mt-4">
            <p className="text-sm font-medium">
              {result.respondidos}/{result.total} itens respondidos
            </p>
            <ProgressBar value={result.respondidos} max={result.total} className="mt-2" />
            <p className="mt-2 text-xs text-gray-500">A nota só é calculada quando a auditoria é concluída.</p>
            {mine && (
              <div className="mt-4">
                <ButtonLink href={`/auditorias/${id}`} full>
                  Continuar preenchendo
                </ButtonLink>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-400">concluída em {audit.concluida_em ? formatDateTimePT(audit.concluida_em) : "—"}</p>
        )}
        {!isDraft && falhaGrave && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-left text-sm font-medium text-white">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Falha grave: nota limitada a {GRAVE_FAILURE_CAP}%
              {result.nota_sem_teto != null && result.nota_sem_teto > GRAVE_FAILURE_CAP && <span className="opacity-80"> (seria {fmtPct(result.nota_sem_teto)})</span>}
              {produtoVencido && <span className="mt-1 block rounded-full bg-white/20 px-2 py-0.5 text-xs">produto vencido em uso · loja inelegível à premiação</span>}
            </span>
          </div>
        )}
      </Card>

      {!isDraft && (
        <ShareReport
          pdfUrl={`/api/auditorias/${audit.id}/relatorio`}
          fileName={`auditoria-${audit.tipo}-${unit.nome.toLowerCase().replace(/\s+/g, "-")}-${audit.data}.pdf`}
          title={`${tipoLabel} · ${unit.nome} · ${formatDayLabelPT(audit.data)}`}
          text={`Relatório da ${tipoLabel.toLowerCase()} de ${unit.nome} em ${formatDayLabelPT(audit.data)}: nota ${notaFinal != null ? Math.round(notaFinal) : "—"}%${falhaGrave ? " (falha grave)" : ""}.`}
        />
      )}

      <Card>
        <CardTitle>{audit.tipo === "completa" ? "Nota por bloco" : "Nota por área"}</CardTitle>
        <div className="space-y-3">
          {bars.map((b) => (
            <ScoreBar key={b.chave} label={b.nome} value={isDraft ? null : b.nota} zerado={!isDraft && b.zerado} hint={`${b.itens_aplicaveis} ${b.itens_aplicaveis === 1 ? "item" : "itens"}`} />
          ))}
        </div>
        {audit.tipo === "completa" && <p className="mt-3 text-xs text-gray-500">Cada bloco vale 20% da nota final.</p>}
      </Card>

      <Card>
        <CardTitle>
          Pontos de atenção {lowWithPhotos.length > 0 && <span className="text-sm font-normal text-gray-500">· {lowWithPhotos.length} {lowWithPhotos.length === 1 ? "item" : "itens"} com nota 3 ou menor</span>}
        </CardTitle>
        {lowWithPhotos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item com nota 3 ou menor{isDraft ? " até agora" : ""}.</p>
        ) : (
          <ul className="space-y-3">
            {lowWithPhotos.map((a) => {
              const meta = itemsById.get(a.item_id)!;
              const sc = a.nota as Score;
              const c = SCORE_COLORS[sc];
              return (
                <li key={a.id} className={cn("rounded-xl border p-3", LOW_CARD[sc])}>
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold", c.solid, "text-white")}>{sc}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{meta.item.descricao}</p>
                      <p className="mt-0.5 text-xs text-gray-600">
                        {meta.bloco} · {SCORE_LABELS[sc]}
                        {meta.item.falha_grave && sc === 1 && <span className="ml-1 font-semibold text-red-700">· falha grave</span>}
                        {meta.item.produto_vencido && a.produto_vencido && <span className="ml-1 font-semibold text-red-700">· produto vencido</span>}
                      </p>
                    </div>
                  </div>
                  {a.observacao && <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700">{a.observacao}</p>}
                  {a.photoUrls.length > 0 && (
                    <div className="mt-2">
                      <PhotoGallery size="sm" photos={a.photoUrls.map((url, i) => ({ id: `${a.id}-${i}`, url }))} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {pendings.length > 0 && (
        <Card>
          <CardTitle>
            Pendências da visita anterior{" "}
            <span className="text-sm font-normal text-gray-500">
              · {resolvidas.length} resolvida{resolvidas.length === 1 ? "" : "s"} × {mantidas.length} mantida{mantidas.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
          <ul className="space-y-2 text-sm">
            {pendings.map((p) => (
              <li key={p.pending_issue_id} className="flex items-start gap-2">
                <Badge tone={p.resolvida === true ? "green" : p.resolvida === false ? "red" : "gray"} className="mt-0.5 shrink-0">
                  {p.resolvida === true ? "resolvida" : p.resolvida === false ? "mantida" : "não avaliada"}
                </Badge>
                <span>
                  {p.descricao}
                  {p.reincidente && <span className="ml-1 text-xs font-semibold text-red-700">· reincidente</span>}
                  {p.observacao && <span className="block text-xs text-gray-500">{p.observacao}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {profile.role === "proprietario" ? (
        <Link href={`/dashboard/lojas/${unit.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium hover:bg-surface-muted">
          Ver página de {unit.nome} <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      ) : (
        <p className="text-center text-xs text-gray-500">
          <Link href={backHref} className="underline">
            Voltar
          </Link>
        </p>
      )}
    </div>
  );
}
