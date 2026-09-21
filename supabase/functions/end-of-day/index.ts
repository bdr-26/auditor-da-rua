// Edge Function: verificação das 23h (rotina não cumprida). Alternativa Supabase-nativa ao /api/cron/end-of-day.
// Deploy: supabase functions deploy end-of-day --no-verify-jwt
// Segredos: CRON_SECRET, APP_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createAdminClient, endOfDayTargetDate, isAuthorized, json, runEndOfDay } from "../_shared/lib.ts";

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) return json({ error: "não autorizado" }, 401);
  const data = new URL(req.url).searchParams.get("data") ?? endOfDayTargetDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return json({ error: "data inválida (YYYY-MM-DD)" }, 400);
  try {
    const result = await runEndOfDay(createAdminClient(), data);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[end-of-day] falhou", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
