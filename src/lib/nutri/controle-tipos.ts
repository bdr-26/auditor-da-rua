/**
 * Definições dos controles digitais do módulo nutricional (as "planilhas" da Daniele, pasta PLANILHAS
 * e mvp.xlsx do Drive), em código: um motor genérico renderiza, valida e imprime qualquer tipo.
 * `cabecalho`: campos únicos do registro; `linhas`: tabela (linhas fixas pré-preenchidas e/ou livres).
 * Linhas fixas podem trazer valores padrão (ex.: conservação de cada preparação).
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
  /** Campo de data de vencimento: entra na lista de "vencimentos" (vencidos / próximos 30 dias). */
  vencimento?: boolean;
}

/** Linha fixa: só o nome, ou nome + valores padrão de campos. */
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
}

export type ControleLinha = { nome: string } & Record<string, unknown>;
export interface ControleDados {
  cabecalho: Record<string, unknown>;
  linhas: ControleLinha[];
}

const num = (v: unknown): number | null => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const SIM_NAO = ["Sim", "Não"];
const SIM_NAO_NA = ["Sim", "Não", "N.A."];
const CONF = ["Conforme", "Não conforme", "N.A."];
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const vencido = (v: unknown, rotulo = "vencido") => (isYmd(v) && v < hojeYmd() ? rotulo : null);

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

/** Alimentos em exposição/distribuição: frio até 10 °C (máx. 4 h), quente 60 °C ou mais. Ambiente sem faixa. */
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

const naoConforme = (v: unknown) => (v === "Não conforme" ? "não conforme" : null);

const frio = (nome: string): LinhaFixa => ({ nome, valores: { conservacao: "Frio" } });
const quente = (nome: string): LinhaFixa => ({ nome, valores: { conservacao: "Quente" } });
const ambiente = (nome: string): LinhaFixa => ({ nome, valores: { conservacao: "Ambiente" } });
const doc = (grupo: string, nome: string): LinhaFixa => ({ nome: `${grupo} · ${nome}`, valores: { grupo } });

