/**
 * Definições dos controles digitais do módulo nutricional (as "planilhas" da Daniele), em código:
 * um motor genérico renderiza, valida e imprime qualquer tipo a partir destas definições.
 * `cabecalho`: campos únicos do registro; `linhas`: tabela (linhas fixas pré-preenchidas e/ou livres).
 */
export type CampoTipo = "text" | "number" | "bool" | "select" | "time" | "date";

export interface Campo {
  key: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[];
  obrigatorio?: boolean;
  sufixo?: string; // ex.: "°C"
  placeholder?: string;
  /** Avalia o valor e devolve um alerta (ex.: fora da faixa) ou null. */
  alerta?: (valor: unknown, linha: Record<string, unknown>) => string | null;
}

export interface ControleTipo {
  codigo: string;
  nome: string;
  curto: string;
  descricao: string;
  /** Texto de orientação (legislação / faixa) mostrado no topo e no PDF. */
  base?: string;
  cabecalho: Campo[];
  /** Nome da coluna que identifica a linha (ex.: "Preparação"). */
  linhaLabel: string;
  /** Linhas pré-preenchidas (o nome fica travado); as demais são livres. */
  linhasFixas?: string[];
  /** Permite incluir linhas além das fixas. */
  linhasLivres: boolean;
  campos: Campo[];
}

export type ControleLinha = { nome: string } & Record<string, unknown>;
export interface ControleDados {
  cabecalho: Record<string, unknown>;
  linhas: ControleLinha[];
}

const num = (v: unknown): number | null => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const SIM_NAO = ["Sim", "Não"];
const SIM_NAO_NA = ["Sim", "Não", "N.A."];
const CONF = ["Conforme", "Não conforme", "N.A."];
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Faixa por tipo de equipamento (°C). */
const FAIXA_EQUIP: Record<string, { min?: number; max?: number }> = {
  Refrigerador: { max: 5 },
  "Pista fria": { max: 5 },
  "Câmara fria": { max: 5 },
  Freezer: { max: -12 },
  Estufa: { min: 60 },
  "Banho-maria": { min: 60 },
};
const alertaEquip = (valor: unknown, linha: Record<string, unknown>) => {
  const t = num(valor);
  if (t == null) return null;
  const f = FAIXA_EQUIP[String(linha.tipo_equip ?? "")];
  if (!f) return null;
  if (f.max != null && t > f.max) return `acima de ${f.max} °C`;
  if (f.min != null && t < f.min) return `abaixo de ${f.min} °C`;
  return null;
};
const alertaFrio = (valor: unknown) => {
  const t = num(valor);
  return t != null && t > 10 ? "acima de 10 °C" : null;
};

