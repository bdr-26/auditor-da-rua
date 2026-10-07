import Link from "next/link";
import { Archive, CalendarDays, CalendarX2, ChevronRight, ClipboardPlus, ListChecks, PlayCircle, Store, Thermometer, Users } from "lucide-react";
import { NutriAuditRow } from "@/components/nutri/audit-row";
import { ControleCard } from "@/components/nutri/controle-card";
import { AgendaItemRow } from "@/components/nutri/agenda-widgets";
import { ClassBadge } from "@/components/nutri/nutri-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/score";
import { isNutriChefe, requireProfile } from "@/lib/auth";
import { NUTRI_AGENDA_TIPO_LABELS } from "@/lib/constants";
import { getDraftProgress, getLastNutriAuditByUnit, getNutriAudits } from "@/lib/data/nutri";
import { getNutriAgenda, getNutriTeam } from "@/lib/data/nutri-agenda";
import { getControles } from "@/lib/data/nutri-controles";
import { getEquipeOverview } from "@/lib/data/nutri-equipe";
import { getUnits } from "@/lib/data/units";
import { addDays, daysBetween, formatDatePT, formatDayLabelPT, formatMonthPT, monthStart, todaySP } from "@/lib/dates";
import { computeMonthlyNutri } from "@/lib/domain/monthly";
import { classifyNutri, nutriBandTone } from "@/lib/domain/nutri";
import { CONTROLE_TIPOS } from "@/lib/nutri/controle-tipos";
import { createClient } from "@/lib/supabase/server";
import { cn, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE_RING: Record<string, string> = {
  green: "border-green-200 bg-green-50",
  yellow: "border-yellow-200 bg-yellow-50",
  orange: "border-orange-200 bg-orange-50",
  red: "border-red-200 bg-red-50",
  gray: "border-line bg-white",
};

export default async function NutriHome() {
  const profile = await requireProfile(["auditor_nutricao", "proprietario"]);
  const chefe = profile.role === "proprietario" || isNutriChefe(profile);
  return chefe ? <ChefeHome profile={profile} /> : <EstagiariaHome profile={profile} />;
}

// ---------------------------------------------------------------------------
// Chefe / proprietário: painel da equipe
// ---------------------------------------------------------------------------
async function ChefeHome({ profile }: { profile: { id: string; nome: string; role: string } }) {
  const supabase = await createClient();
  const today = todaySP();
  const [ov, lastByUnit, monthAudits, recent] = await Promise.all([
    getEquipeOverview(supabase),
    getLastNutriAuditByUnit(supabase),
    getNutriAudits(supabase, { status: "concluida" }),
    getNutriAudits(supabase, { status: "concluida", limit: 5 }),
  ]);
  const isNutri = profile.role === "auditor_nutricao";
  const unitName = new Map(ov.units.map((u) => [u.id, u.nome]));
  const nome = new Map(ov.membros.map((m) => [m.id, m.nome]));
  const mes = monthStart(today);
  const doMes = monthAudits.filter((a) => a.data >= mes);
  const media = computeMonthlyNutri(doMes.map((a) => a.nota_final));
  const semVisita = ov.units.filter((u) => {
    const last = lastByUnit.get(u.id);
    return !last || daysBetween(last.data, today) > 7;
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm capitalize text-gray-500">{formatDayLabelPT(today)}</p>
          <h1 className="text-2xl font-bold">{isNutri ? `Olá, ${profile.nome.split(" ")[0]}` : "Nutrição"}</h1>
        </div>
        <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">{isNutri ? "Nutricionista chefe" : "Módulo nutricional"}</span>
      </header>

      {/* ações */}
      <section className="grid grid-cols-3 gap-2">
        <Quick href="/nutri/agenda" icon={<CalendarDays className="h-5 w-5" />} label="Agenda" sub={`${ov.agendaHoje.length} hoje${ov.agendaAtrasada.length ? ` · ${ov.agendaAtrasada.length} atrasada${ov.agendaAtrasada.length === 1 ? "" : "s"}` : ""}`} tone={ov.agendaAtrasada.length ? "red" : "gray"} />
        <Quick href="/nutri/controles" icon={<Thermometer className="h-5 w-5" />} label="Controles" sub={`${ov.controlesRascunho.length} rascunho${ov.controlesRascunho.length === 1 ? "" : "s"}`} tone={ov.controlesRascunho.length ? "yellow" : "gray"} />
        {isNutri ? <Quick href="/nutri/nova" icon={<ClipboardPlus className="h-5 w-5" />} label="Nova auditoria" sub="checklist" tone="gray" /> : <Quick href="/nutri/checklists" icon={<ListChecks className="h-5 w-5" />} label="Checklists" sub="por unidade" tone="gray" />}
      </section>

      {/* indicadores do mês */}
      <section className="grid grid-cols-3 gap-2">
        <Stat label="No mês" value={String(doMes.length)} sub={doMes.length === 1 ? "auditoria" : "auditorias"} />
        <Stat label="Média do mês" value={fmtPct(media.nota)} sub={media.nota != null ? "conformidade" : "sem nota"} tone={nutriBandTone(classifyNutri(media.nota))} />
        <Stat label="Sem visita" value={String(semVisita.length)} sub="há mais de 7 dias" tone={semVisita.length > 0 ? "orange" : "green"} />
      </section>

      {/* equipe */}
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Equipe · {formatMonthPT(mes)}
          </span>
        </CardTitle>
        <ul className="divide-y divide-line">
          {ov.membros.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{m.nome}</span>
                  <Badge tone={m.nivel === "chefe" ? "brand" : "gray"}>{m.nivel === "chefe" ? "chefe" : "estagiária"}</Badge>
                  {m.rascunhos > 0 && <Badge tone="yellow">{m.rascunhos} rascunho{m.rascunhos === 1 ? "" : "s"}</Badge>}
                  {m.tarefasAtrasadas > 0 && <Badge tone="red">{m.tarefasAtrasadas} atrasada{m.tarefasAtrasadas === 1 ? "" : "s"}</Badge>}
                </div>
                <div className="text-xs text-gray-500">
                  {m.auditoriasMes} auditoria{m.auditoriasMes === 1 ? "" : "s"} · {m.controlesMes} controle{m.controlesMes === 1 ? "" : "s"} · última visita {m.ultimaVisita ? formatDatePT(m.ultimaVisita) : "—"}
                  {m.tarefasPendentes > 0 ? ` · ${m.tarefasPendentes} tarefa${m.tarefasPendentes === 1 ? "" : "s"} programada${m.tarefasPendentes === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <span className={cn("rounded-lg px-2 py-1 text-sm font-bold tabular-nums", m.mediaMes == null ? "bg-gray-100 text-gray-500" : `tone-${nutriBandTone(classifyNutri(m.mediaMes))}`)}>{fmtPct(m.mediaMes)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* rascunhos em aberto (equipe) */}
      {(ov.rascunhos.length > 0 || ov.controlesRascunho.length > 0) && (
        <Card className="border-yellow-200">
          <CardTitle>Em andamento na equipe</CardTitle>
          <div className="space-y-2">
            {ov.rascunhos.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} auditorName={nome.get(a.auditor_id)} />
            ))}
            {ov.controlesRascunho.slice(0, 5).map((c) => (
              <ControleCard key={c.id} c={c} unitName={unitName.get(c.unit_id) ?? "Unidade"} responsavelNome={nome.get(c.responsavel_id)} />
            ))}
          </div>
        </Card>
      )}

      {/* conferência dos controles no mês */}
      <Card>
        <CardTitle>
          Conferência dos controles <span className="text-sm font-normal text-gray-500">· finalizados em {formatMonthPT(mes)}</span>
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1 pr-2">Unidade</th>
                {CONTROLE_TIPOS.map((t) => (
                  <th key={t.codigo} className="py-1 pr-2 text-center">
                    {t.curto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ov.conferencia.map(({ unit, porTipo }) => (
                <tr key={unit.id} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium">{unit.nome}</td>
                  {CONTROLE_TIPOS.map((t) => {
                    const n = porTipo[t.codigo] ?? 0;
                    return (
                      <td key={t.codigo} className="py-1.5 pr-2 text-center">
                        <Link href={`/nutri/controles?tipo=${t.codigo}&loja=${unit.id}`} className={cn("inline-block min-w-[1.75rem] rounded-md px-1.5 py-0.5 font-semibold tabular-nums", n > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-400")}>
                          {n}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Toque num número para ver os controles daquela unidade e tipo. Zero em cinza = nada preenchido no mês.</p>
        <Link href="/nutri/arquivo" className="mt-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-surface-muted">
          <Archive className="h-4 w-4 text-gray-500" /> Arquivo de registros para impressão
          <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
        </Link>
      </Card>

      {/* vencimentos (pasta de documentação, ASO) */}
      {ov.vencimentos.length > 0 && (
        <Card className={cn(ov.vencimentos.some((v) => v.dias < 0) ? "border-red-200" : "border-orange-200")}>
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <CalendarX2 className="h-4 w-4" /> Vencimentos
            </span>{" "}
            <span className="text-sm font-normal text-gray-500">· documentos e exames (30 dias)</span>
          </CardTitle>
          <ul className="divide-y divide-line text-sm">
            {ov.vencimentos.slice(0, 12).map((v, i) => (
              <li key={i} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                <Link href={`/nutri/controles/${v.controleId}`} className="min-w-0 flex-1">
                  <span className="block font-medium">{v.item}</span>
                  <span className="block text-xs text-gray-500">
                    {v.unidade} · {v.tipo} · {v.campo} {formatDatePT(v.data)}
                  </span>
                </Link>
                <Badge tone={v.dias < 0 ? "red" : v.dias <= 7 ? "orange" : "yellow"} className="shrink-0">
                  {v.dias < 0 ? `vencido há ${-v.dias} d` : v.dias === 0 ? "vence hoje" : `${v.dias} d`}
                </Badge>
              </li>
            ))}
          </ul>
          {ov.vencimentos.length > 12 && <p className="mt-2 text-xs text-gray-500">+ {ov.vencimentos.length - 12} outros.</p>}
        </Card>
      )}

      {/* agenda de hoje */}
      {(ov.agendaHoje.length > 0 || ov.agendaAtrasada.length > 0) && (
        <Card>
          <CardTitle>
            Agenda da equipe{" "}
            <Link href="/nutri/agenda" className="float-right text-sm font-medium text-brand-dark">
              Ver semana
            </Link>
          </CardTitle>
          <div className="space-y-2">
            {[...ov.agendaAtrasada, ...ov.agendaHoje].slice(0, 6).map((it) => (
              <AgendaItemRow key={it.id} item={it} unitName={it.unit_id ? unitName.get(it.unit_id) ?? null : null} responsavelNome={nome.get(it.responsavel_id) ?? null} isChefe isMine={it.responsavel_id === profile.id} today={today} />
            ))}
          </div>
        </Card>
      )}

      {/* unidades */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Unidades</h2>
          <span className="text-xs text-gray-500">última auditoria nutricional</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ov.units.map((u) => {
            const last = lastByUnit.get(u.id);
            const dias = last ? daysBetween(last.data, today) : null;
            const tone = last ? nutriBandTone(last.classificacao) : "gray";
            const href = isNutri ? `/nutri/nova?unit=${u.id}` : `/dashboard/lojas/${u.id}`;
            return (
              <Link key={u.id} href={href} className={cn("flex min-h-[6.5rem] flex-col rounded-2xl border p-3 active:scale-[0.99]", TONE_RING[tone])}>
                <div className="flex items-start justify-between gap-1">
                  <Store className="h-4 w-4 shrink-0 text-gray-500" />
                  {last && <span className="text-sm font-bold tabular-nums">{fmtPct(last.nota_final)}</span>}
                </div>
                <div className="mt-auto">
                  <div className="truncate text-sm font-semibold leading-tight">{u.nome}</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">{last ? (dias === 0 ? "auditada hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`) : "nunca auditada"}</div>
                  {last && <ClassBadge classificacao={last.classificacao} className="mt-1" />}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Últimas auditorias</h2>
          <Link href="/nutri/historico" className="text-sm font-medium text-brand-dark">
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Nenhuma auditoria concluída ainda" />
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} auditorName={nome.get(a.auditor_id)} />
            ))}
          </div>
        )}
      </section>

      <Link href="/nutri/checklists" className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 active:bg-surface-muted">
        <ListChecks className="h-5 w-5 text-brand-dark" />
        <span className="flex-1 text-sm font-medium">Checklists por unidade</span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estagiária: hoje, continuar, iniciar
