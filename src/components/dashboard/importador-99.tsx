"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { formatDatePT } from "@/lib/dates";
import { type Detalhe99, indicadoresDoDetalhe, parsePedidos99, type Pedido99, resumirImportacao99 } from "@/lib/indicadores-99";
import { cn } from "@/lib/utils";

export interface Importado99 {
  slug: string;
  detalhe: Detalhe99;
}

/**
 * Lê o relatório "Dados do pedido" da 99 (xlsx) no navegador, agrupa por unidade e mostra a prévia.
 * O arquivo não sobe para o servidor: só o resumo por loja vai junto com "Salvar indicadores".
 */
export function Importador99({ mes, unidades, onAplicar }: { mes: string; unidades: { slug: string; nome: string }[]; onAplicar: (itens: Importado99[], arquivo: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido99[] | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const ym = mes.slice(0, 7);
  const resumo = pedidos ? resumirImportacao99(pedidos, extra) : null;
  const nomeDe = (slug: string) => unidades.find((u) => u.slug === slug)?.nome ?? slug;
  const foraDoMes = resumo?.periodo && (resumo.periodo.de.slice(0, 7) !== ym || resumo.periodo.ate.slice(0, 7) !== ym);
  const semUnidade = resumo?.unidades.filter((u) => !unidades.some((x) => x.slug === u.slug)) ?? [];

  async function ler(file: File) {
    setLendo(true);
    setErro(null);
    setPedidos(null);
    setExtra({});
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("A planilha está vazia.");
      const grade: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      const r = parsePedidos99(grade);
      if (r.erro) throw new Error(r.erro);
      setPedidos(r.pedidos);
      setArquivo(file.name);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-muted/40 p-3" data-testid="importador-99">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Importar relatório da 99 (Dados do pedido)</div>
          <p className="text-xs text-gray-500">O mesmo arquivo que você exporta da 99 para o mês. Preenche pedidos, cancelamentos, nota e tempo por loja, e guarda o detalhe para o relatório do supervisor.</p>
        </div>
        <Button type="button" variant="secondary" disabled={lendo} onClick={() => input.current?.click()}>
          {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} {lendo ? "Lendo…" : "Escolher arquivo"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          data-testid="arquivo-99"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void ler(f);
            e.target.value = "";
          }}
        />
      </div>
      {erro && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
      {resumo && (
        <div className="mt-3 space-y-2" data-testid="previa-99">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">{arquivo}</span> · {resumo.linhas.toLocaleString("pt-BR")} pedidos
            {resumo.periodo && (
              <>
                {" "}
                de {formatDatePT(resumo.periodo.de)} a {formatDatePT(resumo.periodo.ate)}
              </>
            )}
          </p>
          {foraDoMes && <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">Atenção: o arquivo tem pedidos fora de {ym}. Confira se exportou o mês certo.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-xs">
              <thead className="text-left uppercase tracking-wide text-gray-500">
                <tr className="border-b border-line">
                  <th className="py-1.5 pr-2">Loja</th>
                  <th className="py-1.5 pr-2 text-right">Pedidos</th>
                  <th className="py-1.5 pr-2 text-right">Cancel.</th>
                  <th className="py-1.5 pr-2 text-right">Nota</th>
                  <th className="py-1.5 pr-2 text-right">Tempo</th>
                  <th className="py-1.5 pr-2 text-right">Dias</th>
                  <th className="py-1.5 text-right">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {resumo.unidades
                  .slice()
                  .sort((a, b) => nomeDe(a.slug).localeCompare(nomeDe(b.slug), "pt-BR"))
                  .map((u) => {
                    const i = indicadoresDoDetalhe(u.detalhe);
                    const conhecida = unidades.some((x) => x.slug === u.slug);
                    return (
                      <tr key={u.slug} className={cn("border-b border-line last:border-0", !conhecida && "text-gray-400")}>
                        <td className="py-1.5 pr-2 font-medium">
                          {nomeDe(u.slug)}
                          {!conhecida && <span className="ml-1 font-normal">(não está no fechamento)</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{i.pedidos.toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {i.cancelamentos} <span className="text-gray-400">({u.detalhe.cancel_pct ?? 0}%)</span>
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{i.nota_99food == null ? "—" : i.nota_99food.toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{i.tempo_medio_entrega == null ? "—" : `${i.tempo_medio_entrega} min`}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{u.detalhe.dias}</td>
                        <td className="py-1.5 text-right tabular-nums">{u.detalhe.atraso_pct == null ? "—" : `${u.detalhe.atraso_pct}%`}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {resumo.desconhecidas.length > 0 && (
            <div className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
              <div className="mb-1 font-semibold">Lojas da 99 que não reconheci. Escolha a unidade (ou deixe &quot;Ignorar&quot;):</div>
              {resumo.desconhecidas.map((d) => (
                <label key={d.id} className="mb-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {d.nome} <span className="text-yellow-700">({d.pedidos} pedidos)</span>
                  </span>
                  <Select value={extra[d.id] ?? ""} onChange={(e) => setExtra((x) => ({ ...x, [d.id]: e.target.value }))} className="max-w-[12rem]">
                    <option value="">Ignorar</option>
                    {unidades.map((u) => (
                      <option key={u.slug} value={u.slug}>
                        {u.nome}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Pedidos = concluídos (sem os cancelados). Nota = média das avaliações dos clientes (1 a 5). Tempo = média do pedido até a conclusão da entrega.
            {semUnidade.length > 0 && " Lojas fora do fechamento são ignoradas."}
          </p>
          <Button
            type="button"
            data-testid="aplicar-99"
            onClick={() => {
              onAplicar(
                resumo.unidades.filter((u) => unidades.some((x) => x.slug === u.slug)),
                arquivo ?? "relatorio-99.xlsx",
              );
              setPedidos(null);
            }}
          >
            Usar estes números
          </Button>
        </div>
      )}
    </div>
  );
}
