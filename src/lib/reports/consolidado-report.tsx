// Relatório consolidado do grupo (proprietários). Recebe ConsolidadoReportData já montado.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { AUDIT_TYPE_SHORT } from "../constants";
import { formatDatePT, formatDateShortPT } from "../dates";
import {
  BrandHeader,
  Chip,
  COLORS,
  deltaTone,
  Empty,
  fmtDeltaPts,
  fmtNum,
  fmtPct,
  PageFooter,
  Section,
  Stat,
  styles,
  Table,
  toneColors,
  toneOfNutri,
  toneOfPct,
} from "./pdf-ui";
import type { ConsolidadoReportData, ReportRankingRow } from "./types";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ConsolidadoReportDocument({ data }: { data: ConsolidadoReportData }) {
  const d = data;
  const rotinaBase = d.rotina.cumpridos + d.rotina.nao_cumpridos;
  const rotinaPct = rotinaBase > 0 ? (d.rotina.cumpridos / rotinaBase) * 100 : null;
  const premiadaLabel = d.premiadas.length === 0 ? "Sem loja premiada" : d.premiadas.map((p) => p.nome).join(" e ");
  const premiadaHint =
    d.premiadas.length === 0
      ? "nenhuma loja elegível (nota mínima 70% e sem produto vencido)"
      : d.premiadas.length > 1
        ? `empate: prêmio de ${fmtBRL(d.premio_valor)} dividido`
        : `prêmio de ${fmtBRL(d.premio_valor)} ao supervisor${d.premiadas[0].supervisor_nome ? ` (${d.premiadas[0].supervisor_nome})` : ""}`;
  const totalFalhas = d.ranking.reduce((s, r) => s + r.falhas_graves, 0) + (d.producao?.falhas_graves ?? 0);
  const footer = `Auditor da Rua · Consolidado do grupo · ${d.mesLabel}${d.oficial ? "" : " · PRÉVIA"}`;

  return (
    <Document title={`Consolidado do grupo — ${d.mesLabel}`} author="Auditor da Rua" language="pt-BR">
      <Page size="A4" style={styles.page}>
        <BrandHeader
          title="Consolidado do grupo"
          subtitle={`Todas as unidades · ${d.mesLabel}`}
          right={d.oficial ? `Fechamento de ${d.mesLabel}` : `PRÉVIA · ${d.mesLabel}`}
          meta={`Gerado em ${d.geradoEm}${d.oficial ? "" : " · valores parciais, sujeitos ao fechamento do mês"}`}
        />

        <View style={styles.statGrid}>
          <Stat label="Loja premiada" value={premiadaLabel} hint={premiadaHint} small tone={d.premiadas.length ? "green" : "gray"} />
          <Stat label="Média da rede" value={fmtPct(d.media_rede.atual, 1)} hint={`mês anterior ${fmtPct(d.media_rede.anterior, 1)} · ${fmtDeltaPts(d.media_rede.atual, d.media_rede.anterior)}`} tone={deltaTone(d.media_rede.atual, d.media_rede.anterior)} />
          <Stat label="Falhas graves" value={String(totalFalhas)} tone={totalFalhas > 0 ? "red" : "green"} hint="itens de segurança com nota 1" />
          <Stat
            label="Rotina do gerente"
            value={rotinaPct == null ? "—" : `${d.rotina.cumpridos}/${rotinaBase}`}
            hint={rotinaPct == null ? "sem dias encerrados" : `${fmtPct(rotinaPct)} dos dias cumpridos${d.rotina.pendentes ? ` · ${d.rotina.pendentes} a realizar` : ""}`}
            tone={rotinaPct == null ? "gray" : toneOfPct(rotinaPct)}
          />
        </View>

        <Section title="Ranking do mês" hint="Nota mensal ponderada (completa x2, simplificada x1). Desempate: Segurança Alimentar, depois menos falhas graves.">
          <Table<ReportRankingRow>
            rows={d.ranking}
            empty="Nenhuma loja com nota no mês."
            columns={[
              { key: "pos", label: "#", width: "6%", render: (r) => (r.posicao == null ? "—" : `${r.posicao}º`) },
              { key: "nome", label: "Loja", width: "22%", render: (r) => <Text style={[styles.td, r.premiada ? styles.bold : {}]}>{r.nome}{r.premiada ? " *" : ""}</Text> },
              { key: "nota", label: "Nota", width: "10%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfPct(r.nota)).fg }]}>{fmtPct(r.nota, 1)}</Text> },
              { key: "delta", label: "vs. anterior", width: "13%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: toneColors(deltaTone(r.nota, r.nota_anterior)).fg }]}>{fmtDeltaPts(r.nota, r.nota_anterior)}</Text> },
              { key: "n", label: "Audit.", width: "8%", align: "right", render: (r) => String(r.n_auditorias) },
              { key: "fg", label: "Graves", width: "11%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: r.falhas_graves > 0 ? COLORS.red : COLORS.ink }]}>{String(r.falhas_graves)}</Text> },
              { key: "selos", label: "Selos", width: "20%", render: (r) => (r.selos.length === 0 ? <Text style={styles.tdMuted}>—</Text> : <View style={{ gap: 2 }}>{r.selos.map((s) => <Chip key={s} label={s} tone={s === "Amostra reduzida" ? "yellow" : "red"} />)}</View>) },
              { key: "nutri", label: "Nutri", width: "10%", align: "right", render: (r) => fmtPct(r.nota_nutricional) },
            ]}
          />
          {d.premiadas.length ? <Text style={[styles.small, styles.muted, { marginTop: 4 }]}>* loja premiada no mês</Text> : null}
        </Section>

        <Section title="Moema Produção (fora do ranking)">
          {d.producao ? (
            <View style={[styles.statGrid, { marginTop: 0 }]}>
              <Stat label={d.producao.nome} value={fmtPct(d.producao.nota, 1)} tone={toneOfPct(d.producao.nota)} hint="média das terças" />
              <Stat label="Mês anterior" value={fmtPct(d.producao.nota_anterior, 1)} hint={`variação: ${fmtDeltaPts(d.producao.nota, d.producao.nota_anterior)}`} tone={deltaTone(d.producao.nota, d.producao.nota_anterior)} small />
              <Stat label="Auditorias" value={String(d.producao.n_auditorias)} small />
              <Stat label="Falhas graves" value={String(d.producao.falhas_graves)} tone={d.producao.falhas_graves > 0 ? "red" : "green"} small />
            </View>
          ) : (
            <Empty text="Unidade de produção não cadastrada." />
          )}
        </Section>

        <Section title="Falhas graves" hint="Itens de falha grave (Segurança Alimentar; itens marcados na simplificada/produção) com nota 1 — zeram o bloco e limitam a nota do dia a 50%.">
          <Table
            rows={d.falhas_graves}
            empty="Nenhuma falha grave no mês."
            columns={[
              { key: "unidade", label: "Loja", width: "20%", render: (r) => r.unidade },
              { key: "data", label: "Data", width: "12%", render: (r) => formatDatePT(r.data) },
              { key: "item", label: "Item", width: "34%", render: (r) => r.item },
              { key: "obs", label: "Observação", width: "34%", render: (r) => r.observacao ?? "—" },
            ]}
          />
        </Section>

        <Section title="Rotina do gerente" hint="Dias previstos na agenda rotativa (ter–dom). Dia não cumprido não penaliza a loja, só o indicador de rotina.">
          <View style={[styles.statGrid, { marginTop: 0 }]}>
            <Stat label="Dias previstos" value={String(d.rotina.previstos)} small />
            <Stat label="Cumpridos" value={String(d.rotina.cumpridos)} tone="green" small />
            <Stat label="Não cumpridos" value={String(d.rotina.nao_cumpridos)} tone={d.rotina.nao_cumpridos > 0 ? "red" : "green"} small />
            <Stat label="A realizar" value={String(d.rotina.pendentes)} small hint={d.rotina.trocas ? `${d.rotina.trocas} troca${d.rotina.trocas > 1 ? "s" : ""} manual${d.rotina.trocas > 1 ? "is" : ""}` : undefined} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Table
              rows={d.rotina.nao_cumpridos_lista}
              empty="Todos os dias encerrados foram cumpridos."
              columns={[
                { key: "data", label: "Dia não cumprido", width: "25%", render: (r) => formatDatePT(r.data) },
                { key: "unidade", label: "Loja prevista", width: "45%", render: (r) => r.unidade },
                { key: "tipo", label: "Tipo", width: "30%", render: (r) => AUDIT_TYPE_SHORT[r.tipo] },
              ]}
            />
          </View>
        </Section>

        <Section title="Frequência da nutricionista" hint="Sem agenda fixa: frequência real por loja e nota nutricional média do mês.">
          <Table
            rows={d.nutri_frequencia}
            empty="Nenhuma auditoria nutricional no mês."
            columns={[
              { key: "unidade", label: "Loja", width: "24%", render: (r) => r.unidade },
              { key: "n", label: "Visitas", width: "10%", align: "right", render: (r) => String(r.n) },
              { key: "datas", label: "Datas", width: "36%", render: (r) => (r.datas.length ? r.datas.map(formatDateShortPT).join(", ") : "—") },
              { key: "nota", label: "Nota", width: "12%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfNutri(r.classificacao)).fg }]}>{fmtPct(r.nota, 1)}</Text> },
              { key: "class", label: "Faixa", width: "18%", render: (r) => r.classificacao ?? "—" },
            ]}
          />
        </Section>

        <Section title="Indicadores 99Food" hint="Informativos, lançados pelo proprietário no fechamento; não compõem a nota.">
          <Table
            rows={d.food99}
            empty="Indicadores não lançados para este mês."
            columns={[
              { key: "unidade", label: "Loja", width: "34%", render: (r) => r.unidade },
              { key: "nota", label: "Nota média", width: "22%", align: "right", render: (r) => (r.nota_99food == null ? "—" : fmtNum(r.nota_99food, 2)) },
              { key: "canc", label: "Cancelamentos", width: "22%", align: "right", render: (r) => (r.cancelamentos == null ? "—" : String(r.cancelamentos)) },
              { key: "tempo", label: "Tempo médio", width: "22%", align: "right", render: (r) => (r.tempo_medio_entrega == null ? "—" : `${r.tempo_medio_entrega} min`) },
            ]}
          />
        </Section>

        <Section title="Pendências em aberto" hint="Itens com nota 1–2 (ou não conformes) ainda não resolvidos. Reincidente = 2 visitas sem resolver.">
          <Table
            rows={d.pendencias}
            empty="Nenhuma pendência em aberto na rede."
            columns={[
              { key: "unidade", label: "Loja", width: "40%", render: (r) => r.unidade },
              { key: "abertas", label: "Em aberto", width: "30%", align: "right", render: (r) => String(r.abertas) },
              { key: "reinc", label: "Reincidentes", width: "30%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: r.reincidentes > 0 ? COLORS.red : COLORS.ink }]}>{String(r.reincidentes)}</Text> },
            ]}
          />
        </Section>

        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
