import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, daysBetween, monthEnd, monthStart, todaySP } from "../dates";
import {
  computeMonthlyNutri,
  computeMonthlyOperational,
  rankUnits,
  type MonthlySummary,
  type RankingInput,
  type RankingRow,
} from "../domain/monthly";
import { classifyNutri } from "../domain/nutri";
import { BLOCK_NAMES, round2 } from "../domain/scoring";
import { getSettings, type AppSettings } from "../settings";
import type {
  Audit,
  AuditType,
  ExternalIndicator,
  MonthlyClosing,
  OwnerAdjustment,
  PendingIssue,
  Profile,
  Report,
  ScheduleDay,
  Unit,
} from "../types";
import { getMonthAudits } from "./audits";
import { getUnits } from "./units";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lê `?mes=YYYY-MM` ou `YYYY-MM-DD` e devolve o dia 1 do mês (padrão: mês atual). */
export function parseMesParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(v)) return monthStart(v.length === 7 ? `${v}-01` : v);
  return monthStart(todaySP());
}

function num(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function normalizeClosing(c: Record<string, unknown>): MonthlyClosing {
  return {
    ...(c as unknown as MonthlyClosing),
    nota_operacional: num(c.nota_operacional),
    nota_nutricional: num(c.nota_nutricional),
    nota_seguranca: num(c.nota_seguranca),
  };
}

function normalizeAudit(a: Record<string, unknown>): Audit {
  return { ...(a as unknown as Audit), nota_final: num(a.nota_final) };
}

function mean(values: number[]): number | null {
  return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

function weightsFrom(s: AppSettings) {
  return { completa: s.peso_completa, simplificada: s.peso_simplificada, producao: 1 };
}

export async function getClosings(supabase: AnyClient, mes: string): Promise<MonthlyClosing[]> {
  const { data } = await supabase.from("monthly_closings").select("*").eq("mes", monthStart(mes)).order("posicao_ranking");
  return (data ?? []).map(normalizeClosing);
}

/** Auditorias concluídas num intervalo [from, to) — todas as unidades. */
async function getAuditsRange(supabase: AnyClient, from: string, toExclusive: string, opts: { unitId?: string } = {}): Promise<Audit[]> {
  let q = supabase.from("audits").select("*").eq("status", "concluida").gte("data", from).lt("data", toExclusive).order("data");
  if (opts.unitId) q = q.eq("unit_id", opts.unitId);
  const { data } = await q;
  return (data ?? []).map(normalizeAudit);
}

/** Resumo mensal de uma lista de auditorias (aplica pesos e amostra reduzida das configurações). */
export function summarize(audits: Audit[], settings: AppSettings): MonthlySummary {
  const gerente = audits.filter((a) => a.tipo !== "nutricional" && a.status === "concluida");
  const s = computeMonthlyOperational(gerente, weightsFrom(settings));
  return { ...s, amostra_reduzida: s.n_auditorias > 0 && s.n_auditorias < settings.amostra_reduzida_min };
}

export interface NutriMonth {
  nota: number | null;
  n: number;
  classificacao: string | null;
}

export function summarizeNutri(audits: Audit[]): NutriMonth {
  const r = computeMonthlyNutri(audits.filter((a) => a.tipo === "nutricional" && a.status === "concluida").map((a) => a.nota_final));
  return { ...r, classificacao: classifyNutri(r.nota) };
}

// ---------------------------------------------------------------------------
// Visão do mês (dashboard nível 1 e 2)
// ---------------------------------------------------------------------------

export interface UnitMonth {
  unit: Unit;
  summary: MonthlySummary;
  nutri: NutriMonth;
  closing: MonthlyClosing | null;
  /** Nota do mês anterior: fechada (se houver fechamento) ou parcial. */
  prevNota: number | null;
  prevFechada: boolean;
  delta: number | null;
  lastAudit: Audit | null;
  audits: Audit[];
}

export interface RankedUnit extends RankingRow {
  um: UnitMonth;
}

export interface MonthOverview {
  mes: string;
  today: string;
  closed: boolean;
  settings: AppSettings;
  closings: MonthlyClosing[];
  /** Todas as unidades ativas com o resumo do mês. */
  units: UnitMonth[];
  /** Lojas ranqueadas (com nota no mês), em ordem de posição. */
  ranking: RankedUnit[];
  /** Lojas do ranking ainda sem auditorias no mês. */
  semAuditorias: UnitMonth[];
  production: UnitMonth | null;
  leader: RankedUnit | null;
  networkAvg: number | null;
  prevNetworkAvg: number | null;
  falhasGraves: number;
  rotina: { planned: number; done: number; pct: number | null };
  nutriTotal: number;
  nutriAuditorNome: string | null;
  pendings: { open: number; reincidentes: number };
  /** Lojas premiadas (só após o fechamento). */
  premiadas: UnitMonth[];
}

export async function getMonthOverview(supabase: AnyClient, mesInput: string): Promise<MonthOverview> {
  const mes = monthStart(mesInput);
  const prevMes = addMonths(mes, -1);
  const today = todaySP();

  const [units, settings, audits, closings, prevClosings, scheduleRes, pendRes, nutriProfileRes] = await Promise.all([
    getUnits(supabase, { ativas: true }),
    getSettings(supabase),
    getMonthAudits(supabase, mes),
    getClosings(supabase, mes),
    getClosings(supabase, prevMes),
    supabase.from("schedule_days").select("data, status").gte("data", mes).lte("data", monthEnd(mes)),
    supabase.from("pending_issues").select("id, reincidente").eq("status", "aberta"),
    supabase.from("profiles").select("nome").eq("role", "auditor_nutricao").eq("ativo", true).order("created_at").limit(1),
  ]);

  // mês anterior sem fechamento → parcial calculada
  const prevAudits = prevClosings.length === 0 ? await getMonthAudits(supabase, prevMes) : [];
  const prevByUnit = new Map<string, number | null>();
  if (prevClosings.length) {
    for (const c of prevClosings) prevByUnit.set(c.unit_id, c.nota_operacional);
  } else {
    for (const u of units) prevByUnit.set(u.id, summarize(prevAudits.filter((a) => a.unit_id === u.id), settings).nota);
  }

  const closingByUnit = new Map(closings.map((c) => [c.unit_id, c]));
  const byUnit = new Map<string, UnitMonth>();
  for (const u of units) {
    const ua = audits.filter((a) => a.unit_id === u.id);
    const summary = summarize(ua, settings);
    const prevNota = prevByUnit.get(u.id) ?? null;
    const nota = closingByUnit.get(u.id)?.nota_operacional ?? summary.nota;
    const gerente = ua.filter((a) => a.tipo !== "nutricional");
    byUnit.set(u.id, {
      unit: u,
      summary,
      nutri: summarizeNutri(ua),
      closing: closingByUnit.get(u.id) ?? null,
      prevNota,
      prevFechada: prevClosings.length > 0,
      delta: nota != null && prevNota != null ? round2(nota - prevNota) : null,
      lastAudit: gerente[0] ?? null, // getMonthAudits ordena por data desc
      audits: ua,
    });
  }

  const closed = closings.length > 0;
  const lojas = units.filter((u) => u.tipo === "loja");
  let ranking: RankedUnit[];
  if (closed) {
    ranking = closings
      .filter((c) => c.posicao_ranking != null && byUnit.has(c.unit_id))
      .sort((a, b) => a.posicao_ranking! - b.posicao_ranking!)
      .map((c) => {
        const um = byUnit.get(c.unit_id)!;
        return {
          unit_id: c.unit_id,
          nome: um.unit.nome,
          nota: c.nota_operacional,
          nota_seguranca: c.nota_seguranca,
          falhas_graves: c.falhas_graves,
          produto_vencido: c.inelegivel_produto_vencido,
          n_auditorias: c.n_auditorias,
          amostra_reduzida: c.amostra_reduzida,
          entra_no_ranking: true,
          posicao: c.posicao_ranking,
          elegivel: c.elegivel,
          premiada: c.premiada,
          empate: c.empate,
          um,
        };
      });
  } else {
    const inputs: RankingInput[] = lojas.map((u) => {
      const um = byUnit.get(u.id)!;
      return {
        unit_id: u.id,
        nome: u.nome,
        nota: um.summary.nota,
        nota_seguranca: um.summary.nota_seguranca,
        falhas_graves: um.summary.falhas_graves,
        produto_vencido: um.summary.produto_vencido,
        n_auditorias: um.summary.n_auditorias,
        amostra_reduzida: um.summary.amostra_reduzida,
        entra_no_ranking: u.entra_no_ranking,
      };
    });
    ranking = rankUnits(inputs, settings.elegibilidade_min)
      .filter((r) => r.posicao != null)
      .map((r) => ({ ...r, um: byUnit.get(r.unit_id)! }));
  }
  const rankedIds = new Set(ranking.map((r) => r.unit_id));
  const semAuditorias = lojas.filter((u) => u.entra_no_ranking && !rankedIds.has(u.id)).map((u) => byUnit.get(u.id)!);
  const production = units.filter((u) => u.tipo === "producao").map((u) => byUnit.get(u.id)!)[0] ?? null;

  const networkAvg = mean(ranking.map((r) => r.nota).filter((n): n is number => n != null));
  const prevNetworkAvg = prevClosings.length
    ? mean(prevClosings.filter((c) => c.posicao_ranking != null && c.nota_operacional != null).map((c) => c.nota_operacional!))
    : mean(lojas.filter((u) => u.entra_no_ranking).map((u) => prevByUnit.get(u.id)).filter((n): n is number => n != null));

  const schedule = (scheduleRes.data ?? []) as { data: string; status: string }[];
  const considered = schedule.filter((d) => d.data < today || d.status !== "prevista");
  const done = considered.filter((d) => d.status === "concluida").length;

  const pend = (pendRes.data ?? []) as { id: string; reincidente: boolean }[];

  return {
    mes,
    today,
    closed,
    settings,
    closings,
    units: Array.from(byUnit.values()),
    ranking,
    semAuditorias,
    production,
    leader: ranking.find((r) => r.posicao === 1) ?? null,
    networkAvg,
    prevNetworkAvg,
    falhasGraves: audits.filter((a) => a.tipo !== "nutricional" && a.falha_grave).length,
    rotina: { planned: considered.length, done, pct: considered.length ? Math.round((done / considered.length) * 100) : null },
    nutriTotal: audits.filter((a) => a.tipo === "nutricional").length,
    nutriAuditorNome: (nutriProfileRes.data?.[0]?.nome as string | undefined) ?? null,
    pendings: { open: pend.length, reincidentes: pend.filter((p) => p.reincidente).length },
    premiadas: closed ? closings.filter((c) => c.premiada && byUnit.has(c.unit_id)).map((c) => byUnit.get(c.unit_id)!) : [],
  };
}

// ---------------------------------------------------------------------------
// Agregação por item (piores critérios)
// ---------------------------------------------------------------------------

interface AnswerJoined {
  id: string;
  audit_id: string;
  item_id: string | null;
  nota: number | null;
  na: boolean;
  observacao: string | null;
  template_items: {
    chave: string;
    descricao: string;
    bloco_ref: string | null;
    pendencias: boolean;
    template_blocks: { chave: string; nome: string } | null;
  } | null;
}

export interface CriterionStat {
  chave: string;
  descricao: string;
  bloco: string;
  media: number;
  n: number;
  /** nº de notas ≤ 2 */
  baixas: number;
  /** nº de lojas com ao menos uma nota ≤ 2 */
  lojas: number;
}

async function getItemAnswers(supabase: AnyClient, auditIds: string[]): Promise<AnswerJoined[]> {
  if (auditIds.length === 0) return [];
  const { data } = await supabase
    .from("audit_answers")
    .select("id, audit_id, item_id, nota, na, observacao, template_items(chave, descricao, bloco_ref, pendencias, template_blocks(chave, nome))")
    .in("audit_id", auditIds)
    .not("item_id", "is", null);
  return (data ?? []) as unknown as AnswerJoined[];
}

/** Agrupa respostas por chave do item (estável entre templates) e calcula média e nº de notas baixas. */
function aggregateItems(answers: AnswerJoined[], auditMeta: Map<string, { unit_id: string; tipo: AuditType }>): CriterionStat[] {
  const groups = new Map<string, { descricao: string; descTipo: AuditType | null; bloco: string; notas: number[]; baixas: number; lojas: Set<string> }>();
  for (const a of answers) {
    const it = a.template_items;
    if (!it || it.pendencias || a.na || a.nota == null) continue;
    const meta = auditMeta.get(a.audit_id);
    const blocoKey = it.bloco_ref ?? it.template_blocks?.chave ?? "geral";
    const g = groups.get(it.chave) ?? { descricao: it.descricao, descTipo: meta?.tipo ?? null, bloco: BLOCK_NAMES[blocoKey] ?? it.template_blocks?.nome ?? blocoKey, notas: [], baixas: 0, lojas: new Set<string>() };
    // prefere a redação da auditoria completa
    if (g.descTipo !== "completa" && meta?.tipo === "completa") {
      g.descricao = it.descricao;
      g.descTipo = "completa";
    }
    g.notas.push(Number(a.nota));
    if (Number(a.nota) <= 2) {
      g.baixas++;
      if (meta) g.lojas.add(meta.unit_id);
    }
    groups.set(it.chave, g);
  }
  return Array.from(groups.entries())
    .map(([chave, g]) => ({
      chave,
      descricao: g.descricao,
      bloco: g.bloco,
      media: round2(g.notas.reduce((s, v) => s + v, 0) / g.notas.length),
      n: g.notas.length,
      baixas: g.baixas,
      lojas: g.lojas.size,
    }))
    .sort((a, b) => b.baixas - a.baixas || a.media - b.media || b.n - a.n);
}

export async function getNetworkWorstCriteria(supabase: AnyClient, mesInput: string): Promise<{ mes: CriterionStat[]; tresMeses: CriterionStat[] }> {
  const mes = monthStart(mesInput);
  const end = addMonths(mes, 1);
  const audits = await getAuditsRange(supabase, addMonths(mes, -2), end);
  const gerente = audits.filter((a) => a.tipo !== "nutricional");
  const answers = await getItemAnswers(supabase, gerente.map((a) => a.id));
  const meta = new Map(gerente.map((a) => [a.id, { unit_id: a.unit_id, tipo: a.tipo }]));
  const monthIds = new Set(gerente.filter((a) => a.data >= mes).map((a) => a.id));
  return {
    mes: aggregateItems(answers.filter((a) => monthIds.has(a.audit_id)), meta),
    tresMeses: aggregateItems(answers, meta),
  };
}

// ---------------------------------------------------------------------------
// Detalhe da loja (nível 3)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  data: string;
  nota: number;
  tipo: AuditType;
  falha_grave: boolean;
}

export interface NcPhoto {
  url: string;
  item: string;
  nota: number;
  data: string;
  auditId: string;
  observacao: string | null;
}

export interface NutriMonthAudit {
  audit: Audit;
  nc: { descricao: string; area: string | null; observacao: string | null }[];
}

export interface UnitDetail {
  unit: Unit;
  mes: string;
  closed: boolean;
  closing: MonthlyClosing | null;
  summary: MonthlySummary;
  nutri: NutriMonth;
  audits: Audit[];
  trend: TrendPoint[];
  worstItems: CriterionStat[];
  pendings: PendingIssue[];
  photos: NcPhoto[];
  nutriAudits: NutriMonthAudit[];
  indicators: ExternalIndicator | null;
}

interface PhotoAnswerRow {
  id: string;
  audit_id: string;
  nota: number | null;
  observacao: string | null;
  template_items: { descricao: string } | null;
  audit_photos: { storage_path: string }[];
}

interface NutriNcRow {
  audit_id: string;
  nutri_area: string | null;
  observacao: string | null;
  nutri_item_versions: { descricao: string } | null;
}

export async function getUnitDetail(supabase: AnyClient, unitId: string, mesInput: string): Promise<UnitDetail | null> {
  const mes = monthStart(mesInput);
  const end = addMonths(mes, 1);
  const { data: unitRow } = await supabase.from("units").select("*").eq("id", unitId).maybeSingle();
  if (!unitRow) return null;
  const unit = unitRow as Unit;

  const [settings, audits, closingRes, trendRes, last3, pendRes, indRes] = await Promise.all([
    getSettings(supabase),
    getMonthAudits(supabase, mes, { unitId, status: "todas" }),
    supabase.from("monthly_closings").select("*").eq("mes", mes).eq("unit_id", unitId).maybeSingle(),
    supabase
      .from("audits")
      .select("id, data, nota_final, tipo, falha_grave")
      .eq("unit_id", unitId)
      .eq("status", "concluida")
      .neq("tipo", "nutricional")
      .lt("data", end)
      .order("data", { ascending: false })
      .limit(12),
    getAuditsRange(supabase, addMonths(mes, -2), end, { unitId }),
    supabase.from("pending_issues").select("*").eq("unit_id", unitId).eq("status", "aberta").order("reincidente", { ascending: false }).order("created_at"),
    supabase.from("external_indicators").select("*").eq("mes", mes).eq("unit_id", unitId).maybeSingle(),
  ]);

  const concluded = audits.filter((a) => a.status === "concluida");
  const gerenteIds = concluded.filter((a) => a.tipo !== "nutricional").map((a) => a.id);
  const nutriIds = concluded.filter((a) => a.tipo === "nutricional").map((a) => a.id);

  const [photoRows, nutriRows] = await Promise.all([
    gerenteIds.length
      ? supabase
          .from("audit_answers")
          .select("id, audit_id, nota, observacao, template_items(descricao), audit_photos(storage_path)")
          .in("audit_id", gerenteIds)
          .lte("nota", 2)
          .then((r) => (r.data ?? []) as unknown as PhotoAnswerRow[])
      : Promise.resolve([] as PhotoAnswerRow[]),
    nutriIds.length
      ? supabase
          .from("audit_answers")
          .select("audit_id, nutri_area, observacao, nutri_item_versions(descricao)")
          .in("audit_id", nutriIds)
          .eq("resposta", "nao_conforme")
          .then((r) => (r.data ?? []) as unknown as NutriNcRow[])
      : Promise.resolve([] as NutriNcRow[]),
  ]);

  // fotos das não conformidades → URLs assinadas (1h)
  const auditById = new Map(audits.map((a) => [a.id, a]));
  const flat = photoRows.flatMap((r) => r.audit_photos.map((p) => ({ row: r, path: p.storage_path })));
  let photos: NcPhoto[] = [];
  if (flat.length) {
    const { data: signed } = await supabase.storage.from("audit-photos").createSignedUrls(
      flat.map((f) => f.path),
      60 * 60,
    );
    photos = flat
      .map((f, i) => ({ f, url: signed?.[i]?.signedUrl ?? null }))
      .filter((x): x is { f: (typeof flat)[number]; url: string } => !!x.url)
      .map(({ f, url }) => ({
        url,
        item: f.row.template_items?.descricao ?? "Item",
        nota: Number(f.row.nota),
        data: auditById.get(f.row.audit_id)?.data ?? "",
        auditId: f.row.audit_id,
        observacao: f.row.observacao,
      }))
      .sort((a, b) => a.nota - b.nota || b.data.localeCompare(a.data));
  }

  const gerente3 = last3.filter((a) => a.tipo !== "nutricional");
  const answers3 = await getItemAnswers(supabase, gerente3.map((a) => a.id));
  const worstItems = aggregateItems(answers3, new Map(gerente3.map((a) => [a.id, { unit_id: a.unit_id, tipo: a.tipo }])))
    .filter((i) => i.baixas > 0 || i.media < 4)
    .sort((a, b) => a.media - b.media || b.baixas - a.baixas)
    .slice(0, 8);

  const trend: TrendPoint[] = ((trendRes.data ?? []) as { data: string; nota_final: unknown; tipo: AuditType; falha_grave: boolean }[])
    .filter((r) => r.nota_final != null)
    .map((r) => ({ data: r.data, nota: Number(r.nota_final), tipo: r.tipo, falha_grave: r.falha_grave }))
    .reverse();

  const nutriAudits: NutriMonthAudit[] = concluded
    .filter((a) => a.tipo === "nutricional")
    .map((audit) => ({
      audit,
      nc: nutriRows
        .filter((r) => r.audit_id === audit.id)
        .map((r) => ({ descricao: r.nutri_item_versions?.descricao ?? "Item", area: r.nutri_area, observacao: r.observacao })),
    }));

  const ind = indRes.data as Record<string, unknown> | null;

  return {
    unit,
    mes,
    closed: !!closingRes.data,
    closing: closingRes.data ? normalizeClosing(closingRes.data) : null,
    summary: summarize(concluded, settings),
    nutri: summarizeNutri(concluded),
    audits,
    trend,
    worstItems,
    pendings: (pendRes.data ?? []) as PendingIssue[],
    photos,
    nutriAudits,
    indicators: ind
      ? { ...(ind as unknown as ExternalIndicator), nota_99food: num(ind.nota_99food), cancelamentos: num(ind.cancelamentos), tempo_medio_entrega: num(ind.tempo_medio_entrega) }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Perfil dos auditores
// ---------------------------------------------------------------------------

export interface AuditorStats {
  profile: Profile;
  n_auditorias: number;
  media: number | null;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
  na: number;
  nutri: { conforme: number; nao_conforme: number; na: number } | null;
}

export async function getAuditorProfile(supabase: AnyClient, mesInput: string): Promise<AuditorStats[]> {
  const mes = monthStart(mesInput);
  const [{ data: profiles }, audits] = await Promise.all([
    supabase.from("profiles").select("*").in("role", ["auditor_geral", "auditor_nutricao"]).eq("ativo", true).order("role"),
    getMonthAudits(supabase, mes),
  ]);
  const ids = audits.map((a) => a.id);
  const { data: answers } = ids.length
    ? await supabase.from("audit_answers").select("audit_id, nota, na, resposta").in("audit_id", ids)
    : { data: [] as unknown[] };
  const rows = (answers ?? []) as { audit_id: string; nota: number | null; na: boolean; resposta: string | null }[];
  const auditorOf = new Map(audits.map((a) => [a.id, a.auditor_id]));

  return ((profiles ?? []) as Profile[]).map((p) => {
    const mine = audits.filter((a) => a.auditor_id === p.id);
    const myAnswers = rows.filter((r) => auditorOf.get(r.audit_id) === p.id);
    const histogram: AuditorStats["histogram"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let na = 0;
    const nutri = { conforme: 0, nao_conforme: 0, na: 0 };
    for (const r of myAnswers) {
      if (r.resposta) {
        nutri[r.resposta as keyof typeof nutri]++;
        continue;
      }
      if (r.na) na++;
      else if (r.nota != null && r.nota >= 1 && r.nota <= 5) histogram[r.nota as 1 | 2 | 3 | 4 | 5]++;
    }
    return {
      profile: p,
      n_auditorias: mine.length,
      media: mean(mine.map((a) => a.nota_final).filter((n): n is number => n != null)),
      histogram,
      na,
      nutri: p.role === "auditor_nutricao" ? nutri : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Calendário da rotina
// ---------------------------------------------------------------------------

export type DayState = "feito" | "pendente" | "hoje" | "nao_cumprida";

export interface CalendarDay {
  day: ScheduleDay;
  unit: Unit | null;
  unitOriginal: Unit | null;
  trocadoPorNome: string | null;
  audit: { id: string; status: string; nota_final: number | null } | null;
  state: DayState;
}

export interface RoutineCalendar {
  mes: string;
  today: string;
  days: CalendarDay[];
  units: Unit[];
  summary: { planned: number; done: number };
}

export async function getRoutineCalendar(supabase: AnyClient, mesInput: string): Promise<RoutineCalendar> {
  const mes = monthStart(mesInput);
  const today = todaySP();
  const [{ data: rows }, units] = await Promise.all([
    supabase.from("schedule_days").select("*").gte("data", mes).lte("data", monthEnd(mes)).order("data"),
    getUnits(supabase, { ativas: false }),
  ]);
  const days = (rows ?? []) as ScheduleDay[];
  const auditIds = days.map((d) => d.audit_id).filter((id): id is string => !!id);
  const userIds = Array.from(new Set(days.map((d) => d.trocado_por).filter((id): id is string => !!id)));
  const [auditRes, profRes] = await Promise.all([
    auditIds.length ? supabase.from("audits").select("id, status, nota_final").in("id", auditIds) : Promise.resolve({ data: [] as unknown[] }),
    userIds.length ? supabase.from("profiles").select("id, nome").in("id", userIds) : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const auditMap = new Map(((auditRes.data ?? []) as { id: string; status: string; nota_final: unknown }[]).map((a) => [a.id, { id: a.id, status: a.status, nota_final: num(a.nota_final) }]));
  const profMap = new Map(((profRes.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const out: CalendarDay[] = days.map((day) => {
    let state: DayState;
    if (day.status === "concluida") state = "feito";
    else if (day.status === "nao_cumprida") state = "nao_cumprida";
    else if (day.data === today) state = "hoje";
    else if (day.data < today) state = "nao_cumprida";
    else state = "pendente";
    return {
      day,
      unit: unitMap.get(day.unit_id) ?? null,
      unitOriginal: day.unit_original_id ? unitMap.get(day.unit_original_id) ?? null : null,
      trocadoPorNome: day.trocado_por ? profMap.get(day.trocado_por) ?? null : null,
      audit: day.audit_id ? auditMap.get(day.audit_id) ?? null : null,
      state,
    };
  });
  const considered = out.filter((d) => d.day.data < today || d.day.status !== "prevista");
  return {
    mes,
    today,
    days: out,
    units: units.filter((u) => u.ativa),
    summary: { planned: considered.length, done: considered.filter((d) => d.state === "feito").length },
  };
}

// ---------------------------------------------------------------------------
// Pendências da rede
// ---------------------------------------------------------------------------

export interface PendingWithMeta extends PendingIssue {
  unit_nome: string;
  origem_data: string | null;
  origem_tipo: AuditType | null;
  dias_aberta: number;
}

export async function getNetworkPendings(supabase: AnyClient): Promise<{ units: Unit[]; pendings: PendingWithMeta[] }> {
  const today = todaySP();
  const [units, { data: rows }] = await Promise.all([
    getUnits(supabase, { ativas: false }),
    supabase.from("pending_issues").select("*").eq("status", "aberta").order("reincidente", { ascending: false }).order("created_at"),
  ]);
  const pend = (rows ?? []) as PendingIssue[];
  const auditIds = Array.from(new Set(pend.map((p) => p.origem_audit_id)));
  const { data: audits } = auditIds.length ? await supabase.from("audits").select("id, data, tipo").in("id", auditIds) : { data: [] as unknown[] };
  const auditMap = new Map(((audits ?? []) as { id: string; data: string; tipo: AuditType }[]).map((a) => [a.id, a]));
  const unitMap = new Map(units.map((u) => [u.id, u.nome]));
  return {
    units,
    pendings: pend.map((p) => {
      const a = auditMap.get(p.origem_audit_id);
      return {
        ...p,
        unit_nome: unitMap.get(p.unit_id) ?? "—",
        origem_data: a?.data ?? null,
        origem_tipo: a?.tipo ?? null,
        dias_aberta: daysBetween(p.created_at.slice(0, 10), today),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Fechamento: dados de trabalho do mês
// ---------------------------------------------------------------------------

export interface PontualidadeRow {
  audit: Audit;
  answerId: string;
  nota: number | null;
  na: boolean;
  adjustments: (OwnerAdjustment & { user_nome: string })[];
}

export interface ReportWithUnit extends Report {
  unit_nome: string | null;
}

export interface ClosingWorkbench {
  overview: MonthOverview;
  units: Unit[];
  indicators: ExternalIndicator[];
  pontualidade: Map<string, PontualidadeRow[]>;
  reports: ReportWithUnit[];
  fechadoPorNome: string | null;
}

export async function getClosingWorkbench(supabase: AnyClient, mesInput: string): Promise<ClosingWorkbench> {
  const mes = monthStart(mesInput);
  const [overview, units, monthAudits] = await Promise.all([getMonthOverview(supabase, mes), getUnits(supabase, { ativas: true }), getMonthAudits(supabase, mes)]);
  const lojas = units.filter((u) => u.tipo === "loja");

  const audits = monthAudits.filter((a) => a.tipo === "completa" || a.tipo === "simplificada");
  const auditIds = audits.map((a) => a.id);

  const [indRes, ansRes, adjRes, repRes, closerRes] = await Promise.all([
    supabase.from("external_indicators").select("*").eq("mes", mes),
    auditIds.length
      ? supabase.from("audit_answers").select("id, audit_id, nota, na, template_items!inner(chave)").in("audit_id", auditIds).eq("template_items.chave", "pontualidade")
      : Promise.resolve({ data: [] as unknown[] }),
    auditIds.length ? supabase.from("owner_adjustments").select("*, profiles(nome)").in("audit_id", auditIds).order("created_at") : Promise.resolve({ data: [] as unknown[] }),
    supabase.from("reports").select("*").eq("mes", mes).order("tipo").order("gerado_em", { ascending: false }),
    overview.closings[0]?.fechado_por ? supabase.from("profiles").select("nome").eq("id", overview.closings[0].fechado_por).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const adjs = ((adjRes.data ?? []) as (OwnerAdjustment & { profiles: { nome: string } | null })[]).map((a) => ({ ...a, user_nome: a.profiles?.nome ?? "—" }));
  const answers = (ansRes.data ?? []) as { id: string; audit_id: string; nota: number | null; na: boolean }[];
  const pontualidade = new Map<string, PontualidadeRow[]>();
  for (const u of lojas) pontualidade.set(u.id, []);
  for (const a of audits.slice().sort((x, y) => x.data.localeCompare(y.data))) {
    const ans = answers.find((r) => r.audit_id === a.id);
    if (!ans) continue;
    pontualidade.get(a.unit_id)?.push({
      audit: a,
      answerId: ans.id,
      nota: ans.nota == null ? null : Number(ans.nota),
      na: ans.na,
      adjustments: adjs.filter((j) => j.answer_id === ans.id),
    });
  }

  const unitName = new Map(units.map((u) => [u.id, u.nome]));
  return {
    overview,
    units,
    indicators: ((indRes.data ?? []) as Record<string, unknown>[]).map((i) => ({
      ...(i as unknown as ExternalIndicator),
      nota_99food: num(i.nota_99food),
      cancelamentos: num(i.cancelamentos),
      tempo_medio_entrega: num(i.tempo_medio_entrega),
    })),
    pontualidade,
    reports: ((repRes.data ?? []) as Report[]).map((r) => ({ ...r, unit_nome: r.unit_id ? unitName.get(r.unit_id) ?? null : null })),
    fechadoPorNome: (closerRes.data as { nome: string } | null)?.nome ?? null,
  };
}

/** Últimos N meses (dia 1) com status de fechamento, do mais recente ao mais antigo. */
export async function getClosingMonths(supabase: AnyClient, n = 12): Promise<{ mes: string; closed: boolean; fechado_em: string | null; fechado_por_nome: string | null; n_units: number }[]> {
  const current = monthStart(todaySP());
  const months = Array.from({ length: n }, (_, i) => addMonths(current, -i));
  const { data } = await supabase.from("monthly_closings").select("mes, fechado_em, fechado_por, profiles(nome)").gte("mes", months[months.length - 1]);
  const rows = (data ?? []) as unknown as { mes: string; fechado_em: string; fechado_por: string | null; profiles: { nome: string } | null }[];
  return months.map((mes) => {
    const mine = rows.filter((r) => r.mes === mes);
    return {
      mes,
      closed: mine.length > 0,
      fechado_em: mine[0]?.fechado_em ?? null,
      fechado_por_nome: mine[0]?.profiles?.nome ?? null,
      n_units: mine.length,
    };
  });
}
