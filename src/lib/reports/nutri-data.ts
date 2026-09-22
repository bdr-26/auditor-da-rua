import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNutriFillData, type NutriFillAnswer } from "../data/nutri";
import { addMonths, formatDatePT, formatDateShortPT, formatDateTimePT, formatMonthPT, monthEnd, monthStart } from "../dates";
import { classifyNutri, computeNutriScore } from "../domain/nutri";
import { computeMonthlyNutri } from "../domain/monthly";
import { round2 } from "../domain/scoring";
import type { Audit, Unit } from "../types";
import { photoDataUri } from "./data";
import type { NutriAuditReportData, NutriMonthlyReportData, NutriReportApontamento, NutriReportArea } from "./nutri-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export const MAX_PHOTOS_AUDIT = 24;
export const MAX_PHOTOS_MONTHLY = 30;

function areaStats(answers: NutriFillAnswer[]): NutriReportArea[] {
  const map = new Map<string, NutriReportArea & { ordem: number }>();
  for (const a of answers) {
    const g = map.get(a.area) ?? { area: a.area, conformes: 0, nao_conformes: 0, na: 0, aplicaveis: 0, nota: null, ordem: a.area_ordem };
    if (a.resposta === "conforme") {
      g.conformes++;
      g.aplicaveis++;
    } else if (a.resposta === "nao_conforme") {
      g.nao_conformes++;
      g.aplicaveis++;
    } else if (a.resposta === "na") g.na++;
    map.set(a.area, g);
  }
  return Array.from(map.values())
    .sort((x, y) => x.ordem - y.ordem)
    .map(({ ordem, ...g }) => {
      void ordem;
      return { ...g, nota: g.aplicaveis > 0 ? round2((g.conformes / g.aplicaveis) * 100) : null };
    });
}

async function apontamentosOf(admin: AdminClient, answers: NutriFillAnswer[], budget: { left: number; omitted: number }, data?: string): Promise<NutriReportApontamento[]> {
  const out: NutriReportApontamento[] = [];
  for (const a of answers.filter((x) => x.resposta === "nao_conforme").sort((x, y) => x.area_ordem - y.area_ordem || x.ordem - y.ordem)) {
    const fotos: NutriReportApontamento["fotos"] = [];
    for (const p of a.photos) {
      if (budget.left <= 0) {
        budget.omitted++;
        continue;
      }
      const uri = await photoDataUri(admin, p.path);
      if (uri) {
        fotos.push({ id: p.id, dataUri: uri });
        budget.left--;
      }
    }
    out.push({ area: a.area, descricao: a.descricao, observacao: a.observacao, fotos, data });
  }
  return out;
}

/** Relatório de uma auditoria nutricional. */
export async function buildNutriAuditReport(admin: AdminClient, auditId: string): Promise<NutriAuditReportData | null> {
  const fill = await getNutriFillData(admin, auditId);
  if (!fill) return null;
  const { audit, unit, answers, pendings, auditorNome } = fill;
  const score = computeNutriScore(answers.map((a) => ({ entry_id: a.id, area: a.area, peso: a.peso, resposta: a.resposta })));
  const rascunho = audit.status === "rascunho";
  const budget = { left: MAX_PHOTOS_AUDIT, omitted: 0 };
  const apontamentos = await apontamentosOf(admin, answers, budget);
  return {
    auditId,
    unidade: { nome: unit.nome, endereco: unit.endereco, supervisor_nome: unit.supervisor_nome },
    data: formatDatePT(audit.data),
    dataIso: audit.data,
    concluidaEm: audit.concluida_em ? formatDateTimePT(audit.concluida_em) : null,
    rascunho,
    nutricionista: auditorNome,
    geradoEm: formatDateTimePT(new Date().toISOString()),
    nota: rascunho ? score.nota : audit.nota_final,
    classificacao: rascunho ? score.classificacao : audit.classificacao,
    totais: { conformes: score.conformes, nao_conformes: score.nao_conformes, na: score.na, avaliados: score.conformes + score.nao_conformes + score.na },
    areas: areaStats(answers),
    apontamentos,
    pendencias: pendings.map((p) => ({ descricao: p.descricao, resolvida: p.resolvida, origem_data: p.origem_data ? formatDatePT(p.origem_data) : null })),
    fotosOmitidas: budget.omitted,
  };
}

