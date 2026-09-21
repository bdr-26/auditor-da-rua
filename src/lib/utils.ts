/** Junta classes ignorando falsy. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtDelta(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  const s = n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n > 0 ? `+${s}` : s;
}

export function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
