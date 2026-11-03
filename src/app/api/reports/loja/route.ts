import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { formatMonthPT, monthStart } from "@/lib/dates";
import { buildMonthlyReportData } from "@/lib/reports/data";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { renderLojaReport, renderLojaResumoReport } from "@/lib/reports/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHARE_TTL = 60 * 60 * 24 * 7;

/**
 * Relatório mensal de UMA loja, sempre gerado na hora: oficial quando o mês está fechado
 * (lê `monthly_closings`), prévia quando ainda está aberto. Proprietários e o gerente.
 */
async function prepare(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (profile.role !== "proprietario" && profile.role !== "auditor_geral") return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unit") ?? "";
  const mesParam = url.searchParams.get("mes") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(unitId) || !/^\d{4}-\d{2}(-\d{2})?$/.test(mesParam)) return { error: NextResponse.json({ error: "parâmetros inválidos (unit, mes)" }, { status: 400 }) };
  const mes = monthStart(mesParam.length === 7 ? `${mesParam}-01` : mesParam);
  const admin = createAdminClient();
  const bundle = await buildMonthlyReportData(admin, mes, { unitIds: [unitId] });
  const data = bundle.lojas.find((l) => l.unidade.id === unitId);
  if (!data) return { error: NextResponse.json({ error: "unidade sem relatório mensal (inativa, fora do ranking ou só da nutrição)" }, { status: 404 }) };
  // versão resumida (uma página, para o grupo dos supervisores) é o padrão; `versao=completo` traz tudo
  const completo = url.searchParams.get("versao") === "completo";
  const pdf = completo ? await renderLojaReport(data) : await renderLojaResumoReport(data);
  const name = `${completo ? "relatorio" : "resumo"}-${data.unidade.slug}-${mes.slice(0, 7)}${data.oficial ? "" : "-previa"}.pdf`;
  return { admin, unitId, mes, data, pdf, name, completo, download: url.searchParams.get("download") === "1" };
}

/** PDF mensal da loja: `?unit=<id>&mes=YYYY-MM` (`&versao=completo` para a versão completa, `&download=1` para baixar). */
export async function GET(req: Request) {
  const r = await prepare(req);
  if ("error" in r) return r.error;
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${r.download ? "attachment" : "inline"}; filename="${r.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Guarda o PDF no Storage (`loja/<unit>/<mes>.pdf`) e devolve link assinado (7 dias) para o WhatsApp. */
export async function POST(req: Request) {
  const r = await prepare(req);
  if ("error" in r) return r.error;
  const path = `loja/${r.unitId}/${r.mes.slice(0, 7)}${r.completo ? "-completo" : "-resumo"}${r.data.oficial ? "" : "-previa"}.pdf`;
  const { error: upErr } = await r.admin.storage.from(REPORTS_BUCKET).upload(path, r.pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await r.admin.storage.from(REPORTS_BUCKET).createSignedUrl(path, SHARE_TTL, { download: r.name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: r.name, expiresInDays: 7, titulo: `${r.data.unidade.nome} · ${formatMonthPT(r.mes)}` });
}