/** Relatório mensal nutricional de uma unidade: todas as auditorias concluídas do mês compiladas. */
export async function buildNutriMonthlyReport(admin: AdminClient, unitId: string, mesInput: string): Promise<NutriMonthlyReportData | null> {
  const mes = monthStart(mesInput);
  const { data: unitRow } = await admin.from("units").select("*").eq("id", unitId).maybeSingle();
  if (!unitRow) return null;
  const unit = unitRow as Unit;
  const range = async (from: string) => {
    const { data } = await admin
      .from("audits")
      .select("*")
      .eq("tipo", "nutricional")
      .eq("status", "concluida")
      .eq("unit_id", unitId)
      .gte("data", from)
      .lte("data", monthEnd(from))
      .order("data");
    return (data ?? []).map((a) => ({ ...(a as Audit), nota_final: a.nota_final == null ? null : Number(a.nota_final) }) as Audit);
  };
  const [audits, prevAudits] = await Promise.all([range(mes), range(addMonths(mes, -1))]);

  const fills = [];
  for (const a of audits) {
    const f = await getNutriFillData(admin, a.id);
    if (f) fills.push(f);
  }
  const budget = { left: MAX_PHOTOS_MONTHLY, omitted: 0 };
  const rows = [];
  const areaAgg = new Map<string, { conformes: number; nao_conformes: number; na: number; ordem: number }>();
  const recorr = new Map<string, { descricao: string; ocorrencias: number; areas: Set<string> }>();
  const apontamentos: NutriReportApontamento[] = [];
  const nutricionistas = new Set<string>();
  for (const f of fills) {
    const score = computeNutriScore(f.answers.map((x) => ({ entry_id: x.id, area: x.area, peso: x.peso, resposta: x.resposta })));
    rows.push({ auditId: f.audit.id, data: formatDateShortPT(f.audit.data), nota: f.audit.nota_final, classificacao: f.audit.classificacao, nao_conformes: score.nao_conformes, nutricionista: f.auditorNome });
    nutricionistas.add(f.auditorNome);
    for (const a of f.answers) {
      const g = areaAgg.get(a.area) ?? { conformes: 0, nao_conformes: 0, na: 0, ordem: a.area_ordem };
      if (a.resposta === "conforme") g.conformes++;
      else if (a.resposta === "nao_conforme") {
        g.nao_conformes++;
        const key = a.item_id ?? a.descricao;
        const r = recorr.get(key) ?? { descricao: a.descricao, ocorrencias: 0, areas: new Set<string>() };
        r.ocorrencias++;
        r.areas.add(a.area);
        recorr.set(key, r);
      } else if (a.resposta === "na") g.na++;
      areaAgg.set(a.area, g);
    }
    apontamentos.push(...(await apontamentosOf(admin, f.answers, budget, formatDateShortPT(f.audit.data))));
  }
  const areas: NutriReportArea[] = Array.from(areaAgg.entries())
    .sort((x, y) => x[1].ordem - y[1].ordem)
    .map(([area, g]) => {
      const aplicaveis = g.conformes + g.nao_conformes;
      return { area, conformes: g.conformes, nao_conformes: g.nao_conformes, na: g.na, aplicaveis, nota: aplicaveis > 0 ? round2((g.conformes / aplicaveis) * 100) : null };
    });
  const notas = audits.map((a) => a.nota_final).filter((n): n is number => n != null);
  const res = computeMonthlyNutri(audits.map((a) => a.nota_final));
  const prev = computeMonthlyNutri(prevAudits.map((a) => a.nota_final));

  const { data: pend } = await admin
    .from("pending_issues")
    .select("descricao, created_at, visitas_sem_resolver, reincidente")
    .eq("unit_id", unitId)
    .eq("status", "aberta")
    .not("nutri_entry_id", "is", null)
    .order("created_at");

  return {
    unidade: { nome: unit.nome, endereco: unit.endereco, supervisor_nome: unit.supervisor_nome },
    mes,
    mesLabel: formatMonthPT(mes),
    geradoEm: formatDateTimePT(new Date().toISOString()),
    nutricionistas: Array.from(nutricionistas),
    resultado: { nota: res.nota, classificacao: classifyNutri(res.nota), n: res.n, melhor: notas.length ? Math.max(...notas) : null, pior: notas.length ? Math.min(...notas) : null },
    anterior: { nota: prev.nota, classificacao: classifyNutri(prev.nota), n: prev.n },
    auditorias: rows,
    areas,
    recorrentes: Array.from(recorr.values())
      .filter((r) => r.ocorrencias >= 2)
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, 12)
      .map((r) => ({ descricao: r.descricao, ocorrencias: r.ocorrencias, areas: Array.from(r.areas) })),
    apontamentos,
    pendenciasAbertas: ((pend ?? []) as { descricao: string; created_at: string; visitas_sem_resolver: number; reincidente: boolean }[]).map((p) => ({
      descricao: p.descricao,
      desde: formatDatePT(p.created_at.slice(0, 10)),
      visitas_sem_resolver: p.visitas_sem_resolver,
      reincidente: p.reincidente,
    })),
    fotosOmitidas: budget.omitted,
  };
}

export function nutriMonthlyFileName(unitSlug: string, mes: string): string {
  return `nutricional-${unitSlug}-${mes.slice(0, 7)}.pdf`;
}

export function nutriAuditFileName(unitSlug: string, dataIso: string): string {
  return `auditoria-nutricional-${unitSlug}-${dataIso}.pdf`;
}