export const CONTROLE_TIPOS: ControleTipo[] = [
  {
    codigo: "temperatura_equipamentos",
    nome: "Temperatura dos equipamentos",
    curto: "Equipamentos",
    descricao: "Leitura dos refrigeradores, freezers, câmara, pista fria, estufa e banho-maria.",
    base: "Refrigerados até 5 °C · congelados a -12 °C ou menos · quentes a 60 °C ou mais.",
    cabecalho: [{ key: "termometro", label: "Termômetro utilizado", tipo: "text", placeholder: "Ex.: espeto digital nº 2" }],
    linhaLabel: "Equipamento",
    linhasFixas: ["Refrigerador 1", "Freezer 1", "Pista fria"],
    linhasLivres: true,
    campos: [
      { key: "tipo_equip", label: "Tipo", tipo: "select", opcoes: Object.keys(FAIXA_EQUIP), obrigatorio: true },
      { key: "local", label: "Local", tipo: "text", placeholder: "Cozinha, salão…" },
      { key: "temp_manha", label: "Manhã", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "temp_tarde", label: "Tarde", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "acao", label: "Ação corretiva", tipo: "text" },
    ],
  },
  {
    codigo: "temperatura_distribuicao",
    nome: "Temperatura dos alimentos na distribuição",
    curto: "Distribuição",
    descricao: "Preparações da pista fria e demais itens em exposição, de 2 em 2 horas.",
    base: "Alimentos frios em exposição: até 10 °C. Quentes: 60 °C ou mais.",
    cabecalho: [{ key: "amostra", label: "Amostra coletada", tipo: "select", opcoes: SIM_NAO }],
    linhaLabel: "Preparação",
    linhasFixas: ["Alface", "Tomate", "Cebola picada", "Cebola caramelizada", "Picles", "Maionese verde", "Maionese da Rua", "Maionese de mostarda", "Ketchup", "Mostarda", "Molho smash", "Queijo fatiado na GN", "Bacon frito na GN", "Cebola smash", "Molho caipira", "Pão (lote e ambiente)", "Hambúrguer (lote)", "Farofa de bacon"],
    linhasLivres: true,
    campos: [
      { key: "t16", label: "16h", tipo: "number", sufixo: "°C", alerta: alertaFrio },
      { key: "t18", label: "18h", tipo: "number", sufixo: "°C", alerta: alertaFrio },
      { key: "t20", label: "20h", tipo: "number", sufixo: "°C", alerta: alertaFrio },
      { key: "t22", label: "22h", tipo: "number", sufixo: "°C", alerta: alertaFrio },
      { key: "trocou", label: "Trocou", tipo: "select", opcoes: SIM_NAO },
      { key: "lote", label: "Lote", tipo: "text" },
    ],
  },
  {
    codigo: "oleo",
    nome: "Controle de óleos e gorduras",
    curto: "Óleo",
    descricao: "Temperatura do óleo, higienização da fritadeira e troca, por período.",
    base: "RDC 216/2004: óleos e gorduras de fritura não devem ultrapassar 180 °C.",
    cabecalho: [{ key: "fritadeira", label: "Fritadeira", tipo: "text", placeholder: "Ex.: fritadeira 1" }],
    linhaLabel: "Período",
    linhasFixas: ["Manhã", "Noite"],
    linhasLivres: false,
    campos: [
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C", alerta: (v) => (num(v) != null && num(v)! > 180 ? "acima de 180 °C" : null) },
      { key: "higienizada", label: "Fritadeira higienizada", tipo: "select", opcoes: SIM_NAO },
      { key: "trocado", label: "Óleo trocado", tipo: "select", opcoes: SIM_NAO },
    ],
  },
  {
    codigo: "recebimento",
    nome: "Recebimento de mercadorias",
    curto: "Recebimento",
    descricao: "Conferência de cada produto recebido: rotulagem, integridade, temperatura e irregularidades.",
    base: "Refrigerados até 7 °C na chegada · congelados a -12 °C ou menos · embalagem íntegra e rotulagem completa.",
    cabecalho: [
      { key: "nota_fiscal", label: "Nº da nota fiscal", tipo: "text" },
      { key: "fornecedor", label: "Fornecedor", tipo: "text" },
      { key: "recebido_por", label: "Quem recebeu", tipo: "text" },
    ],
    linhaLabel: "Produto",
    linhasLivres: true,
    campos: [
      { key: "marca", label: "Marca", tipo: "text" },
      { key: "fabricacao", label: "Fabricação", tipo: "date" },
      { key: "validade", label: "Validade", tipo: "date" },
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "sif", label: "SIF/SISP/SIM", tipo: "text" },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C" },
      { key: "sensorial", label: "Sensorial (cor, odor, textura)", tipo: "select", opcoes: CONF },
      { key: "embalagem", label: "Embalagem íntegra", tipo: "select", opcoes: CONF },
      { key: "rotulagem", label: "Rotulagem completa", tipo: "select", opcoes: CONF },
      { key: "irregularidade", label: "Irregularidade", tipo: "text" },
    ],
  },
  {
    codigo: "transportados",
    nome: "Alimentos transportados",
    curto: "Transporte",
    descricao: "Saída da cozinha central e entrada na filial: rastreabilidade e tempo × temperatura.",
    base: "Registrar horário e temperatura no início e no fim do transporte.",
    cabecalho: [
      { key: "sentido", label: "Registro", tipo: "select", opcoes: ["Saída da matriz", "Entrada na filial"], obrigatorio: true },
      { key: "horario", label: "Horário", tipo: "time", obrigatorio: true },
      { key: "veiculo", label: "Veículo / caixa térmica", tipo: "text" },
    ],
    linhaLabel: "Preparação",
    linhasLivres: true,
    campos: [
      { key: "conservacao", label: "Conservação", tipo: "select", opcoes: ["Congelado", "Refrigerado", "Ambiente"] },
      { key: "quantidade", label: "Quantidade", tipo: "text" },
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "validade", label: "Validade", tipo: "date" },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C" },
      { key: "ocorrencia", label: "Ocorrência", tipo: "text" },
    ],
  },
  {
    codigo: "hortifruti",
    nome: "Higienização de hortifrúti (cloro PPM)",
    curto: "Hortifrúti",
    descricao: "Validação da solução clorada com fita de teste: alvo 200 PPM de cloro livre.",
    base: "Solução para sanitização de hortifrutícolas deve ficar em torno de 200 PPM.",
    cabecalho: [{ key: "produto_cloro", label: "Produto clorado / diluição", tipo: "text" }],
    linhaLabel: "Produto",
    linhasLivres: true,
    campos: [
      { key: "ppm", label: "PPM medido", tipo: "select", opcoes: ["10", "50", "100", "200"], alerta: (v) => (v != null && v !== "" && String(v) !== "200" ? "abaixo de 200 PPM" : null) },
      { key: "tempo", label: "Tempo de imersão (min)", tipo: "number" },
      { key: "obs", label: "Observação", tipo: "text" },
    ],
  },
  {
    codigo: "amostras",
    nome: "Coleta de amostras",
    curto: "Amostras",
    descricao: "Só onde há produção/estagiária (Moema): amostras de cada preparação servida, duas coletas por dia.",
    base: "Amostra de ~100 g por preparação, em embalagem higienizada e identificada (produto, data, hora, responsável), mantida sob refrigeração por 72 h e descartada depois.",
    cabecalho: [
      { key: "local", label: "Local", tipo: "select", opcoes: ["Salão", "Delivery", "Produção"], obrigatorio: true },
      { key: "horario", label: "Horário da coleta", tipo: "time", obrigatorio: true },
      { key: "coletado_por", label: "Quem coletou", tipo: "text" },
    ],
    linhaLabel: "Preparação",
    linhasLivres: true,
    campos: [
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C" },
      { key: "identificada", label: "Identificada", tipo: "select", opcoes: SIM_NAO, alerta: (v) => (v === "Não" ? "amostra sem identificação" : null) },
      { key: "descarte_em", label: "Descartar em", tipo: "date" },
    ],
  },
  {
    codigo: "conferencia_planilhas",
    nome: "Conferência das planilhas da unidade",
    curto: "Planilhas",
    descricao: "Visita semanal: as planilhas que os funcionários preenchem no dia a dia foram feitas desde a última visita?",
    base: "Marque a situação de cada planilha, os dias que faltaram e quem foi orientado. Vira pendência da próxima visita.",
    cabecalho: [
      { key: "periodo_inicio", label: "Período conferido — de", tipo: "date", obrigatorio: true },
      { key: "periodo_fim", label: "até", tipo: "date", obrigatorio: true },
    ],
    linhaLabel: "Planilha",
    linhasFixas: ["Temperatura dos equipamentos", "Temperatura na distribuição", "Óleo e gorduras", "Recebimento de mercadorias", "Alimentos transportados", "Higienização de hortifrúti", "Higienização / limpeza", "Manutenção"],
    linhasLivres: true,
    campos: [
      { key: "situacao", label: "Situação", tipo: "select", opcoes: ["Preenchida", "Parcial", "Não preenchida", "N.A."], alerta: (v) => (v === "Parcial" ? "preenchimento parcial" : v === "Não preenchida" ? "não preenchida" : null) },
      { key: "dias_faltantes", label: "Dias faltantes", tipo: "text", placeholder: "Ex.: 12 e 14/10" },
      { key: "responsavel_loja", label: "Responsável na loja", tipo: "text" },
      { key: "orientacao", label: "Orientação dada", tipo: "text" },
    ],
  },
  {
    codigo: "pasta_documentacao",
    nome: "Pasta de documentação",
    curto: "Pasta",
    descricao: "Documentos obrigatórios da unidade: situação e vencimento de cada um.",
    base: "Vencido ou ausente fica em vermelho. Preencha o vencimento para o app avisar quando estiver passando.",
    cabecalho: [],
    linhaLabel: "Documento",
    linhasFixas: ["Alvará de funcionamento", "Licença sanitária (CMVS)", "AVCB / CLCB", "Controle integrado de pragas (certificado)", "Limpeza de caixa d'água / reservatório", "Análise de potabilidade da água", "Manual de boas práticas", "POPs (procedimentos operacionais)", "ASO / exames dos colaboradores", "Certificados de treinamento (boas práticas)", "Manutenção de coifa / exaustão"],
    linhasLivres: true,
    campos: [
      { key: "situacao", label: "Situação", tipo: "select", opcoes: ["Em dia", "Vencido", "Ausente", "N.A."], alerta: (v) => (v === "Vencido" ? "documento vencido" : v === "Ausente" ? "documento ausente" : null) },
      { key: "vencimento", label: "Vencimento", tipo: "date", alerta: (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && v < hojeYmd() ? "vencido" : null) },
      { key: "obs", label: "Observação", tipo: "text" },
    ],
  },
  {
    codigo: "manutencao",
    nome: "Manutenção preventiva e corretiva",
    curto: "Manutenção",
    descricao: "Equipamentos verificados, ocorrências e datas de manutenção.",
    cabecalho: [],
    linhaLabel: "Equipamento",
    linhasLivres: true,
    campos: [
      { key: "local", label: "Local", tipo: "text" },
      { key: "verificou_planilha", label: "Verificou a planilha de T °C", tipo: "select", opcoes: SIM_NAO_NA },
      { key: "ocorrencias", label: "Ocorrências", tipo: "text" },
      { key: "data_verificacao", label: "Data da verificação", tipo: "date" },
      { key: "data_manutencao", label: "Data da manutenção", tipo: "date" },
    ],
  },
];

