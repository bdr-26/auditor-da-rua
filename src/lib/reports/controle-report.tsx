// PDF dos controles digitais (planilhas): um registro, ou a compilação do mês por unidade e tipo.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCampo, type Campo, type ControleDados, type ControleTipo } from "../nutri/controle-tipos";
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
}

export interface ControleReportData {
  tipo: ControleTipo;
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  geradoEm: string;
  /** Um registro (PDF individual) ou vários (mensal). */
  registros: ControleReportRegistro[];
  mesLabel?: string;
}

function cabecalhoRows(tipo: ControleTipo, dados: ControleDados): { label: string; valor: string }[] {
  return tipo.cabecalho.map((c) => ({ label: c.label, valor: formatCampo(c, dados.cabecalho[c.key]) }));
}

function columnsFor(tipo: ControleTipo) {
  const campos = tipo.campos;
  const first = 24;
  const rest = (100 - first) / Math.max(1, campos.length);
  return [
    { key: "nome", label: tipo.linhaLabel, width: `${first}%`, render: (l: ControleDados["linhas"][number]) => l.nome || "—" },
    ...campos.map((c: Campo) => ({
      key: c.key,
      label: c.label,
      width: `${rest}%`,
      align: (c.tipo === "number" ? "right" : "left") as "right" | "left",
      render: (l: ControleDados["linhas"][number]) => {
        const v = l[c.key];
        const alerta = c.alerta && v != null && v !== "" ? c.alerta(v, l) : null;
        const txt = formatCampo(c, v);
        return alerta ? <Text style={{ color: COLORS.red, fontFamily: "Helvetica-Bold" }}>{txt}</Text> : txt;
      },
    })),
  ];
}

function Registro({ r, tipo, compact }: { r: ControleReportRegistro; tipo: ControleTipo; compact?: boolean }) {
  const cab = cabecalhoRows(tipo, r.dados);
  const linhas = r.dados.linhas.filter((l) => l.nome || tipo.campos.some((c) => l[c.key] != null && l[c.key] !== ""));
  return (
    <Section title={compact ? `${r.data} · ${r.responsavel}` : "Registros"} hint={compact ? undefined : tipo.descricao}>
      {cab.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          {cab.map((c) => (
            <Text key={c.label} style={{ fontSize: 8.5 }}>
              <Text style={{ color: COLORS.muted }}>{c.label}: </Text>
              {c.valor}
            </Text>
          ))}
        </View>
      )}
      <Table<ControleDados["linhas"][number]> columns={columnsFor(tipo)} rows={linhas} empty="Nenhuma linha preenchida." />
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
  const totalLinhas = d.registros.reduce((n, r) => n + r.dados.linhas.filter((l) => d.tipo.campos.some((c) => l[c.key] != null && l[c.key] !== "")).length, 0);
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
