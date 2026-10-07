import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, weekday } from "../dates";
import type { NutriRotina } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

/** Datas do intervalo [from, to] em que a rotina prevê visita. */
export function datasDaRotina(r: Pick<NutriRotina, "frequencia" | "dias_semana" | "dia_mes">, from: string, to: string): string[] {
  const out: string[] = [];
  const dias = new Set(r.dias_semana.map(Number));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (r.frequencia === "mensal") {
      if (r.dia_mes != null && Number(d.slice(8, 10)) === r.dia_mes) out.push(d);
    } else if (dias.has(weekday(d))) out.push(d);
  }
  return out;
}

export interface MaterializeResult {
  criadas: number;
  rotinas: number;
}

/**
 * Materializa a rotina padrão na `nutri_agenda` no intervalo: uma tarefa por rotina ativa e data,
 * sem duplicar (índice único rotina_id + data). Pula unidades inativas ou em abertura e
 * responsáveis inativas. Idempotente — chamada pelo cron diário e pelo botão "Gerar agenda".
 */
export async function materializeNutriRotinas(admin: AdminClient, from: string, to: string, criadoPor: string | null = null): Promise<MaterializeResult> {
  const [{ data: rotinas }, { data: units }, { data: team }] = await Promise.all([
    admin.from("nutri_rotinas").select("*").eq("ativa", true),
    admin.from("units").select("id, ativa, em_abertura"),
    admin.from("profiles").select("id, ativo").eq("role", "auditor_nutricao"),
  ]);
  const unitOk = new Set((units ?? []).filter((u) => u.ativa && !u.em_abertura).map((u) => u.id as string));
  const respOk = new Set((team ?? []).filter((p) => p.ativo).map((p) => p.id as string));
  const ativas = ((rotinas ?? []) as NutriRotina[]).filter((r) => unitOk.has(r.unit_id) && respOk.has(r.responsavel_id));

  const rows: Record<string, unknown>[] = [];
  for (const r of ativas) {
    for (const data of datasDaRotina({ ...r, dias_semana: (r.dias_semana ?? []).map(Number), dia_mes: r.dia_mes == null ? null : Number(r.dia_mes) }, from, to)) {
      rows.push({ data, responsavel_id: r.responsavel_id, unit_id: r.unit_id, tipo: r.tipo, descricao: r.descricao, status: "prevista", criado_por: criadoPor, rotina_id: r.id });
    }
  }
  if (rows.length === 0) return { criadas: 0, rotinas: ativas.length };

  // já existentes (rotina_id + data) — o upsert ignora duplicadas, mas contamos o que é novo
  const { data: existentes } = await admin.from("nutri_agenda").select("rotina_id, data").not("rotina_id", "is", null).gte("data", from).lte("data", to);
  const have = new Set((existentes ?? []).map((e) => `${e.rotina_id}:${e.data}`));
  const novas = rows.filter((r) => !have.has(`${r.rotina_id}:${r.data}`));
  if (novas.length === 0) return { criadas: 0, rotinas: ativas.length };
  const { error } = await admin.from("nutri_agenda").upsert(novas, { onConflict: "rotina_id,data", ignoreDuplicates: true });
  if (error) throw error;
  return { criadas: novas.length, rotinas: ativas.length };
}
