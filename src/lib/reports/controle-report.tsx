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

export function Registro({ r, tipo, compact }: { r: ControleReportRegistro; tipo: ControleTipo; compact?: boolean }) {
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
