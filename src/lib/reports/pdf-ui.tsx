// Primitivos visuais dos relatórios (react-pdf). Fontes built-in (Helvetica) — sem download externo.
// Atenção: Helvetica usa codificação WinAnsi; evite símbolos fora dela (Δ, ≥, ⚠, setas).
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_YELLOW } from "../constants";

/** Logo DA RUA FOOD INC embutido como data URI (lido do disco no servidor; vazio se indisponível). */
const BRAND_LOGO: string = (() => {
  try {
    return "data:image/png;base64," + readFileSync(join(process.cwd(), "public", "brand", "darua-food-inc.png")).toString("base64");
  } catch {
    return "";
  }
})();
const BRAND_LOGO_RATIO = 1858 / 986;

// Sem hifenização automática (regras em inglês quebram palavras em português).
Font.registerHyphenationCallback((word) => [word]);

export const COLORS = {
  brand: BRAND_YELLOW,
  ink: "#111827",
  graphite: "#374151",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#F9FAFB",
  white: "#FFFFFF",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  yellow: "#CA8A04",
  yellowSoft: "#FEF9C3",
  orange: "#EA580C",
  orangeSoft: "#FFEDD5",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  gray: "#9CA3AF",
  graySoft: "#F3F4F6",
};

export type Tone = "green" | "yellow" | "orange" | "red" | "gray";

export function toneOfPct(pct: number | null | undefined): Tone {
  if (pct == null) return "gray";
  if (pct >= 75) return "green";
  if (pct >= 50) return "yellow";
  if (pct >= 25) return "orange";
  return "red";
}

export function toneOfScore(nota: number | null | undefined): Tone {
  if (nota == null) return "gray";
  if (nota >= 4) return "green";
  if (nota >= 3) return "yellow";
  if (nota >= 2) return "orange";
  return "red";
}

export function toneOfNutri(classificacao: string | null): Tone {
  switch (classificacao) {
    case "Excelente":
      return "green";
    case "Satisfatório":
      return "yellow";
    case "Insatisfatório":
      return "orange";
    case "Crítico":
      return "red";
    default:
      return "gray";
  }
}

export function toneColors(tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case "green":
      return { fg: COLORS.green, bg: COLORS.greenSoft };
    case "yellow":
      return { fg: COLORS.yellow, bg: COLORS.yellowSoft };
    case "orange":
      return { fg: COLORS.orange, bg: COLORS.orangeSoft };
    case "red":
      return { fg: COLORS.red, bg: COLORS.redSoft };
    default:
      return { fg: COLORS.muted, bg: COLORS.graySoft };
  }
}

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: COLORS.ink,
    paddingTop: 36,
    paddingBottom: 54,
    paddingHorizontal: 40,
    lineHeight: 1.35,
  },
  brandBar: {
    backgroundColor: BRAND_YELLOW,
    marginHorizontal: -40,
    marginTop: -36,
    paddingHorizontal: 40,
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandText: { fontFamily: "Helvetica-Bold", fontSize: 10, color: COLORS.ink, letterSpacing: 0.4 },
  brandRight: { fontSize: 9, color: COLORS.ink },
  headerTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, lineHeight: 1.4, marginTop: 18, marginBottom: 4, color: COLORS.ink },
  headerSubtitle: { fontSize: 11, lineHeight: 1.3, color: COLORS.graphite, marginTop: 2 },
  headerMeta: { fontSize: 8, color: COLORS.muted, marginTop: 4 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLORS.ink,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND_YELLOW,
    marginBottom: 8,
  },
  sectionHint: { fontSize: 8.5, color: COLORS.muted, marginBottom: 6 },
  row: { flexDirection: "row" },
  statGrid: { flexDirection: "row", marginTop: 14, gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
  },
  statLabel: { fontSize: 7.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.4, marginTop: 4, marginBottom: 2, color: COLORS.ink },
  statValueSmall: { fontFamily: "Helvetica-Bold", fontSize: 14, lineHeight: 1.2, marginTop: 6, color: COLORS.ink },
  statHint: { fontSize: 8, color: COLORS.graphite, marginTop: 3 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4 },
  th: {
    flexDirection: "row",
    backgroundColor: COLORS.graySoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: COLORS.graphite, textTransform: "uppercase", letterSpacing: 0.3 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  trLast: { borderBottomWidth: 0 },
  td: { fontSize: 9 },
  tdMuted: { fontSize: 8.5, color: COLORS.muted },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: COLORS.muted },
  small: { fontSize: 8 },
  chip: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1.5, fontSize: 7.5, fontFamily: "Helvetica-Bold", alignSelf: "flex-start" },
  listItem: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  bullet: { width: 14, color: COLORS.muted },
  empty: { fontSize: 9, color: COLORS.muted, fontStyle: "italic", paddingVertical: 4 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.muted,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 5,
  },
  signature: { marginTop: 36, flexDirection: "row", gap: 24 },
  signatureBox: { flex: 1, borderTopWidth: 1, borderTopColor: COLORS.ink, paddingTop: 4, fontSize: 9 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10, backgroundColor: COLORS.white },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  photo: { width: 96, height: 72, objectFit: "cover", borderRadius: 3, borderWidth: 0.5, borderColor: COLORS.border },
});

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "+3,2 pts" / "-1,0 pts" / "—" */
export function fmtDeltaPts(atual: number | null | undefined, anterior: number | null | undefined, digits = 1): string {
  if (atual == null || anterior == null) return "—";
  const d = atual - anterior;
  const s = Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (Math.abs(d) < 0.05) return "= 0,0";
  return d > 0 ? `+${s} pts` : `-${s} pts`;
}

