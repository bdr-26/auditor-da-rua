// PDF dos controles digitais (planilhas): um registro, ou a compilação do mês por unidade e tipo.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { cabecalhoVisivel, camposDaLinha, formatCampo, linhaPreenchida, linhaVisivel, rotuloCampo, type Campo, type ControleDados, type ControleTipo } from "../nutri/controle-tipos";
import { BrandHeader, Chip, COLORS, Empty, PageFooter, Section, Stat, styles, Table } from "./pdf-ui";

export interface ControleReportRegistro {
  id: string;
  data: string; // dd/mm/aaaa
  dataIso: string;
  responsavel: string;
  status: "rascunho" | "finalizado";
  finalizadoEm: string | null;
  observacoes: string | null;
  dados: ControleDados;
  alertas: { linha: string; campo: string; alerta: string }[];
  /** caminho da foto → data URI (campos `foto`) */
  fotos: Record<string, string>;
}

export interface ControleReportData {
  tipo: ControleTipo;
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  geradoEm: string;
  /** Um registro (PDF individual) ou vários (mensal). */
  registros: ControleReportRegistro[];
  mesLabel?: string;
}

function cabecalhoRows(tipo: ControleTipo, dados: ControleDados): { label: string; valor: string; alerta: string | null }[] {
  return cabecalhoVisivel(tipo, dados.cabecalho)
    .filter((c) => dados.cabecalho[c.key] != null && dados.cabecalho[c.key] !== "")
    .map((c) => ({ label: rotuloCampo(c, dados.cabecalho), valor: formatCampo(c, dados.cabecalho[c.key]), alerta: c.alerta ? c.alerta(dados.cabecalho[c.key], {}, dados.cabecalho) : null }));
}

function columnsFor(tipo: ControleTipo, dados: ControleDados) {
  const campos = tipo.campos.filter((c) => c.tipo !== "foto");
  const first = 24;
  const rest = (100 - first) / Math.max(1, campos.length);
  return [
    { key: "nome", label: tipo.linhaLabel, width: `${first}%`, render: (l: ControleDados["linhas"][number]) => l.nome || "—" },
    ...campos.map((c: Campo) => ({
      key: c.key,
      label: rotuloCampo(c, dados.cabecalho),
      width: `${rest}%`,
      align: (c.tipo === "number" ? "right" : "left") as "right" | "left",
      render: (l: ControleDados["linhas"][number]) => {
        const v = l[c.key];
        const alerta = c.alerta && v != null && v !== "" ? c.alerta(v, l, dados.cabecalho) : null;
        const txt = formatCampo(c, v);
        return alerta ? <Text style={{ color: COLORS.red, fontFamily: "Helvetica-Bold" }}>{txt}</Text> : txt;
      },
    })),
  ];
}

/** Fotos de uma linha (campos `foto`). */
function FotosLinha({ r, tipo, l }: { r: ControleReportRegistro; tipo: ControleTipo; l: Record<string, unknown> }) {
  const paths = camposDaLinha(tipo, l).filter((c) => c.tipo === "foto").flatMap((c) => (Array.isArray(l[c.key]) ? (l[c.key] as unknown[]).map(String) : []));
  const uris = paths.map((p) => r.fotos[p]).filter((u): u is string => !!u);
  if (uris.length === 0) return null;
  return (
    <View style={styles.photoRow}>
      {uris.map((u, i) => (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
        <Image key={i} src={u} style={styles.photo} />
      ))}
    </View>
  );
}

