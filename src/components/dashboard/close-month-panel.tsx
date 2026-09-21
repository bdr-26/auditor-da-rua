"use client";

import { useRouter } from "next/navigation";
import { closeMonthAction, generateScheduleAction, regenerateReportsAction, reopenMonthAction } from "@/lib/dashboard-actions";
import { formatMonthPT } from "@/lib/dates";
import { ActionButton } from "./action-button";

export function CloseMonthButton({ mes, disabled, blocker }: { mes: string; disabled?: boolean; blocker?: string | null }) {
  const router = useRouter();
  return (
    <div>
      <ActionButton
        action={() => closeMonthAction(mes)}
        confirm={`Fechar ${formatMonthPT(mes)}? As notas serão congeladas, o ranking calculado e os relatórios gerados.`}
        disabled={disabled || !!blocker}
        onDone={(r) => r.ok && router.refresh()}
      >
        Fechar mês
      </ActionButton>
      {blocker && <p className="mt-1 text-xs text-gray-500">{blocker}</p>}
    </div>
  );
}

export function ReopenMonthButton({ mes }: { mes: string }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="danger"
      size="sm"
      action={() => reopenMonthAction(mes)}
      confirm={`Reabrir ${formatMonthPT(mes)}? O ranking e a premiação gravados serão apagados e o mês voltará a aceitar ajustes e indicadores.`}
      onDone={(r) => r.ok && router.refresh()}
    >
      Reabrir mês
    </ActionButton>
  );
}

export function RegenerateReportsButton({ mes }: { mes: string }) {
  const router = useRouter();
  return (
    <ActionButton variant="secondary" size="sm" action={() => regenerateReportsAction(mes)} onDone={(r) => r.ok && router.refresh()}>
      Gerar relatórios novamente
    </ActionButton>
  );
}

export function GenerateScheduleButton({ mes }: { mes: string }) {
  const router = useRouter();
  return (
    <ActionButton variant="secondary" size="sm" action={() => generateScheduleAction(mes)} onDone={(r) => r.ok && router.refresh()}>
      Gerar agenda
    </ActionButton>
  );
}
