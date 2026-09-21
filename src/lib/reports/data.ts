// Monta os dados dos relatórios mensais a partir do Supabase (cliente service_role).
// Usa monthly_closings quando o mês foi fechado (relatório oficial); senão calcula na hora (prévia).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthAudits } from "../data/audits";
import { getUnits } from "../data/units";
import { addMonths, formatDateTimePT, formatMonthPT, monthEnd, monthStart } from "../dates";
import { computeMonthlyNutri, computeMonthlyOperational, rankUnits, type MonthlyAuditInput } from "../domain/monthly";
import { classifyNutri } from "../domain/nutri";
import { BLOCK_NAMES, MAIN_BLOCKS } from "../domain/scoring";
import { getSettings, type AppSettings } from "../settings";
import type { Audit, AuditType, BlockScore, Unit } from "../types";
import type { ConsolidadoReportData, LojaReportData, ReportApontamento, ReportBlockRow, ReportItemStat, ReportNutriApontamento, ReportRankingRow } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export const MAX_PHOTOS_PER_REPORT = 12;

export interface UnitMonthStats {
  unit_id: string;
  nota_operacional: number | null;
  nota_nutricional: number | null;
  nota_seguranca: number | null;
  notas_blocos: BlockScore[];
  n_auditorias: number;
  n_completas: number;
  n_simplificadas: number;
  n_auditorias_nutri: number;
  falhas_graves: number;
  amostra_reduzida: boolean;
  inelegivel_produto_vencido: boolean;
  posicao_ranking: number | null;
  elegivel: boolean;
  premiada: boolean;
  empate: boolean;
}

export interface MonthStats {
  mes: string;
  oficial: boolean;
  byUnit: Map<string, UnitMonthStats>;
  audits: Audit[];
}

