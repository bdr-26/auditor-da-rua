import Link from "next/link";
import { ClipboardCheck, ExternalLink, Leaf } from "lucide-react";
import { ClassBadge } from "@/components/nutri/nutri-badges";
import { ShareReport } from "@/components/reports/share-report";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PctBadge } from "@/components/ui/score";
import { requireProfile } from "@/lib/auth";
import { AUDIT_TYPE_SHORT } from "@/lib/constants";
import { getMonthAudits } from "@/lib/data/audits";
import { getUnits } from "@/lib/data/units";
import { addMonths, formatDatePT, formatMonthPT, formatWeekdayPT, monthStart, todaySP } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Audit, Unit } from "@/lib/types";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditorias" };

/** Proprietário: todas as auditorias do mês em dois blocos (gerente e nutrição), com filtro por loja, abrir e compartilhar/imprimir. */
export default async function AuditoriasPage({ searchParams }: { searchParams: Promise<{ mes?: string; loja?: string }> }) {
  await requireProfile(["proprietario"]);
  const { mes: mesParam, loja } = await searchParams;
  const today = todaySP();
  const mes = /^\d{4}-\d{2}(-\d{2})?$/.test(mesParam ?? "") ? monthStart(mesParam!.length === 7 ? `${mesParam}-01` : mesParam!) : monthStart(today);
  const supabase = await createClient();
  const [units, audits, profilesRes] = await Promise.all([
    getUnits(supabase, { ativas: false }),
    getMonthAudits(supabase, mes, { unitId: loja || undefined, status: "todas" }),
    supabase.from("profiles").select("id, nome"),
  ]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const nome = new Map(((profilesRes.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));
  const unit = loja ? unitById.get(loja) ?? null : null;
  const gerente = audits.filter((a) => a.tipo !== "nutricional");
  const nutri = audits.filter((a) => a.tipo === "nutricional");
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(monthStart(today), -i));
  const q = (p: { mes?: string; loja?: string | null }) => {
    const sp = new URLSearchParams();
    sp.set("mes", (p.mes ?? mes).slice(0, 7));
    const l = p.loja === undefined ? loja : p.loja;
    if (l) sp.set("loja", l);
    return `/dashboard/auditorias?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Auditorias" subtitle="Todas as auditorias do mês: abrir, compartilhar ou imprimir" back="/dashboard" />

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {meses.map((m) => (
          <Link key={m} href={q({ mes: m })} className={cn("shrink-0 rounded-full px-3 py-1.5 font-medium capitalize", m === mes ? "bg-ink text-white" : "border border-line bg-white")}>
            {formatMonthPT(m)}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
        <Link href={q({ loja: null })} className={cn("rounded-full px-2.5 py-1", !loja ? "bg-brand-light font-semibold text-brand-dark" : "text-gray-600")}>
          Todas as unidades
        </Link>
        {units
          .filter((u) => u.ativa || u.id === loja)
          .map((u) => (
            <Link key={u.id} href={q({ loja: u.id })} className={cn("rounded-full px-2.5 py-1", loja === u.id ? "bg-brand-light font-semibold text-brand-dark" : "text-gray-600")}>
              {u.nome}
            </Link>
          ))}
      </div>

      <Bloco
        titulo="Auditorias do gerente"
        icon={<ClipboardCheck className="h-4 w-4" />}
        sub={`${gerente.length} em ${formatMonthPT(mes)}${unit ? ` · ${unit.nome}` : ""}`}
        vazio="Nenhuma auditoria do gerente neste mês."
        itens={gerente.map((a) => (
          <Linha key={a.id} audit={a} unit={unitById.get(a.unit_id)} auditor={nome.get(a.auditor_id) ?? "—"} abrir={`/auditorias/${a.id}/resumo`} pdf={`/api/auditorias/${a.id}/relatorio`} fileName={`auditoria-${a.tipo}-${unitById.get(a.unit_id)?.slug ?? "unidade"}-${a.data}.pdf`} tipoLabel={AUDIT_TYPE_SHORT[a.tipo]} />
        ))}
      />

      <Bloco
        titulo="Auditorias da nutrição"
        icon={<Leaf className="h-4 w-4" />}
        sub={`${nutri.length} em ${formatMonthPT(mes)}${unit ? ` · ${unit.nome}` : ""}`}
        vazio="Nenhuma auditoria nutricional neste mês."
        itens={nutri.map((a) => (
          <Linha key={a.id} audit={a} unit={unitById.get(a.unit_id)} auditor={nome.get(a.auditor_id) ?? "—"} abrir={`/nutri/auditorias/${a.id}/resumo`} pdf={`/api/nutri/relatorio/${a.id}`} fileName={`auditoria-nutricional-${unitById.get(a.unit_id)?.slug ?? "unidade"}-${a.data}.pdf`} tipoLabel="Nutricional" nutri />
        ))}
      />
    </div>
  );
}

function Bloco({ titulo, icon, sub, vazio, itens }: { titulo: string; icon: React.ReactNode; sub: string; vazio: string; itens: React.ReactNode[] }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold">
          {icon} {titulo}
        </h2>
        <span className="text-xs text-gray-500">{sub}</span>
      </div>
      {itens.length === 0 ? <EmptyState title={vazio} /> : <div className="space-y-2">{itens}</div>}
    </section>
  );
}

function Linha({ audit, unit, auditor, abrir, pdf, fileName, tipoLabel, nutri = false }: { audit: Audit; unit: Unit | undefined; auditor: string; abrir: string; pdf: string; fileName: string; tipoLabel: string; nutri?: boolean }) {
  const draft = audit.status === "rascunho";
  const unidade = unit?.nome ?? "Unidade";
  return (
    <div className={cn("rounded-2xl border bg-white px-4 py-3", draft ? "border-yellow-200" : "border-line")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{unidade}</span>
            <Badge tone="gray">{tipoLabel}</Badge>
            {draft && <Badge tone="yellow">rascunho</Badge>}
            {audit.falha_grave && <Badge tone="red">falha grave</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-gray-600">
            <span className="capitalize">{formatWeekdayPT(audit.data, true)}</span>, {formatDatePT(audit.data)} · {auditor}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {draft ? <span className="text-xs text-gray-400">sem nota</span> : nutri ? <div className="flex flex-col items-end gap-1"><span className="text-lg font-bold tabular-nums">{fmtPct(audit.nota_final)}</span><ClassBadge classificacao={audit.classificacao} /></div> : <PctBadge value={audit.nota_final} size="lg" />}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href={abrir} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-white">
          <ExternalLink className="h-4 w-4" /> Abrir
        </Link>
        {!draft && <ShareReport compact pdfUrl={pdf} fileName={fileName} title={`${tipoLabel} · ${unidade} · ${formatDatePT(audit.data)}`} text={`Relatório da auditoria ${tipoLabel.toLowerCase()} de ${unidade} em ${formatDatePT(audit.data)}: nota ${audit.nota_final != null ? Math.round(audit.nota_final) : "—"}%.`} />}
      </div>
    </div>
  );
}
