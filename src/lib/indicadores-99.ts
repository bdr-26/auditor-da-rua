// Leitura do relatório "Dados do pedido" da 99Food (um pedido por linha) e agregação por unidade
// do ROTA. Módulo puro: roda no navegador (o arquivo é lido no cliente, sem passar pelo servidor)
// e no servidor (validação). Nada de "server-only" nem de Supabase aqui.
//
// Colunas usadas (nomes como a 99 exporta; a comparação ignora acentos e maiúsculas):
//   Data · Nome do estabelecimento · ID do loja · Horário do pedido · Horário do cancelamento · Parte
//   responsável pelo cancelamento · Motivos de cancelamentos por parte da loja · Nível de avaliação do cliente (100–500)
//   · Tag de avaliação do cliente · Conteúdo de avaliação do cliente · Tempo de finalização do pedido
//   (segundos) · Duração da entrega (segundos) · Tempo de preparo (minutos) · Tempo para aceitação do
//   pedido (segundos) · Preparação atrasada? · Itens em falta · Quantidade de pedidos anteriores do
//   cliente na loja.

/**
 * Tipo do cancelamento (ver `classificarCancelamento`):
 *  - desistencia: cancelado em menos de 1 minuto, sem a loja ter aceitado — o cliente refez o pedido ou o
 *    pagamento falhou. Não é operação perdida: fica FORA do número de cancelamentos.
 *  - nao_aceito: a loja não confirmou o pedido no prazo (cancelamento automático da 99, aos 5 ou 10 min).
 *  - loja: a loja cancelou ativamente (fechada, item esgotado…).
 *  - apos_aceite: pedido aceito e cancelado depois (plataforma, entregador, cliente).
 *  - indefinido: sem horário do pedido para medir (arquivo antigo) — conta como cancelamento.
 */
export type TipoCancelamento = "desistencia" | "nao_aceito" | "loja" | "apos_aceite" | "indefinido";

export interface Pedido99 {
  data: string; // YYYY-MM-DD
  id_99: string;
  loja: string;
  cancelado: boolean;
  /** minutos entre o pedido e o cancelamento (null se não cancelado ou sem horários) */
  minutos_ate_cancelamento: number | null;
  /** a loja chegou a aceitar o pedido (tempo de aceite > 0 ou clicou em "pronto") */
  aceito: boolean;
  responsavel_cancelamento: string | null;
  motivo_loja: string | null;
  nota: number | null; // 1..5
  tags: string[];
  comentario: string | null;
  tempo_total_min: number | null; // pedido → conclusão
  tempo_entrega_min: number | null;
  tempo_preparo_min: number | null;
  tempo_aceite_s: number | null;
  atrasado: boolean | null;
  item_em_falta: boolean;
  cliente_novo: boolean | null;
}

export interface Detalhe99 {
  periodo: { de: string; ate: string } | null;
  dias: number;
  lojas_99: { id: string; nome: string; pedidos: number }[];
  /** todas as linhas do relatório (inclui desistências) */
  pedidos_total: number;
  concluidos: number;
  /** cancelamentos que contam: não aceitos + loja + após o aceite (+ indefinidos). Desistências ficam fora. */
  cancelados: number;
  /** cancelados ÷ (concluídos + cancelados) */
  cancel_pct: number | null;
  /** cancelados em < 1 min sem aceite (cliente refez / pagamento) — informativo */
  desistencias: number;
  /** a loja não confirmou no prazo (cancelamento automático da 99) */
  nao_aceitos: number;
  /** não aceitos ÷ (concluídos + cancelados) */
  nao_aceitos_pct: number | null;
  /** cancelados pela própria loja (fechada, esgotado…) */
  cancel_loja: number;
  cancel_motivos_loja: Record<string, number>;
  /** cancelados depois do aceite, por "Parte responsável" */
  cancel_apos_aceite: number;
  cancel_resp: Record<string, number>;
  avaliacoes: number;
  nota_media: number | null;
  distribuicao: Record<"1" | "2" | "3" | "4" | "5", number>;
  tags_negativas: Record<string, number>; // tags de avaliações 1–3
  tags_positivas: Record<string, number>; // tags de avaliações 4–5
  comentarios_negativos: { data: string; nota: number; texto: string }[]; // até 8
  atrasados: number;
  atraso_pct: number | null;
  itens_em_falta: number;
  novos_clientes: number;
  novos_pct: number | null;
  tempo_total_medio: number | null; // min, pedido → conclusão
  tempo_entrega_medio: number | null; // min
  tempo_preparo_medio: number | null; // min (só pedidos com preparo informado)
  tempo_aceite_medio: number | null; // segundos
}

