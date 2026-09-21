"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AUDIT_TYPE_SHORT, BRAND_YELLOW } from "@/lib/constants";
import { formatDatePT, formatDateShortPT } from "@/lib/dates";
import type { TrendPoint } from "@/lib/data/dashboard";

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold">{formatDatePT(p.data)}</div>
      <div className="text-gray-600">{AUDIT_TYPE_SHORT[p.tipo]}</div>
      <div className="mt-1 text-sm font-bold tabular-nums">
        {p.nota.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%{p.falha_grave && <span className="ml-1 font-semibold text-red-600">⚠ falha grave</span>}
      </div>
    </div>
  );
}

/** Evolução das últimas auditorias (nota %). */
export function ScoreTrendChart({ data, eligibilityMin = 70 }: { data: TrendPoint[]; eligibilityMin?: number }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#eeeeeb" vertical={false} />
          <XAxis dataKey="data" tickFormatter={formatDateShortPT} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={eligibilityMin} stroke="#9ca3af" strokeDasharray="4 4" />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#d1d5db" }} />
          <Line
            type="monotone"
            dataKey="nota"
            stroke={BRAND_YELLOW}
            strokeWidth={2}
            dot={{ r: 4, fill: BRAND_YELLOW, stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
