// Lógica compartilhada das Edge Functions (Deno). Duplica, de forma compacta, o que está em
// src/lib/cron/*, src/lib/push.ts, src/lib/schedule-sync.ts e src/lib/dates.ts — as functions não
// conseguem importar de src/. Mantenha as duas implementações alinhadas.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

// deno-lint-ignore no-explicit-any
export type AdminClient = SupabaseClient<any, any, any>;

const TIMEZONE = "America/Sao_Paulo";

// ---------- env ----------
export function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v == null) throw new Error(`variável ${name} não configurada`);
  return v;
}

export function createAdminClient(): AdminClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Aceita `Authorization: Bearer <CRON_SECRET|SERVICE_ROLE_KEY>` ou `?secret=<CRON_SECRET>`. */
export function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  if (cronSecret && (bearer === cronSecret || query === cronSecret)) return true;
  if (serviceKey && bearer === serviceKey) return true;
  return false;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

// ---------- datas (espelho de src/lib/dates.ts) ----------
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export function todaySP(now: Date = new Date()): string {
  return ymdFmt.format(now);
}

export function hourSP(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(now);
  return Number(h) % 24;
}

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

export function formatDatePT(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Ver src/lib/cron/end-of-day.ts: antes das 6h SP a verificação é do dia anterior. */
export function endOfDayTargetDate(now: Date = new Date()): string {
  const today = todaySP(now);
  return hourSP(now) < 6 ? addDays(today, -1) : today;
}

// ---------- rótulos (espelho de src/lib/constants.ts) ----------
export type AuditType = "completa" | "simplificada" | "producao" | "nutricional";

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  completa: "Auditoria Completa",
  simplificada: "Auditoria Simplificada",
  producao: "Auditoria de Produção",
  nutricional: "Auditoria Nutricional",
};

export const AUDIT_TYPE_SHORT: Record<AuditType, string> = {
  completa: "Completa",
  simplificada: "Simplificada",
  producao: "Produção",
  nutricional: "Nutricional",
};

export function appUrl(path: string): string {
  const base = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

// ---------- push (espelho de src/lib/push.ts) ----------
export interface PushPayload {
  titulo: string;
  corpo: string;
  url: string;
  tag?: string;
}

export async function sendPushToUsers(
  admin: AdminClient,
  userIds: string[],
  tipo: string,
  chaveDedup: string,
  payload: PushPayload,
): Promise<{ enviados: number; pulados: number }> {
  if (userIds.length === 0) return { enviados: 0, pulados: 0 };
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) {
    console.warn("[push] VAPID não configurado — notificação não enviada:", payload.titulo);
    return { enviados: 0, pulados: userIds.length };
  }
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@burgerdarua.com.br", pub, priv);

  let enviados = 0;
  let pulados = 0;
  for (const userId of userIds) {
    const { error: logErr } = await admin.from("notifications_log").insert({
      user_id: userId,
      tipo,
      chave_dedup: chaveDedup,
      titulo: payload.titulo,
      corpo: payload.corpo,
      url: payload.url,
    });
    if (logErr) {
      pulados++;
      continue; // já enviado (unique user_id + chave_dedup)
    }
    const { data: subs } = await admin.from("push_subscriptions").select("id, subscription").eq("user_id", userId);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("[push] falha ao enviar", e);
      }
    }
  }
  return { enviados, pulados };
}

export async function ownerIds(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "proprietario").eq("ativo", true);
  return (data ?? []).map((p: { id: string }) => p.id);
}

export async function activeGeneralAuditors(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true);
  return (data ?? []).map((p: { id: string }) => p.id);
}

// ---------- agenda (espelho de src/lib/domain/schedule.ts + src/lib/schedule-sync.ts) ----------
interface RotationUnit {
  id: string;
  nome: string;
  ordem_rotacao: number;
}

const ROTATION_DAYS: { weekday: number; tipo: "simplificada" | "completa" }[] = [
  { weekday: 3, tipo: "simplificada" },
  { weekday: 4, tipo: "simplificada" },
  { weekday: 5, tipo: "completa" },
  { weekday: 6, tipo: "completa" },
  { weekday: 0, tipo: "completa" },
];

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function unitForDay(ymd: string, units: RotationUnit[], baseTuesday: string): RotationUnit | null {
  if (units.length === 0) return null;
  const pos = ROTATION_DAYS.findIndex((d) => d.weekday === weekday(ymd));
  if (pos < 0) return null;
  const week = Math.floor(daysBetween(baseTuesday, ymd) / 7);
  const sorted = units.slice().sort((a, b) => a.ordem_rotacao - b.ordem_rotacao || a.nome.localeCompare(b.nome));
  return sorted[mod(pos - week, sorted.length)];
}