export interface ResumoImportacao99 {
  unidades: { slug: string; detalhe: Detalhe99 }[];
  desconhecidas: { id: string; nome: string; pedidos: number }[];
  periodo: { de: string; ate: string } | null;
  linhas: number;
}

export const norm99 = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "2.493" → 2493 · "19,53" → 19.53 · "" → null */
export function num99(v: unknown): number | null {
  const s = String(v ?? "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "2026-10-30 19:47:42" → ms (hora local do relatório; só a diferença importa) */
function hora99(v: unknown): number | null {
  const m = String(v ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function data99(v: unknown): string | null {
  const t = String(v ?? "").trim();
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

const COLS = {
  data: ["Data"],
  nome: ["Nome do estabelecimento"],
  id: ["ID do loja", "ID da loja"],
  pedido: ["Horário do pedido"],
  cancel: ["Horário do cancelamento"],
  pronto: ["Clicou em “Pronto para ser retirado”?", "Clicou em Pronto para ser retirado?"],
  resp: ["Parte responsável pelo cancelamento"],
  motivo: ["Motivos de cancelamentos por parte da loja"],
  nivel: ["Nível de avaliação do cliente"],
  tags: ["Tag de avaliação do cliente"],
  comentario: ["Conteúdo de avaliação do cliente"],
  total: ["Tempo de finalização do pedido (segundos)"],
  entrega: ["Duração da entrega (segundos)"],
  preparo: ["Tempo de preparo (minutos)"],
  aceite: ["Tempo para aceitação do pedido (segundos)"],
  atrasado: ["Preparação atrasada?"],
  falta: ["Itens em falta"],
  anteriores: ["Quantidade de pedidos anteriores do cliente na loja"],
} as const;
const OBRIGATORIAS: (keyof typeof COLS)[] = ["data", "nome", "id", "cancel"];

/** Lê a grade (linha 0 = cabeçalho) do relatório "Dados do pedido". */
export function parsePedidos99(grade: unknown[][]): { pedidos: Pedido99[]; erro?: string } {
  const cab = (grade[0] ?? []).map(norm99);
  if (!cab.includes(norm99("ID do pedido"))) return { pedidos: [], erro: 'Este arquivo não é o relatório "Dados do pedido" da 99 (não tem a coluna "ID do pedido").' };
  const ix = {} as Record<keyof typeof COLS, number>;
  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) ix[k] = COLS[k].map((n) => cab.indexOf(norm99(n))).find((i) => i >= 0) ?? -1;
  const faltando = OBRIGATORIAS.filter((k) => ix[k] < 0).map((k) => COLS[k][0]);
  if (faltando.length) return { pedidos: [], erro: `O relatório não tem as colunas: ${faltando.join(", ")}.` };

  const cel = (row: unknown[], k: keyof typeof COLS) => (ix[k] >= 0 ? String(row[ix[k]] ?? "").trim() : "");
  const pedidos: Pedido99[] = [];
  for (let r = 1; r < grade.length; r++) {
    const row = grade[r];
    if (!row || !row.some((c) => String(c ?? "").trim())) continue;
    const data = data99(cel(row, "data"));
    const id_99 = cel(row, "id");
    if (!data || !id_99) continue;
    const nivel = num99(cel(row, "nivel"));
    const nota = nivel != null && nivel >= 100 && nivel <= 500 ? Math.round(nivel / 100) : null;
    const pos = (k: keyof typeof COLS) => {
      const v = num99(cel(row, k));
      return v != null && v > 0 ? v : null;
    };
    const atr = norm99(cel(row, "atrasado"));
    const ant = cel(row, "anteriores");
    const hPedido = hora99(cel(row, "pedido"));
    const hCancel = hora99(cel(row, "cancel"));
    const aceiteS = num99(cel(row, "aceite"));
    pedidos.push({
      data,
      id_99,
      loja: cel(row, "nome"),
      cancelado: cel(row, "cancel") !== "",
      minutos_ate_cancelamento: hPedido != null && hCancel != null ? Math.max(0, (hCancel - hPedido) / 60000) : null,
      aceito: (aceiteS != null && aceiteS > 0) || norm99(cel(row, "pronto")) === "sim",
      responsavel_cancelamento: cel(row, "resp") || null,
      motivo_loja: cel(row, "motivo") || null,
      nota,
      tags: cel(row, "tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      comentario: cel(row, "comentario") || null,
      tempo_total_min: pos("total") != null ? pos("total")! / 60 : null,
      tempo_entrega_min: pos("entrega") != null ? pos("entrega")! / 60 : null,
      tempo_preparo_min: pos("preparo"),
      tempo_aceite_s: aceiteS,
      atrasado: atr === "sim" ? true : atr === "nao" ? false : null,
      item_em_falta: cel(row, "falta") !== "",
      cliente_novo: ant === "" ? null : num99(ant) === 0,
    });
  }
  if (pedidos.length === 0) return { pedidos: [], erro: "O relatório não tem nenhum pedido." };
  return { pedidos };
}

/** Lojas virtuais da 99 → unidade do ROTA (slug). Pelo nome; o ID fixo serve de garantia para Moema. */
const IDS_99: Record<string, string> = {
  "5764611700901544924": "moema-delivery", // Smash da Rua (sem bairro no nome)
  "5764608147579473685": "moema-delivery", // Burger da Rua - Moema
  "5764614470119459101": "imigrantes",
  "5764614441010988052": "imigrantes",
  "5764616347963886742": "bela-vista",
  "5764617019115439184": "bela-vista",
};
export function unidadeDaLoja99(id_99: string, nome: string): string | null {
  if (IDS_99[id_99]) return IDS_99[id_99];
  const n = norm99(nome);
  if (n.includes("bela vista")) return "bela-vista";
  if (n.includes("imigrantes")) return "imigrantes";
  if (n.includes("mooca")) return "mooca";
  if (n.includes("moema")) return "moema-delivery";
  return null;
}

/** Classifica um pedido cancelado (ver TipoCancelamento). */
export function classificarCancelamento(p: Pedido99): TipoCancelamento {
  const motivo = norm99(p.motivo_loja);
  const respLoja = norm99(p.responsavel_cancelamento).includes("loja");
  if (motivo.includes("nao confirmou") || motivo.includes("prazo")) return "nao_aceito";
  if (p.motivo_loja || respLoja) return "loja";
  if (p.aceito) return "apos_aceite";
  if (p.minutos_ate_cancelamento == null) return "indefinido";
  if (p.minutos_ate_cancelamento < 1) return "desistencia";
  return "nao_aceito";
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const media = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const pct = (n: number, base: number) => (base > 0 ? r1((n / base) * 100) : null);
const top = (c: Record<string, number>, n: number) => Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n));

/** Agrega os pedidos de uma unidade. */
export function agregarPedidos99(pedidos: Pedido99[]): Detalhe99 {
  const lojas = new Map<string, { id: string; nome: string; pedidos: number }>();
  const resp: Record<string, number> = {};
  const motivos: Record<string, number> = {};
  const tagsNeg: Record<string, number> = {};
  const tagsPos: Record<string, number> = {};
  const dist: Detalhe99["distribuicao"] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const notas: number[] = [];
  const tTotal: number[] = [];
  const tEntrega: number[] = [];
  const tPreparo: number[] = [];
  const tAceite: number[] = [];
  const comentarios: Detalhe99["comentarios_negativos"] = [];
  const dias = new Set<string>();
  let cancelados = 0;
  let desistencias = 0;
  let naoAceitos = 0;
  let cancelLoja = 0;
  let aposAceite = 0;
  let atrasados = 0;
  let atrasoBase = 0;
  let falta = 0;
  let novos = 0;
  let novosBase = 0;
  const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

  for (const p of pedidos) {
    dias.add(p.data);
    const l = lojas.get(p.id_99) ?? { id: p.id_99, nome: p.loja, pedidos: 0 };
    l.pedidos++;
    lojas.set(p.id_99, l);
    if (p.cancelado) {
      const tipo = classificarCancelamento(p);
      if (tipo === "desistencia") {
        desistencias++;
        continue;
      }
      cancelados++;
      if (tipo === "nao_aceito") naoAceitos++;
      else if (tipo === "loja") {
        cancelLoja++;
        if (p.motivo_loja) inc(motivos, p.motivo_loja);
      } else {
        aposAceite++;
        inc(resp, p.responsavel_cancelamento ?? "Sem informação");
      }
      continue;
    }
    if (p.nota != null) {
      notas.push(p.nota);
      dist[String(p.nota) as keyof typeof dist]++;
      for (const t of p.tags) inc(p.nota <= 3 ? tagsNeg : tagsPos, t);
      if (p.nota <= 3 && p.comentario && p.comentario.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) comentarios.push({ data: p.data, nota: p.nota, texto: p.comentario.slice(0, 180) });
    }
    if (p.tempo_total_min != null) tTotal.push(p.tempo_total_min);
    if (p.tempo_entrega_min != null) tEntrega.push(p.tempo_entrega_min);
    if (p.tempo_preparo_min != null) tPreparo.push(p.tempo_preparo_min);
    if (p.tempo_aceite_s != null) tAceite.push(p.tempo_aceite_s);
    if (p.atrasado != null) {
      atrasoBase++;
      if (p.atrasado) atrasados++;
    }
    if (p.item_em_falta) falta++;
    if (p.cliente_novo != null) {
      novosBase++;
      if (p.cliente_novo) novos++;
    }
  }
  const concluidos = pedidos.length - cancelados - desistencias;
  const base = concluidos + cancelados;
  const datas = Array.from(dias).sort();
  const mNota = media(notas);
  const mt = (xs: number[]) => {
    const m = media(xs);
    return m == null ? null : r1(m);
  };
  return {
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    dias: datas.length,
    lojas_99: Array.from(lojas.values()).sort((a, b) => b.pedidos - a.pedidos),
    pedidos_total: pedidos.length,
    concluidos,
    cancelados,
    cancel_pct: pct(cancelados, base),
    desistencias,
    nao_aceitos: naoAceitos,
    nao_aceitos_pct: pct(naoAceitos, base),
    cancel_loja: cancelLoja,
    cancel_motivos_loja: top(motivos, 6),
    cancel_apos_aceite: aposAceite,
    cancel_resp: resp,
    avaliacoes: notas.length,
    nota_media: mNota == null ? null : r2(mNota),
    distribuicao: dist,
    tags_negativas: top(tagsNeg, 8),
    tags_positivas: top(tagsPos, 5),
    comentarios_negativos: comentarios.sort((a, b) => a.nota - b.nota || b.data.localeCompare(a.data)).slice(0, 8),
    atrasados,
    atraso_pct: pct(atrasados, atrasoBase),
    itens_em_falta: falta,
    novos_clientes: novos,
    novos_pct: pct(novos, novosBase),
    tempo_total_medio: mt(tTotal),
    tempo_entrega_medio: mt(tEntrega),
    tempo_preparo_medio: mt(tPreparo),
    tempo_aceite_medio: mt(tAceite),
  };
}

/** Agrupa os pedidos por unidade do ROTA. `extra` resolve lojas que o mapa fixo não conhece (escolha do usuário). */
export function resumirImportacao99(pedidos: Pedido99[], extra: Record<string, string> = {}): ResumoImportacao99 {
  const porUnidade = new Map<string, Pedido99[]>();
  const desconhecidas = new Map<string, { id: string; nome: string; pedidos: number }>();
  for (const p of pedidos) {
    const slug = extra[p.id_99] ?? unidadeDaLoja99(p.id_99, p.loja);
    if (!slug) {
      const d = desconhecidas.get(p.id_99) ?? { id: p.id_99, nome: p.loja, pedidos: 0 };
      d.pedidos++;
      desconhecidas.set(p.id_99, d);
      continue;
    }
    (porUnidade.get(slug) ?? porUnidade.set(slug, []).get(slug)!).push(p);
  }
  const datas = pedidos.map((p) => p.data).sort();
  return {
    unidades: Array.from(porUnidade.entries()).map(([slug, ps]) => ({ slug, detalhe: agregarPedidos99(ps) })),
    desconhecidas: Array.from(desconhecidas.values()),
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    linhas: pedidos.length,
  };
}

/** Os quatro campos da aba de indicadores a partir do detalhe. */
export function indicadoresDoDetalhe(d: Detalhe99): { pedidos: number; cancelamentos: number; nota_99food: number | null; tempo_medio_entrega: number | null } {
  return {
    pedidos: d.concluidos,
    cancelamentos: d.cancelados,
    nota_99food: d.nota_media,
    tempo_medio_entrega: d.tempo_total_medio == null ? null : Math.round(d.tempo_total_medio),
  };
}

/** Validação leve do JSON recebido do cliente (campos numéricos finitos, listas limitadas). */
export function detalhe99Valido(d: unknown): d is Detalhe99 {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  const n = (k: string) => typeof o[k] === "number" && Number.isFinite(o[k] as number);
  if (!n("pedidos_total") || !n("concluidos") || !n("cancelados") || !n("avaliacoes")) return false;
  if ((o.pedidos_total as number) > 1_000_000) return false;
  if (!Array.isArray(o.comentarios_negativos) || (o.comentarios_negativos as unknown[]).length > 8) return false;
  if (!Array.isArray(o.lojas_99) || (o.lojas_99 as unknown[]).length > 20) return false;
  return true;
}
