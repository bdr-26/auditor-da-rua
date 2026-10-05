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
  const { data: units } = await admin.from("units").select("id, nome, endereco, em_abertura").in("id", unitIds);
  const emAbertura = new Set((units ?? []).filter((u) => u.em_abertura).map((u) => u.id as string));
  const unitName = new Map((units ?? []).map((u) => [u.id as string, u.nome as string]));
  const unitAddr = new Map((units ?? []).map((u) => [u.id as string, (u.endereco as string | null) ?? null]));

  // demandas abertas por responsável (entram no corpo do lembrete)
  const { data: abertas } = await admin.from("demandas").select("responsavel_id, prazo, unit_id, categoria").in("status", ["aberta", "em_andamento"]);
  const demandasPor = new Map<string, { total: number; atrasadas: number }>();
  const checklistPorUnidade = new Map<string, number>();
  for (const d of (abertas ?? []) as { responsavel_id: string; prazo: string | null; unit_id: string | null; categoria: string }[]) {
    if (d.categoria === "checklist_abertura" && d.unit_id) checklistPorUnidade.set(d.unit_id, (checklistPorUnidade.get(d.unit_id) ?? 0) + 1);
    const cur = demandasPor.get(d.responsavel_id) ?? { total: 0, atrasadas: 0 };
    cur.total++;
    if (d.prazo && d.prazo < data) cur.atrasadas++;
    demandasPor.set(d.responsavel_id, cur);
  }
  const corpoPara = (userId: string, endereco: string | null) => {
    const parts = [endereco ?? "Toque para abrir a agenda e iniciar"];
    const dm = demandasPor.get(userId);
    if (dm && dm.total > 0) parts.push(`${dm.total} demanda${dm.total === 1 ? "" : "s"} aberta${dm.total === 1 ? "" : "s"}${dm.atrasadas ? ` (${dm.atrasadas} atrasada${dm.atrasadas === 1 ? "" : "s"})` : ""}`);
    return parts.join(" · ");
  };

  let auditoresGerais: string[] | null = null;
  for (const row of previstas) {
    let destinatarios: string[];
    if (row.auditor_id) destinatarios = [row.auditor_id];
    else {
      auditoresGerais ??= await activeGeneralAuditors(admin);
      destinatarios = auditoresGerais;
    }
    const nome = unitName.get(row.unit_id) ?? "unidade";
    const abertura = emAbertura.has(row.unit_id);
    const titulo = abertura ? `Hoje: visita de abertura — ${nome}` : `Hoje: ${AUDIT_TYPE_LABELS[row.tipo]} — ${nome}`;
    const itensChecklist = checklistPorUnidade.get(row.unit_id) ?? 0;
    let enviados = 0;
    let pulados = 0;
    for (const userId of destinatarios) {
      const r = await sendPushToUsers(admin, [userId], "lembrete_8h", `lembrete:${data}`, {
        titulo,
        corpo: abertura ? `Checklist de abertura: ${itensChecklist} item${itensChecklist === 1 ? "" : "ns"} em aberto${unitAddr.get(row.unit_id) ? ` · ${unitAddr.get(row.unit_id)}` : ""}` : corpoPara(userId, unitAddr.get(row.unit_id) ?? null),
        url: appUrl(abertura ? `/auditor/demandas?loja=${row.unit_id}` : `/auditor?data=${data}`),
        tag: `lembrete-${data}`,
      });
      enviados += r.enviados;
      pulados += r.pulados;
    }
    result.lembretes.push({ schedule_id: row.id, unidade: nome, tipo: row.tipo, destinatarios: destinatarios.length, enviados, pulados, titulo });
  }
  return result;
}

async function activeGeneralAuditors(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "auditor_geral").eq("ativo", true);
  return (data ?? []).map((p) => p.id as string);
}
