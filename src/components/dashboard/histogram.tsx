"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SCORE_LABELS } from "@/lib/constants";

const HEX: Record<1 | 2 | 3 | 4 | 5, string> = { 5: "#16a34a", 4: "#4ade80", 3: "#facc15", 2: "#f97316", 1: "#dc2626" };

function HistTooltip({ active, payload }: { active?: boolean; payload?: { payload: { nota: 1 | 2 | 3 | 4 | 5; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold">
        Nota {p.nota} · {SCORE_LABELS[p.nota]}
      </div>
      <div className="tabular-nums">{p.count} resposta(s)</div>
    </div>
  );
}

/** Histograma das notas 1–5 dadas por um auditor. */
export function ScoreHistogram({ histogram }: { histogram: Record<1 | 2 | 3 | 4 | 5, number> }) {
  const data = ([1, 2, 3, 4, 5] as const).map((n) => ({ nota: n, count: histogram[n] }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="25%">
          <XAxis dataKey="nota" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Tooltip content={<HistTooltip />} cursor={{ fill: "#f6f6f4" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.nota} fill={HEX[d.nota]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const NUTRI_HEX = { conforme: "#16a34a", nao_conforme: "#dc2626", na: "#9ca3af" } as const;
const NUTRI_LABEL = { conforme: "Conforme", nao_conforme: "Não conforme", na: "N/A" } as const;

/** Barras conforme / não conforme / N/A (auditor nutricional). */
export function NutriHistogram({ counts }: { counts: { conforme: number; nao_conforme: number; na: number } }) {
  const data = (["conforme", "nao_conforme", "na"] as const).map((k) => ({ key: k, label: NUTRI_LABEL[k], count: counts[k] }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="25%">
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f6f6f4" }} formatter={(v) => [`${v} resposta(s)`, ""]} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={NUTRI_HEX[d.key]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
