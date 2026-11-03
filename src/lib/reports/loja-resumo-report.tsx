// Versão RESUMIDA (uma página) do relatório mensal por loja — a que vai para o grupo dos supervisores.
// Só o essencial: nota, o que precisa de ação, auditoria do gerente, auditoria da nutrição e delivery.
// Usa os mesmos dados do relatório completo (LojaReportData); o completo continua disponível no ROTA.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatDatePT } from "../dates";
import { BrandHeader, Chip, COLORS, deltaTone, fmtDeltaPts, fmtNum, fmtPct, PageFooter, styles, type Tone, toneColors, toneOfNutri, toneOfPct, toneOfScore } from "./pdf-ui";
import { plural, pontosDeAtencao } from "./loja-report";
import type { LojaReportData, ReportItemStat } from "./types";

const MAX_ATENCAO = 5;
const MAX_ITENS = 4;

function Bloco({ titulo, cor, children, lado }: { titulo: string; cor: string; children: React.ReactNode; lado?: string }) {
  return (
    <View style={{ marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden" }} wrap={false}>
      <View style={{ backgroundColor: cor, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, color: COLORS.white, letterSpacing: 0.8 }}>{titulo}</Text>
        {lado ? <Text style={{ fontSize: 8, color: COLORS.white }}>{lado}</Text> : null}
      </View>
      <View style={{ padding: 10 }}>{children}</View>
    </View>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Tone }) {
  const color = tone && tone !== "gray" ? toneColors(tone).fg : COLORS.ink;
  return (
    <View style={[styles.stat, { paddingVertical: 8 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { fontSize: 18, color }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function Lista({ titulo, itens, vazio, recorrentes, tone }: { titulo: string; itens: ReportItemStat[]; vazio: string; recorrentes?: Set<string>; tone: Tone }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.bold, { fontSize: 8.5, color: toneColors(tone).fg, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }]}>{titulo}</Text>
      {itens.length === 0 ? (
        <Text style={styles.empty}>{vazio}</Text>
      ) : (
        itens.slice(0, MAX_ITENS).map((it) => (
          <View key={it.chave} style={[styles.row, { alignItems: "flex-start", marginBottom: 2.5 }]}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 3.5, marginRight: 5, backgroundColor: toneColors(toneOfScore(it.media)).fg }} />
            <Text style={[styles.td, { flex: 1, fontSize: 8.5, lineHeight: 1.3 }]}>
              {it.descricao} <Text style={{ color: COLORS.muted }}>({fmtNum(it.media, 1)})</Text>
              {recorrentes?.has(it.chave) ? <Text style={{ color: toneColors("orange").fg, fontFamily: "Helvetica-Bold" }}> · 2º mês</Text> : null}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export function LojaResumoReportDocument({ data }: { data: LojaReportData }) {
  const d = data;
  const atencao = pontosDeAtencao(d);
  const recorrentes = new Set(d.recorrentes.map((r) => r.chave));
  const posicao = d.fora_do_ranking ? (d.unidade.tipo === "producao" ? "Cozinha central" : "Sem nota") : d.posicao != null ? `${d.posicao}º de ${d.total_ranqueadas}` : "—";
  const pend = d.pendencias;
  const reinc = pend.filter((p) => p.reincidente).length;
  const acertos = d.bons.length > 0 ? d.bons : d.manter;
  const det = d.food99?.detalhe ?? null;
  const baixas = det ? det.distribuicao["1"] + det.distribuicao["2"] + det.distribuicao["3"] : 0;
  const reclamacoes = det ? Object.entries(det.tags_negativas).slice(0, 3).map(([t, n]) => `${t} (${n})`).join(" · ") : "";
  const footer = `ROTA · Resumo mensal · ${d.unidade.nome} · ${d.mesLabel}${d.oficial ? "" : " · PRÉVIA"}`;

  return (
    <Document title={`Resumo mensal — ${d.unidade.nome} — ${d.mesLabel}`} author="ROTA" language="pt-BR">
      <Page size="A4" style={[styles.page, { paddingBottom: 40 }]}>
        <BrandHeader
          title={d.unidade.nome}
          subtitle={`Resumo do mês · ${d.mesLabel}${d.unidade.supervisor_nome ? ` · Supervisor: ${d.unidade.supervisor_nome}` : ""}`}
          right={d.oficial ? `Fechamento de ${d.mesLabel}` : `PRÉVIA · ${d.mesLabel}`}
          meta={d.oficial ? undefined : "Valores parciais, sujeitos ao fechamento do mês"}
        />

        <View style={[styles.statGrid, { marginTop: 10 }]}>
          <Kpi label="Nota do mês" value={fmtPct(d.nota, 1)} tone={toneOfPct(d.nota)} hint={d.anterior?.nota != null ? `${fmtDeltaPts(d.nota, d.anterior.nota)} vs. ${d.mesAnteriorLabel.split(" de ")[0]}` : "sem mês anterior"} />
          <Kpi label="Ranking" value={posicao} hint={d.premiada ? "LOJA PREMIADA" : d.falhas_graves > 0 ? `${d.falhas_graves} ${plural(d.falhas_graves, "falha grave", "falhas graves")}` : d.produto_vencido ? "produto vencido" : `${d.n_auditorias} ${plural(d.n_auditorias, "auditoria", "auditorias")}`} tone={d.premiada ? "green" : undefined} />
          <Kpi label="Nutrição" value={d.nutri && d.nutri.n > 0 ? fmtPct(d.nutri.nota, 1) : "—"} tone={d.nutri && d.nutri.n > 0 ? toneOfNutri(d.nutri.classificacao) : undefined} hint={d.nutri && d.nutri.n > 0 ? `${d.nutri.classificacao ?? ""} · ${d.nutri.n} ${plural(d.nutri.n, "visita", "visitas")}` : "sem visita no mês"} />
          <Kpi label="99Food" value={d.food99?.nota_99food != null ? fmtNum(d.food99.nota_99food, 2) : "—"} tone={d.food99?.nota_99food != null ? (d.food99.nota_99food >= 4.6 ? "green" : d.food99.nota_99food >= 4.3 ? "yellow" : "red") : undefined} hint={d.food99?.pedidos != null ? `${d.food99.pedidos.toLocaleString("pt-BR")} pedidos` : "não lançado"} />
        </View>

        <View style={{ marginTop: 10, borderLeftWidth: 3, borderLeftColor: atencao.length ? toneColors(atencao[0].tone).fg : toneColors("green").fg, paddingLeft: 8 }}>
          <Text style={[styles.bold, { fontSize: 10, marginBottom: 3 }]}>O que precisa de ação este mês</Text>
          {atencao.length === 0 ? (
            <View style={[styles.row, { alignItems: "center", gap: 6 }]}>
              <Chip label="SEM PONTOS CRÍTICOS" tone="green" />
              <Text style={styles.tdMuted}>Nenhuma falha grave, recorrência ou pendência reincidente.</Text>
            </View>
          ) : (
            atencao.slice(0, MAX_ATENCAO).map((a, i) => (
              <View key={i} style={[styles.row, { alignItems: "flex-start", marginBottom: 2.5 }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 3, marginRight: 6, backgroundColor: toneColors(a.tone).fg }} />
                <Text style={[styles.td, { flex: 1, lineHeight: 1.3 }]}>{a.texto}</Text>
              </View>
            ))
          )}
          {atencao.length > MAX_ATENCAO ? <Text style={[styles.tdMuted, { marginTop: 1 }]}>+ {atencao.length - MAX_ATENCAO} no relatório completo.</Text> : null}
        </View>

        <Bloco
          titulo="AUDITORIA DO GERENTE"
          cor={COLORS.ink}
          lado={d.n_auditorias === 0 ? "sem auditoria no mês" : `${d.n_auditorias} ${plural(d.n_auditorias, "auditoria", "auditorias")} · nota ${fmtPct(d.nota, 1)} · ${d.falhas_graves} ${plural(d.falhas_graves, "falha grave", "falhas graves")}`}
        >
          {d.n_auditorias === 0 ? (
            <Text style={styles.empty}>A loja não teve auditoria do gerente concluída em {d.mesLabel}.</Text>
          ) : (
            <View style={[styles.row, { gap: 14 }]}>
              <Lista titulo="Onde a loja acertou" itens={acertos} vazio="Nenhum item no padrão em todas as auditorias." tone="green" />
              <Lista titulo="O que melhorar" itens={d.melhorar} vazio="Nenhum item com média 3 ou menos. Parabéns!" recorrentes={recorrentes} tone="red" />
            </View>
          )}
          <View style={{ marginTop: 6, paddingTop: 5, borderTopWidth: 0.5, borderTopColor: COLORS.border }}>
            <Text style={styles.td}>
              <Text style={styles.bold}>Pendências em aberto: {pend.length}</Text>
              {reinc ? <Text style={{ color: toneColors("red").fg }}> · {reinc} {plural(reinc, "reincidente", "reincidentes")}</Text> : null}
              {pend.length ? <Text style={{ color: COLORS.graphite }}> — {pend.slice(0, 3).map((p) => `${p.descricao} (desde ${formatDatePT(p.desde)})`).join("; ")}{pend.length > 3 ? ` e mais ${pend.length - 3}` : ""}</Text> : null}
            </Text>
          </View>
        </Bloco>

        <Bloco
          titulo="AUDITORIA DA NUTRIÇÃO"
          cor="#2F6B3A"
          lado={d.nutri && d.nutri.n > 0 ? `${d.nutri.n} ${plural(d.nutri.n, "visita", "visitas")} · ${fmtPct(d.nutri.nota, 1)} (${d.nutri.classificacao ?? "—"}) · ${d.nutri.anterior != null ? `${fmtDeltaPts(d.nutri.nota, d.nutri.anterior)} vs. mês anterior` : "sem mês anterior"}` : "sem visita no mês"}
        >
          {d.nutri && d.nutri.n > 0 ? (
            <View>
              <Text style={[styles.bold, { fontSize: 8.5, color: toneColors(d.nutri.apontamentos.length ? "orange" : "green").fg, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }]}>
                {d.nutri.apontamentos.length === 0 ? "Nenhuma não conformidade" : `${d.nutri.apontamentos.length} ${plural(d.nutri.apontamentos.length, "não conformidade", "não conformidades")} — corrigir`}
              </Text>
              {d.nutri.apontamentos.slice(0, MAX_ITENS).map((a, i) => (
                <View key={i} style={[styles.row, { alignItems: "flex-start", marginBottom: 2.5 }]}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 3.5, marginRight: 5, backgroundColor: toneColors("orange").fg }} />
                  <Text style={[styles.td, { flex: 1, fontSize: 8.5, lineHeight: 1.3 }]}>
                    <Text style={{ color: COLORS.muted }}>{a.area} · </Text>
                    {a.item}
                    {a.observacao ? <Text style={{ color: COLORS.graphite }}> — {a.observacao}</Text> : null}
                  </Text>
                </View>
              ))}
              {d.nutri.apontamentos.length > MAX_ITENS ? <Text style={styles.tdMuted}>+ {d.nutri.apontamentos.length - MAX_ITENS} no relatório completo.</Text> : null}
            </View>
          ) : (
            <Text style={styles.empty}>Sem auditoria nutricional em {d.mesLabel}.</Text>
          )}
        </Bloco>

        <Bloco titulo="DELIVERY · 99FOOD" cor="#B45309" lado={det?.periodo ? `${det.dias} dias · ${formatDatePT(det.periodo.de)} a ${formatDatePT(det.periodo.ate)}` : d.food99 ? "lançado à mão" : "não lançado"}>
          {d.food99 ? (
            <View>
              <View style={[styles.row, { gap: 8 }]}>
                {[
                  { l: "Pedidos", v: d.food99.pedidos == null ? "—" : d.food99.pedidos.toLocaleString("pt-BR"), t: undefined as Tone | undefined },
                  { l: "Nota", v: d.food99.nota_99food == null ? "—" : fmtNum(d.food99.nota_99food, 2), t: d.food99.nota_99food == null ? undefined : d.food99.nota_99food >= 4.6 ? ("green" as Tone) : d.food99.nota_99food >= 4.3 ? ("yellow" as Tone) : ("red" as Tone) },
                  { l: "Não aceitos", v: det ? `${det.nao_aceitos ?? 0} (${fmtNum(det.nao_aceitos_pct ?? 0, 1)}%)` : "—", t: det && (det.nao_aceitos_pct ?? 0) >= 2 ? ("orange" as Tone) : undefined },
                  { l: "Cancelados", v: d.food99.cancelamentos == null ? "—" : det?.cancel_pct != null ? `${d.food99.cancelamentos} (${fmtNum(det.cancel_pct, 1)}%)` : String(d.food99.cancelamentos), t: det && (det.cancel_pct ?? 0) >= 5 ? ("orange" as Tone) : undefined },
                  { l: "Tempo médio", v: d.food99.tempo_medio_entrega == null ? "—" : `${d.food99.tempo_medio_entrega} min`, t: undefined },
                  { l: "Atrasos", v: det?.atraso_pct == null ? "—" : `${fmtNum(det.atraso_pct, 1)}%`, t: det && (det.atraso_pct ?? 0) >= 5 ? ("orange" as Tone) : undefined },
                ].map((k) => (
                  <View key={k.l} style={{ flex: 1 }}>
                    <Text style={[styles.statLabel, { fontSize: 7 }]}>{k.l}</Text>
                    <Text style={[styles.bold, { fontSize: 12, marginTop: 2, color: k.t ? toneColors(k.t).fg : COLORS.ink }]}>{k.v}</Text>
                  </View>
                ))}
              </View>
              {det ? (
                <Text style={[styles.tdMuted, { marginTop: 5 }]}>
                  {det.avaliacoes} {plural(det.avaliacoes, "avaliação", "avaliações")}
                  {baixas ? `, ${baixas} de 1 a 3 estrelas` : ""}
                  {reclamacoes ? ` — reclamações: ${reclamacoes}` : ""}
                  {det.comentarios_negativos[0] ? ` · “${det.comentarios_negativos[0].texto}”` : ""}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.empty}>Indicadores não lançados para este mês.</Text>
          )}
        </Bloco>

        {d.recado ? (
          <View style={[styles.card, { marginTop: 8, backgroundColor: COLORS.graySoft }]} wrap={false}>
            <Text style={[styles.bold, { fontSize: 9, color: COLORS.graphite }]}>Recado da direção</Text>
            <Text style={[styles.td, { marginTop: 2, lineHeight: 1.35 }]}>{d.recado}</Text>
          </View>
        ) : null}

        <PageFooter left={`${footer} · versão resumida (o relatório completo está no ROTA)`} />
      </Page>
    </Document>
  );
}