// ---------------------------------------------------------------------------
async function EstagiariaHome({ profile }: { profile: { id: string; nome: string } }) {
  const supabase = await createClient();
  const today = todaySP();
  const [units, drafts, controlesRascunho, agendaHoje, agendaProx, recent, team] = await Promise.all([
    getUnits(supabase),
    getNutriAudits(supabase, { auditorId: profile.id, status: "rascunho" }),
    getControles(supabase, { responsavelId: profile.id, status: "rascunho", limit: 10 }),
    getNutriAgenda(supabase, { responsavelId: profile.id, to: today, status: ["prevista"] }),
    getNutriAgenda(supabase, { responsavelId: profile.id, from: addDays(today, 1), to: addDays(today, 7), status: ["prevista"] }),
    getNutriAudits(supabase, { status: "concluida", limit: 5, auditorId: profile.id }),
    getNutriTeam(supabase),
  ]);
  const progress = await getDraftProgress(supabase, drafts.map((d) => d.id));
  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  const nome = new Map(team.map((m) => [m.id, m.nome]));

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm capitalize text-gray-500">{formatDayLabelPT(today)}</p>
          <h1 className="text-2xl font-bold">Olá, {profile.nome.split(" ")[0]}</h1>
        </div>
        <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">Estagiária</span>
      </header>

      {/* hoje */}
      <Card className={cn(agendaHoje.some((t) => t.data < today) && "border-red-200")}>
        <CardTitle>
          Hoje{" "}
          <Link href="/nutri/agenda" className="float-right text-sm font-medium text-brand-dark">
            Agenda
          </Link>
        </CardTitle>
        {agendaHoje.length === 0 ? (
          <p className="text-sm text-gray-500">Nada programado para hoje. Você pode iniciar uma auditoria ou um controle abaixo.</p>
        ) : (
          <div className="space-y-2">
            {agendaHoje.map((it) => (
              <div key={it.id}>
                <AgendaItemRow item={it} unitName={it.unit_id ? unitName.get(it.unit_id) ?? null : null} responsavelNome={null} isChefe={false} isMine today={today} />
                {it.unit_id && it.status === "prevista" && (
                  <div className="mt-1 flex gap-2 pl-1 text-xs">
                    {it.tipo !== "controles" && (
                      <Link href={`/nutri/nova?unit=${it.unit_id}`} className="font-medium text-brand-dark">
                        Iniciar auditoria →
                      </Link>
                    )}
                    {it.tipo !== "auditoria" && (
                      <Link href={`/nutri/controles/novo?loja=${it.unit_id}`} className="font-medium text-brand-dark">
                        Preencher controle →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {agendaProx.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Próximos dias: {agendaProx.slice(0, 3).map((t) => `${formatDatePT(t.data).slice(0, 5)} ${t.unit_id ? unitName.get(t.unit_id) ?? "" : NUTRI_AGENDA_TIPO_LABELS[t.tipo]}`).join(" · ")}
            {agendaProx.length > 3 ? ` · +${agendaProx.length - 3}` : ""}
          </p>
        )}
      </Card>

      {/* continuar rascunhos */}
      {drafts.map((a) => {
        const pr = progress.get(a.id) ?? { answered: 0, total: 0 };
        return (
          <Link key={a.id} href={`/nutri/auditorias/${a.id}`} className="block rounded-2xl bg-ink p-4 text-white shadow-lg shadow-black/10 active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Continuar auditoria</div>
                <div className="truncate text-base font-bold">{unitName.get(a.unit_id) ?? "Unidade"}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/60" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={pr.answered} max={pr.total || 1} className="bg-white/15" />
              <span className="shrink-0 text-xs tabular-nums text-white/70">
                {pr.answered}/{pr.total}
              </span>
            </div>
          </Link>
        );
      })}
      {controlesRascunho.length > 0 && (
        <div className="space-y-2">
          {controlesRascunho.map((c) => (
            <ControleCard key={c.id} c={c} unitName={unitName.get(c.unit_id) ?? "Unidade"} />
          ))}
        </div>
      )}

      {/* ações */}
      <section className="grid grid-cols-2 gap-2">
        <Link href="/nutri/nova" className="flex items-center gap-3 rounded-2xl bg-brand p-4 text-white shadow-md shadow-brand/30 active:scale-[0.99]">
          <ClipboardPlus className="h-7 w-7 shrink-0" />
          <span className="min-w-0">
            <span className="block font-bold leading-tight">Nova auditoria</span>
            <span className="block text-xs text-white/70">checklist da loja</span>
          </span>
        </Link>
        <Link href="/nutri/controles/novo" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 active:scale-[0.99]">
          <Thermometer className="h-7 w-7 shrink-0 text-brand-dark" />
          <span className="min-w-0">
            <span className="block font-bold leading-tight">Novo controle</span>
            <span className="block text-xs text-gray-500">temperatura, óleo…</span>
          </span>
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Suas últimas auditorias</h2>
          <Link href="/nutri/historico" className="text-sm font-medium text-brand-dark">
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Nenhuma auditoria concluída ainda" description="Toque em “Nova auditoria” para começar a primeira visita." />
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <NutriAuditRow key={a.id} audit={a} unitName={unitName.get(a.unit_id) ?? "Unidade"} auditorName={nome.get(a.auditor_id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Quick({ href, icon, label, sub, tone }: { href: string; icon: React.ReactNode; label: string; sub: string; tone: string }) {
  return (
    <Link href={href} className={cn("flex min-h-[5.5rem] flex-col rounded-2xl border p-3 active:scale-[0.99]", TONE_RING[tone] ?? TONE_RING.gray)}>
      <span className="text-brand-dark">{icon}</span>
      <span className="mt-auto block text-sm font-semibold leading-tight">{label}</span>
      <span className="block text-[11px] text-gray-600">{sub}</span>
    </Link>
  );
}

function Stat({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={cn("rounded-2xl border p-3", TONE_RING[tone] ?? TONE_RING.gray)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}
