import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMonthlyReports } from "@/lib/reports/generate";
import { getMonthOverview } from "./data/dashboard";
import { monthEnd, monthStart, todaySP } from "./dates";
import type { MonthlyClosing } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export interface CloseMonthResult {
  closings: MonthlyClosing[];
  reports: { loja: number; consolidado: number } | null;
  /** Preenchido quando o fechamento gravou mas a geração dos PDFs falhou. */
  reportWarning: string | null;
}

/** Mês pode ser fechado? Devolve a mensagem de bloqueio ou null. */
export function closingBlocker(mesInput: string, today = todaySP()): string | null {
  const mes = monthStart(mesInput);
  const current = monthStart(today);
  if (mes > current) return "Não é possível fechar um mês futuro.";
  if (mes === current && today < monthEnd(mes)) return "O mês ainda não terminou.";
  return null;
}

/**
 * Fecha o mês: congela a nota mensal de cada unidade ativa em `monthly_closings`
 * (ranking, elegibilidade, premiação, empate, selos) e dispara a geração dos PDFs.
 * O fechamento é gravado mesmo que a geração dos relatórios falhe (retorna aviso).
 * Deve ser chamado com o cliente admin (service_role) após validar o perfil do proprietário.
 */
export async function closeMonth(admin: AdminClient, mesInput: string, userId: string): Promise<CloseMonthResult> {
  const mes = monthStart(mesInput);
  const blocker = closingBlocker(mes);
  if (blocker) throw new Error(blocker);

  const { data: existing } = await admin.from("monthly_closings").select("id").eq("mes", mes).limit(1);
  if (existing && existing.length > 0) throw new Error("Este mês já está fechado.");

  const ov = await getMonthOverview(admin, mes);
  if (ov.closed) throw new Error("Este mês já está fechado.");

  const rankedById = new Map(ov.ranking.map((r) => [r.unit_id, r]));
  const rows = ov.units.map((um) => {
    const r = rankedById.get(um.unit.id);
    const s = um.summary;
    return {
      mes,
      unit_id: um.unit.id,
      nota_operacional: s.nota,
      nota_nutricional: um.nutri.nota,
      nota_seguranca: s.nota_seguranca,
      notas_blocos: s.notas_blocos,
      n_auditorias: s.n_auditorias,
      n_auditorias_nutri: um.nutri.n,
      falhas_graves: s.falhas_graves,
      amostra_reduzida: s.amostra_reduzida,
      inelegivel_produto_vencido: s.produto_vencido,
      posicao_ranking: r?.posicao ?? null,
      elegivel: r?.elegivel ?? false,
      premiada: r?.premiada ?? false,
      empate: r?.empate ?? false,
      fechado_por: userId,
    };
  });
  if (rows.length === 0) throw new Error("Nenhuma unidade ativa para fechar.");

  const { data: inserted, error } = await admin.from("monthly_closings").insert(rows).select("*");
  if (error) throw new Error(`Falha ao gravar o fechamento: ${error.message}`);

  let reports: CloseMonthResult["reports"] = null;
  let reportWarning: string | null = null;
  try {
    reports = await generateMonthlyReports(admin, mes, userId);
  } catch (e) {
    reportWarning = `Mês fechado, mas os relatórios não foram gerados: ${e instanceof Error ? e.message : String(e)}. Use "Gerar relatórios novamente".`;
  }

  return { closings: (inserted ?? []) as MonthlyClosing[], reports, reportWarning };
}

/** Reabre o mês: remove as linhas de fechamento (os relatórios já gerados permanecem listados até nova geração). */
export async function reopenMonth(admin: AdminClient, mesInput: string): Promise<number> {
  const mes = monthStart(mesInput);
  const { data, error } = await admin.from("monthly_closings").delete().eq("mes", mes).select("id");
  if (error) throw new Error(`Falha ao reabrir o mês: ${error.message}`);
  return data?.length ?? 0;
}

/** Gera (ou regera) os PDFs de um mês já fechado. */
export async function regenerateReports(admin: AdminClient, mesInput: string, userId: string): Promise<{ loja: number; consolidado: number }> {
  const mes = monthStart(mesInput);
  const { data: existing } = await admin.from("monthly_closings").select("id").eq("mes", mes).limit(1);
  if (!existing || existing.length === 0) throw new Error("O mês ainda não foi fechado.");
  return generateMonthlyReports(admin, mes, userId);
}
