/**
 * Definições dos controles digitais do módulo nutricional (as "planilhas" da Daniele, pasta PLANILHAS
 * e mvp.xlsx do Drive, ajustadas pelos testes em loja), em código: um motor genérico renderiza,
 * valida e imprime qualquer tipo.
 *
 * - `cabecalho`: campos únicos do registro (podem ter valor padrão, seção recolhível e condição);
 * - `linhas`: tabela com linhas fixas (nome travado, valores padrão, subconjunto de campos) e/ou livres;
 * - rótulos aceitam `{chave}` do cabeçalho (ex.: horários editáveis);
 * - grupos de linhas podem depender do cabeçalho (ex.: refeição de funcionário "se aplica");
 * - campos `catalogo` oferecem lista cadastrada (fornecedores, produtos, marcas, hortifrútis);
 * - campos `foto` guardam caminhos no bucket de fotos.
 */
export type CampoTipo = "text" | "number" | "bool" | "select" | "time" | "date" | "foto";

export type Cabecalho = Record<string, unknown>;

export interface Campo {
  key: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[];
  obrigatorio?: boolean;
  sufixo?: string; // ex.: "°C"
  placeholder?: string;
  /** Avalia o valor e devolve um alerta (ex.: fora da faixa) ou null. */
  alerta?: (valor: unknown, linha: Record<string, unknown>, cabecalho?: Cabecalho) => string | null;
  /** Campo de data de vencimento: entra na lista de "vencimentos" (vencidos / próximos 30 dias). */
  vencimento?: boolean;
  /** Valor inicial (cabeçalho). */
  padrao?: unknown;
  /** Cabeçalho: seção recolhível em que o campo aparece (ex.: "Horários"). */
  secao?: string;
  /** Só aparece quando a condição sobre o cabeçalho é verdadeira. */
  quando?: (cabecalho: Cabecalho) => boolean;
  /** Opções vêm do catálogo cadastrado pela chefe (categoria). Com "Outro…" para digitar. */
  catalogo?: CatalogoCategoria;
  /** Catálogo: ao escolher, copia o `detalhe` do item (ex.: CNPJ) para este campo do cabeçalho. */
  detalheEm?: string;
}

export type CatalogoCategoria = "fornecedor" | "produto" | "marca" | "preparacao" | "hortifruti";
export const CATALOGO_LABELS: Record<CatalogoCategoria, { nome: string; detalhe?: string; ajuda: string }> = {
  fornecedor: { nome: "Fornecedores", detalhe: "CNPJ", ajuda: "Recebimento: o CNPJ sai automaticamente ao escolher." },
  produto: { nome: "Produtos recebidos", ajuda: "Recebimento: produtos comprados, para escolher na lista." },
  marca: { nome: "Marcas", ajuda: "Recebimento: marcas dos produtos." },
  preparacao: { nome: "Preparações transportadas", ajuda: "Alimentos transportados: o que sai de Moema para as filiais." },
  hortifruti: { nome: "Hortifrútis", ajuda: "Higienização: hortifrútis comprados." },
};

/** Linha fixa: só o nome, ou nome + valores padrão (ex.: conservação, grupo, `campos` visíveis). */
export type LinhaFixa = string | { nome: string; valores: Record<string, unknown> };

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
  linhasFixas?: LinhaFixa[];
  /** Permite incluir linhas além das fixas. */
  linhasLivres: boolean;
  campos: Campo[];
  /** Linhas vêm do cadastro da unidade (ex.: equipamentos) quando existir. */
  inventario?: "equipamentos";
  /** Nome das linhas livres escolhido no catálogo. */
  nomeCatalogo?: CatalogoCategoria;
  /** Grupos de linhas que só aparecem quando a condição sobre o cabeçalho é verdadeira. */
  grupoCondicional?: Record<string, (cabecalho: Cabecalho) => boolean>;
  /** Não aparece para criar (registros antigos continuam abrindo). */
  oculto?: boolean;
}

export type ControleLinha = { nome: string } & Record<string, unknown>;
export interface ControleDados {
  cabecalho: Cabecalho;
  linhas: ControleLinha[];
}

const num = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const SIM_NAO = ["Sim", "Não"];
const SIM_NAO_NA = ["Sim", "Não", "N.A."];
const CONF = ["Conforme", "Não conforme", "N.A."];
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const vencido = (v: unknown, rotulo = "vencido") => (isYmd(v) && v < hojeYmd() ? rotulo : null);
const SE_APLICA = "Se aplica";
const NAO_SE_APLICA = "Não se aplica";
const refeicaoAplica = (c: Cabecalho) => c.refeicao === SE_APLICA;

// ---------------------------------------------------------------------
// Faixas (RDC 216/2004, Portaria CVS 5/2013)
// ---------------------------------------------------------------------

/** Faixa por tipo de equipamento (°C). */
export const FAIXA_EQUIP: Record<string, { min?: number; max?: number }> = {
  Geladeira: { max: 5 },
  Refrigerador: { max: 5 },
  "Pista fria": { max: 5 },
  "Câmara fria": { max: 5 },
  Freezer: { max: -12 },
  "Pista quente": { min: 60 },
  Estufa: { min: 60 },
  "Banho-maria": { min: 60 },
};
export const TIPOS_EQUIP = Object.keys(FAIXA_EQUIP);
export const AREAS_EQUIP = ["Cozinha", "Produção", "Delivery", "Salão", "Açougue", "Estoque 1", "Estoque 2", "Outro"];

