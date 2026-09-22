// Relatório de uma auditoria do gerente (completa / simplificada / produção).
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { GRAVE_FAILURE_CAP, SCORE_LABELS } from "../constants";
import { Assinaturas } from "./nutri-audit-report";
import { Bar, BrandHeader, Chip, COLORS, Empty, fmtPct, PageFooter, Section, Stat, styles, Table, toneColors, toneOfPct, toneOfScore } from "./pdf-ui";
import type { GerenteAuditReportData, GerenteReportBlock, GerenteReportItem } from "./gerente-types";
import type { Score } from "../types";

function notaLabel(n: number | null, na: boolean): string {
  if (na) return "N/A";
  if (n == null) return "—";
  return `${n} · ${SCORE_LABELS[n as Score]}`;
}

function ItemRow({ it }: { it: GerenteReportItem }) {
  const tone = it.na || it.nota == null ? "gray" : toneOfScore(it.nota);
  return (
    <View style={[styles.tr]} wrap={false}>
      <View style={{ width: "62%", paddingRight: 6 }}>
        <Text style={styles.td}>
          {it.descricao}
          {it.falha_grave ? "  (falha grave)" : ""}
        </Text>
        {it.observacao ? <Text style={[styles.tdMuted, { marginTop: 1 }]}>{it.observacao}</Text> : null}
      </View>
      <View style={{ width: "38%", alignItems: "flex-end" }}>
        <Chip label={notaLabel(it.nota, it.na)} tone={tone} />
        {it.produto_vencido ? <Text style={[styles.small, { color: COLORS.red, marginTop: 2 }]}>produto vencido em uso</Text> : null}
      </View>
    </View>
  );
}

function Bloco({ b, flat }: { b: GerenteReportBlock; flat: boolean }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "center", marginBottom: 4 }]}>
        <Text style={styles.bold}>
          {b.nome}
          {b.zerado ? "  (zerado por falha grave)" : ""}
        </Text>
        {!flat && b.peso > 0 ? (
          <View style={[styles.row, { alignItems: "center", gap: 6 }]}>
            <View style={{ width: 90 }}>
              <Bar pct={b.nota} tone={b.zerado ? "red" : undefined} />
            </View>
            <Text style={[styles.bold, { color: toneColors(b.zerado ? "red" : toneOfPct(b.nota)).fg, width: 34, textAlign: "right" }]}>{fmtPct(b.nota)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.table}>
        {b.itens.map((it, i) => (
          <ItemRow key={i} it={it} />
        ))}
      </View>
    </View>
  );
}