/** Garante a agenda do mês atual + próximo sem sobrescrever dias existentes. */
export async function ensureSchedule(admin: AdminClient): Promise<number> {
  const today = todaySP();
  const start = monthStart(today);
  const end = monthEnd(addMonths(today, 1));

  const [{ data: units }, { data: auditors }, { data: settings }] = await Promise.all([
    admin.from("units").select("id, nome, tipo, ordem_rotacao, entra_no_ranking").eq("ativa", true),
    admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true).order("created_at").limit(1),
    admin.from("app_settings").select("valor").eq("chave", "rotacao_semana_base").maybeSingle(),
  ]);
  const auditorId: string | null = auditors?.[0]?.id ?? null;
  const baseTuesday: string = typeof settings?.valor === "string" ? settings.valor : "2026-09-22";
  type UnitRow = { id: string; nome: string; tipo: string; ordem_rotacao: number; entra_no_ranking: boolean };
  const all = (units ?? []) as UnitRow[];
  const rotation = all.filter((u) => u.tipo === "loja" && u.entra_no_ranking);
  const production = all.find((u) => u.tipo === "producao") ?? null;

  const planned: { data: string; unit_id: string; tipo: AuditType }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 2) {
      if (production) planned.push({ data: d, unit_id: production.id, tipo: "producao" });
      continue;
    }
    const r = ROTATION_DAYS.find((x) => x.weekday === wd);
    if (!r) continue;
    const u = unitForDay(d, rotation, baseTuesday);
    if (u) planned.push({ data: d, unit_id: u.id, tipo: r.tipo });
  }
  if (planned.length === 0) return 0;

  const { data: existing } = await admin.from("schedule_days").select("data").gte("data", start).lte("data", end);
  const have = new Set((existing ?? []).map((e: { data: string }) => e.data));
  const rows = planned.filter((p) => !have.has(p.data)).map((p) => ({ ...p, status: "prevista", auditor_id: auditorId }));
  if (rows.length === 0) return 0;
  const { error } = await admin.from("schedule_days").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ---------- jobs (espelho de src/lib/cron/*) ----------
interface ScheduleRow {
  id: string;
  data: string;
  unit_id: string;
  tipo: AuditType;
  status: "prevista" | "concluida" | "nao_cumprida";
  auditor_id: string | null;
}

export async function runDailyReminder(admin: AdminClient, data = todaySP()) {
  const agendaCriada = await ensureSchedule(admin);
  const { data: rows, error } = await admin.from("schedule_days").select("*").eq("data", data);
  if (error) throw error;
  const previstas = ((rows ?? []) as ScheduleRow[]).filter((r) => r.status === "prevista");
  const lembretes: unknown[] = [];
  if (previstas.length === 0) return { data, agenda_criada: agendaCriada, lembretes, motivo: "sem auditoria prevista pendente" };

  const { data: units } = await admin.from("units").select("id, nome").in("id", previstas.map((r) => r.unit_id));
  const unitName = new Map((units ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome]));
  let gerais: string[] | null = null;
  for (const row of previstas) {
    const destinatarios = row.auditor_id ? [row.auditor_id] : (gerais ??= await activeGeneralAuditors(admin));
    const nome = unitName.get(row.unit_id) ?? "unidade";
    const titulo = `Hoje: ${AUDIT_TYPE_LABELS[row.tipo]} — ${nome}`;
    const r = await sendPushToUsers(admin, destinatarios, "lembrete_8h", `lembrete:${data}`, {
      titulo,
      corpo: "Toque para abrir a agenda e iniciar",
      url: appUrl(`/auditor?data=${data}`),
      tag: `lembrete-${data}`,
    });
    lembretes.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, destinatarios: destinatarios.length, ...r, titulo });
  }
  return { data, agenda_criada: agendaCriada, lembretes };
}

export async function runEndOfDay(admin: AdminClient, data = endOfDayTargetDate()) {
  const { data: rows, error } = await admin.from("schedule_days").select("*").eq("data", data).eq("status", "prevista");
  if (error) throw error;
  const previstas = (rows ?? []) as ScheduleRow[];
  const concluidas: unknown[] = [];
  const naoCumpridas: unknown[] = [];
  if (previstas.length === 0) return { data, concluidas, nao_cumpridas: naoCumpridas, motivo: "nenhum dia previsto pendente na data" };

  const unitIds = previstas.map((r) => r.unit_id);
  const [{ data: units }, { data: audits }, owners] = await Promise.all([
    admin.from("units").select("id, nome").in("id", unitIds),
    admin.from("audits").select("id, unit_id, tipo").eq("data", data).eq("status", "concluida").in("unit_id", unitIds),
    ownerIds(admin),
  ]);
  const unitName = new Map((units ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome]));
  const concluded = new Map((audits ?? []).map((a: { id: string; unit_id: string; tipo: string }) => [`${a.unit_id}:${a.tipo}`, a.id]));
  const mes = monthStart(data);
  let gerais: string[] | null = null;

  for (const row of previstas) {
    const nome = unitName.get(row.unit_id) ?? "unidade";
    const auditId = concluded.get(`${row.unit_id}:${row.tipo}`);
    if (auditId) {
      await admin.from("schedule_days").update({ status: "concluida", audit_id: auditId }).eq("id", row.id);
      concluidas.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, audit_id: auditId });
      continue;
    }
    const { error: upErr } = await admin.from("schedule_days").update({ status: "nao_cumprida" }).eq("id", row.id);
    if (upErr) throw upErr;
    const auditores = row.auditor_id ? [row.auditor_id] : (gerais ??= await activeGeneralAuditors(admin));
    const titulo = "Auditoria não registrada";
    const corpo = `Auditoria de ${nome} (${AUDIT_TYPE_SHORT[row.tipo]}) prevista para ${formatDatePT(data)} não foi registrada`;
    const chave = `rotina:${data}:${row.unit_id}`;
    const tag = `rotina-${data}-${row.unit_id}`;
    const a = await sendPushToUsers(admin, auditores, "rotina_nao_cumprida", chave, { titulo, corpo, url: appUrl(`/auditor/agenda?mes=${mes}`), tag });
    const o = await sendPushToUsers(admin, owners.filter((id) => !auditores.includes(id)), "rotina_nao_cumprida", chave, {
      titulo,
      corpo,
      url: appUrl(`/dashboard/calendario?mes=${mes}`),
      tag,
    });
    naoCumpridas.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, enviados: a.enviados + o.enviados, pulados: a.pulados + o.pulados });
  }
  return { data, concluidas, nao_cumpridas: naoCumpridas };
}