export function Registro({ r, tipo, compact }: { r: ControleReportRegistro; tipo: ControleTipo; compact?: boolean }) {
  const cab = cabecalhoRows(tipo, r.dados);
  const linhas = r.dados.linhas.filter((l) => linhaVisivel(tipo, r.dados.cabecalho, l) && (l.nome || linhaPreenchida(tipo, l)));
  const temFoto = tipo.campos.some((c) => c.tipo === "foto") && linhas.some((l) => camposDaLinha(tipo, l).some((c) => c.tipo === "foto" && Array.isArray(l[c.key]) && (l[c.key] as unknown[]).length > 0));
  const variam = linhas.some((l) => Array.isArray(l.campos)); // linhas com conjuntos de campos diferentes
  const ficha = tipo.campos.length > 8 || temFoto || variam; // muitos campos: cada linha vira uma ficha (rótulo: valor) em vez de tabela estreita
  return (
    <Section title={compact ? `${r.data} · ${r.responsavel}` : "Registros"} hint={compact ? undefined : tipo.descricao}>
      {cab.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          {cab.map((c) => (
            <Text key={c.label} style={{ fontSize: 8.5 }}>
              <Text style={{ color: COLORS.muted }}>{c.label}: </Text>
              <Text style={c.alerta ? { color: COLORS.red, fontFamily: "Helvetica-Bold" } : undefined}>{c.valor}</Text>
            </Text>
          ))}
        </View>
      )}
      {ficha ? (
        linhas.length === 0 ? (
          <Empty text="Nenhuma linha preenchida." />
        ) : (
          linhas.map((l, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 6, marginBottom: 4 }} wrap={false}>
              <Text style={[styles.bold, { marginBottom: 2 }]}>{typeof l.grupo === "string" ? `${l.grupo} · ` : ""}{l.nome || "—"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {camposDaLinha(tipo, l).map((c) => {
                  const v = l[c.key];
                  if (v == null || v === "" || c.tipo === "foto") return null;
                  const alerta = c.alerta ? c.alerta(v, l, r.dados.cabecalho) : null;
                  return (
                    <Text key={c.key} style={{ fontSize: 8, width: "31%" }}>
                      <Text style={{ color: COLORS.muted }}>{rotuloCampo(c, r.dados.cabecalho)}: </Text>
                      <Text style={alerta ? { color: COLORS.red, fontFamily: "Helvetica-Bold" } : undefined}>{formatCampo(c, v)}</Text>
                    </Text>
                  );
                })}
              </View>
              <FotosLinha r={r} tipo={tipo} l={l} />
            </View>
          ))
        )
      ) : (
        <Table<ControleDados["linhas"][number]> columns={columnsFor(tipo, r.dados)} rows={linhas} empty="Nenhuma linha preenchida." />
      )}
      {r.alertas.length > 0 && (
        <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {r.alertas.map((a, i) => (
            <Chip key={i} label={`${a.linha}: ${a.campo} ${a.alerta}`} tone="red" />
          ))}
        </View>
      )}
      {r.observacoes ? <Text style={{ marginTop: 6, fontSize: 8.5 }}>Observações: {r.observacoes}</Text> : null}
    </Section>
  );
}

