"use client";

import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/nutri-actions";

/**
 * Executa uma server action com estado de carregamento e mensagens (erro / info).
 * `redirect()` dentro da action lança e navega; aqui só tratamos o retorno normal.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = useCallback(
    (fn: () => Promise<ActionResult | undefined | void>, after?: (r: ActionResult) => void) =>
      new Promise<ActionResult | null>((resolve) => {
        setError(null);
        setInfo(null);
        startTransition(async () => {
          try {
            const r = (await fn()) ?? null;
            if (r && !r.ok) setError(r.error);
            if (r && r.ok && r.info) setInfo(r.info);
            if (r) after?.(r);
            resolve(r);
          } catch (e) {
            // NEXT_REDIRECT é relançado pelo framework; outros erros viram mensagem
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("NEXT_REDIRECT")) throw e;
            setError("Falha de conexão. Tente novamente.");
            resolve(null);
          }
        });
      }),
    [],
  );

  return { run, pending, error, info, setError, setInfo };
}