export const CONTROLE_BY_CODIGO = new Map(CONTROLE_TIPOS.map((t) => [t.codigo, t]));
export function getControleTipo(codigo: string): ControleTipo | null {
  return CONTROLE_BY_CODIGO.get(codigo) ?? null;
}

/** Estrutura inicial de um controle do tipo (linhas fixas prontas). */
export function dadosIniciais(tipo: ControleTipo): ControleDados {
  return { cabecalho: {}, linhas: (tipo.linhasFixas ?? []).map((nome) => ({ nome })) };
}

/** Normaliza o JSON gravado (tolera registros antigos/incompletos). */
export function parseDados(raw: unknown, tipo: ControleTipo): ControleDados {
  const r = (raw ?? {}) as Partial<ControleDados>;
  const linhas = Array.isArray(r.linhas) ? r.linhas.filter((l) => l && typeof l === "object").map((l) => ({ ...(l as Record<string, unknown>), nome: String((l as Record<string, unknown>).nome ?? "") })) : [];
  const base = linhas.length > 0 ? linhas : dadosIniciais(tipo).linhas;
  return { cabecalho: (r.cabecalho && typeof r.cabecalho === "object" ? r.cabecalho : {}) as Record<string, unknown>, linhas: base };
}

export interface ControleResumo {
  linhasPreenchidas: number;
  linhasTotal: number;
  alertas: { linha: string; campo: string; alerta: string }[];
  faltando: string[]; // campos obrigatórios vazios
}

