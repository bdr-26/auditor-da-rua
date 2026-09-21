"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { saveSettings } from "@/lib/admin-actions";
import type { AppSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [s, setS] = useState<AppSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const num = <K extends keyof AppSettings>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: Number(e.target.value) }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveSettings(s);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Salvo." } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <Card>
        <CardTitle>Rotina do gerente</CardTitle>
        <Field label="Terça-feira da semana 1 da rotação" hint="Semana em que quarta = 1ª loja da ordem de rotação. Mudar aqui altera só os dias ainda não gerados (use “Regenerar dias futuros” em Unidades).">
          <Input type="date" value={s.rotacao_semana_base} onChange={(e) => setS((p) => ({ ...p, rotacao_semana_base: e.target.value }))} required />
        </Field>
      </Card>

      <Card>
        <CardTitle>Nota mensal e ranking</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Peso da auditoria completa">
            <Input type="number" min={0.1} step={0.5} value={s.peso_completa} onChange={num("peso_completa")} />
          </Field>
          <Field label="Peso da auditoria simplificada">
            <Input type="number" min={0.1} step={0.5} value={s.peso_simplificada} onChange={num("peso_simplificada")} />
          </Field>
          <Field label="Elegibilidade mínima à premiação (%)">
            <Input type="number" min={0} max={100} step={1} value={s.elegibilidade_min} onChange={num("elegibilidade_min")} />
          </Field>
          <Field label="Prêmio ao supervisor (R$)">
            <Input type="number" min={0} step={10} value={s.premio_valor} onChange={num("premio_valor")} />
          </Field>
          <Field label="Mínimo de auditorias sem selo “amostra reduzida”">
            <Input type="number" min={1} step={1} value={s.amostra_reduzida_min} onChange={num("amostra_reduzida_min")} />
          </Field>
          <Field label="Visitas sem resolver para pendência reincidente">
            <Input type="number" min={1} step={1} value={s.pendencia_reincidente_visitas} onChange={num("pendencia_reincidente_visitas")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Composição futura do ranking</CardTitle>
        <p className="mb-3 rounded-lg bg-surface-muted p-3 text-xs text-gray-600">
          Reservado para versão futura: os parâmetros abaixo são armazenados, mas o ranking da v1 considera apenas a nota operacional do gerente. A nota nutricional e os indicadores 99Food são exibidos ao lado, sem compor a nota.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={s.nutri_compoe_ranking} onChange={(e) => setS((p) => ({ ...p, nutri_compoe_ranking: e.target.checked }))} /> Nota nutricional compõe o ranking
          </label>
          <Field label="Peso da nota nutricional">
            <Input type="number" min={0} step={0.1} value={s.nutri_peso} onChange={num("nutri_peso")} disabled={!s.nutri_compoe_ranking} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={s.food99_compoe_ranking} onChange={(e) => setS((p) => ({ ...p, food99_compoe_ranking: e.target.checked }))} /> Indicadores 99Food compõem o ranking
          </label>
          <Field label="Peso dos indicadores 99Food">
            <Input type="number" min={0} step={0.1} value={s.food99_peso} onChange={num("food99_peso")} disabled={!s.food99_compoe_ranking} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </Button>
        {msg && <span className={cn("text-sm", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</span>}
      </div>
    </form>
  );
}
