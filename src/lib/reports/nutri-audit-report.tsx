// Relatório de uma auditoria nutricional (para compartilhar/imprimir). Recebe NutriAuditReportData já montado.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { Bar, BrandHeader, Chip, COLORS, Empty, fmtPct, PageFooter, Section, Stat, styles, Table, toneColors, toneOfNutri, toneOfPct } from "./pdf-ui";
import type { NutriAuditReportData, NutriReportApontamento, NutriReportArea } from "./nutri-types";

export const FAIXAS = "Faixas: Excelente 91–100% · Satisfatório 80–90% · Insatisfatório 50–79% · Crítico abaixo de 50%. Nota = itens conformes ÷ itens aplicáveis (N/A fora do cálculo).";

export function ApontamentoNutri({ a, showDate }: { a: NutriReportApontamento; showDate?: boolean }) {
  return (
    <View style={[styles.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.red }]} wrap={false}>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={styles.tdMuted}>
          {showDate && a.data ? `${a.data} · ` : ""}
          {a.area}
        </Text>
        <Chip label="NÃO CONFORME" tone="red" />
      </View>
      <Text style={[styles.bold, { marginTop: 3 }]}>{a.descricao}</Text>
      {a.observacao ? <Text style={{ marginTop: 2, color: COLORS.graphite }}>{a.observacao}</Text> : <Text style={styles.empty}>Sem apontamento escrito.</Text>}
      {a.fotos.length > 0 ? (
        <View style={styles.photoRow}>
          {a.fotos.map((f) => (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem prop alt
            <Image key={f.id} src={f.dataUri} style={styles.photo} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function AreasTable({ rows, colNc = "Não conf." }: { rows: NutriReportArea[]; colNc?: string }) {
  return (
    <Table<NutriReportArea>
      rows={rows}
      empty="Sem itens respondidos."
      columns={[
        { key: "area", label: "Área", width: "34%", render: (r) => r.area },
        { key: "ok", label: "Conf.", width: "9%", align: "right", render: (r) => String(r.conformes) },
        { key: "nc", label: colNc, width: "11%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: r.nao_conformes > 0 ? COLORS.red : COLORS.ink }]}>{String(r.nao_conformes)}</Text> },
        { key: "na", label: "N/A", width: "8%", align: "right", render: (r) => String(r.na) },
        { key: "nota", label: "% conf.", width: "11%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfPct(r.nota)).fg }]}>{fmtPct(r.nota)}</Text> },
        { key: "bar", label: "", width: "27%", render: (r) => <View style={{ paddingTop: 3, paddingRight: 8 }}><Bar pct={r.nota} /></View> },
      ]}
    />
  );
}

export function Assinaturas({ esquerda, direita }: { esquerda: string; direita: string }) {
  return (
    <View style={styles.signature} wrap={false}>
      <Text style={styles.signatureBox}>{esquerda}</Text>
      <Text style={styles.signatureBox}>{direita}</Text>
    </View>
  );
}

export function NutriAuditReportDocument({ data }: { data: NutriAuditReportData }) {
  const d = data;
  const tone = toneOfNutri(d.classificacao);
  const footer = `ROTA · Auditoria Nutricional · ${d.unidade.nome} · ${d.data}${d.rascunho ? " · PRÉVIA (rascunho)" : ""}`;
  const meta = [
    `Nutricionista: ${d.nutricionista}`,
    d.unidade.supervisor_nome ? `Responsável da unidade: ${d.unidade.supervisor_nome}` : null,
    d.concluidaEm ? `Concluída em ${d.concluidaEm}` : null,
    `Gerado em ${d.geradoEm}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document title={`Auditoria Nutricional — ${d.unidade.nome} — ${d.data}`} author="ROTA" language="pt-BR">
      <Page size="A4" style={styles.page}>
        <BrandHeader title={d.unidade.nome} subtitle={`Relatório de Auditoria Nutricional · ${d.data}${d.unidade.endereco ? ` · ${d.unidade.endereco}` : ""}`} right={d.rascunho ? "PRÉVIA · rascunho" : `Auditoria de ${d.data}`} meta={meta} />

        <View style={styles.statGrid}>
          <Stat label="Nota da auditoria" value={fmtPct(d.nota, 1)} tone={tone} hint={d.classificacao ?? "sem classificação"} />
          <Stat label="Itens avaliados" value={String(d.totais.avaliados)} hint={`${d.totais.na} não se aplicam`} />
          <Stat label="Conformes" value={String(d.totais.conformes)} tone="green" hint="problema não encontrado" />
          <Stat label="Não conformes" value={String(d.totais.nao_conformes)} tone={d.totais.nao_conformes > 0 ? "red" : "green"} hint="apontamentos" />
        </View>
        <View style={[styles.row, { gap: 4, marginTop: 8, alignItems: "center" }]}>
          <Chip label={d.classificacao ?? "—"} tone={tone} />
          <View style={{ flex: 1, marginLeft: 4 }}><Text style={[styles.small, styles.muted]}>{FAIXAS}</Text></View>
        </View>

        <Section title="Resultado por área" hint="Itens conformes, não conformes e não aplicáveis em cada área da unidade.">
          <AreasTable rows={d.areas} />
        </Section>

        <Section title="Apontamentos (não conformidades)" hint="Itens em que o problema foi encontrado, com a descrição da nutricionista e as fotos registradas.">
          {d.apontamentos.length === 0 ? (
            <Empty text="Nenhuma não conformidade encontrada nesta auditoria." />
          ) : (
            d.apontamentos.map((a, i) => <ApontamentoNutri key={i} a={a} />)
          )}
          {d.fotosOmitidas > 0 ? <Text style={[styles.small, styles.muted]}>{d.fotosOmitidas} foto(s) não incluída(s) por limite de tamanho do PDF; todas ficam disponíveis no app.</Text> : null}
        </Section>

        {d.pendencias.length > 0 ? (
          <Section title="Apontamentos da visita anterior" hint="Situação dos apontamentos abertos na última visita.">
            <Table<NutriAuditReportData["pendencias"][number]>
              rows={d.pendencias}
              columns={[
                { key: "s", label: "Situação", width: "16%", render: (p) => <Chip label={p.resolvida === true ? "resolvido" : p.resolvida === false ? "mantido" : "não avaliado"} tone={p.resolvida === true ? "green" : p.resolvida === false ? "red" : "gray"} /> },
                { key: "d", label: "Item", width: "64%", render: (p) => p.descricao },
                { key: "o", label: "Apontado em", width: "20%", align: "right", render: (p) => p.origem_data ?? "—" },
              ]}
            />
          </Section>
        ) : null}

        <Assinaturas esquerda={`Nutricionista: ${d.nutricionista}`} direita={`Responsável da unidade: ${d.unidade.supervisor_nome ?? "____________________"}`} />
        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
