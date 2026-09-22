import "server-only";

/**
 * Autoriza chamadas aos endpoints de cron (/api/cron/*).
 * Aceita `Authorization: Bearer ${CRON_SECRET}` (formato enviado automaticamente pelo Vercel Cron)
 * ou `?secret=${CRON_SECRET}` (útil para testes manuais e para o pg_cron).
 *
 * Tolerâncias para evitar "não autorizado" por detalhe de cópia: espaços/aspas em volta do valor
 * (no Vercel ou no link) e o `+` do segredo, que a URL transformaria em espaço.
 */
export type CronAuth = { ok: true } | { ok: false; status: 401 | 500; error: string; detalhe?: string };

const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");

export function checkCronAuth(req: Request): CronAuth {
  const secret = clean(process.env.CRON_SECRET);
  if (!secret) return { ok: false, status: 500, error: "CRON_SECRET não configurado" };

  const header = req.headers.get("authorization") ?? "";
  const bearer = clean(header.startsWith("Bearer ") ? header.slice(7) : "");
  const url = new URL(req.url);
  const query = clean(url.searchParams.get("secret"));
  // valor cru da query (sem decodificar): preserva `+` e `%xx` como foram digitados
  const raw = clean((url.search.match(/[?&]secret=([^&]*)/) ?? [])[1]);
  const candidates = [bearer, query, raw, query.replace(/ /g, "+")].filter(Boolean);
  if (candidates.some((c) => c === secret)) return { ok: true };

  const recebido = bearer || query || raw;
  const detalhe = !recebido
    ? "nenhum segredo recebido: use ?secret=... na URL ou o cabeçalho Authorization: Bearer ..."
    : `o segredo recebido (${recebido.length} caracteres) é diferente do CRON_SECRET configurado (${secret.length} caracteres)${recebido.length === secret.length ? "; mesmo tamanho, confira letra a letra" : ""}`;
  return { ok: false, status: 401, error: "não autorizado", detalhe };
}
