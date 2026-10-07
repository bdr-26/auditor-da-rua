import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildControleMonthlyReport, controleFileName } from "@/lib/reports/controle-data";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { renderControleReport } from "@/lib/reports/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SHARE_TTL = 60 * 60 * 24 * 7;

async function prepare(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (profile.role !== "proprietario" && profile.role !== "auditor_nutricao") return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const sp = new URL(req.url).searchParams;
  const unit = sp.get("unit") ?? "";
  const tipo = sp.get("tipo") ?? "";
  const mes = sp.get("mes") ?? "";
  if (!unit || !tipo || !/^\d{4}-\d{2}(-\d{2})?$/.test(mes)) return { error: NextResponse.json({ error: "informe unit, tipo e mes (YYYY-MM)" }, { status: 400 }) };
  const admin = createAdminClient();
  const data = await buildControleMonthlyReport(admin, unit, tipo, mes.length === 7 ? `${mes}-01` : mes);
  if (!data) return { error: NextResponse.json({ error: "unidade ou tipo não encontrado" }, { status: 404 }) };
  const { data: u } = await admin.from("units").select("slug").eq("id", unit).maybeSingle();
  const name = controleFileName((u?.slug as string | undefined) ?? "unidade", tipo, mes.slice(0, 7));
  return { admin, data, name, path: `nutri/controles/mensal/${unit}/${tipo}-${mes.slice(0, 7)}.pdf` };
}

/** Compilação mensal (inline; `?download=1` baixa). */
export async function GET(req: Request) {
  try {
    const p = await prepare(req);
    if ("error" in p) return p.error;
    const pdf = await renderControleReport(p.data);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${p.name}"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[controle-mensal]", e);
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const p = await prepare(req);
  if ("error" in p) return p.error;
  let pdf: Buffer;
  try {
    pdf = await renderControleReport(p.data);
  } catch (e) {
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  const { error: upErr } = await p.admin.storage.from(REPORTS_BUCKET).upload(p.path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await p.admin.storage.from(REPORTS_BUCKET).createSignedUrl(p.path, SHARE_TTL, { download: p.name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: p.name, expiresInDays: 7 });
}
