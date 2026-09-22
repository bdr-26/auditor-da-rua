import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildGerenteAuditReport, gerenteAuditFileName } from "@/lib/reports/gerente-data";
import { REPORTS_BUCKET } from "@/lib/reports/generate";
import { renderGerenteAuditReport } from "@/lib/reports/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHARE_TTL = 60 * 60 * 24 * 7; // 7 dias

async function authorize(auditId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: audit } = await admin.from("audits").select("id, auditor_id, tipo, data, units(slug)").eq("id", auditId).maybeSingle();
  if (!audit || audit.tipo === "nutricional") return { error: NextResponse.json({ error: "auditoria não encontrada" }, { status: 404 }) };
  if (profile.role !== "proprietario" && audit.auditor_id !== profile.id) return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const u = audit.units as { slug?: string } | { slug?: string }[] | null;
  const slug = (Array.isArray(u) ? u[0]?.slug : u?.slug) ?? "unidade";
  return { admin, audit: audit as { id: string; tipo: string; data: string }, slug };
}

/** PDF da auditoria do gerente (inline para ver/imprimir; `?download=1` baixa). */
export async function GET(req: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const auth = await authorize(auditId);
  if ("error" in auth) return auth.error;
  const data = await buildGerenteAuditReport(auth.admin, auditId);
  if (!data) return NextResponse.json({ error: "auditoria não encontrada" }, { status: 404 });
  const pdf = await renderGerenteAuditReport(data);
  const name = gerenteAuditFileName(auth.slug, auth.audit.tipo, auth.audit.data);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}

/** Guarda o PDF no Storage e devolve link assinado (7 dias) para compartilhar. */
export async function POST(_req: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const auth = await authorize(auditId);
  if ("error" in auth) return auth.error;
  const data = await buildGerenteAuditReport(auth.admin, auditId);
  if (!data) return NextResponse.json({ error: "auditoria não encontrada" }, { status: 404 });
  const pdf = await renderGerenteAuditReport(data);
  const name = gerenteAuditFileName(auth.slug, auth.audit.tipo, auth.audit.data);
  const path = `gerente/auditorias/${auditId}.pdf`;
  const { error: upErr } = await auth.admin.storage.from(REPORTS_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed, error: signErr } = await auth.admin.storage.from(REPORTS_BUCKET).createSignedUrl(path, SHARE_TTL, { download: name });
  if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: name, expiresInDays: 7 });
}
