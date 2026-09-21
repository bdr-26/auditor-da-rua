"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { concludeAudit, deleteDraft } from "@/lib/audit-actions";

export function ReviewActions({ auditId, blockers }: { auditId: string; blockers: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canConclude = blockers.length === 0;

  const conclude = () => {
    setError(null);
    start(async () => {
      const res = await concludeAudit(auditId);
      if (res?.error) setError(res.error);
    });
  };

  const discard = () => {
    setError(null);
    start(async () => {
      const res = await deleteDraft(auditId);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-3">
      {!canConclude && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Ainda não dá para concluir:</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="button" size="lg" full onClick={conclude} disabled={!canConclude || pending} variant="dark">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        Concluir auditoria
      </Button>
      <p className="text-center text-xs text-gray-500">Depois de concluída, a auditoria não pode mais ser alterada.</p>

      <div className="pt-4">
        {!confirmDelete ? (
          <Button type="button" variant="ghost" full onClick={() => setConfirmDelete(true)} className="text-red-700" disabled={pending}>
            <Trash2 className="h-4 w-4" /> Descartar rascunho
          </Button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">Descartar este rascunho? Todas as respostas e fotos serão apagadas.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={discard} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Descartar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
