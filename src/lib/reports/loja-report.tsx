// Relatório mensal por loja (para o supervisor). Recebe LojaReportData já montado.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { AUDIT_TYPE_SHORT } from "../constants";
import { formatDatePT } from "../dates";
import type { Detalhe99 } from "../indicadores-99";
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
  type Tone,
  toneColors,
  toneOfNutri,
  toneOfPct,
  toneOfScore,
} from "./pdf-ui";
import type { LojaReportData, ReportApontamento, ReportAuditRow, ReportBlockRow, ReportItemStat, ReportNutriApontamento, ReportPendencia, ReportRecorrente } from "./types";

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

/** Resumo em linguagem simples para o supervisor: o que importa do mês em poucas linhas. */
function resumoDoMes(d: LojaReportData): string[] {
  const out: string[] = [];
  if (d.n_auditorias === 0) {
    out.push(`A loja não teve auditoria concluída em ${d.mesLabel}.`);
  } else {
    const nota = `Nota do mês: ${fmtPct(d.nota, 1)}`;
    const varia = d.anterior?.nota != null && d.nota != null ? ` (${fmtDeltaPts(d.nota, d.anterior.nota)} em relação a ${d.mesAnteriorLabel})` : d.anterior ? ` (sem nota em ${d.mesAnteriorLabel})` : "";
    const pos = d.fora_do_ranking ? "" : d.posicao != null ? ` · ${d.posicao}º de ${d.total_ranqueadas} lojas${d.premiada ? " · loja premiada" : ""}` : "";
    out.push(`${nota}${varia}${pos}.`);
    out.push(
      d.unidade.tipo === "producao"
        ? `${d.n_auditorias} ${plural(d.n_auditorias, "auditoria", "auditorias")} da cozinha central no mês.`
        : `${d.n_auditorias} ${plural(d.n_auditorias, "auditoria", "auditorias")} no mês (${d.n_completas} ${plural(d.n_completas, "completa", "completas")}, ${d.n_simplificadas} ${plural(d.n_simplificadas, "simplificada", "simplificadas")}).`,
    );
  }
  if (d.bons.length > 0) out.push(`Onde acertaram: ${d.bons.length} ${plural(d.bons.length, "item ficou", "itens ficaram")} no padrão máximo em todas as auditorias — ex.: ${d.bons.slice(0, 3).map((b) => b.descricao).join("; ")}.`);
  if (d.melhorar.length > 0) out.push(`Prioridades: ${d.melhorar.slice(0, 3).map((m) => `${m.descricao} (média ${fmtNum(m.media, 1)})`).join("; ")}.`);
  if (d.recorrentes.length > 0) out.push(`${d.recorrentes.length} ${plural(d.recorrentes.length, "item repete", "itens repetem")} nota baixa pelo 2º mês seguido — ver "O que é recorrente".`);
  const reinc = d.pendencias.filter((p) => p.reincidente).length;
  if (d.pendencias.length > 0) out.push(`${d.pendencias.length} ${plural(d.pendencias.length, "pendência", "pendências")} em aberto para a próxima visita${reinc ? ` (${reinc} ${plural(reinc, "reincidente", "reincidentes")})` : ""}.`);
  if (d.nutri && d.nutri.n > 0) out.push(`Nutrição: ${fmtPct(d.nutri.nota, 1)} (${d.nutri.classificacao ?? "—"}) em ${d.nutri.n} ${plural(d.nutri.n, "visita", "visitas")}, ${d.nutri.apontamentos.length} ${plural(d.nutri.apontamentos.length, "não conformidade", "não conformidades")}.`);
  if (d.food99) {
    const partes: string[] = [];
    if (d.food99.pedidos != null) partes.push(`${d.food99.pedidos.toLocaleString("pt-BR")} pedidos`);
    if (d.food99.nota_99food != null) partes.push(`nota 99Food ${fmtNum(d.food99.nota_99food, 2)}`);
    if (d.food99.cancelamentos != null) partes.push(`${d.food99.cancelamentos} ${plural(d.food99.cancelamentos, "cancelamento", "cancelamentos")}`);
    if (d.food99.tempo_medio_entrega != null) partes.push(`entrega média ${d.food99.tempo_medio_entrega} min`);
    const det = d.food99.detalhe;
    if (det) {
      if (det.avaliacoes) partes.push(`${det.avaliacoes} ${plural(det.avaliacoes, "avaliação", "avaliações")}`);
      if (det.novos_pct != null) partes.push(`${det.novos_pct}% de clientes novos`);
    }
    if (partes.length) out.push(`Delivery: ${partes.join(" · ")}.`);
  }
  return out;
}

