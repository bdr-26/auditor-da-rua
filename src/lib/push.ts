import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export interface PushPayload {
  titulo: string;
  corpo: string;
  url: string;
  tag?: string;
}

function configured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Envia um Web Push para os usuários informados. `tipo` + `chaveDedup` evitam envio duplicado
 * (registro em notifications_log). Falhas 404/410 removem a subscription expirada.
 * Usar com o cliente admin.
 */
export async function sendPushToUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  userIds: string[],
  tipo: string,
  chaveDedup: string,
  payload: PushPayload,
): Promise<{ enviados: number; pulados: number }> {
  if (userIds.length === 0) return { enviados: 0, pulados: 0 };
  if (!configured()) {
    console.warn("[push] VAPID não configurado — notificação não enviada:", payload.titulo);
    return { enviados: 0, pulados: userIds.length };
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contato@burgerdarua.com.br",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  let enviados = 0;
  let pulados = 0;
  for (const userId of userIds) {
    // dedup por usuário + chave
    const { error: logErr } = await admin.from("notifications_log").insert({
      user_id: userId,
      tipo,
      chave_dedup: chaveDedup,
      titulo: payload.titulo,
      corpo: payload.corpo,
      url: payload.url,
    });
    if (logErr) {
      pulados++;
      continue; // já enviado
    }
    const { data: subs } = await admin.from("push_subscriptions").select("id, subscription").eq("user_id", userId);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("[push] falha ao enviar", e);
      }
    }
  }
  return { enviados, pulados };
}

/** Ids dos proprietários ativos. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ownerIds(admin: SupabaseClient<any, any, any>): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "proprietario").eq("ativo", true);
  return (data ?? []).map((p) => p.id as string);
}

export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}
