import { TIMEZONE } from "./constants";

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje em São Paulo no formato YYYY-MM-DD. */
export function todaySP(now: Date = new Date()): string {
  return ymdFmt.format(now);
}

/** Hora atual (0-23) em São Paulo. */
export function hourSP(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(now);
  return Number(h) % 24;
}

/** Converte YYYY-MM-DD em Date UTC meia-noite (aritmética de dias sem efeito de fuso). */
export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = parseYMD(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYMD(d);
}

/** 0=domingo ... 6=sábado */
export function weekday(ymd: string): number {
  return parseYMD(ymd).getUTCDay();
}

export function monthStart(ymd: string): string {
  return ymd.slice(0, 7) + "-01";
}

export function monthEnd(ymd: string): string {
  const d = parseYMD(monthStart(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toYMD(d);
}

export function addMonths(ymd: string, n: number): string {
  const d = parseYMD(monthStart(ymd));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toYMD(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYMD(b).getTime() - parseYMD(a).getTime()) / 86_400_000);
}

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS_PT = ["domingo", "terça", "terça", "quarta", "quinta", "sexta", "sábado"];
WEEKDAYS_PT[1] = "segunda";
const WEEKDAYS_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function formatMonthPT(ymd: string): string {
  const d = parseYMD(ymd);
  return `${MONTHS_PT[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function formatMonthShortPT(ymd: string): string {
  const d = parseYMD(ymd);
  return `${MONTHS_PT[d.getUTCMonth()].slice(0, 3)}/${String(d.getUTCFullYear()).slice(2)}`;
}

export function formatDatePT(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateShortPT(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

export function formatWeekdayPT(ymd: string, short = false): string {
  const w = weekday(ymd);
  return short ? WEEKDAYS_SHORT_PT[w] : WEEKDAYS_PT[w];
}

/** "quarta, 23/09" */
export function formatDayLabelPT(ymd: string): string {
  return `${formatWeekdayPT(ymd)}, ${formatDateShortPT(ymd)}`;
}

export function formatDateTimePT(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isSameMonth(ymd: string, mes: string): boolean {
  return ymd.slice(0, 7) === mes.slice(0, 7);
}
