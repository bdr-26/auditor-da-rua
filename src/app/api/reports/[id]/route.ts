import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORTS_BUCKET } from "@/lib/reports/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_TTL = 60 * 60 * 24 * 7;

/** Proprietários veem tudo; o gerente vê os relatórios mensais por loja (não o consolidado). */
async function load(id: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: NextResponse.json({ error: "id inválido" }, { status: 400 }) };
  const admin = createAdminClient();
  const { data: report } = await admin.from("reports").select("id, mes, tipo, storage_path, units(slug)").eq("id", id).maybeSingle();
  if (!report) return { error: NextResponse.json({ error: "relatório não encontrado" }, { status: 404 }) };
  const allowed = profile.role === "proprietario" || (profile.role === "auditor_geral" && report.tipo === "loja");
  if (!allowed) return { error: NextResponse.json({ error: "sem permissão" }, { status: 403 }) };
  const unit = report.units as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(unit) ? unit[0]?.slug : unit?.slug;
  const filename = `${report.tipo === "consolidado" ? "consolidado" : (slug ?? "loja")}-${String(report.mes).slice(0, 7)}.pdf`;
  return { admin, report: report as { storage_path: string }, filename };
}

/** Entrega o PDF de um relatório (bucket privado `reports`). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { data: file, error } = await r.admin.storage.from(REPORTS_BUCKET).download(r.report.storage_path);
  if (error || !file) return NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });
  const buf = Buffer.from(await file.arrayBuffer());
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${r.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Link assinado (7 dias) do relatório já gerado, para compartilhar. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { data: signed, error } = await r.admin.storage.from(REPORTS_BUCKET).createSignedUrl(r.report.storage_path, SHARE_TTL, { download: r.filename });
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "falha ao assinar" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: r.filename, expiresInDays: 7 });
}
