"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "unsupported" | "denied" | "off" | "on" | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Botão para ativar/desativar notificações push neste aparelho. */
export function PushOptIn({ compact, dark }: { compact?: boolean; dark?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setStatus("loading");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("VAPID não configurado");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("falha ao salvar subscription");
      setStatus("on");
    } catch (e) {
      console.error(e);
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setStatus("off");
  }

  if (status === "unsupported") return null;
  const Icon = status === "on" ? BellRing : status === "denied" ? BellOff : Bell;
  const label = status === "on" ? "Notificações ativas" : status === "denied" ? "Notificações bloqueadas" : "Ativar notificações";
  return (
    <button
      type="button"
      onClick={status === "on" ? disable : enable}
      disabled={status === "loading" || status === "denied"}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-1 rounded-lg text-xs transition disabled:opacity-50",
        compact ? "h-9 w-9 justify-center" : "px-3 py-2",
        dark ? "text-gray-300 hover:bg-graphite" : "text-gray-600 hover:bg-surface-muted",
        status === "on" && (dark ? "text-brand" : "text-brand-dark"),
      )}
    >
      <Icon className="h-4 w-4" />
      {!compact && label}
    </button>
  );
}
