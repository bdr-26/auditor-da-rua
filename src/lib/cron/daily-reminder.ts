import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_TYPE_LABELS } from "../constants";
import { todaySP } from "../dates";
import { appUrl, sendPushToUsers } from "../push";
import { ensureSchedule } from "../schedule-sync";
import type { AuditType, ScheduleDay } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export interface DailyReminderResult {
  data: string;
  agenda_criada: number;
  lembretes: {
    schedule_id: string;
    unidade: string;
    tipo: AuditType;
    destinatarios: number;
    enviados: number;
    pulados: number;
    titulo: string;
  }[];
  motivo?: string;
}

/**
 * Lembrete das 8h (ter–dom): garante a agenda materializada e avisa o gerente sobre a auditoria
 * prevista para hoje. Dedup por `lembrete:${data}` — pode ser chamado mais de uma vez no dia.
 */
export async function runDailyReminder(admin: AdminClient, opts: { data?: string } = {}): Promise<DailyReminderResult> {
  const agendaCriada = await ensureSchedule(admin);
  const data = opts.data ?? todaySP();

  const { data: rows, error } = await admin.from("schedule_days").select("*").eq("data", data);
  if (error) throw error;
  const previstas = ((rows ?? []) as ScheduleDay[]).filter((r) => r.status === "prevista");
  const result: DailyReminderResult = { data, agenda_criada: agendaCriada, lembretes: [] };
  if (previstas.length === 0) {
    result.motivo = (rows ?? []).length === 0 ? "sem auditoria prevista para a data" : "agenda do dia já concluída/encerrada";
    return result;
  }

  const unitIds = Array.from(new Set(previstas.map((r) => r.unit_id)));
  const { data: units } = await admin.from("units").select("id, nome").in("id", unitIds);
  const unitName = new Map((units ?? []).map((u) => [u.id as string, u.nome as string]));

  let auditoresGerais: string[] | null = null;
  for (const row of previstas) {
    let destinatarios: string[];
    if (row.auditor_id) destinatarios = [row.auditor_id];
    else {
      auditoresGerais ??= await activeGeneralAuditors(admin);
      destinatarios = auditoresGerais;
    }
    const nome = unitName.get(row.unit_id) ?? "unidade";
    const titulo = `Hoje: ${AUDIT_TYPE_LABELS[row.tipo]} — ${nome}`;
    const { enviados, pulados } = await sendPushToUsers(admin, destinatarios, "lembrete_8h", `lembrete:${data}`, {
      titulo,
      corpo: "Toque para abrir a agenda e iniciar",
      url: appUrl(`/auditor?data=${data}`),
      tag: `lembrete-${data}`,
    });
    result.lembretes.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, destinatarios: destinatarios.length, enviados, pulados, titulo });
  }
  return result;
}

async function activeGeneralAuditors(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true);
  return (data ?? []).map((p) => p.id as string);
}
