import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron/auth";
import { runEndOfDay } from "@/lib/cron/end-of-day";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verificação das 23h (02:05 UTC do dia seguinte via vercel.json). Protegido por CRON_SECRET.
 * Query opcional: ?data=YYYY-MM-DD. Sem `data`, usa o dia anterior em SP quando a hora SP < 6h
 * (execução noturna), senão o dia corrente (ver endOfDayTargetDate).
 */
async function handle(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error, detalhe: auth.detalhe }, { status: auth.status });
  const data = new URL(req.url).searchParams.get("data") ?? undefined;
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: "data inválida (YYYY-MM-DD)" }, { status: 400 });
  try {
    const result = await runEndOfDay(createAdminClient(), { data });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron] end-of-day falhou", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