function num(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function emptyStats(unit_id: string): UnitMonthStats {
  return {
    unit_id,
    nota_operacional: null,
    nota_nutricional: null,
    nota_seguranca: null,
    notas_blocos: [],
    n_auditorias: 0,
    n_completas: 0,
    n_simplificadas: 0,
    n_auditorias_nutri: 0,
    falhas_graves: 0,
    amostra_reduzida: false,
    inelegivel_produto_vencido: false,
    posicao_ranking: null,
    elegivel: false,
    premiada: false,
    empate: false,
  };
}

/** Estatísticas do mês por unidade: do fechamento (oficial) ou calculadas na hora (prévia). */
export async function getMonthStats(admin: AdminClient, mes: string, units: Unit[], settings: AppSettings): Promise<MonthStats> {
  const [{ data: closings }, audits] = await Promise.all([admin.from("monthly_closings").select("*").eq("mes", mes), getMonthAudits(admin, mes)]);
  const byUnit = new Map<string, UnitMonthStats>();
  const countTypes = (unitId: string) => ({
    n_completas: audits.filter((a) => a.unit_id === unitId && a.tipo === "completa").length,
    n_simplificadas: audits.filter((a) => a.unit_id === unitId && a.tipo === "simplificada").length,
  });

  if (closings && closings.length > 0) {
    for (const c of closings) {
      byUnit.set(c.unit_id as string, {
        unit_id: c.unit_id as string,
        nota_operacional: num(c.nota_operacional),
        nota_nutricional: num(c.nota_nutricional),
        nota_seguranca: num(c.nota_seguranca),
        notas_blocos: ((c.notas_blocos as BlockScore[] | null) ?? []).map((b) => ({ ...b, nota: num(b.nota), peso: Number(b.peso) })),
        n_auditorias: Number(c.n_auditorias ?? 0),
        ...countTypes(c.unit_id as string),
        n_auditorias_nutri: Number(c.n_auditorias_nutri ?? 0),
        falhas_graves: Number(c.falhas_graves ?? 0),
        amostra_reduzida: !!c.amostra_reduzida,
        inelegivel_produto_vencido: !!c.inelegivel_produto_vencido,
        posicao_ranking: c.posicao_ranking == null ? null : Number(c.posicao_ranking),
        elegivel: !!c.elegivel,
        premiada: !!c.premiada,
        empate: !!c.empate,
      });
    }
    for (const u of units) if (!byUnit.has(u.id)) byUnit.set(u.id, emptyStats(u.id));
    return { mes, oficial: true, byUnit, audits };
  }

  // prévia: mesma engine do fechamento (lib/domain/monthly)
  const weights = { completa: settings.peso_completa, simplificada: settings.peso_simplificada, producao: 1 };
  const partial = new Map<string, ReturnType<typeof computeMonthlyOperational> & { nutri: ReturnType<typeof computeMonthlyNutri> }>();
  for (const u of units) {
    const ops: MonthlyAuditInput[] = audits.filter((a) => a.unit_id === u.id && a.tipo !== "nutricional");
    const nutri = computeMonthlyNutri(audits.filter((a) => a.unit_id === u.id && a.tipo === "nutricional").map((a) => a.nota_final));
    partial.set(u.id, { ...computeMonthlyOperational(ops, weights), nutri });
  }
  const ranking = rankUnits(
    units.map((u) => {
      const p = partial.get(u.id)!;
      return {
        unit_id: u.id,
        nome: u.nome,
        nota: p.nota,
        nota_seguranca: p.nota_seguranca,
        falhas_graves: p.falhas_graves,
        produto_vencido: p.produto_vencido,
        n_auditorias: p.n_auditorias,
        amostra_reduzida: p.amostra_reduzida,
        entra_no_ranking: u.entra_no_ranking && u.tipo === "loja",
      };
    }),
    settings.elegibilidade_min,
  );
  for (const u of units) {
    const p = partial.get(u.id)!;
    const r = ranking.find((x) => x.unit_id === u.id);
    byUnit.set(u.id, {
      unit_id: u.id,
      nota_operacional: p.nota,
      nota_nutricional: p.nutri.nota,
      nota_seguranca: p.nota_seguranca,
      notas_blocos: p.notas_blocos,
      n_auditorias: p.n_auditorias,
      n_completas: p.n_completas,
      n_simplificadas: p.n_simplificadas,
      n_auditorias_nutri: p.nutri.n,
      falhas_graves: p.falhas_graves,
      amostra_reduzida: p.amostra_reduzida,
      inelegivel_produto_vencido: p.produto_vencido,
      posicao_ranking: r?.posicao ?? null,
      elegivel: r?.elegivel ?? false,
      premiada: r?.premiada ?? false,
      empate: r?.empate ?? false,
    });
  }
  return { mes, oficial: false, byUnit, audits };
}

// ---------- respostas do mês ----------

interface AnswerRow {
  id: string;
  audit_id: string;
  nota: number | null;
  na: boolean;
  observacao: string | null;
  template_items: { chave: string; descricao: string; falha_grave: boolean; pendencias: boolean } | null;
  audit_photos: { storage_path: string }[] | null;
}

interface NutriAnswerRow {
  audit_id: string;
  nutri_area: string | null;
  observacao: string | null;
  nutri_item_versions: { descricao: string } | null;
  nutri_item_bank: { descricao: string } | null;
}

async function getGerenteAnswers(admin: AdminClient, auditIds: string[]): Promise<AnswerRow[]> {
  if (auditIds.length === 0) return [];
  const { data, error } = await admin
    .from("audit_answers")
    .select("id, audit_id, nota, na, observacao, template_items(chave, descricao, falha_grave, pendencias), audit_photos(storage_path)")
    .in("audit_id", auditIds)
    .not("item_id", "is", null);
  if (error) throw error;
  return (data ?? []) as unknown as AnswerRow[];
}

async function getNutriNonConformities(admin: AdminClient, auditIds: string[]): Promise<NutriAnswerRow[]> {
  if (auditIds.length === 0) return [];
  const { data, error } = await admin
    .from("audit_answers")
    .select("audit_id, nutri_area, observacao, nutri_item_versions(descricao), nutri_item_bank(descricao)")
    .in("audit_id", auditIds)
    .eq("resposta", "nao_conforme");
  if (error) throw error;
  return (data ?? []) as unknown as NutriAnswerRow[];
}

/** Baixa uma foto do bucket privado e devolve como data URI (jpeg/png). webp não é suportado pelo react-pdf. */
export async function photoDataUri(admin: AdminClient, path: string): Promise<string | null> {
  const ext = path.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
  if (!mime) return null;
  try {
    const { data, error } = await admin.storage.from("audit-photos").download(path);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.length === 0) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.warn("[reports] foto indisponível", path, e);
    return null;
  }
}

