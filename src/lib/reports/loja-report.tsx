// Relatório mensal por loja (para o supervisor). Recebe LojaReportData já montado.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { AUDIT_TYPE_SHORT } from "../constants";
import { formatDatePT } from "../dates";
import {
  Bar,
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
  toneOfScore,
} from "./pdf-ui";
import type { LojaReportData, ReportApontamento, ReportAuditRow, ReportBlockRow, ReportItemStat, ReportNutriApontamento } from "./types";

function ItemList({ items, empty, showOcorrencias }: { items: ReportItemStat[]; empty: string; showOcorrencias?: boolean }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <View>
      {items.map((it) => (
        <View key={it.chave} style={styles.listItem} wrap={false}>
          <Text style={[styles.td, { flex: 1 }]}>{it.descricao}</Text>
          <View style={{ width: 70, alignItems: "flex-end" }}>
            <Chip label={`média ${fmtNum(it.media, 1)}`} tone={toneOfScore(it.media)} />
          </View>
          <Text style={[styles.tdMuted, { width: 92, textAlign: "right" }]}>
            {showOcorrencias ? `${it.ocorrencias}x nota 1–3 · ${it.n} resp.` : `${it.n} resposta${it.n === 1 ? "" : "s"}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Apontamento({ a }: { a: ReportApontamento }) {
  const c = toneColors(toneOfScore(a.nota));
  return (
    <View style={[styles.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: c.fg }]} wrap={false}>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={styles.tdMuted}>
          {formatDatePT(a.data)} · {AUDIT_TYPE_SHORT[a.tipo]}
        </Text>
        <View style={[styles.row, { gap: 4 }]}>
          {a.falha_grave ? <Chip label="FALHA GRAVE" tone="red" /> : null}
          <Chip label={`nota ${a.nota}`} tone={toneOfScore(a.nota)} />
        </View>
      </View>
      <Text style={[styles.bold, { marginTop: 3 }]}>{a.item}</Text>
      {a.observacao ? <Text style={{ marginTop: 2, color: COLORS.graphite }}>{a.observacao}</Text> : <Text style={[styles.empty]}>Sem observação.</Text>}
      {a.fotos.length > 0 ? (
        <View style={styles.photoRow}>
          {a.fotos.map((src, i) => (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem prop alt
            <Image key={i} src={src} style={styles.photo} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LojaReportDocument({ data }: { data: LojaReportData }) {
  const d = data;
  const posicaoLabel = d.fora_do_ranking ? "Fora do ranking" : d.posicao != null ? `${d.posicao}º${d.empate ? " (empate)" : ""}` : "—";
  const posicaoHint = d.fora_do_ranking
    ? d.unidade.tipo === "producao"
      ? "Cozinha central: nota própria"
      : "Sem nota no mês"
    : `de ${d.total_ranqueadas} lojas ranqueadas${d.premiada ? " · PREMIADA" : ""}`;
  const selos: { label: string; tone: "red" | "orange" | "yellow" | "green" }[] = [];
  if (d.falhas_graves > 0) selos.push({ label: `${d.falhas_graves} falha${d.falhas_graves > 1 ? "s" : ""} grave${d.falhas_graves > 1 ? "s" : ""}`, tone: "red" });
  if (d.produto_vencido) selos.push({ label: "Inelegível (produto vencido)", tone: "red" });
  if (d.amostra_reduzida) selos.push({ label: "Amostra reduzida", tone: "yellow" });
  if (d.premiada) selos.push({ label: "Loja premiada", tone: "green" });

  const footer = `Auditor da Rua · Relatório mensal · ${d.unidade.nome} · ${d.mesLabel}${d.oficial ? "" : " · PRÉVIA"}`;

  return (
    <Document title={`Relatório mensal — ${d.unidade.nome} — ${d.mesLabel}`} author="Auditor da Rua" language="pt-BR">
      <Page size="A4" style={styles.page}>
        <BrandHeader
          title={d.unidade.nome}
          subtitle={`Relatório mensal · ${d.mesLabel}${d.unidade.supervisor_nome ? ` · Supervisor: ${d.unidade.supervisor_nome}` : ""}`}
          right={d.oficial ? `Fechamento de ${d.mesLabel}` : `PRÉVIA · ${d.mesLabel}`}
          meta={`Gerado em ${d.geradoEm}${d.oficial ? "" : " · valores parciais, sujeitos ao fechamento do mês"}`}
        />

        <View style={styles.statGrid}>
          <Stat label="Nota do mês" value={fmtPct(d.nota, 1)} tone={toneOfPct(d.nota)} hint={d.oficial ? "nota fechada" : "nota parcial"} />
          <Stat label="Posição no ranking" value={posicaoLabel} hint={posicaoHint} small={d.fora_do_ranking} />
          <Stat
            label="Mês anterior"
            value={d.anterior ? fmtPct(d.anterior.nota, 1) : "—"}
            hint={`variação: ${fmtDeltaPts(d.nota, d.anterior?.nota)}`}
            tone={deltaTone(d.nota, d.anterior?.nota)}
          />
          <Stat
            label="Auditorias"
            value={String(d.n_auditorias)}
            hint={d.unidade.tipo === "producao" ? "terças do mês" : `${d.n_completas} completa${d.n_completas === 1 ? "" : "s"} · ${d.n_simplificadas} simplificada${d.n_simplificadas === 1 ? "" : "s"}`}
          />
        </View>
        {selos.length > 0 ? (
          <View style={[styles.row, { gap: 4, marginTop: 8 }]}>
            {selos.map((s) => (
              <Chip key={s.label} label={s.label} tone={s.tone} />
            ))}
          </View>
        ) : null}

        <Section title="Decomposição por bloco" hint="Nota do bloco = média dos itens aplicáveis (1 = 0%, 5 = 100%). Bloco zerado = item de falha grave com nota 1.">
          <Table<ReportBlockRow>
            rows={d.blocos}
            empty="Sem auditorias com nota no mês."
            columns={[
              { key: "nome", label: "Bloco", width: "30%", render: (b) => (b.zerado ? `${b.nome} (zerado)` : b.nome) },
              { key: "nota", label: "Nota", width: "11%", align: "right", render: (b) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfPct(b.nota)).fg }]}>{fmtPct(b.nota)}</Text> },
              { key: "bar", label: "", width: "33%", render: (b) => <View style={{ paddingTop: 3, paddingRight: 8 }}><Bar pct={b.nota} tone={b.zerado ? "red" : undefined} /></View> },
              { key: "ant", label: "Mês anterior", width: "13%", align: "right", render: (b) => fmtPct(b.nota_anterior) },
              { key: "delta", label: "Variação", width: "13%", align: "right", render: (b) => <Text style={[styles.td, { textAlign: "right", color: toneColors(deltaTone(b.nota, b.nota_anterior)).fg }]}>{fmtDeltaPts(b.nota, b.nota_anterior)}</Text> },
            ]}
          />
        </Section>

        <Section title="O que está bom" hint="Itens com média 5 (Padrão DA RUA) em todas as auditorias do mês.">
          <ItemList items={d.bons} empty="Nenhum item ficou com média 5 no mês." />
        </Section>

        <Section title="O que manter" hint="Itens com média 4 ou mais (dentro do padrão).">
          <ItemList items={d.manter} empty="Nenhum item com média 4 ou mais." />
        </Section>

        <Section title="O que melhorar" hint="Itens com média 3 ou menos, do pior para o melhor, com nº de ocorrências de nota 1–3.">
          <ItemList items={d.melhorar} empty="Nenhum item com média 3 ou menos. Parabéns!" showOcorrencias />
        </Section>

        <Section title="Apontamentos" hint="Itens com nota 1 ou 2 registrados nas auditorias do mês, com observação e foto.">
          {d.apontamentos.length === 0 ? <Empty text="Nenhum apontamento no mês." /> : d.apontamentos.map((a, i) => <Apontamento key={i} a={a} />)}
        </Section>

        <Section title="Nutrição" hint="Auditorias da nutricionista no mês (nota % = itens conformes ÷ itens aplicáveis).">
          {d.nutri && d.nutri.n > 0 ? (
            <View>
              <View style={[styles.statGrid, { marginTop: 0 }]}>
                <Stat label="Nota nutricional" value={fmtPct(d.nutri.nota, 1)} tone={toneOfNutri(d.nutri.classificacao)} hint={d.nutri.classificacao ?? ""} />
                <Stat label="Visitas no mês" value={String(d.nutri.n)} small />
                <Stat label="Mês anterior" value={fmtPct(d.nutri.anterior, 1)} hint={`variação: ${fmtDeltaPts(d.nutri.nota, d.nutri.anterior)}`} tone={deltaTone(d.nutri.nota, d.nutri.anterior)} small />
              </View>
              <View style={{ marginTop: 8 }}>
                <Table<ReportNutriApontamento>
                  rows={d.nutri.apontamentos}
                  empty="Nenhuma não conformidade apontada no mês."
                  columns={[
                    { key: "data", label: "Data", width: "12%", render: (r) => formatDatePT(r.data) },
                    { key: "area", label: "Área", width: "22%", render: (r) => r.area },
                    { key: "item", label: "Não conformidade", width: "36%", render: (r) => r.item },
                    { key: "obs", label: "Observação", width: "30%", render: (r) => r.observacao ?? "—" },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Empty text="Sem auditoria nutricional no mês." />
          )}
        </Section>

        <Section title="Indicadores 99Food" hint="Informativos: não compõem a nota (lançados pelo proprietário no fechamento).">
          {d.food99 ? (
            <View style={[styles.statGrid, { marginTop: 0 }]}>
              <Stat label="Nota média" value={d.food99.nota_99food == null ? "—" : fmtNum(d.food99.nota_99food, 2)} small />
              <Stat label="Cancelamentos" value={d.food99.cancelamentos == null ? "—" : String(d.food99.cancelamentos)} small />
              <Stat label="Tempo médio de entrega" value={d.food99.tempo_medio_entrega == null ? "—" : `${d.food99.tempo_medio_entrega} min`} small />
            </View>
          ) : (
            <Empty text="Indicadores não lançados para este mês." />
          )}
        </Section>

        <Section title="Auditorias do mês">
          <Table<ReportAuditRow>
            rows={d.auditorias}
            empty="Nenhuma auditoria concluída no mês."
            columns={[
              { key: "data", label: "Data", width: "16%", render: (r) => formatDatePT(r.data) },
              { key: "tipo", label: "Tipo", width: "22%", render: (r) => AUDIT_TYPE_SHORT[r.tipo] },
              { key: "auditor", label: "Auditor", width: "34%", render: (r) => r.auditor },
              { key: "nota", label: "Nota", width: "14%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfPct(r.nota)).fg }]}>{fmtPct(r.nota, 1)}</Text> },
              { key: "fg", label: "", width: "14%", render: (r) => (r.falha_grave ? <Chip label="falha grave" tone="red" /> : "") },
            ]}
          />
        </Section>

        <View style={styles.signature} wrap={false}>
          <Text style={styles.signatureBox}>Assinatura do supervisor: ____________________________</Text>
          <Text style={[styles.signatureBox, { flex: 0.5 }]}>Data: ___/___/______</Text>
        </View>

        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
