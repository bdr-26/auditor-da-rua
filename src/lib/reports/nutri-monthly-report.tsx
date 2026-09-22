// Relatório mensal nutricional por unidade: compila todas as auditorias do mês num resultado mensurável.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ApontamentoNutri, AreasTable, Assinaturas, FAIXAS } from "./nutri-audit-report";
import { BrandHeader, Chip, COLORS, deltaTone, Empty, fmtDeltaPts, fmtPct, PageFooter, Section, Stat, styles, Table, toneColors, toneOfNutri, toneOfPct } from "./pdf-ui";
import type { NutriMonthlyAuditRow, NutriMonthlyRecorrente, NutriMonthlyReportData } from "./nutri-types";

export function NutriMonthlyReportDocument({ data }: { data: NutriMonthlyReportData }) {
  const d = data;
  const tone = toneOfNutri(d.resultado.classificacao);
  const footer = `ROTA · Relatório mensal nutricional · ${d.unidade.nome} · ${d.mesLabel}`;
  const meta = [
    d.nutricionistas.length ? `Nutricionista${d.nutricionistas.length > 1 ? "s" : ""}: ${d.nutricionistas.join(", ")}` : null,
    d.unidade.supervisor_nome ? `Responsável da unidade: ${d.unidade.supervisor_nome}` : null,
    `Gerado em ${d.geradoEm}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document title={`Relatório mensal nutricional — ${d.unidade.nome} — ${d.mesLabel}`} author="ROTA" language="pt-BR">
      <Page size="A4" style={styles.page}>
        <BrandHeader title={d.unidade.nome} subtitle={`Relatório mensal nutricional · ${d.mesLabel}${d.unidade.endereco ? ` · ${d.unidade.endereco}` : ""}`} right={d.mesLabel} meta={meta} />

        <View style={styles.statGrid}>
          <Stat label="Resultado do mês" value={fmtPct(d.resultado.nota, 1)} tone={tone} hint={d.resultado.classificacao ?? "sem auditorias"} />
          <Stat label="Auditorias" value={String(d.resultado.n)} hint={d.resultado.n === 1 ? "visita no mês" : "visitas no mês"} />
          <Stat label="Melhor / pior" value={d.resultado.n ? `${fmtPct(d.resultado.melhor)} / ${fmtPct(d.resultado.pior)}` : "—"} hint="nota por visita" small />
          <Stat label="Mês anterior" value={fmtPct(d.anterior.nota, 1)} hint={`variação: ${fmtDeltaPts(d.resultado.nota, d.anterior.nota)}`} tone={deltaTone(d.resultado.nota, d.anterior.nota)} />
        </View>
        <View style={[styles.row, { gap: 4, marginTop: 8, alignItems: "center" }]}>
          <Chip label={d.resultado.classificacao ?? "—"} tone={tone} />
          <View style={{ flex: 1, marginLeft: 4 }}><Text style={[styles.small, styles.muted]}>{FAIXAS} Resultado do mês = média das auditorias.</Text></View>
        </View>

        <Section title="Auditorias do mês" hint="Cada visita com a nota, a classificação e o nº de não conformidades.">
          <Table<NutriMonthlyAuditRow>
            rows={d.auditorias}
            empty="Nenhuma auditoria nutricional concluída no mês."
            columns={[
              { key: "data", label: "Data", width: "12%", render: (r) => r.data },
              { key: "nut", label: "Nutricionista", width: "30%", render: (r) => r.nutricionista },
              { key: "nota", label: "Nota", width: "12%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfPct(r.nota)).fg }]}>{fmtPct(r.nota, 1)}</Text> },
              { key: "cls", label: "Classificação", width: "26%", render: (r) => <Chip label={r.classificacao ?? "—"} tone={toneOfNutri(r.classificacao)} /> },
              { key: "nc", label: "Não conf.", width: "20%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: r.nao_conformes > 0 ? COLORS.red : COLORS.ink }]}>{String(r.nao_conformes)}</Text> },
            ]}
          />
        </Section>

        <Section title="Resultado por área (mês)" hint="Soma dos itens de todas as auditorias do mês em cada área.">
          <AreasTable rows={d.areas} colNc="Não conf." />
        </Section>

        <Section title="Não conformidades recorrentes" hint="Itens apontados em duas ou mais visitas no mês: onde a correção não está se sustentando.">
          {d.recorrentes.length === 0 ? (
            <Empty text="Nenhum item se repetiu no mês." />
          ) : (
            <Table<NutriMonthlyRecorrente>
              rows={d.recorrentes}
              columns={[
                { key: "oc", label: "Vezes", width: "10%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: COLORS.red }]}>{`${r.ocorrencias}×`}</Text> },
                { key: "d", label: "Item", width: "60%", render: (r) => r.descricao },
                { key: "a", label: "Áreas", width: "30%", render: (r) => r.areas.join(", ") },
              ]}
            />
          )}
        </Section>

        <Section title="Apontamentos do mês" hint="Todas as não conformidades registradas, por visita, com fotos.">
          {d.apontamentos.length === 0 ? <Empty text="Nenhuma não conformidade no mês." /> : d.apontamentos.map((a, i) => <ApontamentoNutri key={i} a={a} showDate />)}
          {d.fotosOmitidas > 0 ? <Text style={[styles.small, styles.muted]}>{d.fotosOmitidas} foto(s) não incluída(s) por limite de tamanho do PDF; todas ficam disponíveis no app.</Text> : null}
        </Section>

        <Section title="Pendências em aberto ao fim do mês" hint="Apontamentos ainda não resolvidos até a última visita.">
          {d.pendenciasAbertas.length === 0 ? (
            <Empty text="Nenhuma pendência em aberto." />
          ) : (
            <Table<NutriMonthlyReportData["pendenciasAbertas"][number]>
              rows={d.pendenciasAbertas}
              columns={[
                { key: "d", label: "Item", width: "58%", render: (p) => p.descricao },
                { key: "s", label: "Desde", width: "16%", render: (p) => p.desde },
                { key: "v", label: "Visitas sem resolver", width: "26%", align: "right", render: (p) => (p.reincidente ? <Chip label={`${p.visitas_sem_resolver} · REINCIDENTE`} tone="red" /> : String(p.visitas_sem_resolver)) },
              ]}
            />
          )}
        </Section>

        <Assinaturas esquerda={`Nutricionista: ${d.nutricionistas[0] ?? "____________________"}`} direita={`Responsável da unidade: ${d.unidade.supervisor_nome ?? "____________________"}`} />
        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
