import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, formatDatePT, formatDateTimePT, formatMonthPT, monthStart } from "../dates";
import { CONTROLE_TIPOS, getControleTipo, parseDados, resumirControle } from "../nutri/controle-tipos";
import type { Audit, NutriControle, Unit } from "../types";
import type { ControleReportData, ControleReportRegistro, DossieReportData } from "./controle-report";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

async function nomes(admin: AdminClient, ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const { data } = await admin.from("profiles").select("id, nome").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p.nome as string]));
}

function toRegistro(c: NutriControle, tipoCodigo: string, nome: string): ControleReportRegistro | null {
  const tipo = getControleTipo(tipoCodigo);
  if (!tipo) return null;
  const dados = parseDados(c.dados, tipo);
  const resumo = resumirControle(tipo, dados);
  return {
    id: c.id,
    data: formatDatePT(c.data),
    dataIso: c.data,
    responsavel: nome,
    status: c.status,
    finalizadoEm: c.finalizado_em ? formatDateTimePT(c.finalizado_em) : null,
    observacoes: c.observacoes,
    dados,
    alertas: resumo.alertas,
  };
}

/** PDF de um controle. */
export async function buildControleReport(admin: AdminClient, id: string): Promise<ControleReportData | null> {
  const { data: row } = await admin.from("nutri_controles").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const c = row as NutriControle;
  const tipo = getControleTipo(c.tipo);
  if (!tipo) return null;
  const [{ data: unit }, nm] = await Promise.all([admin.from("units").select("*").eq("id", c.unit_id).maybeSingle(), nomes(admin, [c.responsavel_id])]);
  if (!unit) return null;
  const u = unit as Unit;
  const reg = toRegistro(c, tipo.codigo, nm.get(c.responsavel_id) ?? "—");
  return { tipo, unidade: { nome: u.nome, endereco: u.endereco, supervisor_nome: u.supervisor_nome }, geradoEm: formatDateTimePT(new Date().toISOString()), registros: reg ? [reg] : [] };
}

/** Compilação mensal: todos os controles finalizados de um tipo numa unidade. */
export async function buildControleMonthlyReport(admin: AdminClient, unitId: string, tipoCodigo: string, mesInput: string): Promise<ControleReportData | null> {
  const tipo = getControleTipo(tipoCodigo);
  if (!tipo) return null;
  const mes = monthStart(mesInput);
  const fim = addMonths(mes, 1);
  const [{ data: unit }, { data: rows }] = await Promise.all([
    admin.from("units").select("*").eq("id", unitId).maybeSingle(),
    admin.from("nutri_controles").select("*").eq("unit_id", unitId).eq("tipo", tipoCodigo).eq("status", "finalizado").gte("data", mes).lt("data", fim).order("data"),
  ]);
  if (!unit) return null;
  const u = unit as Unit;
  const list = (rows ?? []) as NutriControle[];
  const nm = await nomes(admin, list.map((c) => c.responsavel_id));
  const registros = list.map((c) => toRegistro(c, tipo.codigo, nm.get(c.responsavel_id) ?? "—")).filter((r): r is ControleReportRegistro => !!r);
  return { tipo, unidade: { nome: u.nome, endereco: u.endereco, supervisor_nome: u.supervisor_nome }, geradoEm: formatDateTimePT(new Date().toISOString()), registros, mesLabel: formatMonthPT(mes) };
}

export function controleFileName(slug: string, tipoCodigo: string, sufixo: string): string {
  return `controle-${tipoCodigo}-${slug}-${sufixo}.pdf`;
}

/** Arquivo de registros: todos os controles finalizados da unidade entre `from` e `to` (inclusive), por tipo, + auditorias concluídas. */
export async function buildDossieReport(admin: AdminClient, unitId: string, from: string, to: string): Promise<DossieReportData | null> {
  const [{ data: unit }, { data: rows }, { data: audits }] = await Promise.all([
    admin.from("units").select("*").eq("id", unitId).maybeSingle(),
    admin.from("nutri_controles").select("*").eq("unit_id", unitId).eq("status", "finalizado").gte("data", from).lte("data", to).order("data"),
    admin.from("audits").select("*").eq("unit_id", unitId).eq("tipo", "nutricional").eq("status", "concluida").gte("data", from).lte("data", to).order("data"),
  ]);
  if (!unit) return null;
  const u = unit as Unit;
  const list = (rows ?? []) as NutriControle[];
  const auds = (audits ?? []) as Audit[];
  const nm = await nomes(admin, [...list.map((c) => c.responsavel_id), ...auds.map((a) => a.auditor_id)]);
  const secoes = CONTROLE_TIPOS.map((tipo) => ({
    tipo,
    registros: list.filter((c) => c.tipo === tipo.codigo).map((c) => toRegistro(c, tipo.codigo, nm.get(c.responsavel_id) ?? "—")).filter((r): r is ControleReportRegistro => !!r),
  }));
  const periodoLabel = from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01") ? formatMonthPT(from) : `${formatDatePT(from)} a ${formatDatePT(to)}`;
  return {
    unidade: { nome: u.nome, endereco: u.endereco, supervisor_nome: u.supervisor_nome },
    periodoLabel,
    geradoEm: formatDateTimePT(new Date().toISOString()),
    secoes,
    auditorias: auds.map((a) => ({ data: formatDatePT(a.data), nutricionista: nm.get(a.auditor_id) ?? "—", nota: a.nota_final == null ? "—" : `${Math.round(Number(a.nota_final))}%`, classificacao: a.classificacao ?? "—" })),
  };
}