function itemStats(answers: AnswerRow[], auditType: Map<string, AuditType>): { bons: ReportItemStat[]; manter: ReportItemStat[]; melhorar: ReportItemStat[] } {
  const agg = new Map<string, { descricao: string; fromCompleta: boolean; notas: number[] }>();
  for (const a of answers) {
    const it = a.template_items;
    if (!it || it.pendencias || a.na || a.nota == null) continue;
    const g = agg.get(it.chave) ?? { descricao: it.descricao, fromCompleta: false, notas: [] };
    if (!g.fromCompleta && auditType.get(a.audit_id) === "completa") {
      g.descricao = it.descricao;
      g.fromCompleta = true;
    }
    g.notas.push(Number(a.nota));
    agg.set(it.chave, g);
  }
  const stats: ReportItemStat[] = Array.from(agg.entries()).map(([chave, g]) => ({
    chave,
    descricao: g.descricao,
    media: Math.round((g.notas.reduce((s, v) => s + v, 0) / g.notas.length) * 100) / 100,
    n: g.notas.length,
    ocorrencias: g.notas.filter((v) => v <= 3).length,
  }));
  const byDesc = (a: ReportItemStat, b: ReportItemStat) => a.descricao.localeCompare(b.descricao, "pt-BR");
  return {
    bons: stats.filter((s) => s.media === 5).sort(byDesc),
    manter: stats.filter((s) => s.media >= 4 && s.media < 5).sort((a, b) => b.media - a.media || byDesc(a, b)),
    melhorar: stats.filter((s) => s.media <= 3).sort((a, b) => a.media - b.media || b.ocorrencias - a.ocorrencias || byDesc(a, b)),
  };
}

function blockRows(unit: Unit, cur: UnitMonthStats, prev: UnitMonthStats | undefined): ReportBlockRow[] {
  const prevNota = new Map((prev?.notas_blocos ?? []).map((b) => [b.chave, b.nota]));
  const curMap = new Map(cur.notas_blocos.map((b) => [b.chave, b]));
  if (unit.tipo === "producao") {
    return cur.notas_blocos
      .filter((b) => b.chave !== "pendencias")
      .map((b) => ({ chave: b.chave, nome: b.nome, nota: b.nota, nota_anterior: prevNota.get(b.chave) ?? null, zerado: b.zerado }));
  }
  return (MAIN_BLOCKS as readonly string[]).map((chave) => {
    const b = curMap.get(chave);
    return { chave, nome: b?.nome ?? BLOCK_NAMES[chave] ?? chave, nota: b?.nota ?? null, nota_anterior: prevNota.get(chave) ?? null, zerado: b?.zerado ?? false };
  });
}

function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
}

export interface MonthlyReportBundle {
  mes: string;
  oficial: boolean;
  lojas: LojaReportData[];
  consolidado: ConsolidadoReportData;
}

