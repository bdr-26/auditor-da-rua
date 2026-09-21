import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthStart } from "../dates";
import { buildMonthlyReportData } from "./data";
import { renderConsolidadoReport, renderLojaReport } from "./render";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export const REPORTS_BUCKET = "reports";

async function uploadPdf(admin: AdminClient, path: string, pdf: Buffer): Promise<void> {
  const { error } = await admin.storage.from(REPORTS_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`falha ao salvar ${path}: ${error.message}`);
}

/**
 * Gera os relatórios mensais (1 PDF por loja ranqueada + Moema Produção, e o consolidado do grupo),
 * salva no bucket privado `reports` em `YYYY-MM/<slug>.pdf` e registra em `reports`.
 * Idempotente: sobrescreve arquivos e substitui as linhas do mesmo mês/unidade/tipo.
 *
 * @param admin cliente service_role
 * @param mes   'YYYY-MM-01'
 * @param userId perfil do proprietário que solicitou (reports.gerado_por)
 */
export async function generateMonthlyReports(admin: AdminClient, mes: string, userId: string): Promise<{ loja: number; consolidado: number }> {
  const mesNorm = monthStart(mes);
  const prefix = mesNorm.slice(0, 7);
  const bundle = await buildMonthlyReportData(admin, mesNorm);

  let loja = 0;
  for (const data of bundle.lojas) {
    const pdf = await renderLojaReport(data);
    const path = `${prefix}/${data.unidade.slug}.pdf`;
    await uploadPdf(admin, path, pdf);
    await admin.from("reports").delete().eq("mes", mesNorm).eq("tipo", "loja").eq("unit_id", data.unidade.id);
    const { error } = await admin.from("reports").insert({ mes: mesNorm, unit_id: data.unidade.id, tipo: "loja", storage_path: path, gerado_por: userId });
    if (error) throw error;
    loja++;
  }

  const pdf = await renderConsolidadoReport(bundle.consolidado);
  const path = `${prefix}/consolidado.pdf`;
  await uploadPdf(admin, path, pdf);
  await admin.from("reports").delete().eq("mes", mesNorm).eq("tipo", "consolidado");
  const { error } = await admin.from("reports").insert({ mes: mesNorm, unit_id: null, tipo: "consolidado", storage_path: path, gerado_por: userId });
  if (error) throw error;

  return { loja, consolidado: 1 };
}
