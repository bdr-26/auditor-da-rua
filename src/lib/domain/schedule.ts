import { ROTATION_DAYS } from "../constants";
import { addDays, daysBetween, weekday } from "../dates";
import type { AuditType } from "../types";

export interface RotationUnit {
  id: string;
  nome: string;
  ordem_rotacao: number;
}

export interface PlannedDay {
  data: string;
  unit_id: string;
  tipo: Exclude<AuditType, "nutricional">;
}

/**
 * Índice da semana de rotação para uma data. Semana 0 começa na terça `baseTuesday`
 * (a semana de trabalho do gerente vai de terça a domingo; segunda é folga e pertence à semana anterior).
 */
export function rotationWeekIndex(ymd: string, baseTuesday: string): number {
  return Math.floor(daysBetween(baseTuesday, ymd) / 7);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Loja prevista para uma data (qua–dom), dada a lista ordenada de lojas em rotação.
 * A escala desliza 1 posição por semana: unidade = (posição − semana) mod N.
 * Semana 0: qua = 1ª loja, qui = 2ª, ... dom = 5ª. Semana 1: qua = 5ª, qui = 1ª, ...
 * Com 5 lojas o ciclo fecha em 5 semanas e cada loja passa 1x em cada dia.
 */
export function unitForDay(ymd: string, units: RotationUnit[], baseTuesday: string): RotationUnit | null {
  if (units.length === 0) return null;
  const wd = weekday(ymd);
  const pos = ROTATION_DAYS.findIndex((d) => d.weekday === wd);
  if (pos < 0) return null;
  const week = rotationWeekIndex(ymd, baseTuesday);
  const sorted = units.slice().sort((a, b) => a.ordem_rotacao - b.ordem_rotacao || a.nome.localeCompare(b.nome));
  return sorted[mod(pos - week, sorted.length)];
}

/** Tipo de auditoria do gerente previsto para o dia da semana (null = folga/segunda). */
export function auditTypeForWeekday(wd: number): Exclude<AuditType, "nutricional"> | null {
  if (wd === 2) return "producao";
  const r = ROTATION_DAYS.find((d) => d.weekday === wd);
  return r ? r.tipo : null;
}

/**
 * Gera a agenda de `from` a `to` (inclusive): terça = produção (unidade fixa),
 * qua/qui = simplificada, sex/sáb/dom = completa, segunda sem auditoria.
 */
export function generateSchedule(
  from: string,
  to: string,
  units: RotationUnit[],
  productionUnitId: string | null,
  baseTuesday: string,
  skipDates: Iterable<string> = [],
): PlannedDay[] {
  const skip = new Set(skipDates);
  const out: PlannedDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (skip.has(d)) continue; // folga (ex.: domingo de folga do mês)
    const tipo = auditTypeForWeekday(weekday(d));
    if (!tipo) continue;
    if (tipo === "producao") {
      if (productionUnitId) out.push({ data: d, unit_id: productionUnitId, tipo });
      continue;
    }
    const u = unitForDay(d, units, baseTuesday);
    if (u) out.push({ data: d, unit_id: u.id, tipo });
  }
  return out;
}

/** Domingos de um mês (YYYY-MM-01) — candidatos à folga mensal. */
export function sundaysOfMonth(mes: string): string[] {
  const out: string[] = [];
  const start = mes.slice(0, 7) + "-01";
  const end = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10);
  for (let d = start; d <= end; d = addDays(d, 1)) if (weekday(d) === 0) out.push(d);
  return out;
}

/** Semana de trabalho (terça a domingo) que contém a data. */
export function workWeekRange(ymd: string): { start: string; end: string } {
  const wd = weekday(ymd);
  // dias desde a terça: ter=0, qua=1, ..., dom=5, seg=6
  const sinceTuesday = mod(wd - 2, 7);
  const start = addDays(ymd, -sinceTuesday);
  return { start, end: addDays(start, 5) };
}
