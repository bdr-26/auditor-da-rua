"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { concludeNutriAudit, discardNutriDraft } from "@/lib/nutri-actions";
import { useAction } from "./use-action";

export function ReviewActions({ auditId, blockers }: { auditId: string; blockers: string[] }) {
  const { run, pending, error } = useAction();
  const [confirming, setConfirming] = useState(false);
  const blocked = blockers.length > 0;

  return (
    <div className="space-y-3">
      {blocked && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <p className="font-semibold">Ainda não é possível concluir:</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Button size="lg" full variant="dark" disabled={blocked || pending} onClick={() => void run(() => concludeNutriAudit(auditId))}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Concluir auditoria
      </Button>
      <p className="text-center text-xs text-gray-500">Depois de concluída, a auditoria não pode ser alterada.</p>

      <div className="border-t border-line pt-3">
        {confirming ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">Descartar o rascunho apaga todas as respostas e fotos desta auditoria. Confirmar?</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" full onClick={() => setConfirming(false)} disabled={pending}>
                Voltar
              </Button>
              <Button variant="danger" full onClick={() => void run(() => discardNutriDraft(auditId))} disabled={pending}>
                Sim, descartar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" full className="text-red-700" onClick={() => setConfirming(true)} disabled={pending}>
            <Trash2 className="h-4 w-4" /> Descartar rascunho
          </Button>
        )}
      </div>
    </div>
  );
}
