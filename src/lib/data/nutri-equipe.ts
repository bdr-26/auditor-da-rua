import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, monthStart, todaySP } from "../dates";
import { CONTROLE_TIPOS_ATIVOS } from "../nutri/controle-tipos";
import type { Audit, NutriAgendaItem, NutriControle, Unit } from "../types";
import { getNutriAgenda, getNutriTeam } from "./nutri-agenda";
import { getControles } from "./nutri-controles";
import { getVencimentos, type Vencimento } from "./nutri-vencimentos";
import { getNutriAudits } from "./nutri";
import { getUnits } from "./units";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface MembroStats {
  id: string;
  nome: string;
  nivel: "chefe" | "estagiaria" | null;
  auditoriasMes: number;
  mediaMes: number | null;
  ultimaVisita: string | null;
  rascunhos: number;
  controlesMes: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
}

export interface EquipeOverview {
  mes: string;
  today: string;
  membros: MembroStats[];
  rascunhos: Audit[];
  controlesRascunho: NutriControle[];
  /** conferência: por unidade × tipo de controle, quantos finalizados no mês */
  conferencia: { unit: Unit; porTipo: Record<string, number> }[];
  agendaHoje: NutriAgendaItem[];
  agendaAtrasada: NutriAgendaItem[];
  units: Unit[];
  /** vencidos e vencendo em 30 dias (pasta de documentação, ASO) */
  vencimentos: Vencimento[];
}

/** Visão da nutricionista chefe: equipe, rascunhos abertos, conferência dos controles e agenda. */
export async function getEquipeOverview(supabase: AnyClient, mesInput?: string): Promise<EquipeOverview> {
  const today = todaySP();
  const mes = monthStart(mesInput ?? today);
  const fim = addMonths(mes, 1);
  const [team, units, auditsMes, rascunhos, controlesMes, controlesRascunho, agenda] = await Promise.all([
    getNutriTeam(supabase),
    getUnits(supabase),
    getNutriAudits(supabase, { status: "concluida" }),
    getNutriAudits(supabase, { status: "rascunho" }),
    getControles(supabase, { from: mes, to: fim, status: "finalizado" }),
    getControles(supabase, { status: "rascunho", limit: 50 }),
    getNutriAgenda(supabase, { from: addMonths(mes, -1), to: fim, status: ["prevista"] }),
  ]);
  const doMes = auditsMes.filter((a) => a.data >= mes && a.data < fim);
  const vencimentos = await getVencimentos(supabase, units);

  const membros: MembroStats[] = team.map((m) => {
    const minhas = doMes.filter((a) => a.auditor_id === m.id);
    const notas = minhas.map((a) => a.nota_final).filter((n): n is number => n != null);
    const todas = auditsMes.filter((a) => a.auditor_id === m.id);
    const tarefas = agenda.filter((t) => t.responsavel_id === m.id);
    return {
      id: m.id,
      nome: m.nome,
      nivel: m.nutri_nivel,
      auditoriasMes: minhas.length,
      mediaMes: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
      ultimaVisita: todas[0]?.data ?? null,
      rascunhos: rascunhos.filter((a) => a.auditor_id === m.id).length,
      controlesMes: controlesMes.filter((c) => c.responsavel_id === m.id).length,
      tarefasPendentes: tarefas.filter((t) => t.data >= today).length,
      tarefasAtrasadas: tarefas.filter((t) => t.data < today).length,
    };
  });

  const conferencia = units
    .filter((u) => u.ativa)
    .map((unit) => {
      const porTipo: Record<string, number> = {};
      for (const t of CONTROLE_TIPOS_ATIVOS) porTipo[t.codigo] = controlesMes.filter((c) => c.unit_id === unit.id && c.tipo === t.codigo).length;
      return { unit, porTipo };
    });

  return {
    mes,
    today,
    membros,
    rascunhos,
    controlesRascunho,
    conferencia,
    agendaHoje: agenda.filter((t) => t.data === today),
    agendaAtrasada: agenda.filter((t) => t.data < today),
    units,
    vencimentos,
  };
}
