import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { monthEnd, monthStart } from "@/lib/dates";
import { buildDossieReport } from "@/lib/reports/controle-data";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { renderDossieReport } from "@/lib/reports/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SHARE_TTL = 60 * 60 * 24 * 7;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Arquivo de registros em PDF: todos os controles finalizados de uma unidade num período.
 * `?unit=&mes=YYYY-MM` (mês) ou `?unit=&from=YYYY-MM-DD&to=YYYY-MM-DD` (período livre, máx. 366 dias).
 */
async function prepare(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (profile.role !== "proprietario" && profile.role !== "auditor_nutricao") return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const sp = new URL(req.url).searchParams;
  const unit = sp.get("unit") ?? "";
  const mes = sp.get("mes") ?? "";
  let from = sp.get("from") ?? "";
  let to = sp.get("to") ?? "";
  if (/^\d{4}-\d{2}$/.test(mes)) {
    from = monthStart(`${mes}-01`);
    to = monthEnd(from);
  }
  if (!unit || !YMD.test(from) || !YMD.test(to) || from > to) return { error: NextResponse.json({ error: "informe unit e mes (YYYY-MM) ou from/to (YYYY-MM-DD)" }, { status: 400 }) };
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 366) return { error: NextResponse.json({ error: "período máximo de 1 ano" }, { status: 400 }) };
  const admin = createAdminClient();
  const data = await buildDossieReport(admin, unit, from, to);
  if (!data) return { error: NextResponse.json({ error: "unidade não encontrada" }, { status: 404 }) };
  const { data: u } = await admin.from("units").select("slug").eq("id", unit).maybeSingle();
  const slug = (u?.slug as string | undefined) ?? "unidade";
  const sufixo = /^\d{4}-\d{2}$/.test(mes) ? mes : `${from}_${to}`;
  return { admin, data, name: `arquivo-registros-${slug}-${sufixo}.pdf`, path: `nutri/controles/arquivo/${unit}/${sufixo}.pdf` };
}

/** Inline (imprimir no navegador); `?download=1` baixa. */
export async function GET(req: Request) {
  try {
    const p = await prepare(req);
    if ("error" in p) return p.error;
    const pdf = await renderDossieReport(p.data);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${p.name}"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[controle-dossie]", e);
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

/** Gera, guarda no bucket e devolve link assinado de 7 dias (WhatsApp). */
export async function POST(req: Request) {
  const p = await prepare(req);
  if ("error" in p) return p.error;
  let pdf: Buffer;
  try {
    pdf = await renderDossieReport(p.data);
  } catch (e) {
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  const { error: upErr } = await p.admin.storage.from(REPORTS_BUCKET).upload(p.path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await p.admin.storage.from(REPORTS_BUCKET).createSignedUrl(p.path, SHARE_TTL, { download: p.name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: p.name, expiresInDays: 7 });
}
