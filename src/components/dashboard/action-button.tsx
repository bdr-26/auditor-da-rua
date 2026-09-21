"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Result = { ok: true; message?: string; warning?: string } | { ok: false; error: string };

/** Botão que executa uma server action com confirmação opcional e mostra o resultado inline. */
export function ActionButton({
  action,
  confirm,
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  onDone,
}: {
  action: () => Promise<Result>;
  confirm?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  onDone?: (r: Result) => void;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setResult(r);
            onDone?.(r);
          });
        }}
      >
        {pending ? "Aguarde…" : children}
      </Button>
      {result && (
        <p className={cn("text-xs", result.ok ? (result.warning ? "text-orange-700" : "text-green-700") : "text-red-700")}>
          {result.ok ? result.warning ?? result.message ?? "Feito." : result.error}
        </p>
      )}
    </div>
  );
}
