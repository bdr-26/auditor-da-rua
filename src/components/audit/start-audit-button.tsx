"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { startAudit } from "@/lib/audit-actions";
import type { AuditType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Botão que inicia (ou retoma) a auditoria via server action e mostra erro inline. */
export function StartAuditButton({
  unitId,
  tipo,
  data,
  className,
  children,
  unstyled,
}: {
  unitId: string;
  tipo: AuditType;
  data?: string;
  className?: string;
  children: React.ReactNode;
  unstyled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    start(async () => {
      const res = await startAudit({ unitId, tipo, data });
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className={cn(unstyled ? "contents" : "w-full")}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cn(
          !unstyled &&
            "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-lg font-semibold text-ink transition hover:bg-brand-dark hover:text-white disabled:opacity-60",
          className,
        )}
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {pending ? "Abrindo…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