const alertaEquip = (valor: unknown, linha: Record<string, unknown>) => {
  const t = num(valor);
  if (t == null) return null;
  const f = FAIXA_EQUIP[String(linha.tipo_equip ?? "")];
  if (!f) return null;
  if (f.max != null && t > f.max) return `acima de ${f.max} °C`;
  if (f.min != null && t < f.min) return `abaixo de ${f.min} °C`;
  return null;
};

/** Alimentos em exposição/distribuição: frio até 10 °C, quente 60 °C ou mais, ambiente sem faixa. */
const alertaExposicao = (valor: unknown, linha: Record<string, unknown>) => {
  const t = num(valor);
  if (t == null) return null;
  const c = String(linha.conservacao ?? "Frio");
  if (c === "Quente" && t < 60) return "abaixo de 60 °C";
  if (c === "Frio" && t > 10) return "acima de 10 °C";
  return null;
};

/** Transporte: congelado -12 °C ou menos, refrigerado até 10 °C, quente 60 °C ou mais. */
const alertaTransporte = (valor: unknown, linha: Record<string, unknown>) => {
  const t = num(valor);
  if (t == null) return null;
  const c = String(linha.conservacao ?? "");
  if (c === "Congelado" && t > -12) return "acima de -12 °C";
  if (c === "Refrigerado" && t > 10) return "acima de 10 °C";
  if (c === "Quente" && t < 60) return "abaixo de 60 °C";
  return null;
};

/** Recebimento: congelado -12 °C ou menos, refrigerado até 7 °C (tolerância 10 °C). */
const alertaRecebimento = (valor: unknown, linha: Record<string, unknown>) => {
  const t = num(valor);
  if (t == null) return null;
  const c = String(linha.conservacao ?? "");
  if (c === "Congelado" && t > -12) return "acima de -12 °C";
  if (c === "Refrigerado" && t > 10) return "acima de 10 °C (recusar)";
  if (c === "Refrigerado" && t > 7) return "acima de 7 °C (tolerância)";
  return null;
};

const faixa = (min: number | null, max: number | null, rotulo?: string) => (v: unknown) => {
  const t = num(v);
  if (t == null) return null;
  if (min != null && t < min) return rotulo ?? `abaixo de ${min} °C`;
  if (max != null && t > max) return rotulo ?? `acima de ${max} °C`;
  return null;
};

const naoConforme = (v: unknown) => (v === "Não conforme" ? "não conforme" : null);

const frio = (nome: string, extra: Record<string, unknown> = {}): LinhaFixa => ({ nome, valores: { conservacao: "Frio", ...extra } });
const quente = (nome: string, extra: Record<string, unknown> = {}): LinhaFixa => ({ nome, valores: { conservacao: "Quente", ...extra } });
const ambiente = (nome: string, extra: Record<string, unknown> = {}): LinhaFixa => ({ nome, valores: { conservacao: "Ambiente", ...extra } });
const doc = (grupo: string, nome: string): LinhaFixa => ({ nome: `${grupo} · ${nome}`, valores: { grupo } });
const REFEICAO = "Refeição de funcionário";

/** Horários da distribuição (editáveis no cabeçalho): leituras e limites de troca. */
const HORARIOS_DISTRIBUICAO: { key: string; label: string; padrao: string }[] = [
  { key: "h1", label: "1ª leitura", padrao: "11:00" },
  { key: "h2", label: "2ª leitura", padrao: "13:00" },
  { key: "h3", label: "3ª leitura", padrao: "15:00" },
  { key: "h4", label: "4ª leitura", padrao: "17:00" },
  { key: "h5", label: "5ª leitura", padrao: "19:00" },
  { key: "h6", label: "6ª leitura", padrao: "21:00" },
  { key: "h7", label: "7ª leitura", padrao: "23:00" },
  { key: "tr1", label: "1ª troca até", padrao: "13:00" },
  { key: "tr2", label: "2ª troca até", padrao: "17:00" },
  { key: "tr3", label: "3ª troca até", padrao: "21:00" },
  { key: "hr1", label: "Refeição: 1ª leitura", padrao: "14:30" },
  { key: "hr2", label: "Refeição: 2ª leitura", padrao: "16:30" },
];