/** Monta todos os dados dos relatórios do mês (1 por loja + consolidado). */
export async function buildMonthlyReportData(admin: AdminClient, mesInput: string, opts: { maxPhotos?: number } = {}): Promise<MonthlyReportBundle> {
  const mes = monthStart(mesInput);
  const mesAnterior = addMonths(mes, -1);
  const maxPhotos = opts.maxPhotos ?? MAX_PHOTOS_PER_REPORT;
  const geradoEm = formatDateTimePT(new Date().toISOString());
  const mesLabel = formatMonthPT(mes);

  const [units, settings] = await Promise.all([getUnits(admin, { ativas: true }), getSettings(admin)]);
  const [cur, prev, { data: profiles }, { data: indicators }, { data: schedule }, { data: pendings }] = await Promise.all([
    getMonthStats(admin, mes, units, settings),
    getMonthStats(admin, mesAnterior, units, settings),
    admin.from("profiles").select("id, nome"),
    admin.from("external_indicators").select("*").eq("mes", mes),
    admin.from("schedule_days").select("*").gte("data", mes).lte("data", monthEnd(mes)).order("data"),
    admin.from("pending_issues").select("unit_id, reincidente").eq("status", "aberta"),
  ]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const nomeProfile = new Map((profiles ?? []).map((p) => [p.id as string, p.nome as string]));
  const gerenteAudits = cur.audits.filter((a) => a.tipo !== "nutricional");
  const nutriAudits = cur.audits.filter((a) => a.tipo === "nutricional");
  const auditType = new Map(cur.audits.map((a) => [a.id, a.tipo]));
  const auditById = new Map(cur.audits.map((a) => [a.id, a]));

  const [answers, nutriNc] = await Promise.all([
    getGerenteAnswers(
      admin,
      gerenteAudits.map((a) => a.id),
    ),
    getNutriNonConformities(
      admin,
      nutriAudits.map((a) => a.id),
    ),
  ]);

  const rankedUnits = units.filter((u) => u.entra_no_ranking && u.tipo === "loja");
  const reportUnits = units.filter((u) => u.entra_no_ranking || u.tipo === "producao");

  // ---------- relatórios por loja ----------
  const lojas: LojaReportData[] = [];
  for (const unit of reportUnits) {
    const s = cur.byUnit.get(unit.id) ?? emptyStats(unit.id);
    const p = prev.byUnit.get(unit.id);
    const unitAudits = gerenteAudits.filter((a) => a.unit_id === unit.id).sort((a, b) => a.data.localeCompare(b.data));
    const unitAuditIds = new Set(unitAudits.map((a) => a.id));
    const unitAnswers = answers.filter((a) => unitAuditIds.has(a.audit_id));
    const { bons, manter, melhorar } = itemStats(unitAnswers, auditType);

    // apontamentos (nota 1–2) com fotos (limite por relatório)
    let fotosRestantes = maxPhotos;
    const apontamentos: ReportApontamento[] = [];
    const baixos = unitAnswers
      .filter((a) => a.template_items && !a.na && a.nota != null && Number(a.nota) <= 2)
      .sort((a, b) => {
        const da = auditById.get(a.audit_id)!.data;
        const db = auditById.get(b.audit_id)!.data;
        return da.localeCompare(db) || Number(a.nota) - Number(b.nota);
      });
    for (const a of baixos) {
      const audit = auditById.get(a.audit_id)!;
      const paths = (a.audit_photos ?? []).map((ph) => ph.storage_path).slice(0, Math.max(0, fotosRestantes));
      const fotos = (await Promise.all(paths.map((path) => photoDataUri(admin, path)))).filter((x): x is string => !!x);
      fotosRestantes -= fotos.length;
      apontamentos.push({
        data: audit.data,
        tipo: audit.tipo,
        item: a.template_items!.descricao,
        nota: Number(a.nota),
        falha_grave: a.template_items!.falha_grave && Number(a.nota) === 1,
        observacao: a.observacao,
        fotos,
      });
    }

    const unitNutri = nutriAudits.filter((a) => a.unit_id === unit.id);
    const unitNutriIds = new Set(unitNutri.map((a) => a.id));
    const nutriApont: ReportNutriApontamento[] = nutriNc
      .filter((n) => unitNutriIds.has(n.audit_id))
      .map((n) => ({
        data: auditById.get(n.audit_id)!.data,
        area: n.nutri_area ?? "—",
        item: n.nutri_item_versions?.descricao ?? n.nutri_item_bank?.descricao ?? "Item",
        observacao: n.observacao,
      }))
      .sort((a, b) => a.data.localeCompare(b.data) || a.area.localeCompare(b.area, "pt-BR"));

    const ind = (indicators ?? []).find((i) => i.unit_id === unit.id);
    lojas.push({
      mes,
      mesLabel,
      geradoEm,
      oficial: cur.oficial,
      unidade: { id: unit.id, nome: unit.nome, slug: unit.slug, tipo: unit.tipo, supervisor_nome: unit.supervisor_nome },
      nota: s.nota_operacional,
      posicao: s.posicao_ranking,
      total_ranqueadas: rankedUnits.length,
      fora_do_ranking: unit.tipo === "producao" || !unit.entra_no_ranking || s.posicao_ranking == null,
      premiada: s.premiada,
      elegivel: s.elegivel,
      empate: s.empate,
      amostra_reduzida: s.amostra_reduzida,
      produto_vencido: s.inelegivel_produto_vencido,
      falhas_graves: s.falhas_graves,
      n_auditorias: s.n_auditorias,
      n_completas: s.n_completas,
      n_simplificadas: s.n_simplificadas,
      anterior: p ? { nota: p.nota_operacional, posicao: p.posicao_ranking } : null,
      blocos: blockRows(unit, s, p),
      bons,
      manter,
      melhorar,
      apontamentos,
      auditorias: unitAudits
        .slice()
        .sort((a, b) => b.data.localeCompare(a.data))
        .map((a) => ({ data: a.data, tipo: a.tipo, nota: a.nota_final, falha_grave: a.falha_grave, auditor: nomeProfile.get(a.auditor_id) ?? "—" })),
      nutri:
        unit.tipo === "producao" && s.n_auditorias_nutri === 0
          ? null
          : { nota: s.nota_nutricional, classificacao: classifyNutri(s.nota_nutricional), n: s.n_auditorias_nutri, anterior: p?.nota_nutricional ?? null, apontamentos: nutriApont },
      food99: ind ? { nota_99food: num(ind.nota_99food), cancelamentos: num(ind.cancelamentos), tempo_medio_entrega: num(ind.tempo_medio_entrega) } : null,
    });
  }

  // ---------- consolidado ----------
  const ranking: ReportRankingRow[] = rankedUnits
    .map((u) => {
      const s = cur.byUnit.get(u.id) ?? emptyStats(u.id);
      const selos: string[] = [];
      if (s.falhas_graves > 0) selos.push("Falha grave");
      if (s.inelegivel_produto_vencido) selos.push("Inelegível");
      if (s.amostra_reduzida) selos.push("Amostra reduzida");
      return {
        posicao: s.posicao_ranking,
        nome: u.nome,
        nota: s.nota_operacional,
        nota_anterior: prev.byUnit.get(u.id)?.nota_operacional ?? null,
        n_auditorias: s.n_auditorias,
        falhas_graves: s.falhas_graves,
        selos,
        nota_nutricional: s.nota_nutricional,
        premiada: s.premiada,
        empate: s.empate,
      };
    })
    .sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99) || a.nome.localeCompare(b.nome, "pt-BR"));

  const producaoUnit = units.find((u) => u.tipo === "producao") ?? null;
  const prodStats = producaoUnit ? cur.byUnit.get(producaoUnit.id) : undefined;

  const falhasGraves = answers
    .filter((a) => a.template_items?.falha_grave && !a.na && Number(a.nota) === 1)
    .map((a) => {
      const audit = auditById.get(a.audit_id)!;
      return { unidade: unitById.get(audit.unit_id)?.nome ?? "—", data: audit.data, item: a.template_items!.descricao, observacao: a.observacao };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.unidade.localeCompare(b.unidade, "pt-BR"));

  const sched = schedule ?? [];
  const rotina = {
    previstos: sched.length,
    cumpridos: sched.filter((d) => d.status === "concluida").length,
    nao_cumpridos: sched.filter((d) => d.status === "nao_cumprida").length,
    pendentes: sched.filter((d) => d.status === "prevista").length,
    trocas: sched.filter((d) => d.unit_original_id != null).length,
    nao_cumpridos_lista: sched
      .filter((d) => d.status === "nao_cumprida")
      .map((d) => ({ data: d.data as string, unidade: unitById.get(d.unit_id as string)?.nome ?? "—", tipo: d.tipo as AuditType })),
  };

  const nutriFrequencia = units
    .filter((u) => u.tipo === "loja")
    .map((u) => {
      const s = cur.byUnit.get(u.id);
      const datas = nutriAudits.filter((a) => a.unit_id === u.id).map((a) => a.data).sort();
      return { unidade: u.nome, n: datas.length, datas, nota: s?.nota_nutricional ?? null, classificacao: classifyNutri(s?.nota_nutricional ?? null) };
    });

  const food99 = units
    .filter((u) => u.tipo === "loja")
    .map((u) => {
      const i = (indicators ?? []).find((x) => x.unit_id === u.id);
      return i ? { unidade: u.nome, nota_99food: num(i.nota_99food), cancelamentos: num(i.cancelamentos), tempo_medio_entrega: num(i.tempo_medio_entrega) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const pendencias = units.map((u) => {
    const rows = (pendings ?? []).filter((p) => p.unit_id === u.id);
    return { unidade: u.nome, abertas: rows.length, reincidentes: rows.filter((p) => p.reincidente).length };
  });

  const consolidado: ConsolidadoReportData = {
    mes,
    mesLabel,
    geradoEm,
    oficial: cur.oficial,
    ranking,
    premiadas: rankedUnits.filter((u) => cur.byUnit.get(u.id)?.premiada).map((u) => ({ nome: u.nome, supervisor_nome: u.supervisor_nome })),
    premio_valor: settings.premio_valor,
    producao:
      producaoUnit && prodStats
        ? {
            nome: producaoUnit.nome,
            nota: prodStats.nota_operacional,
            nota_anterior: prev.byUnit.get(producaoUnit.id)?.nota_operacional ?? null,
            n_auditorias: prodStats.n_auditorias,
            falhas_graves: prodStats.falhas_graves,
          }
        : null,
    media_rede: {
      atual: mean(rankedUnits.map((u) => cur.byUnit.get(u.id)?.nota_operacional ?? null)),
      anterior: mean(rankedUnits.map((u) => prev.byUnit.get(u.id)?.nota_operacional ?? null)),
    },
    falhas_graves: falhasGraves,
    rotina,
    nutri_frequencia: nutriFrequencia,
    food99,
    pendencias,
  };

  return { mes, oficial: cur.oficial, lojas, consolidado };
}
