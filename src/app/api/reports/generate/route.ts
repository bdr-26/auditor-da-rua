import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { monthStart } from "@/lib/dates";
import { generateMonthlyReports } from "@/lib/reports/generate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** (Re)gera os relatórios de um mês. Body: { "mes": "YYYY-MM" | "YYYY-MM-01" }. Só proprietários. */
export async function POST(req: Request) {
  const profile = await requireProfile(["proprietario"]);
  let body: { mes?: string } = {};
  try {
    body = (await req.json()) as { mes?: string };
  } catch {
    // body vazio → erro abaixo
  }
  const mesRaw = typeof body.mes === "string" ? body.mes.trim() : "";
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(mesRaw)) return NextResponse.json({ error: "informe mes no formato YYYY-MM" }, { status: 400 });
  const mes = monthStart(mesRaw.length === 7 ? `${mesRaw}-01` : mesRaw);
  try {
    const result = await generateMonthlyReports(createAdminClient(), mes, profile.id);
    return NextResponse.json({ ok: true, mes, ...result });
  } catch (e) {
    console.error("[reports] geração falhou", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
