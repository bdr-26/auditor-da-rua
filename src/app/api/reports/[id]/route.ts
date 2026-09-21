import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORTS_BUCKET } from "@/lib/reports/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrega o PDF de um relatório (bucket privado `reports`). Só proprietários. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["proprietario"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: report } = await admin.from("reports").select("id, mes, tipo, storage_path, units(slug)").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "relatório não encontrado" }, { status: 404 });

  const { data: file, error } = await admin.storage.from(REPORTS_BUCKET).download(report.storage_path as string);
  if (error || !file) return NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });

  const unit = report.units as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(unit) ? unit[0]?.slug : unit?.slug;
  const filename = `${report.tipo === "consolidado" ? "consolidado" : (slug ?? "loja")}-${String(report.mes).slice(0, 7)}.pdf`;
  const buf = Buffer.from(await file.arrayBuffer());
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