export function deltaTone(atual: number | null | undefined, anterior: number | null | undefined): Tone {
  if (atual == null || anterior == null) return "gray";
  const d = atual - anterior;
  if (Math.abs(d) < 0.05) return "gray";
  return d > 0 ? "green" : "red";
}

export function BrandHeader({ title, subtitle, right, meta }: { title: string; subtitle?: string; right: string; meta?: string }) {
  return (
    <View>
      <View style={styles.brandBar} fixed>
        {BRAND_LOGO ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
          <Image src={BRAND_LOGO} style={{ height: 34, width: 34 * BRAND_LOGO_RATIO }} />
        ) : (
          <Text style={styles.brandText}>DA RUA FOOD INC</Text>
        )}
        <Text style={styles.brandRight}>{right}</Text>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      {meta ? <Text style={styles.headerMeta}>{meta}</Text> : null}
    </View>
  );
}

export function Section({ title, hint, children, wrap = true }: { title: string; hint?: string; children: ReactNode; wrap?: boolean }) {
  return (
    <View style={styles.section} wrap={wrap}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {title}
      </Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Stat({ label, value, hint, tone, small }: { label: string; value: string; hint?: string; tone?: Tone; small?: boolean }) {
  const color = tone && tone !== "gray" ? toneColors(tone).fg : COLORS.ink;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[small ? styles.statValueSmall : styles.statValue, { color }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  const c = toneColors(tone);
  return <Text style={[styles.chip, { color: c.fg, backgroundColor: c.bg }]}>{label}</Text>;
}

/** Barra horizontal simples (0..100) desenhada com larguras de View. */
export function Bar({ pct, tone, height = 7 }: { pct: number | null; tone?: Tone; height?: number }) {
  const t = tone ?? toneOfPct(pct);
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, backgroundColor: COLORS.graySoft, borderRadius: height / 2, flexGrow: 1 }}>
      <View style={{ height, width: `${v}%`, backgroundColor: toneColors(t).fg, borderRadius: height / 2 }} />
    </View>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  width: number | string; // flex (number) ou largura fixa ("18%")
  align?: "left" | "right" | "center";
  render: (row: T, index: number) => ReactNode;
}

function colStyle<T>(c: Column<T>) {
  const base = typeof c.width === "number" ? { flex: c.width } : { width: c.width };
  return { ...base, paddingRight: 4, textAlign: c.align ?? "left" } as const;
}

export function Table<T>({ columns, rows, empty = "Nenhum registro." }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.table}>
      <View style={styles.th} fixed>
        {columns.map((c) => (
          <Text key={c.key} style={[styles.thText, colStyle(c)]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.tr, i === rows.length - 1 ? styles.trLast : {}]} wrap={false}>
          {columns.map((c) => {
            const content = c.render(r, i);
            return typeof content === "string" || typeof content === "number" ? (
              <Text key={c.key} style={[styles.td, colStyle(c)]}>
                {content}
              </Text>
            ) : (
              <View key={c.key} style={colStyle(c)}>
                {content}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function PageFooter({ left }: { left: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}
