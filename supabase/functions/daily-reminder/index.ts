// Edge Function: lembrete das 8h (ter–dom). Alternativa Supabase-nativa ao /api/cron/daily-reminder.
// Deploy: supabase functions deploy daily-reminder --no-verify-jwt
// Segredos: CRON_SECRET, APP_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createAdminClient, isAuthorized, json, runDailyReminder, todaySP } from "../_shared/lib.ts";

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) return json({ error: "não autorizado" }, 401);
  const data = new URL(req.url).searchParams.get("data") ?? todaySP();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return json({ error: "data inválida (YYYY-MM-DD)" }, 400);
  try {
    const result = await runDailyReminder(createAdminClient(), data);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[daily-reminder] falhou", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