const vazio = (v: unknown) => v == null || v === "";

/** Conferência do preenchimento: linhas com algum valor, alertas de faixa e obrigatórios faltando. */
export function resumirControle(tipo: ControleTipo, dados: ControleDados): ControleResumo {
  const alertas: ControleResumo["alertas"] = [];
  const faltando: string[] = [];
  for (const c of tipo.cabecalho) if (c.obrigatorio && vazio(dados.cabecalho[c.key])) faltando.push(c.label);
  let preenchidas = 0;
  for (const l of dados.linhas) {
    const temValor = tipo.campos.some((c) => !vazio(l[c.key]));
    if (temValor) preenchidas++;
    for (const c of tipo.campos) {
      const v = l[c.key];
      if (temValor && c.obrigatorio && vazio(v)) faltando.push(`${l.nome || "linha"}: ${c.label}`);
      const a = c.alerta && !vazio(v) ? c.alerta(v, l) : null;
      if (a) alertas.push({ linha: l.nome || "linha", campo: c.label, alerta: a });
    }
  }
  return { linhasPreenchidas: preenchidas, linhasTotal: dados.linhas.length, alertas, faltando };
}

export function formatCampo(c: Campo, v: unknown): string {
  if (vazio(v)) return "—";
  if (c.tipo === "bool") return v ? "Sim" : "Não";
  if (c.tipo === "number") return `${v}${c.sufixo ? ` ${c.sufixo}` : ""}`;
  if (c.tipo === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  return String(v);
}