export const CONTROLE_TIPOS: ControleTipo[] = [
  {
    codigo: "temperatura_equipamentos",
    nome: "Temperatura dos equipamentos",
    curto: "Equipamentos",
    descricao: "Duas leituras por dia de cada geladeira, freezer, câmara, pista fria e pista quente da unidade, com o horário de cada leitura.",
    base: "Geladeira, pista e câmara fria até 5 °C · freezer a -12 °C ou menos · pista quente, estufa e banho-maria a 60 °C ou mais. Fora da faixa: registre a medida corretiva. As linhas vêm do cadastro de equipamentos da unidade (Início → Equipamentos). Temperatura negativa: digite o sinal de menos (ex.: -12).",
    cabecalho: [{ key: "termometro", label: "Termômetro utilizado", tipo: "text", placeholder: "Ex.: espeto digital nº 2" }],
    linhaLabel: "Equipamento",
    linhasFixas: [],
    linhasLivres: true,
    inventario: "equipamentos",
    campos: [
      { key: "tipo_equip", label: "Tipo", tipo: "select", opcoes: TIPOS_EQUIP, obrigatorio: true },
      { key: "local", label: "Área", tipo: "select", opcoes: AREAS_EQUIP },
      { key: "h1", label: "1º horário", tipo: "time" },
      { key: "temp1", label: "T °C no 1º horário", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "h2", label: "2º horário", tipo: "time" },
      { key: "temp2", label: "T °C no 2º horário", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "acao", label: "Medida corretiva", tipo: "text" },
    ],
  },
  {
    codigo: "temperatura_distribuicao",
    nome: "Distribuição de alimentos",
    curto: "Distribuição",
    descricao: "Temperatura das preparações em exposição ao longo do dia, troca entre as leituras, amostra por alimento e, onde houver, a refeição de funcionário com o balcão térmico.",
    base: "Temperatura no centro geométrico × tempo total entre espera, transporte e distribuição. Quentes: mínimo 60 °C, máximo 6 h; abaixo de 60 °C, máximo 1 h. Frios: até 10 °C, máximo 4 h; entre 10 e 21 °C, máximo 2 h. Pescados e carnes cruas: até 5 °C, máximo 2 h. Os horários das leituras podem ser ajustados em “Horários”.",
    cabecalho: [
      { key: "dia_semana", label: "Dia da semana", tipo: "select", opcoes: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] },
      { key: "refeicao", label: "Refeição de funcionário preparada no local", tipo: "select", opcoes: [NAO_SE_APLICA, SE_APLICA], obrigatorio: true },
      ...HORARIOS_DISTRIBUICAO.map((h): Campo => ({ key: h.key, label: h.label, tipo: "time", padrao: h.padrao, secao: "Horários (editar se precisar)", quando: h.key.startsWith("hr") ? refeicaoAplica : undefined })),
      // balcão térmico (refeição de funcionário)
      { key: "bm_h1", label: "Balcão térmico · 1º horário", tipo: "time", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica },
      { key: "bm_t1", label: "Balcão térmico · T °C (80 a 90 °C)", tipo: "number", sufixo: "°C", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica, alerta: faixa(80, 90) },
      { key: "bm_h2", label: "Balcão térmico · 2º horário", tipo: "time", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica },
      { key: "bm_t2", label: "Balcão térmico · T °C (80 a 90 °C)", tipo: "number", sufixo: "°C", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica, alerta: faixa(80, 90) },
      { key: "agua_h1", label: "Água do balcão · 1º horário", tipo: "time", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica },
      { key: "agua_t1", label: "Água do balcão · T °C (mínimo 80 °C)", tipo: "number", sufixo: "°C", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica, alerta: faixa(80, null) },
      { key: "agua_h2", label: "Água do balcão · 2º horário", tipo: "time", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica },
      { key: "agua_t2", label: "Água do balcão · T °C (mínimo 80 °C)", tipo: "number", sufixo: "°C", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica, alerta: faixa(80, null) },
      { key: "alimento_t", label: "T °C do alimento ao entrar no balcão (maior que 60 °C)", tipo: "number", sufixo: "°C", secao: "Balcão térmico e entrada de alimentos", quando: refeicaoAplica, alerta: faixa(60, null) },
    ],
    linhaLabel: "Preparação",
    linhasFixas: [
      frio("Alface"),
      frio("Tomate"),
      frio("Cebola picada"),
      frio("Cebola caramelizada"),
      frio("Picles"),
      frio("Maionese verde"),
      frio("Maionese da Rua"),
      frio("Maionese de mostarda"),
      frio("Ketchup"),
      frio("Mostarda"),
      frio("Molho smash"),
      frio("Queijo fatiado na GN"),
      quente("Bacon frito na GN"),
      quente("Cebola smash"),
      frio("Molho caipira", { campos: ["conservacao", "amostra"] }),
      ambiente("Pão", { campos: ["conservacao", "lote", "validade_original", "amostra"] }),
      frio("Carne de hambúrguer", { campos: ["conservacao", "amostra"] }),
      ambiente("Água", { campos: ["conservacao", "amostra"] }),
      ambiente("Farofa de bacon"),
      quente("Arroz", { grupo: REFEICAO, campos: ["conservacao", "amostra", "r1", "r2"] }),
      quente("Feijão", { grupo: REFEICAO, campos: ["conservacao", "amostra", "r1", "r2"] }),
      quente("Proteína (ave, peixe, bovina/suína)", { grupo: REFEICAO, campos: ["conservacao", "amostra", "r1", "r2"] }),
    ],
    linhasLivres: true,
    grupoCondicional: { [REFEICAO]: refeicaoAplica },
    campos: [
      { key: "conservacao", label: "Conservação", tipo: "select", opcoes: ["Frio", "Quente", "Ambiente"] },
      { key: "amostra", label: "Amostra coletada", tipo: "select", opcoes: SIM_NAO },
      { key: "t1", label: "{h1}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "t2", label: "{h2}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou1", label: "Trocou até {tr1}", tipo: "select", opcoes: SIM_NAO },
      { key: "t3", label: "{h3}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "t4", label: "{h4}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou2", label: "Trocou até {tr2}", tipo: "select", opcoes: SIM_NAO },
      { key: "t5", label: "{h5}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "t6", label: "{h6}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou3", label: "Trocou até {tr3}", tipo: "select", opcoes: SIM_NAO },
      { key: "t7", label: "{h7}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "validade_original", label: "Validade original", tipo: "date", alerta: (v) => vencido(v, "vencido") },
      { key: "r1", label: "{hr1}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "r2", label: "{hr2}", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
    ],
  },
  {
    codigo: "oleo",
    nome: "Controle de óleos e gorduras",
    curto: "Óleo",
    descricao: "Temperatura do óleo, higienização da fritadeira e troca, manhã e noite (planilha mensal por fritadeira).",
    base: "RDC 216/2004: óleos e gorduras de fritura não devem ultrapassar 180 °C. Trocar quando houver alteração de cor, odor, espuma ou fumaça.",
    cabecalho: [{ key: "fritadeira", label: "Fritadeira", tipo: "text", placeholder: "Ex.: fritadeira 1" }],
    linhaLabel: "Período",
    linhasFixas: ["Manhã", "Noite"],
    linhasLivres: false,
    campos: [
      { key: "temperatura", label: "Temperatura do óleo", tipo: "number", sufixo: "°C", alerta: faixa(null, 180) },
      { key: "higienizada", label: "Fritadeira foi higienizada", tipo: "select", opcoes: SIM_NAO },
      { key: "trocado", label: "O óleo foi trocado", tipo: "select", opcoes: SIM_NAO },
    ],
  },
  {
    codigo: "recebimento",
    nome: "Recebimento de mercadorias",
    curto: "Recebimento",
    descricao: "Cada produto recebido: dados da nota e da embalagem, temperatura e avaliação conforme/não conforme (só onde há recebimento, ex.: Moema Delivery).",
    base: "Refrigerados até 7 °C na chegada (tolerância 10 °C) · congelados a -12 °C ou menos · embalagem íntegra, rotulagem completa (denominação, origem, validade, lote, SIF/SISP/SIM). Quando a estagiária não está no recebimento, quem recebe anota temperatura e validade no verso da nota e ela confere depois. Fornecedores, produtos e marcas vêm do catálogo (Início → Catálogos).",
    cabecalho: [
      { key: "nota_fiscal", label: "Nº da nota fiscal", tipo: "text" },
      { key: "fornecedor", label: "Fornecedor", tipo: "text", catalogo: "fornecedor", detalheEm: "cnpj" },
      { key: "cnpj", label: "CNPJ do fornecedor", tipo: "text", placeholder: "00.000.000/0000-00" },
      { key: "recebido_por", label: "Quem recebeu", tipo: "text" },
      { key: "presenca", label: "Conferência", tipo: "select", opcoes: ["Presente no recebimento", "Pela anotação no verso da nota"] },
    ],
    linhaLabel: "Produto",
    linhasLivres: true,
    nomeCatalogo: "produto",
    campos: [
      { key: "marca", label: "Marca", tipo: "text", catalogo: "marca" },
      { key: "conservacao", label: "Conservação", tipo: "select", opcoes: ["Congelado", "Refrigerado", "Ambiente"] },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C", alerta: alertaRecebimento },
      { key: "fabricacao", label: "Fabricação", tipo: "date" },
      { key: "validade", label: "Validade", tipo: "date", alerta: (v) => vencido(v, "produto vencido") },
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "sif", label: "SIF / SISP / SIM", tipo: "text" },
      { key: "sensorial", label: "Sensorial (cor, odor, textura)", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "embalagem", label: "Embalagem íntegra", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "denominacao", label: "Denominação de venda", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "origem", label: "Origem (razão social, endereço, CNPJ)", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "conteudo", label: "Conteúdo líquido", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "instrucao", label: "Instrução de uso", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "modo_conservacao", label: "Modo de conservação no rótulo", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "info_nutricional", label: "Informação nutricional", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "registro", label: "Registro no órgão oficial", tipo: "select", opcoes: CONF, alerta: naoConforme },
      { key: "irregularidade", label: "Irregularidade / devolução", tipo: "text" },
    ],
  },
  {
    codigo: "transportados",
    nome: "Alimentos transportados",
    curto: "Transporte",
    descricao: "Saída e entrada das preparações entre a cozinha central (Moema) e as filiais: rastreabilidade e tempo × temperatura.",
    base: "Registrar horário e temperatura no início e no fim do transporte. Congelado -12 °C ou menos · refrigerado até 10 °C · quente 60 °C ou mais. Etiqueta do produto transportado: produto, manipulação, validade, marca, SIF, lote, validade original e rastreabilidade.",
    cabecalho: [
      { key: "sentido", label: "Local", tipo: "select", opcoes: ["Saída da matriz", "Entrada na filial", "Saída da filial", "Retorno para matriz"], obrigatorio: true },
      { key: "outra_unidade", label: "Destino / origem", tipo: "text", placeholder: "Ex.: Imigrantes", obrigatorio: true },
      { key: "horario", label: "Horário", tipo: "time", obrigatorio: true },
      { key: "transporte", label: "Transportado como", tipo: "select", opcoes: ["Caixa térmica", "Gelo", "Carro refrigerado", "Outros"] },
      { key: "transporte_outro", label: "Transportado como (descreva)", tipo: "text", quando: (c) => c.transporte === "Outros" },
    ],
    linhaLabel: "Preparação",
    linhasLivres: true,
    nomeCatalogo: "preparacao",
    campos: [
      { key: "conservacao", label: "Conservação", tipo: "select", opcoes: ["Congelado", "Refrigerado", "Quente", "Ambiente"] },
      { key: "quantidade", label: "Quantidade", tipo: "text" },
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "validade", label: "Validade", tipo: "date", alerta: (v) => vencido(v, "vencido") },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C", alerta: alertaTransporte },
      { key: "ocorrencia", label: "Ocorrência", tipo: "text" },
    ],
  },
  {
    codigo: "hortifruti",
    nome: "Higienização de hortifrúti (cloro PPM)",
    curto: "Hortifrúti",
    descricao: "Validação da solução clorada com fita de teste: alvo 200 PPM de cloro livre.",
    base: "A fita de PPM deve ser usada sempre que uma solução clorada for preparada. Solução para sanitização de hortifrutícolas em torno de 200 PPM. Os hortifrútis vêm do catálogo (Início → Catálogos).",
    cabecalho: [{ key: "produto_cloro", label: "Produto clorado / diluição", tipo: "text" }],
    linhaLabel: "Hortifrúti",
    linhasLivres: true,
    nomeCatalogo: "hortifruti",
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
    descricao: "Substituída pelo campo “Amostra coletada” de cada alimento na distribuição.",
    cabecalho: [
      { key: "local", label: "Local", tipo: "select", opcoes: ["Salão", "Delivery", "Produção"] },
      { key: "horario", label: "Horário da coleta", tipo: "time" },
      { key: "coletado_por", label: "Quem coletou", tipo: "text" },
    ],
    linhaLabel: "Preparação",
    linhasLivres: true,
    oculto: true,
    campos: [
      { key: "lote", label: "Lote", tipo: "text" },
      { key: "temperatura", label: "Temperatura", tipo: "number", sufixo: "°C" },
      { key: "identificada", label: "Identificada", tipo: "select", opcoes: SIM_NAO },
      { key: "descarte_em", label: "Descartar em", tipo: "date" },
    ],
  },
  {
    codigo: "caixa_gordura",
    nome: "Higienização das caixas de gordura",
    curto: "Caixa de gordura",
    descricao: "Cada higienização de caixa de gordura: qual caixa, quem fez, ação corretiva e foto.",
    base: "Registre cada caixa higienizada na data. A foto comprova o serviço para a fiscalização.",
    cabecalho: [],
    linhaLabel: "Caixa",
    linhasLivres: true,
    campos: [
      { key: "quem_fez", label: "Quem fez", tipo: "text" },
      { key: "acao", label: "Ação corretiva", tipo: "text" },
      { key: "foto", label: "Foto", tipo: "foto" },
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
    linhasFixas: ["Temperatura dos equipamentos", "Distribuição de alimentos", "Óleo e gorduras", "Recebimento de mercadorias", "Alimentos transportados", "Higienização de hortifrúti", "Higienização / limpeza", "Caixa de gordura", "Manutenção", "Ficha técnica dos produtos de limpeza"],
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
    nome: "Pasta sanitária (documentação)",
    curto: "Pasta",
    descricao: "Lista de documentos da pasta sanitária (mvp.xlsx): por fornecedor/serviço, POPs, planilhas, RH e administrativo, com situação, periodicidade e vencimento.",
    base: "Para cada documento: aplicável ou não, situação, periodicidade e vencimento. Vencido ou ausente fica em vermelho; o vencimento entra nos avisos de 30 dias.",
    cabecalho: [],
    linhaLabel: "Documento",
    linhasFixas: [
      ...["Alvará de funcionamento", "Alvará sanitário / licença da vigilância", "ART da empresa", "Contrato social, CNPJ e I.E.", "Certificado de Regularidade – Cadastro Técnico Federal", "Comprovante de execução (tipo de praga e iscas)", "Relatório técnico de visita com medidas preventivas", "Mapeamento das iscas", "Saneantes utilizados com ingrediente ativo", "Ficha técnica dos produtos", "Procedimentos antes e depois das aplicações", "Orientação médica em caso de acidente", "Telefone do centro de informações toxicológicas"].map((n) => doc("Dedetização", n)),
      ...["Alvará de funcionamento", "Alvará sanitário / licença da vigilância", "ART da empresa", "Contrato social, CNPJ e I.E.", "Certificado de Regularidade – Cadastro Técnico Federal", "Laudo microbiológico da água", "Tipo de abastecimento de água", "Volume, local e localização das caixas", "Periodicidade de higienização de cada reservatório", "Comprovante de higienização das caixas d'água", "Descrição do método de higienização", "Características das superfícies higienizadas", "Princípio ativo e produto utilizado", "Concentração e tempo de contato dos agentes químicos"].map((n) => doc("Caixa d'água", n)),
      ...["Higienização e manutenção dos filtros e sistemas de filtragem", "Troca dos filtros (nota fiscal)"].map((n) => doc("Filtros, bebedouros e máquina de gelo", n)),
      ...["Alvará de funcionamento", "Alvará sanitário / licença da vigilância", "ART da empresa", "Contrato social", "Certificado de Regularidade – IBAMA", "Autorização ambiental para transporte de produtos perigosos", "AMLURB do contratante e da contratada", "Cadastro de grande gerador – AMLURB (> 200 l/dia)", "Cadastro de CNPJ e I.E.", "Comprovante de retirada do lixo e aterro sanitário"].map((n) => doc("Resíduos", n)),
      ...["Alvará de funcionamento", "Alvará sanitário / licença da vigilância", "Contrato social", "Certificado de Regularidade – IBAMA", "Certificado de produtos controlados", "Declaração de destino final dos resíduos", "Licença de operação", "Licença de instalação", "Certificado de movimentação de resíduos de interesse ambiental", "Licença metropolitana de localização", "Cadastro de CNPJ e I.E.", "Registro nacional de transportadores de carga"].map((n) => doc("Reciclagem de óleo", n)),
      ...["Certificado de limpeza das coifas", "Alvará de funcionamento", "Responsável técnico", "CNPJ"].map((n) => doc("Exaustão – coifas", n)),
      ...["Certificado e PMOC", "Alvará de funcionamento", "Responsável técnico", "CNPJ"].map((n) => doc("Ar-condicionado e exaustores", n)),
      ...["Certificado de calibração da balança", "Certificado de calibração do termômetro", "Certificado de calibração da pista fria", "Certificado de calibração da câmara fria"].map((n) => doc("Calibração", n)),
      doc("Manutenção", "Comprovante de manutenção preventiva e corretiva dos equipamentos"),
      ...["Manual de boas práticas", "POP 01: Higienização das instalações, equipamentos, móveis e utensílios", "POP 02: Higiene e saúde dos funcionários", "POP 03: Capacitação dos funcionários em Boas Práticas", "POP 04: Controle de qualidade no recebimento de mercadorias", "POP 05: Seleção das matérias-primas, ingredientes e embalagens", "POP 06: Controle de qualidade e rastreabilidade do produto acabado", "POP 07: Higienização do reservatório de água e potabilidade", "POP 08: Manutenção das instalações, equipamentos e calibração", "POP 09: Controle integrado de vetores e pragas urbanas", "POP 10: Manejo de resíduos", "POP 11: Higienização de frutas, verduras e legumes", "POP 12: Transporte de alimentos"].map((n) => doc("Manual e POPs", n)),
      ...["Temperatura dos equipamentos", "Distribuição de alimentos", "Temperatura do óleo", "Recebimento de mercadorias", "Manutenção preventiva e corretiva", "Validação de higienização dos hortifrútis", "Higienização das caixas de gordura", "Ficha técnica dos produtos de limpeza e lubrificantes"].map((n) => doc("Planilhas", n)),
      ...["CIPA", "Comprovante de entrega de EPIs", "Comprovante de entrega de uniformes", "Comprovante de capacitação de funcionários", "Ordem de serviço", "Ciência do PGR e segurança no trabalho", "ASOs", "PGR", "PCMSO", "LTCAT", "Riscos psicossociais", "Resultado do exame de fezes (a cada 6 meses)"].map((n) => doc("RH", n)),
      ...["Contratação do responsável técnico", "ART do responsável técnico", "Certificado do curso de R.T. (quando o proprietário responde)", "Fichas técnicas dos produtos fabricados", "Registro das reclamações do SAC", "Licenciamento sanitário dos fornecedores", "Manual para surtos de DTAs", "Manutenção dos extintores", "Alvará de funcionamento", "Alvará sanitário", "AVCB ou CLCB", "ECAD e CADAN", "Análise microbiológica de alimentos", "Análise de shelf life", "Análise de swab", "Layout e planta do local", "Contrato social da empresa", "Cartão do CNPJ, CNAE e CCM"].map((n) => doc("Administrativo", n)),
    ],
    linhasLivres: true,
    campos: [
      { key: "situacao", label: "Situação", tipo: "select", opcoes: ["Em dia", "Vencido", "Ausente", "N.A."], alerta: (v) => (v === "Vencido" ? "documento vencido" : v === "Ausente" ? "documento ausente" : null) },
      { key: "periodicidade", label: "Periodicidade", tipo: "select", opcoes: ["Mensal", "Trimestral", "Semestral", "Anual", "Bienal", "Única"] },
      { key: "vencimento", label: "Vencimento", tipo: "date", vencimento: true, alerta: (v) => vencido(v) },
      { key: "obs", label: "Observação", tipo: "text" },
    ],
  },
  {
    codigo: "enxoval_rh",
    nome: "Enxoval de RH (uniforme, EPIs, exames)",
    curto: "RH / EPIs",
    descricao: "Por colaborador: cargo, uniforme, EPIs entregues com ficha assinada, ordem de serviço, declaração de ciência, treinamentos e exames (ASO + fezes a cada 6 meses).",
    base: "EPIs por cargo: sapato técnico, respirador PFF2, avental PVC, avental e mangote térmicos, óculos, luvas nitrílicas (cano longo/baixo), luva para altas temperaturas, luva de malha de aço; com câmara fria: meia térmica, balaclava, luva para baixas temperaturas, japona e calça térmicas. Exames: clínico, micológico de unha, coprocultura e parasitológico, semestral ou anual conforme o PCMSO; resultado de fezes junto do ASO a cada 6 meses.",
    cabecalho: [],
    linhaLabel: "Colaborador",
    linhasLivres: true,
    campos: [
      { key: "cargo", label: "Cargo", tipo: "select", opcoes: ["Chapeiro(a)", "Auxiliar de cozinha", "Atendente", "Supervisor(a)", "Gerente", "Entregador(a)", "Produção", "Outro"] },
      { key: "uniforme", label: "Uniforme completo", tipo: "select", opcoes: SIM_NAO, alerta: (v) => (v === "Não" ? "uniforme incompleto" : null) },
      { key: "epis", label: "EPIs entregues", tipo: "text", placeholder: "Ex.: sapato técnico, avental térmico, luva nitrílica" },
      { key: "epis_faltantes", label: "EPIs faltantes para o cargo", tipo: "text" },
      { key: "ficha_epi", label: "Ficha de entrega de EPI assinada", tipo: "select", opcoes: SIM_NAO_NA, alerta: (v) => (v === "Não" ? "ficha de EPI não assinada" : null) },
      { key: "ordem_servico", label: "Ordem de serviço assinada", tipo: "select", opcoes: SIM_NAO, alerta: (v) => (v === "Não" ? "ordem de serviço não assinada" : null) },
      { key: "declaracao", label: "Declaração de ciência (PGR/PCMSO/EPI)", tipo: "select", opcoes: SIM_NAO, alerta: (v) => (v === "Não" ? "declaração não assinada" : null) },
      { key: "treinamento_epi", label: "Treinamento de EPIs e segurança", tipo: "date" },
      { key: "treinamento_bp", label: "Treinamento boas práticas (8 h)", tipo: "date" },
      { key: "aso_validade", label: "ASO válido até", tipo: "date", vencimento: true, alerta: (v) => vencido(v, "ASO vencido") },
      { key: "fezes_validade", label: "Exame de fezes válido até (6 meses)", tipo: "date", vencimento: true, alerta: (v) => vencido(v, "exame de fezes vencido") },
      { key: "obs", label: "Observação", tipo: "text" },
    ],
  },
  {
    codigo: "manutencao",
    nome: "Manutenção preventiva e corretiva",
    curto: "Manutenção",
    descricao: "Equipamentos verificados, ocorrências, datas de manutenção e foto.",
    cabecalho: [],
    linhaLabel: "Equipamento",
    linhasLivres: true,
    inventario: "equipamentos",
    campos: [
      { key: "local", label: "Local", tipo: "select", opcoes: AREAS_EQUIP },
      { key: "verificou_planilha", label: "Verificou a planilha de T °C", tipo: "select", opcoes: SIM_NAO_NA },
      { key: "ocorrencias", label: "Ocorrências", tipo: "text" },
      { key: "data_verificacao", label: "Data da verificação", tipo: "date" },
      { key: "data_manutencao", label: "Data da manutenção", tipo: "date" },
      { key: "foto", label: "Foto", tipo: "foto" },
    ],
  },
];

export const CONTROLE_BY_CODIGO = new Map(CONTROLE_TIPOS.map((t) => [t.codigo, t]));
export function getControleTipo(codigo: string): ControleTipo | null {
  return CONTROLE_BY_CODIGO.get(codigo) ?? null;
}
/** Tipos oferecidos para criar (sem os ocultos). */
export const CONTROLE_TIPOS_ATIVOS = CONTROLE_TIPOS.filter((t) => !t.oculto);

export const nomeLinhaFixa = (l: LinhaFixa): string => (typeof l === "string" ? l : l.nome);
export function nomesLinhasFixas(tipo: ControleTipo): string[] {
  return (tipo.linhasFixas ?? []).map(nomeLinhaFixa);
}

/** Rótulo do campo com `{chave}` do cabeçalho substituída (ex.: horário editável). */
export function rotuloCampo(c: Campo, cabecalho: Cabecalho): string {
  return c.label.replace(/\{(\w+)\}/g, (_, k) => {
    const v = cabecalho[k];
    return v == null || v === "" ? "—" : String(v);
  });
}

/** Campos do cabeçalho visíveis para este registro. */
export function cabecalhoVisivel(tipo: ControleTipo, cabecalho: Cabecalho): Campo[] {
  return tipo.cabecalho.filter((c) => !c.quando || c.quando(cabecalho));
}

/** Campos visíveis de uma linha: subconjunto `campos` da linha fixa, se houver. */
export function camposDaLinha(tipo: ControleTipo, linha: Record<string, unknown>): Campo[] {
  const sub = Array.isArray(linha.campos) ? new Set(linha.campos.map(String)) : null;
  return sub ? tipo.campos.filter((c) => sub.has(c.key)) : tipo.campos;
}

/** Linha visível (grupo condicional ao cabeçalho). */
export function linhaVisivel(tipo: ControleTipo, cabecalho: Cabecalho, linha: Record<string, unknown>): boolean {
  const g = typeof linha.grupo === "string" ? linha.grupo : null;
  const cond = g ? tipo.grupoCondicional?.[g] : undefined;
  return cond ? cond(cabecalho) : true;
}

/** Estrutura inicial de um controle do tipo (linhas fixas prontas, com valores padrão; cabeçalho com padrões). */
export function dadosIniciais(tipo: ControleTipo): ControleDados {
  const cabecalho: Cabecalho = {};
  for (const c of tipo.cabecalho) if (c.padrao != null) cabecalho[c.key] = c.padrao;
  return { cabecalho, linhas: (tipo.linhasFixas ?? []).map((l) => (typeof l === "string" ? { nome: l } : { ...l.valores, nome: l.nome })) };
}

/** Normaliza o JSON gravado (tolera registros antigos/incompletos; completa padrões do cabeçalho). */
export function parseDados(raw: unknown, tipo: ControleTipo): ControleDados {
  const r = (raw ?? {}) as Partial<ControleDados>;
  const linhas = Array.isArray(r.linhas) ? r.linhas.filter((l) => l && typeof l === "object").map((l) => ({ ...(l as Record<string, unknown>), nome: String((l as Record<string, unknown>).nome ?? "") })) : [];
  const base = linhas.length > 0 ? linhas : dadosIniciais(tipo).linhas;
  const cabecalho = { ...dadosIniciais(tipo).cabecalho, ...((r.cabecalho && typeof r.cabecalho === "object" ? r.cabecalho : {}) as Cabecalho) };
  return { cabecalho, linhas: base };
}

export interface ControleResumo {
  linhasPreenchidas: number;
  linhasTotal: number;
  alertas: { linha: string; campo: string; alerta: string }[];
  faltando: string[]; // campos obrigatórios vazios
}

const vazio = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/** Campos que contam como "preenchimento" (valores padrão de linha fixa não contam). */
const PADRAO_KEYS = new Set(["conservacao", "grupo", "campos"]);
function camposDeValor(tipo: ControleTipo, linha?: Record<string, unknown>): Campo[] {
  return (linha ? camposDaLinha(tipo, linha) : tipo.campos).filter((c) => !PADRAO_KEYS.has(c.key));
}

/** Conferência do preenchimento: linhas visíveis com algum valor, alertas de faixa e obrigatórios faltando. */
export function resumirControle(tipo: ControleTipo, dados: ControleDados): ControleResumo {
  const alertas: ControleResumo["alertas"] = [];
  const faltando: string[] = [];
  const cab = dados.cabecalho;
  for (const c of cabecalhoVisivel(tipo, cab)) {
    const v = cab[c.key];
    if (c.obrigatorio && vazio(v)) faltando.push(rotuloCampo(c, cab));
    const a = c.alerta && !vazio(v) ? c.alerta(v, {}, cab) : null;
    if (a) alertas.push({ linha: "Cabeçalho", campo: rotuloCampo(c, cab), alerta: a });
  }
  let preenchidas = 0;
  let total = 0;
  for (const l of dados.linhas) {
    if (!linhaVisivel(tipo, cab, l)) continue;
    total++;
    const temValor = camposDeValor(tipo, l).some((c) => !vazio(l[c.key]));
    if (temValor) preenchidas++;
    for (const c of camposDaLinha(tipo, l)) {
      const v = l[c.key];
      if (temValor && c.obrigatorio && vazio(v)) faltando.push(`${l.nome || "linha"}: ${rotuloCampo(c, cab)}`);
      const a = c.alerta && !vazio(v) ? c.alerta(v, l, cab) : null;
      if (a) alertas.push({ linha: l.nome || "linha", campo: rotuloCampo(c, cab), alerta: a });
    }
  }
  return { linhasPreenchidas: preenchidas, linhasTotal: total, alertas, faltando };
}

/** Linha tem algum valor digitado (ignora os padrões de linha fixa). */
export function linhaPreenchida(tipo: ControleTipo, l: Record<string, unknown>): boolean {
  return camposDeValor(tipo, l).some((c) => !vazio(l[c.key]));
}

/** Caminhos de fotos (campos `foto`) de um registro. */
export function fotosDoRegistro(tipo: ControleTipo, dados: ControleDados): string[] {
  const out: string[] = [];
  for (const l of dados.linhas) for (const c of camposDaLinha(tipo, l)) if (c.tipo === "foto" && Array.isArray(l[c.key])) out.push(...(l[c.key] as unknown[]).map(String));
  return out;
}

export function formatCampo(c: Campo, v: unknown): string {
  if (vazio(v)) return "—";
  if (c.tipo === "bool") return v ? "Sim" : "Não";
  if (c.tipo === "number") return `${v}${c.sufixo ? ` ${c.sufixo}` : ""}`;
  if (c.tipo === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  if (c.tipo === "foto") return Array.isArray(v) ? `${v.length} foto${v.length === 1 ? "" : "s"}` : "—";
  return String(v);
}
