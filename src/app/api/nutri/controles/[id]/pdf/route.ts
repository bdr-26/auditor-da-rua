import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildControleReport, controleFileName } from "@/lib/reports/controle-data";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { renderControleReport } from "@/lib/reports/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SHARE_TTL = 60 * 60 * 24 * 7;

async function authorize(id: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (profile.role !== "proprietario" && profile.role !== "auditor_nutricao") return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const admin = createAdminClient();
  const { data: c } = await admin.from("nutri_controles").select("id, tipo, data, units(slug)").eq("id", id).maybeSingle();
  if (!c) return { error: NextResponse.json({ error: "controle não encontrado" }, { status: 404 }) };
  const u = c.units as { slug?: string } | { slug?: string }[] | null;
  const slug = (Array.isArray(u) ? u[0]?.slug : u?.slug) ?? "unidade";
  return { admin, name: controleFileName(slug, c.tipo as string, c.data as string) };
}

/** PDF de um controle (inline; `?download=1` baixa). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await authorize(id);
    if ("error" in auth) return auth.error;
    const data = await buildControleReport(auth.admin, id);
    if (!data) return NextResponse.json({ error: "controle não encontrado" }, { status: 404 });
    const pdf = await renderControleReport(data);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${auth.name}"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[controle-pdf]", e);
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

/** Guarda no Storage e devolve link assinado (7 dias) para compartilhar. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  const data = await buildControleReport(auth.admin, id);
  if (!data) return NextResponse.json({ error: "controle não encontrado" }, { status: 404 });
  let pdf: Buffer;
  try {
    pdf = await renderControleReport(data);
  } catch (e) {
    return NextResponse.json({ error: `falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  const path = `nutri/controles/${id}.pdf`;
  const { error: upErr } = await auth.admin.storage.from(REPORTS_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await auth.admin.storage.from(REPORTS_BUCKET).createSignedUrl(path, SHARE_TTL, { download: auth.name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: auth.name, expiresInDays: 7 });
}
