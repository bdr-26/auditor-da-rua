import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { monthStart } from "@/lib/dates";
import { buildNutriMonthlyReport, nutriMonthlyFileName } from "@/lib/reports/nutri-data";
import { renderNutriMonthlyReport } from "@/lib/reports/render";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHARE_TTL = 60 * 60 * 24 * 7;

async function prepare(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (profile.role !== "proprietario" && profile.role !== "auditor_nutricao") return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unit") ?? "";
  const mesParam = url.searchParams.get("mes") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(unitId) || !/^\d{4}-\d{2}(-\d{2})?$/.test(mesParam)) return { error: NextResponse.json({ error: "parâmetros inválidos (unit, mes)" }, { status: 400 }) };
  const mes = monthStart(mesParam.length === 7 ? `${mesParam}-01` : mesParam);
  const admin = createAdminClient();
  const { data: unit } = await admin.from("units").select("slug").eq("id", unitId).maybeSingle();
  if (!unit) return { error: NextResponse.json({ error: "unidade não encontrada" }, { status: 404 }) };
  const data = await buildNutriMonthlyReport(admin, unitId, mes);
  if (!data) return { error: NextResponse.json({ error: "unidade não encontrada" }, { status: 404 }) };
  const pdf = await renderNutriMonthlyReport(data);
  return { admin, unitId, mes, slug: unit.slug as string, pdf, name: nutriMonthlyFileName(unit.slug as string, mes), download: url.searchParams.get("download") === "1" };
}

/** PDF mensal nutricional da unidade: `?unit=<id>&mes=YYYY-MM`. */
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

/** Guarda o PDF mensal no Storage e devolve link assinado (7 dias) para compartilhar. */
export async function POST(req: Request) {
  const r = await prepare(req);
  if ("error" in r) return r.error;
  const path = `nutri/mensal/${r.unitId}/${r.mes.slice(0, 7)}.pdf`;
  const { error: upErr } = await r.admin.storage.from(REPORTS_BUCKET).upload(path, r.pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await r.admin.storage.from(REPORTS_BUCKET).createSignedUrl(path, SHARE_TTL, { download: r.name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: r.name, expiresInDays: 7 });
}
