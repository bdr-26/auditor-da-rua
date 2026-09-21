"use client";

import { useEffect } from "react";

/** Registra o service worker do PWA (push + instalação). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[sw] registro falhou", e));
  }, []);
  return null;
}
