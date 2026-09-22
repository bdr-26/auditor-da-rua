"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: minimal-ui)").matches || nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Faixa "Instalar o app": no Android dispara a instalação real (modo aplicativo, sem barra de endereço);
 * no iPhone mostra o caminho (Compartilhar → Adicionar à Tela de Início). Some quando já está instalado.
 */
export function InstallBanner() {
  const [bip, setBip] = useState<BIP | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("rota-install-dismissed") === "1";
    } catch {}
    if (dismissed) return;
    setIos(isIOS());
    setShow(true);
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIP);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  async function install() {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === "accepted") setShow(false);
  }

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem("rota-install-dismissed", "1");
    } catch {}
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-brand/40 bg-brand-light p-3 text-sm text-ink lg:hidden">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instale o ROTA como aplicativo</p>
          {ios ? (
            <p className="mt-0.5 text-xs text-gray-700">
              No Safari, toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra sempre pelo ícone novo.
            </p>
          ) : bip ? (
            <p className="mt-0.5 text-xs text-gray-700">Abre em tela cheia, sem barra de endereço, e recebe notificações.</p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-700">
              No Chrome, toque no menu <strong>⋮</strong> e em <strong>Instalar app</strong> (ou “Adicionar à tela inicial”). Abra sempre pelo ícone novo.
            </p>
          )}
          {bip && (
            <button type="button" onClick={install} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white">
              <Download className="h-4 w-4" /> Instalar agora
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Fechar" className="flex h-8 w-8 min-h-0 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-white/60">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