/** Pontos de atenção: tudo que precisa de ação imediata do supervisor, do mais grave para o menos. */
function pontosDeAtencao(d: LojaReportData): { tone: Tone; texto: string }[] {
  const out: { tone: Tone; texto: string }[] = [];
  if (d.falhas_graves > 0) {
    const itens = Array.from(new Set(d.apontamentos.filter((a) => a.falha_grave).map((a) => a.item)));
    out.push({ tone: "red", texto: `${d.falhas_graves} ${plural(d.falhas_graves, "falha grave", "falhas graves")} no mês${itens.length ? `: ${itens.join("; ")}` : ""}. Zera o bloco e tira a loja da premiação.` });
  }
  if (d.produto_vencido) out.push({ tone: "red", texto: "Produto vencido encontrado em auditoria: loja inelegível à premiação do mês." });
  for (const b of d.blocos.filter((b) => b.zerado)) out.push({ tone: "red", texto: `Bloco "${b.nome}" zerado por falha grave.` });
  for (const p of d.pendencias.filter((p) => p.reincidente)) out.push({ tone: "red", texto: `Pendência reincidente sem resolver desde ${formatDatePT(p.desde)}: ${p.descricao}` });
  for (const r of d.recorrentes) out.push({ tone: "orange", texto: `Recorrente: ${r.descricao} — média ${fmtNum(r.media, 1)} agora e ${fmtNum(r.media_anterior, 1)} em ${d.mesAnteriorLabel}.` });
  if (d.nota != null && d.anterior?.nota != null && d.nota - d.anterior.nota <= -5) out.push({ tone: "orange", texto: `A nota caiu ${fmtNum(d.anterior.nota - d.nota, 1)} pontos em relação a ${d.mesAnteriorLabel}.` });
  for (const b of d.blocos.filter((b) => !b.zerado && b.nota != null && b.nota_anterior != null && b.nota - b.nota_anterior <= -10)) out.push({ tone: "orange", texto: `Bloco "${b.nome}" caiu ${fmtNum(b.nota_anterior! - b.nota!, 0)} pontos (${fmtPct(b.nota_anterior)} → ${fmtPct(b.nota)}).` });
  if (d.nutri && d.nutri.n > 0 && (d.nutri.classificacao === "Insatisfatório" || d.nutri.classificacao === "Regular")) out.push({ tone: d.nutri.classificacao === "Insatisfatório" ? "red" : "orange", texto: `Nutrição com classificação ${d.nutri.classificacao} (${fmtPct(d.nutri.nota, 1)}): ${d.nutri.apontamentos.length} ${plural(d.nutri.apontamentos.length, "não conformidade", "não conformidades")} no mês.` });
  const abertas = d.pendencias.filter((p) => !p.reincidente).length;
  if (abertas > 0) out.push({ tone: "yellow", texto: `${abertas} ${plural(abertas, "pendência aberta", "pendências abertas")} da auditoria: serão conferidas na próxima visita.` });
  if (d.food99) {
    if (d.food99.nota_99food != null && d.food99.nota_99food < 4.5) out.push({ tone: "orange", texto: `Nota 99Food em ${fmtNum(d.food99.nota_99food, 2)} (abaixo de 4,5).` });
    const det = d.food99.detalhe;
    if (det) {
      if ((det.nao_aceitos_pct ?? 0) >= 2) out.push({ tone: "orange", texto: `${det.nao_aceitos} pedidos não aceitos no prazo (${fmtNum(det.nao_aceitos_pct, 1)}%): a 99 cancelou porque a loja não confirmou. Venda perdida, concentrada nos horários de pico.` });
      if (det.cancel_pct != null && det.cancel_pct >= 5) out.push({ tone: "orange", texto: `${det.cancelados} pedidos cancelados de ${(det.concluidos + det.cancelados).toLocaleString("pt-BR")} (${fmtNum(det.cancel_pct, 1)}%), sem contar desistências imediatas do cliente.` });
      if (det.cancel_loja > 0) {
        const motivos = Object.entries(det.cancel_motivos_loja).map(([m, n]) => `${m} (${n})`).join(", ");
        out.push({ tone: "orange", texto: `${det.cancel_loja} ${plural(det.cancel_loja, "cancelamento", "cancelamentos")} por responsabilidade da loja${motivos ? `: ${motivos}` : ""}.` });
      }
      if (det.atraso_pct != null && det.atraso_pct >= 5) out.push({ tone: "orange", texto: `${det.atrasados} pedidos com preparação atrasada (${fmtNum(det.atraso_pct, 1)}%).` });
      const neg = Object.entries(det.tags_negativas).slice(0, 3).map(([t, n]) => `${t} (${n})`);
      const baixas = det.distribuicao["1"] + det.distribuicao["2"] + det.distribuicao["3"];
      if (baixas > 0 && det.avaliacoes > 0 && baixas / det.avaliacoes >= 0.1) out.push({ tone: "orange", texto: `${baixas} ${plural(baixas, "avaliação", "avaliações")} de 1 a 3 estrelas em ${det.avaliacoes}${neg.length ? `: ${neg.join(", ")}` : ""}.` });
      if (det.itens_em_falta > 0) out.push({ tone: "yellow", texto: `${det.itens_em_falta} ${plural(det.itens_em_falta, "pedido entregue", "pedidos entregues")} com item em falta.` });
    } else if (d.food99.pedidos && d.food99.cancelamentos != null && d.food99.cancelamentos / (d.food99.pedidos + d.food99.cancelamentos) >= 0.1) {
      out.push({ tone: "orange", texto: `${d.food99.cancelamentos} cancelamentos para ${d.food99.pedidos.toLocaleString("pt-BR")} pedidos concluídos (${fmtNum((d.food99.cancelamentos / (d.food99.pedidos + d.food99.cancelamentos)) * 100, 1)}%).` });
    }
  }
  if (d.amostra_reduzida) out.push({ tone: "yellow", texto: "Amostra reduzida: menos auditorias que o previsto; a nota do mês tem menos peso." });
  return out;
}

