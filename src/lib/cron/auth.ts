import "server-only";

/**
 * Autoriza chamadas aos endpoints de cron (/api/cron/*).
 * Aceita `Authorization: Bearer ${CRON_SECRET}` (formato enviado automaticamente pelo Vercel Cron)
 * ou `?secret=${CRON_SECRET}` (útil para testes manuais e para o pg_cron).
 */
export type CronAuth = { ok: true } | { ok: false; status: 401 | 500; error: string };

export function checkCronAuth(req: Request): CronAuth {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 500, error: "CRON_SECRET não configurado" };
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  if (bearer === secret || query === secret) return { ok: true };
  return { ok: false, status: 401, error: "não autorizado" };
}