export function GerenteAuditReportDocument({ data }: { data: GerenteAuditReportData }) {
  const d = data;
  const tone = d.falhaGrave ? "red" : toneOfPct(d.nota);
  const flat = d.tipo !== "completa";
  const apontamentos = d.blocos.flatMap((b) => b.itens.filter((it) => it.nota != null && it.nota <= 3).map((it) => ({ bloco: b.nome, it })));
  const footer = `ROTA · ${d.tipoLabel} · ${d.unidade.nome} · ${d.data}${d.rascunho ? " · PRÉVIA (rascunho)" : ""}`;
  const meta = [`Auditor: ${d.auditor}`, d.unidade.supervisor_nome ? `Responsável da unidade: ${d.unidade.supervisor_nome}` : null, d.concluidaEm ? `Concluída em ${d.concluidaEm}` : null, `Gerado em ${d.geradoEm}`].filter(Boolean).join(" · ");

  return (
    <Document title={`${d.tipoLabel} — ${d.unidade.nome} — ${d.data}`} author="ROTA" language="pt-BR">
      <Page size="A4" style={styles.page}>
        <BrandHeader title={d.unidade.nome} subtitle={`${d.tipoLabel} · ${d.data}${d.unidade.endereco ? ` · ${d.unidade.endereco}` : ""}`} right={d.rascunho ? "PRÉVIA · rascunho" : `Auditoria de ${d.data}`} meta={meta} />

        <View style={styles.statGrid}>
          <Stat label="Nota da auditoria" value={fmtPct(d.nota, 1)} tone={tone} hint={d.falhaGrave ? `falha grave · teto de ${GRAVE_FAILURE_CAP}%` : "média dos blocos"} />
          <Stat label="Itens avaliados" value={`${d.totais.respondidos}/${d.totais.total}`} hint={`${d.totais.na} não se aplicam`} />
          <Stat label="Atenção (3)" value={String(d.totais.atencao)} tone={d.totais.atencao > 0 ? "yellow" : "green"} hint="desvios visíveis" />
          <Stat label="Não conforme / crítico" value={`${d.totais.naoConformes} / ${d.totais.criticos}`} tone={d.totais.criticos > 0 ? "red" : d.totais.naoConformes > 0 ? "orange" : "green"} hint="notas 2 e 1" />
        </View>
        <View style={[styles.row, { gap: 4, marginTop: 8, alignItems: "center" }]}>
          {d.falhaGrave ? <Chip label="FALHA GRAVE" tone="red" /> : null}
          {d.produtoVencido ? <Chip label="PRODUTO VENCIDO EM USO" tone="red" /> : null}
          {d.falhaGrave && d.notaSemTeto != null && d.notaSemTeto > GRAVE_FAILURE_CAP ? <Text style={[styles.small, styles.muted]}>Nota calculada sem o teto: {fmtPct(d.notaSemTeto, 1)}.</Text> : null}
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={[styles.small, styles.muted]}>Escala: 5 Padrão DA RUA · 4 Conforme · 3 Atenção · 2 Não conforme · 1 Crítico. Nota do item = (nota - 1) / 4. Item de falha grave com nota 1 zera o bloco e limita a nota do dia a 50%.</Text>
          </View>
        </View>

        {!flat ? (
          <Section title="Nota por bloco" hint="Cinco blocos com peso igual (20% cada); N/A fora do cálculo.">
            <Table<GerenteReportBlock>
              rows={d.blocos.filter((b) => b.peso > 0)}
              columns={[
                { key: "nome", label: "Bloco", width: "40%", render: (b) => (b.zerado ? `${b.nome} (zerado)` : b.nome) },
                { key: "nota", label: "Nota", width: "12%", align: "right", render: (b) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(b.zerado ? "red" : toneOfPct(b.nota)).fg }]}>{fmtPct(b.nota)}</Text> },
                { key: "bar", label: "", width: "48%", render: (b) => <View style={{ paddingTop: 3, paddingRight: 8 }}><Bar pct={b.nota} tone={b.zerado ? "red" : undefined} /></View> },
              ]}
            />
          </Section>
        ) : null}

        <Section title="Itens avaliados" hint="Todos os itens com a nota dada e a observação do auditor.">
          {d.blocos.filter((b) => b.itens.length > 0).map((b) => (
            <Bloco key={b.chave} b={b} flat={flat || b.peso === 0} />
          ))}
        </Section>

        <Section title="Pontos de atenção (nota 3 ou menos)" hint="Itens que exigem ação da unidade, com observação e fotos.">
          {apontamentos.length === 0 ? (
            <Empty text="Nenhum item com nota 3 ou menos." />
          ) : (
            apontamentos.map(({ bloco, it }, i) => (
              <View key={i} style={[styles.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: toneColors(toneOfScore(it.nota)).fg }]} wrap={false}>
                <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
                  <Text style={styles.tdMuted}>{bloco}</Text>
                  <View style={[styles.row, { gap: 4 }]}>
                    {it.falha_grave && it.nota === 1 ? <Chip label="FALHA GRAVE" tone="red" /> : null}
                    <Chip label={notaLabel(it.nota, it.na)} tone={toneOfScore(it.nota)} />
                  </View>
                </View>
                <Text style={[styles.bold, { marginTop: 3 }]}>{it.descricao}</Text>
                {it.observacao ? <Text style={{ marginTop: 2, color: COLORS.graphite }}>{it.observacao}</Text> : <Text style={styles.empty}>Sem observação.</Text>}
                {it.fotos.length > 0 ? (
                  <View style={styles.photoRow}>
                    {it.fotos.map((f) => (
                      // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
                      <Image key={f.id} src={f.dataUri} style={styles.photo} />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
          {d.fotosOmitidas > 0 ? <Text style={[styles.small, styles.muted]}>{d.fotosOmitidas} foto(s) não incluída(s) por limite de tamanho do PDF; todas ficam disponíveis no app.</Text> : null}
        </Section>

        {d.pendencias.length > 0 ? (
          <Section title="Pendências da visita anterior" hint="Itens com nota 1–2 na última visita e a situação encontrada hoje.">
            <Table<GerenteAuditReportData["pendencias"][number]>
              rows={d.pendencias}
              columns={[
                { key: "s", label: "Situação", width: "16%", render: (p) => <Chip label={p.resolvida === true ? "resolvida" : p.resolvida === false ? "mantida" : "não avaliada"} tone={p.resolvida === true ? "green" : p.resolvida === false ? "red" : "gray"} /> },
                { key: "d", label: "Item", width: "58%", render: (p) => p.descricao },
                { key: "n", label: "Nota anterior", width: "12%", align: "right", render: (p) => (p.nota_origem != null ? String(p.nota_origem) : "—") },
                { key: "o", label: "Apontado em", width: "14%", align: "right", render: (p) => p.origem_data ?? "—" },
              ]}
            />
          </Section>
        ) : null}

        <Assinaturas esquerda={`Auditor: ${d.auditor}`} direita={`Responsável da unidade: ${d.unidade.supervisor_nome ?? "____________________"}`} />
        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