/** Detalhe do relatório da 99: avaliações, cancelamentos, atrasos e o que os clientes reclamaram. */
function Detalhe99Bloco({ det }: { det: Detalhe99 }) {
  const estrelas = (["5", "4", "3", "2", "1"] as const).map((k) => ({ k, n: det.distribuicao[k] }));
  const neg = Object.entries(det.tags_negativas);
  const pos = Object.entries(det.tags_positivas).slice(0, 4);
  const resp = Object.entries(det.cancel_resp).sort((a, b) => b[1] - a[1]);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={[styles.row, { gap: 8 }]} wrap={false}>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={[styles.bold, { fontSize: 8.5, marginBottom: 3 }]}>Avaliações dos clientes</Text>
          {det.avaliacoes === 0 ? (
            <Text style={styles.empty}>Sem avaliações no mês.</Text>
          ) : (
            estrelas.map(({ k, n }) => (
              <View key={k} style={[styles.row, { alignItems: "center", marginBottom: 2 }]}>
                <Text style={[styles.tdMuted, { width: 42 }]}>{k} estrela{k === "1" ? "" : "s"}</Text>
                <Bar pct={det.avaliacoes ? (n / det.avaliacoes) * 100 : 0} tone={k === "5" || k === "4" ? "green" : k === "3" ? "yellow" : "red"} height={5} />
                <Text style={[styles.tdMuted, { width: 34, textAlign: "right" }]}>{n}</Text>
              </View>
            ))
          )}
          {pos.length ? <Text style={[styles.tdMuted, { marginTop: 3 }]}>Elogios: {pos.map(([t, n]) => `${t} (${n})`).join(", ")}</Text> : null}
        </View>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={[styles.bold, { fontSize: 8.5, marginBottom: 3 }]}>Operação</Text>
          <Text style={styles.td}>Preparação atrasada: {det.atrasados} ({det.atraso_pct == null ? "—" : `${fmtNum(det.atraso_pct, 1)}%`})</Text>
          <Text style={styles.td}>Pedidos com item em falta: {det.itens_em_falta}</Text>
          <Text style={styles.td}>Clientes novos: {det.novos_clientes.toLocaleString("pt-BR")}{det.novos_pct != null ? ` (${fmtNum(det.novos_pct, 0)}%)` : ""}</Text>
          <Text style={styles.td}>Aceite do pedido: {det.tempo_aceite_medio == null ? "—" : `${fmtNum(det.tempo_aceite_medio, 0)} s`} em média</Text>
          <Text style={[styles.bold, { fontSize: 8.5, marginTop: 5, marginBottom: 2 }]}>Cancelamentos ({det.cancelados})</Text>
          <Text style={[styles.td, { color: (det.nao_aceitos_pct ?? 0) >= 2 ? toneColors("orange").fg : COLORS.ink }]}>Não aceitos no prazo: {det.nao_aceitos ?? 0}{det.nao_aceitos_pct != null ? ` (${fmtNum(det.nao_aceitos_pct, 1)}%)` : ""}</Text>
          <Text style={styles.td}>Cancelados pela loja: {det.cancel_loja}{Object.keys(det.cancel_motivos_loja).length ? ` — ${Object.entries(det.cancel_motivos_loja).map(([m, n]) => `${m} (${n})`).join("; ")}` : ""}</Text>
          <Text style={styles.td}>Depois do aceite: {det.cancel_apos_aceite ?? 0}{resp.length ? ` — ${resp.map(([r, n]) => `${r.replace("Responsabilidade d", "d")} ${n}`).join(", ")}` : ""}</Text>
          <Text style={[styles.tdMuted, { marginTop: 2 }]}>Desistências imediatas (menos de 1 min, fora do número acima): {det.desistencias ?? 0}</Text>
        </View>
      </View>
      {neg.length > 0 || det.comentarios_negativos.length > 0 ? (
        <View style={[styles.card, { marginTop: 8, borderLeftWidth: 3, borderLeftColor: toneColors("orange").fg }]} wrap={false}>
          <Text style={[styles.bold, { fontSize: 8.5, marginBottom: 3 }]}>O que os clientes reclamaram (avaliações de 1 a 3 estrelas)</Text>
          {neg.length ? <Text style={styles.td}>{neg.map(([t, n]) => `${t} (${n})`).join(" · ")}</Text> : null}
          {det.comentarios_negativos.slice(0, 5).map((c, i) => (
            <Text key={i} style={[styles.tdMuted, { marginTop: 2 }]}>
              {formatDatePT(c.data)} · {c.nota} {c.nota === 1 ? "estrela" : "estrelas"} · “{c.texto}”
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: Tone }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={[styles.row, { marginBottom: 3 }]} wrap={false}>
          <Text style={[styles.bullet, { color: tone ? toneColors(tone).fg : COLORS.muted }]}>•</Text>
          <Text style={[styles.td, { flex: 1, lineHeight: 1.35 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

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

  const footer = `ROTA · Relatório mensal · ${d.unidade.nome} · ${d.mesLabel}${d.oficial ? "" : " · PRÉVIA"}`;
  const resumo = resumoDoMes(d);
  const atencao = pontosDeAtencao(d);

  return (
    <Document title={`Relatório mensal — ${d.unidade.nome} — ${d.mesLabel}`} author="ROTA" language="pt-BR">
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

        <View style={[styles.card, { marginTop: 14, backgroundColor: COLORS.graySoft, borderColor: COLORS.border }]}>
          <Text style={[styles.bold, { fontSize: 10.5, marginBottom: 5, color: COLORS.ink }]}>Resumo do mês para o supervisor</Text>
          <Bullets items={resumo} />
          {d.recado ? (
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: COLORS.border }}>
              <Text style={[styles.bold, { fontSize: 9, color: COLORS.graphite }]}>Recado da direção</Text>
              <Text style={[styles.td, { marginTop: 2, lineHeight: 1.35 }]}>{d.recado}</Text>
            </View>
          ) : null}
        </View>

        <Section title="Pontos de atenção" hint="O que precisa de ação imediata, do mais grave para o menos grave.">
          {atencao.length === 0 ? (
            <View style={[styles.row, { alignItems: "center", gap: 6 }]}>
              <Chip label="SEM PONTOS CRÍTICOS" tone="green" />
              <Text style={styles.tdMuted}>Nenhuma falha grave, recorrência ou pendência reincidente no mês.</Text>
            </View>
          ) : (
            <View>
              {atencao.map((a, i) => (
                <View key={i} style={[styles.row, { marginBottom: 4, alignItems: "flex-start" }]} wrap={false}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 3, marginRight: 6, backgroundColor: toneColors(a.tone).fg }} />
                  <Text style={[styles.td, { flex: 1, lineHeight: 1.35 }]}>{a.texto}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

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

        <Section title="O que é recorrente" hint={`Itens com média 3 ou menos neste mês e também em ${d.mesAnteriorLabel}: o problema se repete e precisa de plano de ação.`}>
          <Table<ReportRecorrente>
            rows={d.recorrentes}
            empty={d.anterior ? "Nenhum item repetiu nota baixa em relação ao mês anterior." : "Sem mês anterior para comparar."}
            columns={[
              { key: "item", label: "Item", width: "52%", render: (r) => r.descricao },
              { key: "media", label: `Média ${d.mesLabel.split(" de ")[0]}`, width: "16%", align: "right", render: (r) => <Text style={[styles.td, styles.bold, { textAlign: "right", color: toneColors(toneOfScore(r.media)).fg }]}>{fmtNum(r.media, 1)}</Text> },
              { key: "ant", label: `Média ${d.mesAnteriorLabel.split(" de ")[0]}`, width: "16%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: toneColors(toneOfScore(r.media_anterior)).fg }]}>{fmtNum(r.media_anterior, 1)}</Text> },
              { key: "oc", label: "Notas 1–3", width: "16%", align: "right", render: (r) => `${r.ocorrencias} + ${r.ocorrencias_anterior}` },
            ]}
          />
        </Section>

        <Section title="Pendências em aberto" hint="Apontadas em auditorias anteriores e ainda não resolvidas; serão conferidas na próxima visita. Reincidente = segue sem resolver há mais de uma visita.">
          <Table<ReportPendencia>
            rows={d.pendencias}
            empty="Nenhuma pendência em aberto."
            columns={[
              { key: "desde", label: "Desde", width: "13%", render: (p) => formatDatePT(p.desde) },
              { key: "origem", label: "Origem", width: "13%", render: (p) => (p.origem === "nutri" ? "Nutrição" : "Gerente") },
              { key: "desc", label: "Pendência", width: "50%", render: (p) => p.descricao },
              { key: "visitas", label: "Visitas", width: "10%", align: "right", render: (p) => String(p.visitas_sem_resolver) },
              { key: "st", label: "", width: "14%", render: (p) => (p.reincidente ? <Chip label="REINCIDENTE" tone="red" /> : <Chip label="aberta" tone="yellow" />) },
            ]}
          />
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

        <Section title="Delivery e indicadores 99Food" hint={d.food99?.detalhe ? `Relatório "Dados do pedido" da 99 importado no fechamento (${d.food99.detalhe.dias} dias${d.food99.detalhe.periodo ? `, ${formatDatePT(d.food99.detalhe.periodo.de)} a ${formatDatePT(d.food99.detalhe.periodo.ate)}` : ""}). Informativo: não compõe a nota.` : "Informativos: não compõem a nota (lançados pelo proprietário no fechamento)."}>
          {d.food99 ? (
            <View>
              <View style={[styles.statGrid, { marginTop: 0 }]}>
                <Stat label="Pedidos no mês" value={d.food99.pedidos == null ? "—" : d.food99.pedidos.toLocaleString("pt-BR")} hint={d.food99.detalhe ? "concluídos" : undefined} small />
                <Stat label="Nota 99Food" value={d.food99.nota_99food == null ? "—" : fmtNum(d.food99.nota_99food, 2)} hint={d.food99.detalhe ? `${d.food99.detalhe.avaliacoes} ${plural(d.food99.detalhe.avaliacoes, "avaliação", "avaliações")}` : undefined} small />
                <Stat label="Cancelamentos" value={d.food99.cancelamentos == null ? "—" : String(d.food99.cancelamentos)} hint={d.food99.detalhe?.cancel_pct != null ? `${fmtNum(d.food99.detalhe.cancel_pct, 1)}% · ${d.food99.detalhe.nao_aceitos ?? 0} não aceitos` : undefined} small />
                <Stat label="Tempo médio de entrega" value={d.food99.tempo_medio_entrega == null ? "—" : `${d.food99.tempo_medio_entrega} min`} hint={d.food99.detalhe?.tempo_preparo_medio != null ? `preparo ${fmtNum(d.food99.detalhe.tempo_preparo_medio, 0)} min · entrega ${fmtNum(d.food99.detalhe.tempo_entrega_medio, 0)} min` : undefined} small />
              </View>
              {d.food99.detalhe ? <Detalhe99Bloco det={d.food99.detalhe} /> : null}
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