export const CONTROLE_TIPOS: ControleTipo[] = [
  {
    codigo: "temperatura_equipamentos",
    nome: "Temperatura dos equipamentos",
    curto: "Equipamentos",
    descricao: "Duas leituras por dia de cada geladeira, freezer, câmara, pista fria e pista quente da unidade (planilha mensal de equipamentos).",
    base: "Geladeira, pista e câmara fria até 5 °C · freezer a -12 °C ou menos · pista quente, estufa e banho-maria a 60 °C ou mais. Fora da faixa: registre a medida corretiva. As linhas vêm do cadastro de equipamentos da unidade (Nutrição → Equipamentos).",
    cabecalho: [{ key: "termometro", label: "Termômetro utilizado", tipo: "text", placeholder: "Ex.: espeto digital nº 2" }],
    linhaLabel: "Equipamento",
    linhasFixas: [],
    linhasLivres: true,
    inventario: "equipamentos",
    campos: [
      { key: "tipo_equip", label: "Tipo", tipo: "select", opcoes: TIPOS_EQUIP, obrigatorio: true },
      { key: "local", label: "Área", tipo: "select", opcoes: AREAS_EQUIP },
      { key: "temp_manha", label: "1ª leitura", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "temp_tarde", label: "2ª leitura", tipo: "number", sufixo: "°C", alerta: alertaEquip },
      { key: "acao", label: "Medida corretiva", tipo: "text" },
    ],
  },
  {
    codigo: "temperatura_distribuicao",
    nome: "Temperatura dos alimentos na distribuição",
    curto: "Distribuição",
    descricao: "Preparações da pista fria e demais itens em exposição, de 2 em 2 horas (16h, 18h, 20h, 22h), com a troca entre as leituras.",
    base: "Frio em exposição: até 10 °C (máximo 4 h); acima disso, trocar. Quente: 60 °C ou mais. Ambiente (pão, farofa): sem faixa, registrar lote.",
    cabecalho: [
      { key: "dia_semana", label: "Dia da semana", tipo: "select", opcoes: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] },
      { key: "amostra", label: "Amostra coletada", tipo: "select", opcoes: SIM_NAO },
      { key: "horario_amostra", label: "Horário da retirada de amostra", tipo: "time" },
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
      frio("Molho caipira"),
      ambiente("Pão (lote e ambiente)"),
      frio("Hambúrguer (lote)"),
      ambiente("Farofa de bacon"),
    ],
    linhasLivres: true,
    campos: [
      { key: "conservacao", label: "Conservação", tipo: "select", opcoes: ["Frio", "Quente", "Ambiente"] },
      { key: "t16", label: "16h", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou_18", label: "Trocou até 18h", tipo: "select", opcoes: SIM_NAO },
      { key: "t18", label: "18h", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou_20", label: "Trocou até 20h", tipo: "select", opcoes: SIM_NAO },
      { key: "t20", label: "20h", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "trocou_22", label: "Trocou até 22h", tipo: "select", opcoes: SIM_NAO },
      { key: "t22", label: "22h", tipo: "number", sufixo: "°C", alerta: alertaExposicao },
      { key: "lote", label: "Lote", tipo: "text" },
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
      { key: "temperatura", label: "Temperatura do óleo", tipo: "number", sufixo: "°C", alerta: (v) => (num(v) != null && num(v)! > 180 ? "acima de 180 °C" : null) },
      { key: "higienizada", label: "Fritadeira foi higienizada", tipo: "select", opcoes: SIM_NAO },
      { key: "trocado", label: "O óleo foi trocado", tipo: "select", opcoes: SIM_NAO },
    ],
  },
  {
    codigo: "recebimento",
    nome: "Recebimento de mercadorias",
    curto: "Recebimento",
    descricao: "Cada produto recebido: dados da nota e da embalagem, temperatura e avaliação conforme/não conforme (só onde há recebimento, ex.: Moema Delivery).",
    base: "Refrigerados até 7 °C na chegada (tolerância 10 °C) · congelados a -12 °C ou menos · embalagem íntegra, rotulagem completa (denominação, origem, validade, lote, SIF/SISP/SIM). Quando a estagiária não está no recebimento, quem recebe anota temperatura e validade no verso da nota e ela confere depois.",
    cabecalho: [
      { key: "nota_fiscal", label: "Nº da nota fiscal", tipo: "text" },
      { key: "fornecedor", label: "Fornecedor", tipo: "text" },
      { key: "recebido_por", label: "Quem recebeu", tipo: "text" },
      { key: "presenca", label: "Conferência", tipo: "select", opcoes: ["Presente no recebimento", "Pela anotação no verso da nota"] },
    ],
    linhaLabel: "Produto",
    linhasLivres: true,
    campos: [
      { key: "marca", label: "Marca", tipo: "text" },
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
    descricao: "Saída da cozinha central (Moema) e entrada na filial: rastreabilidade e tempo × temperatura de cada preparação.",
    base: "Registrar horário e temperatura no início e no fim do transporte. Congelado -12 °C ou menos · refrigerado até 10 °C · quente 60 °C ou mais. Etiqueta do produto transportado: produto, manipulação, validade, marca, SIF, lote, validade original e rastreabilidade.",
    cabecalho: [
      { key: "sentido", label: "Registro", tipo: "select", opcoes: ["Saída da matriz", "Entrada na filial"], obrigatorio: true },
      { key: "outra_unidade", label: "Destino / origem", tipo: "text", placeholder: "Ex.: Imigrantes", obrigatorio: true },
      { key: "horario", label: "Horário", tipo: "time", obrigatorio: true },
      { key: "veiculo", label: "Veículo / caixa térmica", tipo: "text" },
    ],
    linhaLabel: "Preparação",
    linhasLivres: true,
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
    base: "A fita de PPM deve ser usada sempre que uma solução clorada for preparada. Solução para sanitização de hortifrutícolas em torno de 200 PPM.",
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
    linhasFixas: ["Temperatura dos equipamentos", "Temperatura na distribuição", "Óleo e gorduras", "Recebimento de mercadorias", "Alimentos transportados", "Higienização de hortifrúti", "Higienização / limpeza", "Manutenção", "Ficha técnica dos produtos de limpeza"],
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
      ...["Temperatura dos equipamentos", "Temperatura dos alimentos na distribuição", "Temperatura do óleo", "Recebimento de mercadorias", "Manutenção preventiva e corretiva", "Validação de higienização dos hortifrútis", "Ficha técnica dos produtos de limpeza e lubrificantes"].map((n) => doc("Planilhas", n)),
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
    descricao: "Equipamentos verificados, ocorrências e datas de manutenção.",
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
    ],
  },
];

export const CONTROLE_BY_CODIGO = new Map(CONTROLE_TIPOS.map((t) => [t.codigo, t]));
export function getControleTipo(codigo: string): ControleTipo | null {
  return CONTROLE_BY_CODIGO.get(codigo) ?? null;
}

export const nomeLinhaFixa = (l: LinhaFixa): string => (typeof l === "string" ? l : l.nome);
export function nomesLinhasFixas(tipo: ControleTipo): string[] {
  return (tipo.linhasFixas ?? []).map(nomeLinhaFixa);
}

/** Estrutura inicial de um controle do tipo (linhas fixas prontas, com valores padrão). */
export function dadosIniciais(tipo: ControleTipo): ControleDados {
  return { cabecalho: {}, linhas: (tipo.linhasFixas ?? []).map((l) => (typeof l === "string" ? { nome: l } : { ...l.valores, nome: l.nome })) };
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

/** Campos que contam como "preenchimento" (valores padrão de linha fixa não contam). */
function camposDeValor(tipo: ControleTipo): Campo[] {
  return tipo.campos.filter((c) => c.key !== "conservacao" && c.key !== "grupo");
}

/** Conferência do preenchimento: linhas com algum valor, alertas de faixa e obrigatórios faltando. */
export function resumirControle(tipo: ControleTipo, dados: ControleDados): ControleResumo {
  const alertas: ControleResumo["alertas"] = [];
  const faltando: string[] = [];
  for (const c of tipo.cabecalho) if (c.obrigatorio && vazio(dados.cabecalho[c.key])) faltando.push(c.label);
  let preenchidas = 0;
  const valor = camposDeValor(tipo);
  for (const l of dados.linhas) {
    const temValor = valor.some((c) => !vazio(l[c.key]));
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

/** Linha tem algum valor digitado (ignora os padrões de linha fixa). */
export function linhaPreenchida(tipo: ControleTipo, l: Record<string, unknown>): boolean {
  return camposDeValor(tipo).some((c) => !vazio(l[c.key]));
}

export function formatCampo(c: Campo, v: unknown): string {
  if (vazio(v)) return "—";
  if (c.tipo === "bool") return v ? "Sim" : "Não";
  if (c.tipo === "number") return `${v}${c.sufixo ? ` ${c.sufixo}` : ""}`;
  if (c.tipo === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  return String(v);
}
