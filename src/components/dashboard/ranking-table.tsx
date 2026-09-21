import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PctBadge } from "@/components/ui/score";
import { nutriBandTone } from "@/lib/domain/nutri";
import type { RankedUnit, UnitMonth } from "@/lib/data/dashboard";
import { cn, fmtPct } from "@/lib/utils";
import { Delta } from "./delta";

function Selos({ r }: { r: RankedUnit }) {
  return (
    <span className="flex flex-wrap gap-1">
      {r.falhas_graves > 0 && <Badge tone="red">⚠ {r.falhas_graves} falha{r.falhas_graves > 1 ? "s" : ""} grave{r.falhas_graves > 1 ? "s" : ""}</Badge>}
      {r.produto_vencido && <Badge tone="red">inelegível</Badge>}
      {!r.produto_vencido && !r.elegivel && r.nota != null && <Badge tone="gray">abaixo do mínimo</Badge>}
      {r.amostra_reduzida && <Badge tone="gray">amostra reduzida</Badge>}
      {r.empate && <Badge tone="yellow">empate</Badge>}
      {r.premiada && <Badge tone="brand">premiada</Badge>}
    </span>
  );
}

export function RankingTable({ ranking, semAuditorias, mes, closed }: { ranking: RankedUnit[]; semAuditorias: UnitMonth[]; mes: string; closed: boolean }) {
  const href = (id: string) => `/dashboard/lojas/${id}?mes=${mes}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr className="border-b border-line">
            <th className="py-2 pr-2">Pos.</th>
            <th className="py-2 pr-2">Loja</th>
            <th className="py-2 pr-2">{closed ? "Nota fechada" : "Nota parcial"}</th>
            <th className="py-2 pr-2">Mês anterior</th>
            <th className="py-2 pr-2">Δ</th>
            <th className="py-2 pr-2 text-center">Aud.</th>
            <th className="py-2 pr-2">Selos</th>
            <th className="py-2">Nutri</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r) => {
            const first = r.posicao === 1;
            return (
              <tr key={r.unit_id} className={cn("border-b border-line last:border-0 hover:bg-surface-muted", first && "bg-brand-light/60")}>
                <td className="py-3 pr-2 font-bold tabular-nums">
                  <span className={cn("inline-flex items-center gap-1", first && "text-brand-dark")}>
                    {first && <Trophy className="h-4 w-4" />}
                    {r.posicao}º
                  </span>
                </td>
                <td className="py-3 pr-2 font-semibold">
                  <Link href={href(r.unit_id)} className="hover:underline">
                    {r.nome}
                  </Link>
                </td>
                <td className="py-3 pr-2">
                  <PctBadge value={r.nota} />
                </td>
                <td className="py-3 pr-2 tabular-nums text-gray-700">
                  {fmtPct(r.um.prevNota)}
                  {r.um.prevNota != null && !r.um.prevFechada && <span className="ml-1 text-xs text-gray-400">(parcial)</span>}
                </td>
                <td className="py-3 pr-2">
                  <Delta value={r.um.delta} />
                </td>
                <td className="py-3 pr-2 text-center tabular-nums">{r.n_auditorias}</td>
                <td className="py-3 pr-2">
                  <Selos r={r} />
                </td>
                <td className="py-3">
                  {r.um.nutri.nota != null ? (
                    <Badge tone={nutriBandTone(r.um.nutri.classificacao)}>
                      {fmtPct(r.um.nutri.nota)} · {r.um.nutri.classificacao}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {semAuditorias.map((um) => (
            <tr key={um.unit.id} className="border-b border-line text-gray-400 last:border-0">
              <td className="py-3 pr-2">—</td>
              <td className="py-3 pr-2 font-semibold text-gray-500">
                <Link href={href(um.unit.id)} className="hover:underline">
                  {um.unit.nome}
                </Link>
              </td>
              <td className="py-3 pr-2 text-xs" colSpan={5}>
                sem auditorias neste mês
              </td>
              <td className="py-3">
                {um.nutri.nota != null ? <Badge tone={nutriBandTone(um.nutri.classificacao)}>{fmtPct(um.nutri.nota)}</Badge> : <span className="text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