export function ControleReportDocument({ data }: { data: ControleReportData }) {
  const d = data;
  const unico = d.registros.length === 1 && !d.mesLabel;
  const r0 = d.registros[0];
  const footer = `ROTA · ${d.tipo.nome} · ${d.unidade.nome}${d.mesLabel ? ` · ${d.mesLabel}` : r0 ? ` · ${r0.data}` : ""}`;
  const meta = unico && r0 ? [`Responsável: ${r0.responsavel}`, r0.status === "finalizado" ? `Finalizado em ${r0.finalizadoEm ?? "—"}` : "RASCUNHO", `Emitido em ${d.geradoEm}`].join("  ·  ") : `Emitido em ${d.geradoEm}`;
  const totalAlertas = d.registros.reduce((n, r) => n + r.alertas.length, 0);
  const totalLinhas = d.registros.reduce((n, r) => n + r.dados.linhas.filter((l) => linhaPreenchida(d.tipo, l)).length, 0);
  return (
    <Document title={`${d.tipo.nome} - ${d.unidade.nome}`} author="ROTA · Grupo Da Rua">
      <Page size="A4" style={styles.page}>
        <BrandHeader title={d.tipo.nome} subtitle={d.mesLabel ? `${d.unidade.nome} · ${d.mesLabel}` : `${d.unidade.nome}${r0 ? ` · ${r0.data}` : ""}`} right={d.mesLabel ? "Compilação mensal" : "Controle"} meta={meta} />
        {d.tipo.base ? <Text style={{ fontSize: 8.5, color: COLORS.muted, marginBottom: 8 }}>{d.tipo.base}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <Stat label="Registros" value={String(d.registros.length)} small />
          <Stat label="Linhas preenchidas" value={String(totalLinhas)} small />
          <Stat label="Fora da faixa" value={String(totalAlertas)} tone={totalAlertas > 0 ? "red" : "green"} small />
        </View>
        {d.registros.length === 0 ? <Empty text="Nenhum controle finalizado neste período." /> : d.registros.map((r) => <Registro key={r.id} r={r} tipo={d.tipo} compact={!unico} />)}
        <View style={styles.signature} wrap={false}>
          <Text style={styles.signatureBox}>Responsável: {unico && r0 ? r0.responsavel : "Equipe de nutrição"}</Text>
          <Text style={styles.signatureBox}>Responsável da unidade: {d.unidade.supervisor_nome ?? "____________________"}</Text>
        </View>
        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}

/** Arquivo de registros: todos os controles finalizados de uma unidade num período, agrupados por tipo. */
export interface DossieReportData {
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  periodoLabel: string;
  geradoEm: string;
  secoes: { tipo: ControleTipo; registros: ControleReportRegistro[] }[];
  auditorias: { data: string; nutricionista: string; nota: string; classificacao: string }[];
}

export function DossieReportDocument({ data }: { data: DossieReportData }) {
  const d = data;
  const total = d.secoes.reduce((n, s) => n + s.registros.length, 0);
  const alertas = d.secoes.reduce((n, s) => n + s.registros.reduce((m, r) => m + r.alertas.length, 0), 0);
  const footer = `ROTA · Arquivo de registros · ${d.unidade.nome} · ${d.periodoLabel}`;
  return (
    <Document title={`Arquivo de registros - ${d.unidade.nome} - ${d.periodoLabel}`} author="ROTA · Grupo Da Rua">
      <Page size="A4" style={styles.page}>
        <BrandHeader title="Arquivo de registros" subtitle={`${d.unidade.nome} · ${d.periodoLabel}`} right="Controles de qualidade" meta={`${d.unidade.endereco ?? ""}${d.unidade.endereco ? "  ·  " : ""}Emitido em ${d.geradoEm}`} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <Stat label="Registros" value={String(total)} small />
          <Stat label="Tipos de controle" value={String(d.secoes.filter((s) => s.registros.length > 0).length)} small />
          <Stat label="Fora da faixa" value={String(alertas)} tone={alertas > 0 ? "red" : "green"} small />
          <Stat label="Auditorias" value={String(d.auditorias.length)} small />
        </View>
        <Section title="Resumo do período" hint="Quantidade de registros finalizados por tipo de controle.">
          <Table<{ tipo: string; n: number; alertas: number }>
            rows={d.secoes.map((s) => ({ tipo: s.tipo.nome, n: s.registros.length, alertas: s.registros.reduce((m, r) => m + r.alertas.length, 0) }))}
            empty="Nenhum controle finalizado no período."
            columns={[
              { key: "t", label: "Controle", width: "64%", render: (r) => r.tipo },
              { key: "n", label: "Registros", width: "18%", align: "right", render: (r) => String(r.n) },
              { key: "a", label: "Fora da faixa", width: "18%", align: "right", render: (r) => <Text style={[styles.td, { textAlign: "right", color: r.alertas > 0 ? COLORS.red : COLORS.ink }]}>{String(r.alertas)}</Text> },
            ]}
          />
        </Section>
        {d.auditorias.length > 0 ? (
          <Section title="Auditorias nutricionais do período" hint="Relatório individual de cada auditoria disponível no app (Histórico).">
            <Table<DossieReportData["auditorias"][number]>
              rows={d.auditorias}
              columns={[
                { key: "d", label: "Data", width: "20%", render: (r) => r.data },
                { key: "n", label: "Nutricionista", width: "44%", render: (r) => r.nutricionista },
                { key: "nota", label: "Nota", width: "16%", align: "right", render: (r) => r.nota },
                { key: "c", label: "Classificação", width: "20%", render: (r) => r.classificacao },
              ]}
            />
          </Section>
        ) : null}
        {total === 0 ? <Empty text="Nenhum controle finalizado neste período." /> : null}
        {d.secoes
          .filter((s) => s.registros.length > 0)
          .map((s) => (
            <View key={s.tipo.codigo} break>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{s.tipo.nome}</Text>
              <Text style={{ fontSize: 8.5, color: COLORS.muted, marginBottom: 8 }}>
                {s.tipo.descricao}
                {s.tipo.base ? ` ${s.tipo.base}` : ""}
              </Text>
              {s.registros.map((r) => (
                <Registro key={r.id} r={r} tipo={s.tipo} compact />
              ))}
            </View>
          ))}
        <View style={styles.signature} wrap={false}>
          <Text style={styles.signatureBox}>Equipe de nutrição</Text>
          <Text style={styles.signatureBox}>Responsável da unidade: {d.unidade.supervisor_nome ?? "____________________"}</Text>
        </View>
        <PageFooter left={footer} />
      </Page>
    </Document>
  );
}
