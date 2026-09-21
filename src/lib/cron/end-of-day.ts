import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_TYPE_SHORT } from "../constants";
import { addDays, formatDatePT, hourSP, monthStart, todaySP } from "../dates";
import { appUrl, ownerIds, sendPushToUsers } from "../push";
import type { AuditType, ScheduleDay } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

/**
 * Data que a verificação das 23h deve avaliar.
 * O Vercel Cron dispara às 02:05 UTC, que já é o dia seguinte em São Paulo (23:05 SP): antes das 6h SP
 * consideramos o dia anterior; a partir das 6h consideramos o dia corrente (execução manual no mesmo dia).
 */
export function endOfDayTargetDate(now: Date = new Date()): string {
  const today = todaySP(now);
  return hourSP(now) < 6 ? addDays(today, -1) : today;
}

export interface EndOfDayResult {
  data: string;
  concluidas: { schedule_id: string; unidade: string; tipo: AuditType; audit_id: string }[];
  nao_cumpridas: { schedule_id: string; unidade: string; tipo: AuditType; enviados: number; pulados: number }[];
  motivo?: string;
}

/**
 * Verificação das 23h: dias previstos sem auditoria concluída viram `nao_cumprida` e geram push para o
 * gerente e os proprietários. Se existir auditoria concluída para (unidade, tipo, data), a agenda é
 * marcada como `concluida` (defesa contra concluir sem atualizar a agenda). A loja NÃO é penalizada.
 */
export async function runEndOfDay(admin: AdminClient, opts: { data?: string } = {}): Promise<EndOfDayResult> {
  const data = opts.data ?? endOfDayTargetDate();
  const result: EndOfDayResult = { data, concluidas: [], nao_cumpridas: [] };

  const { data: rows, error } = await admin.from("schedule_days").select("*").eq("data", data).eq("status", "prevista");
  if (error) throw error;
  const previstas = (rows ?? []) as ScheduleDay[];
  if (previstas.length === 0) {
    result.motivo = "nenhum dia previsto pendente na data";
    return result;
  }

  const unitIds = Array.from(new Set(previstas.map((r) => r.unit_id)));
  const [{ data: units }, { data: audits }, owners] = await Promise.all([
    admin.from("units").select("id, nome").in("id", unitIds),
    admin.from("audits").select("id, unit_id, tipo").eq("data", data).eq("status", "concluida").in("unit_id", unitIds),
    ownerIds(admin),
  ]);
  const unitName = new Map((units ?? []).map((u) => [u.id as string, u.nome as string]));
  const concludedKey = new Map((audits ?? []).map((a) => [`${a.unit_id}:${a.tipo}`, a.id as string]));
  const mes = monthStart(data);

  let auditoresGerais: string[] | null = null;
  for (const row of previstas) {
    const nome = unitName.get(row.unit_id) ?? "unidade";
    const auditId = concludedKey.get(`${row.unit_id}:${row.tipo}`);
    if (auditId) {
      await admin.from("schedule_days").update({ status: "concluida", audit_id: auditId }).eq("id", row.id);
      result.concluidas.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, audit_id: auditId });
      continue;
    }

    const { error: upErr } = await admin.from("schedule_days").update({ status: "nao_cumprida" }).eq("id", row.id);
    if (upErr) throw upErr;

    let auditores: string[];
    if (row.auditor_id) auditores = [row.auditor_id];
    else {
      auditoresGerais ??= await activeGeneralAuditors(admin);
      auditores = auditoresGerais;
    }
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
    result.nao_cumpridas.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, enviados: a.enviados + o.enviados, pulados: a.pulados + o.pulados });
  }
  return result;
}

async function activeGeneralAuditors(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true);
  return (data ?? []).map((p) => p.id as string);
}
