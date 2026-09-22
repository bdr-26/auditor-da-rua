// =====================================================================
// Fixtures do preview local — dados pt-BR consistentes com o esquema
// (supabase/migrations/0001_schema.sql) e com os seeds 0003/0004.
// Tudo é determinístico (ids por hash + PRNG com semente); "hoje" é
// calculado em America/Sao_Paulo no momento do carregamento.
// =====================================================================
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------
// utilitários
// ---------------------------------------------------------------------
export function uuid(key) {
  const h = createHash("md5").update(String(key)).digest("hex");
  const v = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIMEZONE = "America/Sao_Paulo";
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function todaySP(now = new Date()) {
  return ymdFmt.format(now);
}
function parseYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toYMD(d) {
  return d.toISOString().slice(0, 10);
}
export function addDays(ymd, n) {
  const d = parseYMD(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYMD(d);
}
export function weekday(ymd) {
  return parseYMD(ymd).getUTCDay();
}
export function monthStart(ymd) {
  return ymd.slice(0, 7) + "-01";
}
export function monthEnd(ymd) {
  const d = parseYMD(monthStart(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toYMD(d);
}
export function addMonths(ymd, n) {
  const d = parseYMD(monthStart(ymd));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toYMD(d);
}
function daysBetween(a, b) {
  return Math.round((parseYMD(b).getTime() - parseYMD(a).getTime()) / 86400000);
}
/** ISO UTC para "HH:MM" em São Paulo (UTC-3) na data informada. */
function atSP(ymd, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(...ymd.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)), h + 3, m)).toISOString();
}
const round2 = (n) => Math.round(n * 100) / 100;
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// ---------------------------------------------------------------------
// metadados usados pelo mock (FKs, defaults, colunas numeric)
// ---------------------------------------------------------------------
/** table → { coluna: tabela referenciada } (ordem = ordem de declaração no esquema). */
export const FK = {
  template_blocks: { template_id: "audit_templates" },
  template_items: { block_id: "template_blocks" },
  nutri_item_bank: { criado_por: "profiles" },
  nutri_item_versions: { bank_item_id: "nutri_item_bank" },
  unit_nutri_checklist: { unit_id: "units", bank_item_id: "nutri_item_bank" },
  schedule_days: { unit_id: "units", auditor_id: "profiles", audit_id: "audits", unit_original_id: "units", trocado_por: "profiles" },
  audits: { unit_id: "units", auditor_id: "profiles", template_id: "audit_templates" },
  audit_answers: {
    audit_id: "audits",
    item_id: "template_items",
    nutri_entry_id: "unit_nutri_checklist",
    nutri_item_id: "nutri_item_bank",
    nutri_item_version_id: "nutri_item_versions",
  },
  audit_photos: { answer_id: "audit_answers" },
  pending_issues: {
    unit_id: "units",
    item_id: "template_items",
    nutri_entry_id: "unit_nutri_checklist",
    nutri_item_id: "nutri_item_bank",
    origem_audit_id: "audits",
    resolvida_em_audit_id: "audits",
  },
  audit_pending_reviews: { audit_id: "audits", pending_issue_id: "pending_issues" },
  monthly_closings: { unit_id: "units", fechado_por: "profiles" },
  owner_adjustments: { closing_id: "monthly_closings", audit_id: "audits", answer_id: "audit_answers", user_id: "profiles" },
  external_indicators: { unit_id: "units", lancado_por: "profiles" },
  push_subscriptions: { user_id: "profiles" },
  notifications_log: { user_id: "profiles" },
  reports: { unit_id: "units", gerado_por: "profiles" },
  auditor_days_off: { auditor_id: "profiles", criado_por: "profiles" },
};

/** Colunas numeric(…) devolvidas como string pelo PostgREST: nome → casas decimais. */
export const NUMERIC_COLS = {
  nota_final: 2,
  nota_operacional: 2,
  nota_nutricional: 2,
  nota_seguranca: 2,
  nota_99food: 2,
  peso: 3,
  nutri_peso: 3,
};

/** Chave primária por tabela (todas uuid `id`, exceto app_settings). */
export const PRIMARY_KEY = { app_settings: "chave" };

/** Defaults aplicados em INSERT (além de id/created_at/updated_at). */
export const TABLE_DEFAULTS = {
  units: { tipo: "loja", ativa: true, entra_no_ranking: true, ordem_rotacao: 0, endereco: null, supervisor_nome: null, nutri_checklist_em_revisao: false },
  audit_templates: { versao: 1, ativo: true },
  template_blocks: { peso: 1 },
  template_items: { falha_grave: false, produto_vencido: false, pendencias: false, bloco_ref: null, ativo: true },
  nutri_item_bank: { versao: 1, peso: 1, ativo: true, criado_por: null },
  unit_nutri_checklist: { area_ordem: 0, ordem: 0, status: "ativo" },
  schedule_days: { status: "prevista", auditor_id: null, audit_id: null, unit_original_id: null, trocado_por: null, trocado_em: null, motivo_troca: null },
  audits: {
    template_id: null,
    status: "rascunho",
    nota_final: null,
    notas_blocos: null,
    falha_grave: false,
    produto_vencido: false,
    classificacao: null,
    etapa_atual: 0,
    concluida_em: null,
  },
  audit_answers: {
    item_id: null,
    nutri_entry_id: null,
    nutri_item_id: null,
    nutri_item_version_id: null,
    nutri_area: null,
    nutri_peso: null,
    nota: null,
    resposta: null,
    na: false,
    produto_vencido: false,
    observacao: null,
  },
  pending_issues: {
    item_id: null,
    nutri_entry_id: null,
    nutri_item_id: null,
    nota_origem: null,
    observacao_origem: null,
    status: "aberta",
    resolvida_em_audit_id: null,
    resolvida_em: null,
    visitas_sem_resolver: 0,
    reincidente: false,
    reincidente_notificado_em: null,
  },
  audit_pending_reviews: { resolvida: null, observacao: null },
  monthly_closings: { n_auditorias: 0, n_auditorias_nutri: 0, falhas_graves: 0, amostra_reduzida: false, inelegivel_produto_vencido: false, posicao_ranking: null, elegivel: false, premiada: false, empate: false, fechado_por: null },
  owner_adjustments: { closing_id: null, valor_original: null, valor_novo: null },
  external_indicators: { nota_99food: null, cancelamentos: null, tempo_medio_entrega: null, lancado_por: null },
  reports: { unit_id: null, gerado_por: null },
  auditor_days_off: { auditor_id: null, motivo: "Folga de domingo", criado_por: null },
  notifications_log: { user_id: null, chave_dedup: null, url: null },
  push_subscriptions: { user_agent: null },
  app_settings: { descricao: null },
};

/** Colunas de timestamp geradas automaticamente. */
export const TIMESTAMP_COLS = {
  units: ["created_at"],
  profiles: ["created_at"],
  audit_templates: ["created_at"],
  nutri_item_bank: ["created_at", "updated_at"],
  nutri_item_versions: ["created_at"],
  unit_nutri_checklist: ["created_at"],
  schedule_days: ["created_at"],
  audits: ["iniciada_em", "created_at", "updated_at"],
  audit_answers: ["updated_at"],
  audit_photos: ["created_at"],
  pending_issues: ["created_at"],
  audit_pending_reviews: ["updated_at"],
  monthly_closings: ["fechado_em"],
  owner_adjustments: ["created_at"],
  external_indicators: ["updated_at"],
  push_subscriptions: ["created_at"],
  notifications_log: ["enviado_em"],
  reports: ["gerado_em"],
  auditor_days_off: ["created_at"],
  app_settings: ["updated_at"],
};

// ---------------------------------------------------------------------
// usuários / perfis
// ---------------------------------------------------------------------
export const USERS = {
  antonio: { id: uuid("profile:antonio"), nome: "Antônio Costa", email: "antonio@bdr-auditor.app", role: "proprietario" },
  rodrigo: { id: uuid("profile:rodrigo"), nome: "Rodrigo Almeida", email: "rodrigo@bdr-auditor.app", role: "auditor_geral" },
  dani: { id: uuid("profile:dani"), nome: "Daniele Souza", email: "dani@bdr-auditor.app", role: "auditor_nutricao" },
  victor: { id: uuid("profile:victor"), nome: "Victor Ramos", email: "victor@bdr-auditor.app", role: "proprietario" },
};

// ---------------------------------------------------------------------
// unidades (seed 0003)
// ---------------------------------------------------------------------
const UNIT_DEFS = [
  { slug: "moema-salao", nome: "Moema Salão", tipo: "loja", ordem_rotacao: 1, endereco: "Al. dos Maracatins, 1217 – Moema", supervisor_nome: "Camila Ferreira", quality: 0.9 },
  { slug: "moema-delivery", nome: "Moema Delivery", tipo: "loja", ordem_rotacao: 2, endereco: "Av. Ibirapuera, 2332 – Moema", supervisor_nome: "Lucas Pereira", quality: 0.8 },
  { slug: "imigrantes", nome: "Imigrantes", tipo: "loja", ordem_rotacao: 3, endereco: "Av. Ricardo Jafet, 2340 – Vila Mariana", supervisor_nome: "Juliana Martins", quality: 0.72 },
  { slug: "bela-vista", nome: "Bela Vista", tipo: "loja", ordem_rotacao: 4, endereco: "R. Treze de Maio, 1045 – Bela Vista", supervisor_nome: "Rafael Nogueira", quality: 0.66 },
  { slug: "mooca", nome: "Mooca", tipo: "loja", ordem_rotacao: 5, endereco: "R. da Mooca, 2560 – Mooca", supervisor_nome: "Patrícia Lima", quality: 0.55 },
  { slug: "moema-producao", nome: "Moema Produção", tipo: "producao", ordem_rotacao: 0, endereco: "R. Gaivota, 810 – Moema (cozinha central)", supervisor_nome: "Marcos Tavares", quality: 0.8, entra_no_ranking: false },
];
export const UNIT_IDS = Object.fromEntries(UNIT_DEFS.map((u) => [u.slug, uuid(`unit:${u.slug}`)]));

// ---------------------------------------------------------------------
// templates das auditorias do gerente (seed 0003, mesmas chaves/descrições)
// ---------------------------------------------------------------------
// item: [chave, descricao, falha_grave, produto_vencido, pendencias, bloco_ref]
const TEMPLATE_DEFS = [
  {
    tipo: "completa",
    nome: "Auditoria Completa",
    blocks: [
      { chave: "pendencias", nome: "Pendências da visita anterior", peso: 0, ordem: 0, items: [["pendencias_anterior", "Pendências da visita anterior resolvidas", false, false, true, null]] },
      {
        chave: "seguranca",
        nome: "Segurança Alimentar",
        peso: 20,
        ordem: 1,
        items: [
          ["temperaturas", "Controle de temperatura dos alimentos (quente/frio)", true, false, false, null],
          ["validades_pvps", "Validade e rotação de insumos — PVPS, sem itens vencidos", true, true, false, null],
          ["armazenamento", "Armazenamento e identificação (etiquetas corretas, estoque organizado)", true, false, false, null],
          ["epis", "Uso correto de EPIs (luvas, touca, proteção)", true, false, false, null],
          ["higienizacao_equip", "Higienização de utensílios e equipamentos (chapa, utensílios)", true, false, false, null],
        ],
      },
      {
        chave: "operacao",
        nome: "Operação e Produto",
        peso: 20,
        ordem: 2,
        items: [
          ["montagem_peso", "Padronização de montagem e peso do hambúrguer (ficha técnica)", false, false, false, null],
          ["ponto_carne", "Ponto de cocção da carne", false, false, false, null],
          ["tempo_preparo", "Tempo de preparo e entrega do pedido", false, false, false, null],
          ["mise_en_place", "Organização da linha de produção (mise en place)", false, false, false, null],
          ["desperdicio", "Controle de desperdício de insumos", false, false, false, null],
        ],
      },
      {
        chave: "limpeza",
        nome: "Limpeza e Estrutura",
        peso: 20,
        ordem: 3,
        items: [
          ["limpeza_geral", "Limpeza geral (salão, cozinha, banheiros, área externa)", false, false, false, null],
          ["descarte_residuos", "Descarte correto de resíduos e óleo de fritura", false, false, false, null],
          ["equipamentos", "Equipamentos funcionando e manutenções em dia", false, false, false, null],
          ["apresentacao", "Apresentação geral da loja (organização e padrão visual)", false, false, false, null],
        ],
      },
      {
        chave: "atendimento",
        nome: "Atendimento e Delivery",
        peso: 20,
        ordem: 4,
        items: [
          ["atendimento_cliente", "Qualidade do atendimento ao cliente", false, false, false, null],
          ["embalagem_expedicao", "Embalagem e expedição dos pedidos", false, false, false, null],
          ["app_delivery", "Operação no app de delivery no dia (tempo de aceite, cancelamentos)", false, false, false, null],
        ],
      },
      {
        chave: "equipe",
        nome: "Equipe e Gestão",
        peso: 20,
        ordem: 5,
        items: [
          ["uniforme", "Uniforme limpo, conservado e completo", false, false, false, null],
          ["pontualidade", "Pontualidade e cumprimento da escala", false, false, false, null],
          ["planilhas", "Preenchimento correto das planilhas e registros de controle", false, false, false, null],
          ["ambiente", "Ambiente de trabalho (clima, respeito, colaboração)", false, false, false, null],
        ],
      },
    ],
  },
  {
    tipo: "simplificada",
    nome: "Auditoria Simplificada",
    blocks: [
      {
        chave: "geral",
        nome: "Checklist do dia",
        peso: 1,
        ordem: 1,
        items: [
          ["temperaturas", "Temperaturas quente/frio", true, false, false, "seguranca"],
          ["validades_pvps", "Validades e PVPS", true, true, false, "seguranca"],
          ["limpeza_geral", "Limpeza geral", false, false, false, "limpeza"],
          ["montagem_ponto", "Montagem e ponto da carne", false, false, false, "operacao"],
          ["tempo_preparo", "Tempo de preparo dos pedidos", false, false, false, "operacao"],
          ["uniforme", "Uniforme", false, false, false, "equipe"],
          ["pontualidade", "Escala cumprida no dia", false, false, false, "equipe"],
          ["mise_en_place", "Mise en place", false, false, false, "operacao"],
          ["equipamentos", "Equipamentos funcionando", false, false, false, "limpeza"],
          ["descarte_residuos", "Descarte de resíduos e óleo", false, false, false, "limpeza"],
          ["planilhas", "Planilhas do dia preenchidas", false, false, false, "equipe"],
          ["pendencias_anterior", "Pendências da visita anterior resolvidas", false, false, true, null],
        ],
      },
    ],
  },
  {
    tipo: "producao",
    nome: "Auditoria de Produção",
    blocks: [
      {
        chave: "producao",
        nome: "Cozinha central",
        peso: 1,
        ordem: 1,
        items: [
          ["recebimento", "Recebimento de insumos (conferência, temperatura, qualidade)", false, false, false, null],
          ["armazenamento", "Armazenamento (câmaras, estoque seco, identificação)", true, false, false, null],
          ["producao_ficha", "Produção conforme ficha técnica (padrão, rendimento)", false, false, false, null],
          ["validades_pvps", "Validades e PVPS", true, false, false, null],
          ["higienizacao_equip", "Higienização de equipamentos e utensílios", true, false, false, null],
          ["expedicao", "Expedição para as lojas (conferência, embalagem, horários)", false, false, false, null],
          ["limpeza_org", "Limpeza e organização geral", false, false, false, null],
          ["planilhas_producao", "Planilhas de produção preenchidas", false, false, false, null],
          ["pendencias_anterior", "Pendências da visita anterior", false, false, true, null],
        ],
      },
    ],
  },
  { tipo: "nutricional", nome: "Auditoria Nutricional", blocks: [] },
];
export const TEMPLATE_IDS = Object.fromEntries(TEMPLATE_DEFS.map((t) => [t.tipo, uuid(`template:${t.tipo}`)]));

// ---------------------------------------------------------------------
// checklists nutricionais (seed 0004): Anexo A (Moema Salão) e Anexo C (Imigrantes)
// ---------------------------------------------------------------------
const ETIQUETAS = "Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)";
const BPF = [
  "Funcionários não têm o hábito de lavar as mãos",
  "Funcionários não têm o hábito de higienizar o local antes de iniciar as atividades e na troca",
  "Existe foco de contaminação cruzada",
  "Funcionários não estão tendo higiene pessoal",
];
const HIGIENIZACAO = [
  "Ralos com resíduos de alimentos",
  "POPs de higienização de todas as áreas não estão sendo seguidos",
  "POPs de higienização de todas as áreas não estão sendo preenchidos",
  "Freezers de todas as áreas com acúmulo de gelo",
  "Lâmpadas aquecedoras sujas",
  "Saleiros sujos",
];
const FUNCIONARIOS = ["Funcionários não utilizam EPIs", "Funcionários com uniformes sujos", "Funcionários com adornos, perfumes, maquiagem, cílios postiços"];
const PLANILHAS_LOJA =
  "Planilhas não estão sendo preenchidas (banheiros de cliente, temperatura dos alimentos na distribuição, temperatura dos equipamentos, temperatura do óleo, limpeza da caixa de gordura, manutenção preventiva e corretiva e entrega dos EPIs)";
const LAVAGEM = [
  ETIQUETAS,
  "Equipamentos não estão limpos (micro-ondas, filtro de água, estantes, carrinho de limpeza, prateleiras, geladeira e freezer)",
  "Bebidas da geladeira estão fora do PVPS",
  "Produtos da estante fora do PVPS",
  "Amostras não foram coletadas, vencidas ou não descartadas",
];
const LIMPEZA_BANHEIRO = ["Panos dentro do balde com água", "Local desorganizado", "Produtos de limpeza vencidos", "Perfex e papel filme desprotegidos"];
const SALAO = ["Bancadas de saída de pedidos suja", "Equipamentos não estão limpos (máquina de refri, mesas, bancos, dispenser de ketchup, ar-condicionado)", "Sachês vencidos"];
const BANHEIRO_CLIENTE = ["Papel higiênico e sabonete não foram abastecidos, local sujo e desorganizado"];

const ANEXO_A = [
  [
    1,
    "Cozinha / Chapa",
    [
      ETIQUETAS,
      "Produtos não estão segregados por gêneros",
      "Produto dentro do freezer ao lado da chapa não estão fechados e sem etiquetas",
      "Bisnaga de água não identificada",
      "Bebidas da geladeira fora do PVPS",
      "GN na pista desprotegidas",
      "GN na pista com etiqueta",
      "Pista fria não foi identificada com o dia",
      "Saleiro e dispenser de cobertura de sorvetes sujos",
      "Bisnagas na geladeira sem proteção",
      "GNs abertas dentro da geladeira da chapa",
      "Amostras de água não foram coletadas",
      "Amostras vencidas ou não coletadas",
      "Higienização de prateleiras e local não foi realizada",
      "Equipamentos não estão limpos (geladeiras, tostadeiras, pistas, máquina de sorvete, fritadeiras, prateleiras)",
    ],
  ],
  [2, "Área de Lavagem de Louças e Estoque", LAVAGEM],
  [3, "Estoque de Produtos de Limpeza e Banheiro de Funcionário", LIMPEZA_BANHEIRO],
  [4, "Salão 1 e 2", SALAO],
  [5, "Banheiro de Cliente", BANHEIRO_CLIENTE],
  [6, "Sala de Descartáveis", ["Caixas não estão sob estrados, local sujo e desorganizado"]],
  [7, "Boas Práticas de Fabricação", BPF],
  [8, "Higienização", HIGIENIZACAO],
  [9, "Funcionários", FUNCIONARIOS],
  [10, "Planilhas", [PLANILHAS_LOJA]],
];

const ANEXO_C = [
  [
    1,
    "Cozinha / Chapa",
    [
      ETIQUETAS,
      "Produtos não estão segregados por gêneros",
      "Produto dentro do freezer ao lado da chapa não estão fechados e sem etiquetas",
      "Bisnaga de água não identificada",
      "Bebidas da geladeira fora do PVPS",
      "GN na pista desprotegidas",
      "GN na pista com etiqueta",
      "Pista fria não foi identificada com o dia",
      "Bisnagas na geladeira sem proteção",
      "GNs abertas dentro da geladeira da chapa",
      "Amostras de água não foram coletadas",
      "Amostras vencidas ou não coletadas",
      "Higienização de prateleiras e local não foi realizada",
      "Equipamentos não estão limpos (geladeiras, tostadeiras, pistas, fritadeiras, chapa, prateleiras)",
    ],
  ],
  [2, "Área de Lavagem de Louças e Estoque", LAVAGEM],
  [3, "Estoque de Produtos de Limpeza e Banheiro de Funcionário", LIMPEZA_BANHEIRO],
  [4, "Salão", SALAO],
  [5, "Banheiro de Cliente", BANHEIRO_CLIENTE],
  [6, "Área do Lixo", ["Local não está dentro das conformidades (organizado, limpo, separação de orgânicos e porta fechada)", "Foram encontrados lixos descartados em local errado"]],
  [7, "Boas Práticas de Fabricação", BPF],
  [8, "Higienização", HIGIENIZACAO],
  [9, "Funcionários", FUNCIONARIOS],
  [10, "Planilhas", [PLANILHAS_LOJA]],
];

// ---------------------------------------------------------------------
// domínio (ports de src/lib/domain — mantidos iguais em comportamento)
// ---------------------------------------------------------------------
const ROTATION_DAYS = [
  { weekday: 3, tipo: "simplificada" },
  { weekday: 4, tipo: "simplificada" },
  { weekday: 5, tipo: "completa" },
  { weekday: 6, tipo: "completa" },
  { weekday: 0, tipo: "completa" },
];
const mod = (n, m) => ((n % m) + m) % m;

function unitForDay(ymd, units, baseTuesday) {
  const wd = weekday(ymd);
  const pos = ROTATION_DAYS.findIndex((d) => d.weekday === wd);
  if (pos < 0) return null;
  const week = Math.floor(daysBetween(baseTuesday, ymd) / 7);
  const sorted = units.slice().sort((a, b) => a.ordem_rotacao - b.ordem_rotacao || a.nome.localeCompare(b.nome));
  return sorted[mod(pos - week, sorted.length)];
}
function auditTypeForWeekday(wd) {
  if (wd === 2) return "producao";
  const r = ROTATION_DAYS.find((d) => d.weekday === wd);
  return r ? r.tipo : null;
}
export function generateSchedule(from, to, units, productionUnitId, baseTuesday, skipDates = []) {
  const skip = new Set(skipDates);
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (skip.has(d)) continue;
    const tipo = auditTypeForWeekday(weekday(d));
    if (!tipo) continue;
    if (tipo === "producao") {
      if (productionUnitId) out.push({ data: d, unit_id: productionUnitId, tipo });
      continue;
    }
    const u = unitForDay(d, units, baseTuesday);
    if (u) out.push({ data: d, unit_id: u.id, tipo });
  }
  return out;
}

const GRAVE_FAILURE_CAP = 50;
const BLOCK_NAMES = {
  seguranca: "Segurança Alimentar",
  operacao: "Operação e Produto",
  limpeza: "Limpeza e Estrutura",
  atendimento: "Atendimento e Delivery",
  equipe: "Equipe e Gestão",
  pendencias: "Pendências",
  producao: "Cozinha central",
  geral: "Checklist do dia",
};
const MAIN_BLOCKS = ["seguranca", "operacao", "limpeza", "atendimento", "equipe"];
const scoreToPct = (nota) => ((nota - 1) / 4) * 100;

/** Port de computeAuditScore (src/lib/domain/scoring.ts). */
export function computeAuditScore(tipo, blocks, answers) {
  const byItem = new Map(answers.map((a) => [a.item_id, a]));
  const allItems = blocks.flatMap((b) => b.items);
  const faltando = [];
  const itens_falha_grave = [];
  let produto_vencido = false;
  for (const item of allItems) {
    const a = byItem.get(item.id);
    const answered = !!a && (a.na || (a.nota != null && a.nota >= 1 && a.nota <= 5));
    if (!answered) {
      faltando.push(item.id);
      continue;
    }
    if (a.na) continue;
    if (item.falha_grave && Number(a.nota) === 1) itens_falha_grave.push(item.id);
    if (item.produto_vencido && Number(a.nota) === 1 && a.produto_vencido) produto_vencido = true;
  }
  const falha_grave = itens_falha_grave.length > 0;
  const itemPct = (item) => {
    const a = byItem.get(item.id);
    if (!a || a.na || a.nota == null) return null;
    if (tipo !== "completa" && falha_grave && item.falha_grave) return 0;
    return scoreToPct(Number(a.nota));
  };
  let notas_blocos = [];
  let nota_sem_teto = null;
  if (tipo === "completa") {
    notas_blocos = blocks
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((b) => {
        const pcts = b.items.map(itemPct).filter((v) => v != null);
        const zerado = b.items.some((it) => itens_falha_grave.includes(it.id));
        const m = mean(pcts);
        return {
          chave: b.chave,
          nome: b.nome,
          peso: Number(b.peso),
          nota: m == null ? null : zerado ? 0 : round2(m),
          zerado,
          itens_respondidos: b.items.filter((it) => byItem.get(it.id) && !faltando.includes(it.id)).length,
          itens_aplicaveis: pcts.length,
        };
      });
    const weighted = notas_blocos.filter((b) => b.peso > 0 && b.nota != null);
    const totalPeso = weighted.reduce((s, b) => s + b.peso, 0);
    nota_sem_teto = totalPeso > 0 ? weighted.reduce((s, b) => s + b.nota * b.peso, 0) / totalPeso : null;
  } else {
    const pcts = allItems.map(itemPct).filter((v) => v != null);
    nota_sem_teto = mean(pcts);
    const groups = new Map();
    for (const b of blocks) {
      for (const it of b.items) {
        const key = it.pendencias ? "pendencias" : (it.bloco_ref ?? b.chave);
        const nome = it.pendencias ? "Pendências" : it.bloco_ref ? (BLOCK_NAMES[it.bloco_ref] ?? it.bloco_ref) : b.nome;
        const g = groups.get(key) ?? { nome, pcts: [], zerado: false, respondidos: 0 };
        const p = itemPct(it);
        if (p != null) g.pcts.push(p);
        if (itens_falha_grave.includes(it.id)) g.zerado = true;
        if (!faltando.includes(it.id)) g.respondidos++;
        groups.set(key, g);
      }
    }
    notas_blocos = Array.from(groups.entries()).map(([chave, g]) => {
      const m = mean(g.pcts);
      return { chave, nome: g.nome, peso: 0, nota: m == null ? null : round2(m), zerado: g.zerado, itens_respondidos: g.respondidos, itens_aplicaveis: g.pcts.length };
    });
  }
  let nota_final = nota_sem_teto == null ? null : round2(nota_sem_teto);
  if (nota_final != null && falha_grave) nota_final = Math.min(nota_final, GRAVE_FAILURE_CAP);
  return { nota_final, notas_blocos, falha_grave, produto_vencido };
}

const NUTRI_BANDS = [
  { nome: "Excelente", min: 91 },
  { nome: "Satisfatório", min: 80 },
  { nome: "Insatisfatório", min: 50 },
  { nome: "Crítico", min: 0 },
];
function classifyNutri(nota) {
  if (nota == null) return null;
  const r = Math.round(nota);
  for (const b of NUTRI_BANDS) if (r >= b.min) return b.nome;
  return "Crítico";
}
/** Port de computeNutriScore (src/lib/domain/nutri.ts) → nota, classificação e notas_blocos por área. */
function computeNutri(answers) {
  let conf = 0;
  let apl = 0;
  const areas = new Map();
  for (const a of answers) {
    if (!a.resposta) continue;
    const g = areas.get(a.area) ?? { perdidos: 0, aplicaveis: 0, respondidos: 0 };
    g.respondidos++;
    if (a.resposta !== "na") {
      apl += a.peso;
      g.aplicaveis += a.peso;
      if (a.resposta === "conforme") conf += a.peso;
      else g.perdidos += a.peso;
    }
    areas.set(a.area, g);
  }
  const nota = apl > 0 ? round2((conf / apl) * 100) : null;
  return {
    nota,
    classificacao: classifyNutri(nota),
    notas_blocos: Array.from(areas.entries()).map(([area, g]) => ({
      chave: area,
      nome: area,
      peso: 0,
      nota: g.aplicaveis > 0 ? round2(((g.aplicaveis - g.perdidos) / g.aplicaveis) * 100) : null,
      zerado: false,
      itens_respondidos: g.respondidos,
      itens_aplicaveis: g.aplicaveis,
    })),
  };
}

/** Port de computeMonthlyOperational + rankUnits (src/lib/domain/monthly.ts). */
function monthlyOperational(audits, weights = { completa: 2, simplificada: 1, producao: 1 }) {
  const valid = audits.filter((a) => a.nota_final != null && a.tipo !== "nutricional");
  let sum = 0;
  let wsum = 0;
  for (const a of valid) {
    const w = weights[a.tipo] ?? 1;
    sum += a.nota_final * w;
    wsum += w;
  }
  const blockAgg = new Map();
  for (const a of valid) {
    for (const b of a.notas_blocos ?? []) {
      if (b.nota == null) continue;
      const g = blockAgg.get(b.chave) ?? { nome: b.nome, vals: [], zerados: 0 };
      g.vals.push(b.nota);
      if (b.zerado) g.zerados++;
      blockAgg.set(b.chave, g);
    }
  }
  const notas_blocos = MAIN_BLOCKS.filter((k) => blockAgg.has(k))
    .concat(Array.from(blockAgg.keys()).filter((k) => !MAIN_BLOCKS.includes(k)))
    .map((chave) => {
      const g = blockAgg.get(chave);
      return { chave, nome: g.nome, peso: MAIN_BLOCKS.includes(chave) ? 20 : 0, nota: round2(g.vals.reduce((s, v) => s + v, 0) / g.vals.length), zerado: g.zerados > 0, itens_respondidos: g.vals.length, itens_aplicaveis: g.vals.length };
    });
  const seg = notas_blocos.find((b) => b.chave === "seguranca");
  return {
    nota: wsum > 0 ? round2(sum / wsum) : null,
    n_auditorias: valid.length,
    amostra_reduzida: valid.length > 0 && valid.length < 3,
    falhas_graves: valid.filter((a) => a.falha_grave).length,
    produto_vencido: valid.some((a) => a.produto_vencido),
    nota_seguranca: seg?.nota ?? null,
    notas_blocos,
  };
}
function rankUnits(rows, eligibilityMin = 70) {
  const ranked = rows.filter((r) => r.entra_no_ranking && r.nota != null);
  const cmp = (a, b) => {
    if (b.nota !== a.nota) return b.nota - a.nota;
    const sa = a.nota_seguranca ?? -1;
    const sb = b.nota_seguranca ?? -1;
    if (sb !== sa) return sb - sa;
    return a.falhas_graves - b.falhas_graves;
  };
  const tied = (a, b) => cmp(a, b) === 0;
  ranked.sort(cmp);
  const out = new Map();
  let pos = 0;
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    if (i === 0 || !tied(ranked[i - 1], r)) pos = i + 1;
    const empate = (i > 0 && tied(ranked[i - 1], r)) || (i < ranked.length - 1 && tied(ranked[i + 1], r));
    const elegivel = r.nota >= eligibilityMin && !r.produto_vencido;
    out.set(r.unit_id, { posicao: pos, elegivel, premiada: pos === 1 && elegivel, empate });
  }
  return out;
}

// ---------------------------------------------------------------------
// textos de apoio (observações realistas por critério)
// ---------------------------------------------------------------------
const OBS_BY_CHAVE = {
  temperaturas: "Pista fria marcando 9 °C; hambúrgueres fora da faixa segura durante o pico do almoço.",
  validades_pvps: "Molho especial vencido há 3 dias na geladeira da linha; PVPS do pão não respeitado.",
  armazenamento: "Caixas de carne no chão da câmara e etiquetas de descongelamento sem data.",
  epis: "Dois funcionários da chapa sem touca durante o serviço.",
  higienizacao_equip: "Chapa com crosta de gordura acumulada; espátulas sem higienização entre lotes.",
  montagem_peso: "Blends pesando 140 g em vez de 160 g; montagem fora da ficha técnica.",
  montagem_ponto: "Carne servida ao ponto para pedido bem passado; montagem sem o padrão de alface.",
  ponto_carne: "Três hambúrgueres saíram crus no centro durante a auditoria.",
  tempo_preparo: "Tempo médio de preparo de 22 min no horário de pico (meta: 12 min).",
  mise_en_place: "Linha desorganizada: molhos sem identificação e insumos misturados na pista.",
  desperdicio: "Batata descartada em excesso (duas cestas cheias) por fritura antecipada.",
  limpeza_geral: "Ralos da cozinha com resíduos; área externa com lixo acumulado e banheiro sem papel.",
  descarte_residuos: "Óleo de fritura descartado em bombona sem tampa ao lado do lixo comum.",
  equipamentos: "Fritadeira 2 sem funcionar há uma semana; termostato da chapa quebrado.",
  apresentacao: "Cardápio rasgado no balcão, letreiro externo apagado e mesas com adesivos soltos.",
  atendimento_cliente: "Cliente aguardou 8 min no balcão sem ser atendido; equipe sem cumprimento padrão.",
  embalagem_expedicao: "Pedidos saindo sem lacre e com batata fora da embalagem térmica.",
  app_delivery: "Quatro cancelamentos no dia por tempo de aceite acima de 5 min.",
  uniforme: "Camisetas manchadas e um funcionário sem o avental padrão.",
  pontualidade: "Dois colaboradores chegaram 40 min atrasados; escala do turno da noite incompleta.",
  planilhas: "Planilha de temperatura sem registros do turno da tarde.",
  ambiente: "Discussão entre gerente e chapeiro na frente dos clientes.",
  recebimento: "Carne recebida a 8 °C sem conferência de temperatura registrada.",
  producao_ficha: "Rendimento do molho 15% abaixo da ficha; blend com gramatura irregular.",
  expedicao: "Expedição para a Mooca saiu 50 min atrasada e sem conferência de itens.",
  limpeza_org: "Piso da área de porcionamento com gordura; prateleiras sem identificação.",
  planilhas_producao: "Planilha de produção do dia anterior em branco.",
};

// ---------------------------------------------------------------------
// montagem das fixtures
// ---------------------------------------------------------------------
export function buildFixtures(today = todaySP()) {
  const rng = mulberry32(20260922);
  const t = {
    profiles: [],
    units: [],
    app_settings: [],
    audit_templates: [],
    template_blocks: [],
    template_items: [],
    nutri_item_bank: [],
    nutri_item_versions: [],
    unit_nutri_checklist: [],
    schedule_days: [],
    audits: [],
    audit_answers: [],
    audit_photos: [],
    pending_issues: [],
    audit_pending_reviews: [],
    monthly_closings: [],
    owner_adjustments: [],
    external_indicators: [],
    reports: [],
    auditor_days_off: [],
    push_subscriptions: [],
    notifications_log: [],
  };
  const ids = {
    today,
    units: UNIT_IDS,
    templates: TEMPLATE_IDS,
    users: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, u.id])),
  };

  // ----- perfis -----
  const baseCreated = "2026-07-01T12:00:00.000Z";
  let i = 0;
  for (const u of Object.values(USERS)) {
    t.profiles.push({ id: u.id, nome: u.nome, email: u.email, role: u.role, ativo: true, created_at: addIsoMinutes(baseCreated, i++) });
  }

  // ----- unidades -----
  for (const u of UNIT_DEFS) {
    t.units.push({
      id: UNIT_IDS[u.slug],
      nome: u.nome,
      slug: u.slug,
      tipo: u.tipo,
      ativa: true,
      entra_no_ranking: u.entra_no_ranking ?? true,
      ordem_rotacao: u.ordem_rotacao,
      endereco: u.endereco,
      supervisor_nome: u.supervisor_nome,
      nutri_checklist_em_revisao: u.slug === "imigrantes",
      created_at: baseCreated,
    });
  }
  const unitBySlug = Object.fromEntries(t.units.map((u) => [u.slug, u]));
  const quality = Object.fromEntries(UNIT_DEFS.map((u) => [UNIT_IDS[u.slug], u.quality]));

  // ----- configurações (mesmas chaves do seed) -----
  const ROTACAO_BASE = "2026-09-22";
  const settings = [
    ["rotacao_semana_base", ROTACAO_BASE, "Terça-feira da semana 1 da rotação (qua = Moema Salão)"],
    ["premio_valor", 200, "Prêmio em R$ ao supervisor da loja 1ª colocada"],
    ["elegibilidade_min", 70, "Nota mensal mínima (%) para premiação"],
    ["amostra_reduzida_min", 3, 'Nº mínimo de auditorias no mês para não receber o selo "amostra reduzida"'],
    ["peso_completa", 2, "Peso da auditoria completa na nota mensal"],
    ["peso_simplificada", 1, "Peso da auditoria simplificada na nota mensal"],
    ["nutri_compoe_ranking", false, "Nota nutricional compõe a nota do ranking?"],
    ["nutri_peso", 0, "Peso da nota nutricional na nota do ranking (quando ativo)"],
    ["food99_compoe_ranking", false, "Indicadores 99Food compõem a nota do ranking?"],
    ["food99_peso", 0, "Peso dos indicadores 99Food (quando ativo)"],
    ["pendencia_reincidente_visitas", 2, "Nº de visitas consecutivas sem resolver para disparar alerta de reincidência"],
  ];
  for (const [chave, valor, descricao] of settings) t.app_settings.push({ chave, valor, descricao, updated_at: baseCreated });

  // ----- templates -----
  const templateBlocks = {}; // tipo → ScoringBlock[]
  for (const td of TEMPLATE_DEFS) {
    t.audit_templates.push({ id: TEMPLATE_IDS[td.tipo], tipo: td.tipo, versao: 1, nome: td.nome, ativo: true, created_at: baseCreated });
    templateBlocks[td.tipo] = [];
    for (const b of td.blocks) {
      const blockId = uuid(`block:${td.tipo}:${b.chave}`);
      t.template_blocks.push({ id: blockId, template_id: TEMPLATE_IDS[td.tipo], chave: b.chave, nome: b.nome, peso: b.peso, ordem: b.ordem });
      const items = b.items.map(([chave, descricao, falha_grave, produto_vencido, pendencias, bloco_ref], idx) => {
        const item = { id: uuid(`item:${td.tipo}:${chave}`), block_id: blockId, chave, descricao, falha_grave, produto_vencido, pendencias, bloco_ref, ordem: idx + 1, ativo: true };
        t.template_items.push(item);
        return item;
      });
      templateBlocks[td.tipo].push({ chave: b.chave, nome: b.nome, peso: b.peso, ordem: b.ordem, items });
    }
  }
  const itemByKey = (tipo, chave) => t.template_items.find((it) => it.id === uuid(`item:${tipo}:${chave}`)) ?? null;

  // ----- banco nutricional + composição -----
  const bankByDesc = new Map();
  function bankItem(descricao, area) {
    let b = bankByDesc.get(descricao);
    if (!b) {
      const id = uuid(`nutri:${descricao}`);
      b = { id, descricao, versao: 1, area_padrao: area, peso: 1, ativo: true, criado_por: null, created_at: baseCreated, updated_at: baseCreated };
      t.nutri_item_bank.push(b);
      t.nutri_item_versions.push({ id: uuid(`nutriv:${descricao}:1`), bank_item_id: id, versao: 1, descricao, created_at: baseCreated });
      bankByDesc.set(descricao, b);
    }
    return b;
  }
  const compositions = {}; // unitId → entries
  function compose(slug, anexo) {
    const unitId = UNIT_IDS[slug];
    const entries = [];
    for (const [area_ordem, area, descs] of anexo) {
      descs.forEach((descricao, idx) => {
        const b = bankItem(descricao, area);
        const e = { id: uuid(`entry:${slug}:${area}:${descricao}`), unit_id: unitId, bank_item_id: b.id, area, area_ordem, ordem: idx + 1, status: "ativo", created_at: baseCreated };
        t.unit_nutri_checklist.push(e);
        entries.push({ ...e, descricao });
      });
    }
    compositions[unitId] = entries;
  }
  compose("moema-salao", ANEXO_A);
  compose("imigrantes", ANEXO_C);
  const versionOf = (bankId) => t.nutri_item_versions.find((v) => v.bank_item_id === bankId && v.versao === 1).id;

  // ----- agenda: mês anterior + atual + próximo -----
  const curStart = monthStart(today);
  const prevStart = addMonths(curStart, -1);
  const nextStart = addMonths(curStart, 1);
  const nextEnd = monthEnd(nextStart);
  const sundaysNext = [];
  for (let d = nextStart; d <= nextEnd; d = addDays(d, 1)) if (weekday(d) === 0) sundaysNext.push(d);
  const sundayOff = sundaysNext[1] ?? sundaysNext[0];
  t.auditor_days_off.push({ id: uuid("dayoff:1"), data: sundayOff, auditor_id: null, motivo: "Folga de domingo", criado_por: USERS.antonio.id, created_at: atSP(today, "09:00") });

  const rotation = t.units.filter((u) => u.tipo === "loja" && u.entra_no_ranking);
  const planned = generateSchedule(prevStart, nextEnd, rotation, UNIT_IDS["moema-producao"], ROTACAO_BASE, [sundayOff]);

  // dia não cumprido: a simplificada passada mais recente do mês atual (ou o último dia passado do mês)
  const pastCurrent = planned.filter((p) => p.data < today && p.data >= curStart);
  const naoCumprida = pastCurrent.filter((p) => p.tipo === "simplificada").at(-1) ?? pastCurrent.at(-1) ?? null;

  const audits = []; // auditorias do gerente (objetos completos)
  function newAudit({ unit_id, tipo, data, status, auditor, etapa }) {
    const a = {
      id: uuid(`audit:${unit_id}:${tipo}:${data}`),
      unit_id,
      auditor_id: auditor,
      template_id: TEMPLATE_IDS[tipo],
      tipo,
      data,
      status,
      nota_final: null,
      notas_blocos: null,
      falha_grave: false,
      produto_vencido: false,
      classificacao: null,
      etapa_atual: etapa ?? 0,
      iniciada_em: atSP(data, "11:30"),
      concluida_em: status === "concluida" ? atSP(data, "13:05") : null,
      created_at: atSP(data, "11:30"),
      updated_at: status === "concluida" ? atSP(data, "13:05") : atSP(data, "11:30"),
    };
    t.audits.push(a);
    return a;
  }

  let todayRow = null;
  for (const p of planned) {
    const row = { id: uuid(`sched:${p.data}`), data: p.data, unit_id: p.unit_id, tipo: p.tipo, status: "prevista", auditor_id: USERS.rodrigo.id, audit_id: null, unit_original_id: null, trocado_por: null, trocado_em: null, motivo_troca: null, created_at: atSP(prevStart, "08:00") };
    if (p.data < today) {
      if (naoCumprida && p.data === naoCumprida.data) {
        row.status = "nao_cumprida";
      } else {
        const a = newAudit({ unit_id: p.unit_id, tipo: p.tipo, data: p.data, status: "concluida", auditor: USERS.rodrigo.id, etapa: 0 });
        audits.push(a);
        row.status = "concluida";
        row.audit_id = a.id;
      }
    } else if (p.data === today) {
      todayRow = row;
    }
    t.schedule_days.push(row);
  }

  // troca manual registrada num dia futuro (para o calendário do proprietário)
  const futureSwap = t.schedule_days.find((r) => r.data > today && r.tipo === "completa" && r.status === "prevista");
  if (futureSwap) {
    const original = futureSwap.unit_id;
    const other = rotation.find((u) => u.id !== original);
    futureSwap.unit_original_id = original;
    futureSwap.unit_id = other.id;
    futureSwap.trocado_por = USERS.antonio.id;
    futureSwap.trocado_em = atSP(today, "08:40");
    futureSwap.motivo_troca = "Loja fechada para manutenção do exaustor";
  }

  // ----- rascunho do gerente (hoje) -----
  const draftUnitId = todayRow ? todayRow.unit_id : UNIT_IDS["moema-salao"];
  const draftTipo = todayRow ? todayRow.tipo : "completa";
  const draftGerente = newAudit({ unit_id: draftUnitId, tipo: draftTipo, data: today, status: "rascunho", auditor: USERS.rodrigo.id, etapa: 1 });
  draftGerente.iniciada_em = draftGerente.created_at = draftGerente.updated_at = atSP(today, "10:15");
  if (todayRow) todayRow.audit_id = draftGerente.id;
  ids.draftGerente = draftGerente.id;
  ids.draftGerenteTipo = draftTipo;
  ids.draftGerenteUnit = draftUnitId;

  // ----- auditorias especiais (falha grave, produto vencido, origens de pendências, ajuste do proprietário) -----
  const byDateAsc = audits.slice().sort((a, b) => a.data.localeCompare(b.data));
  const latest = (pred) => byDateAsc.filter(pred).at(-1) ?? null;
  const oldest = (pred) => byDateAsc.find(pred) ?? null;
  const overrides = new Map(); // `${auditId}:${chave}` → { nota, observacao, produto_vencido, photos }
  const setOverride = (audit, chave, o) => audit && overrides.set(`${audit.id}:${chave}`, o);

  const fgAudit = latest((a) => a.unit_id === UNIT_IDS["mooca"] && a.tipo === "completa" && a.data >= curStart) ?? latest((a) => a.tipo === "completa" && a.unit_id === UNIT_IDS["mooca"]) ?? latest((a) => a.tipo === "completa");
  setOverride(fgAudit, "temperaturas", { nota: 1, observacao: OBS_BY_CHAVE.temperaturas, photos: 2 });
  const pvAudit = latest((a) => a.unit_id === UNIT_IDS["bela-vista"] && a.tipo === "completa" && a !== fgAudit) ?? latest((a) => a.tipo === "completa" && a !== fgAudit);
  setOverride(pvAudit, "validades_pvps", { nota: 1, observacao: OBS_BY_CHAVE.validades_pvps, produto_vencido: true, photos: 1 });

  const moocaAll = byDateAsc.filter((a) => a.unit_id === UNIT_IDS["mooca"]);
  const p1Origin = moocaAll[0] ?? null; // limpeza_geral reincidente
  setOverride(p1Origin, "limpeza_geral", { nota: 2, observacao: OBS_BY_CHAVE.limpeza_geral, photos: 1 });
  const imigAll = byDateAsc.filter((a) => a.unit_id === UNIT_IDS["imigrantes"]);
  const r1Origin = imigAll[0] ?? null; // equipamentos (resolvida na visita seguinte)
  const r1Resolved = imigAll[1] ?? null;
  setOverride(r1Origin, "equipamentos", { nota: 2, observacao: OBS_BY_CHAVE.equipamentos, photos: 1 });
  const p4Origin = latest((a) => a.unit_id === draftUnitId); // pendência aberta para a unidade do rascunho de hoje
  const p4Chave = draftTipo === "producao" ? "planilhas_producao" : "planilhas";
  setOverride(p4Origin, p4Chave, { nota: 2, observacao: OBS_BY_CHAVE[p4Chave], photos: 1 });
  const adjAudit = latest((a) => a.tipo === "completa" && a.data < curStart && a.unit_id === UNIT_IDS["moema-delivery"]) ?? latest((a) => a.tipo === "completa" && a.data < curStart);
  setOverride(adjAudit, "pontualidade", { nota: 4, observacao: OBS_BY_CHAVE.pontualidade, photos: 1 });

  // ----- respostas das auditorias do gerente -----
  function pickScore(q) {
    const r = rng();
    if (r < 0.09 * (1 - q)) return 2;
    if (r < 0.5 * q + 0.04) return 5;
    if (r < 0.86) return 4;
    return 3;
  }
  function addPhotos(answer, n, data) {
    for (let k = 0; k < n; k++) {
      const pid = uuid(`photo:${answer.id}:${k}`);
      t.audit_photos.push({ id: pid, answer_id: answer.id, storage_path: `${answer.audit_id}/${answer.id}/${pid}.jpg`, created_at: atSP(data, `12:${String(10 + k).padStart(2, "0")}`) });
    }
  }
  function genAnswers(audit, hasPendings) {
    const blocks = templateBlocks[audit.tipo];
    const q = quality[audit.unit_id] ?? 0.7;
    const out = [];
    for (const b of blocks) {
      for (const item of b.items) {
        const ans = {
          id: uuid(`answer:${audit.id}:${item.id}`),
          audit_id: audit.id,
          item_id: item.id,
          nutri_entry_id: null,
          nutri_item_id: null,
          nutri_item_version_id: null,
          nutri_area: null,
          nutri_peso: null,
          nota: null,
          resposta: null,
          na: false,
          produto_vencido: false,
          observacao: null,
          updated_at: atSP(audit.data, "12:40"),
        };
        const o = overrides.get(`${audit.id}:${item.chave}`);
        if (item.pendencias) {
          if (hasPendings) ans.nota = rng() < 0.5 ? 3 : 4;
          else ans.na = true;
        } else if (o) {
          ans.nota = o.nota;
          ans.observacao = o.observacao ?? null;
          ans.produto_vencido = !!o.produto_vencido;
          t.audit_answers.push(ans);
          addPhotos(ans, o.photos ?? 1, audit.data);
          out.push(ans);
          continue;
        } else {
          ans.nota = pickScore(q);
          if (ans.nota <= 2) {
            ans.observacao = OBS_BY_CHAVE[item.chave] ?? "Fora do padrão; registrado com foto para correção.";
            t.audit_answers.push(ans);
            addPhotos(ans, 1, audit.data);
            out.push(ans);
            continue;
          }
          if (ans.nota === 3 && rng() < 0.3) ans.observacao = "Aceitável, mas precisa de atenção na próxima visita.";
        }
        t.audit_answers.push(ans);
        out.push(ans);
      }
    }
    return out;
  }

  // pendências abertas por unidade no momento de cada auditoria (só para preencher o item "pendências")
  const pendingsAtUnit = new Map();
  const markPending = (unitId, from, to) => pendingsAtUnit.set(unitId, [...(pendingsAtUnit.get(unitId) ?? []), { from, to }]);
  if (p1Origin) markPending(UNIT_IDS["mooca"], p1Origin.data, "9999-12-31");
  if (r1Origin && r1Resolved) markPending(UNIT_IDS["imigrantes"], r1Origin.data, r1Resolved.data);
  const hasPendingsAt = (unitId, data) => (pendingsAtUnit.get(unitId) ?? []).some((p) => data > p.from && data <= p.to);

  for (const a of audits) {
    const answers = genAnswers(a, hasPendingsAt(a.unit_id, a.data));
    const score = computeAuditScore(
      a.tipo,
      templateBlocks[a.tipo],
      answers.map((x) => ({ item_id: x.item_id, nota: x.nota, na: x.na, produto_vencido: x.produto_vencido })),
    );
    a.nota_final = score.nota_final;
    a.notas_blocos = score.notas_blocos;
    a.falha_grave = score.falha_grave;
    a.produto_vencido = score.produto_vencido;
  }

  // rascunho do gerente: algumas respostas do primeiro bloco pontuado
  {
    const blocks = templateBlocks[draftTipo];
    const scored = blocks.filter((b) => (draftTipo === "completa" ? b.peso > 0 : true))[0];
    const notas = [5, 4, 4];
    scored.items
      .filter((it) => !it.pendencias)
      .slice(0, 3)
      .forEach((item, idx) => {
        t.audit_answers.push({
          id: uuid(`answer:${draftGerente.id}:${item.id}`),
          audit_id: draftGerente.id,
          item_id: item.id,
          nutri_entry_id: null,
          nutri_item_id: null,
          nutri_item_version_id: null,
          nutri_area: null,
          nutri_peso: null,
          nota: notas[idx],
          resposta: null,
          na: false,
          produto_vencido: false,
          observacao: idx === 2 ? "Etiquetas ok; conferir novamente a câmara 2 na próxima visita." : null,
          updated_at: atSP(today, "10:40"),
        });
      });
  }

  // ----- auditorias nutricionais (Dani) -----
  const nutriAudits = [];
  function newNutriAudit(slug, data, status, ncDescs, naDescs = [], opts = {}) {
    const unit_id = UNIT_IDS[slug];
    const a = {
      id: uuid(`audit:${unit_id}:nutricional:${data}`),
      unit_id,
      auditor_id: USERS.dani.id,
      template_id: TEMPLATE_IDS.nutricional,
      tipo: "nutricional",
      data,
      status,
      nota_final: null,
      notas_blocos: null,
      falha_grave: false,
      produto_vencido: false,
      classificacao: null,
      etapa_atual: opts.etapa ?? 0,
      iniciada_em: atSP(data, "09:10"),
      concluida_em: status === "concluida" ? atSP(data, "11:25") : null,
      created_at: atSP(data, "09:10"),
      updated_at: status === "concluida" ? atSP(data, "11:25") : atSP(data, "09:10"),
    };
    t.audits.push(a);
    const entries = compositions[unit_id];
    const answers = [];
    entries.forEach((e, idx) => {
      const nc = ncDescs.has(e.descricao);
      const na = naDescs.has(e.descricao);
      let resposta = nc ? "nao_conforme" : na ? "na" : "conforme";
      if (status === "rascunho") resposta = opts.answered && opts.answered(e, idx) ? resposta : null;
      const ans = {
        id: uuid(`answer:${a.id}:${e.id}`),
        audit_id: a.id,
        item_id: null,
        nutri_entry_id: e.id,
        nutri_item_id: e.bank_item_id,
        nutri_item_version_id: versionOf(e.bank_item_id),
        nutri_area: e.area,
        nutri_peso: 1,
        nota: null,
        resposta,
        na: false,
        produto_vencido: false,
        observacao: resposta === "nao_conforme" ? (opts.obs?.[e.descricao] ?? NUTRI_OBS[e.descricao] ?? "Encontrado durante a visita; orientada a correção imediata.") : null,
        updated_at: atSP(data, "10:30"),
      };
      t.audit_answers.push(ans);
      answers.push({ ...ans, area: e.area, peso: 1, descricao: e.descricao, entry: e });
      if (resposta === "nao_conforme" && (opts.photos ?? true)) addPhotos(ans, 1, data);
    });
    if (status === "concluida") {
      const s = computeNutri(answers);
      a.nota_final = s.nota;
      a.classificacao = s.classificacao;
      a.notas_blocos = s.notas_blocos;
    }
    a.answers = answers; // interno (removido antes de exportar)
    nutriAudits.push(a);
    return a;
  }

  const nutriDate = (off) => addDays(today, -off);
  const ms1 = newNutriAudit(
    "moema-salao",
    nutriDate(35),
    "concluida",
    new Set(["Bisnaga de água não identificada", "Saleiro e dispenser de cobertura de sorvetes sujos", "Freezers de todas as áreas com acúmulo de gelo", "Panos dentro do balde com água", "Sachês vencidos"]),
    new Set(["Amostras de água não foram coletadas"]),
  );
  const ms2 = newNutriAudit("moema-salao", nutriDate(12), "concluida", new Set(["Saleiro e dispenser de cobertura de sorvetes sujos"]), new Set(["Amostras de água não foram coletadas"]));
  const im1 = newNutriAudit(
    "imigrantes",
    nutriDate(27),
    "concluida",
    new Set([ETIQUETAS, "GN na pista desprotegidas", "Ralos com resíduos de alimentos", "Freezers de todas as áreas com acúmulo de gelo", "Funcionários com uniformes sujos", "Local desorganizado"]),
    new Set(),
    { photos: false },
  );
  const im2 = newNutriAudit(
    "imigrantes",
    nutriDate(6),
    "concluida",
    new Set([
      ETIQUETAS,
      "Produtos não estão segregados por gêneros",
      "Bebidas da geladeira fora do PVPS",
      "Ralos com resíduos de alimentos",
      "POPs de higienização de todas as áreas não estão sendo preenchidos",
      "Freezers de todas as áreas com acúmulo de gelo",
      "Lâmpadas aquecedoras sujas",
      "Funcionários com adornos, perfumes, maquiagem, cílios postiços",
      PLANILHAS_LOJA,
    ]),
    new Set(["Amostras de água não foram coletadas"]),
  );
  // rascunho nutricional de hoje (Moema Salão): 1ª área parcialmente respondida
  const draftNutri = newNutriAudit(
    "moema-salao",
    today,
    "rascunho",
    new Set([ETIQUETAS, "Bisnagas na geladeira sem proteção"]),
    new Set(["Amostras de água não foram coletadas"]),
    {
      etapa: 1,
      answered: (e) => e.area_ordem === 1 || (e.area_ordem === 2 && e.ordem <= 2),
      obs: { [ETIQUETAS]: "Etiqueta do queijo cheddar com data de validade rasurada.", "Bisnagas na geladeira sem proteção": "Duas bisnagas de maionese sem tampa na geladeira da chapa." },
      photos: false,
    },
  );
  draftNutri.iniciada_em = draftNutri.created_at = draftNutri.updated_at = atSP(today, "09:10");
  ids.draftNutri = draftNutri.id;
  ids.concludedNutri = im2.id;
  ids.concludedNutriMoema = ms2.id;
  ids.concludedGerente = (fgAudit ?? byDateAsc.at(-1)).id;
  ids.concludedGerenteClean = latest((a) => a.tipo === "completa" && !a.falha_grave && !a.produto_vencido && a.unit_id === UNIT_IDS["moema-salao"])?.id ?? ids.concludedGerente;

  // ----- pendências -----
  const now = new Date().toISOString();
  const answerOf = (audit, chave) => t.audit_answers.find((x) => x.audit_id === audit.id && x.item_id === uuid(`item:${audit.tipo}:${chave}`));
  const nutriAnswerOf = (audit, desc) => audit.answers.find((x) => x.descricao === desc);
  function pending(key, row) {
    const r = { id: uuid(`pending:${key}`), unit_id: null, item_id: null, nutri_entry_id: null, nutri_item_id: null, descricao: "", nota_origem: null, observacao_origem: null, origem_audit_id: null, status: "aberta", resolvida_em_audit_id: null, resolvida_em: null, visitas_sem_resolver: 0, reincidente: false, reincidente_notificado_em: null, created_at: now, ...row };
    t.pending_issues.push(r);
    return r;
  }
  function review(audit, issue, resolvida, observacao = null) {
    if (!audit || !issue) return;
    t.audit_pending_reviews.push({ id: uuid(`review:${audit.id}:${issue.id}`), audit_id: audit.id, pending_issue_id: issue.id, resolvida, observacao, updated_at: audit.concluida_em ?? atSP(audit.data, "10:20") });
  }
  const pendById = {};
  if (p1Origin) {
    const item = itemByKey(p1Origin.tipo, "limpeza_geral");
    const later = moocaAll.filter((a) => a.data > p1Origin.data).slice(0, 2);
    pendById.p1 = pending("mooca-limpeza", {
      unit_id: UNIT_IDS["mooca"],
      item_id: item.id,
      descricao: item.descricao,
      nota_origem: 2,
      observacao_origem: OBS_BY_CHAVE.limpeza_geral,
      origem_audit_id: p1Origin.id,
      visitas_sem_resolver: later.length,
      reincidente: later.length >= 2,
      reincidente_notificado_em: later[1]?.concluida_em ?? null,
      created_at: p1Origin.concluida_em,
    });
    for (const a of later) review(a, pendById.p1, false, "Ralos continuam sujos; área externa parcialmente limpa.");
  }
  if (fgAudit) {
    const item = itemByKey(fgAudit.tipo, "temperaturas");
    pendById.p2 = pending("mooca-temperaturas", { unit_id: fgAudit.unit_id, item_id: item.id, descricao: item.descricao, nota_origem: 1, observacao_origem: OBS_BY_CHAVE.temperaturas, origem_audit_id: fgAudit.id, created_at: fgAudit.concluida_em });
  }
  if (pvAudit) {
    const item = itemByKey(pvAudit.tipo, "validades_pvps");
    pendById.p3 = pending("belavista-validades", { unit_id: pvAudit.unit_id, item_id: item.id, descricao: item.descricao, nota_origem: 1, observacao_origem: OBS_BY_CHAVE.validades_pvps, origem_audit_id: pvAudit.id, created_at: pvAudit.concluida_em });
  }
  if (p4Origin) {
    const item = itemByKey(p4Origin.tipo, p4Chave);
    pendById.p4 = pending("hoje-planilhas", { unit_id: p4Origin.unit_id, item_id: item.id, descricao: item.descricao, nota_origem: 2, observacao_origem: OBS_BY_CHAVE[p4Chave], origem_audit_id: p4Origin.id, created_at: p4Origin.concluida_em });
  }
  {
    const ans = nutriAnswerOf(ms1, "Saleiro e dispenser de cobertura de sorvetes sujos");
    pendById.p5 = pending("moema-saleiro", {
      unit_id: UNIT_IDS["moema-salao"],
      nutri_entry_id: ans.nutri_entry_id,
      nutri_item_id: ans.nutri_item_id,
      descricao: ans.descricao,
      observacao_origem: ans.observacao,
      origem_audit_id: ms1.id,
      visitas_sem_resolver: 1,
      created_at: ms1.concluida_em,
    });
    review(ms2, pendById.p5, false);
    const bisnaga = nutriAnswerOf(ms1, "Bisnaga de água não identificada");
    pendById.r2 = pending("moema-bisnaga", {
      unit_id: UNIT_IDS["moema-salao"],
      nutri_entry_id: bisnaga.nutri_entry_id,
      nutri_item_id: bisnaga.nutri_item_id,
      descricao: bisnaga.descricao,
      observacao_origem: bisnaga.observacao,
      origem_audit_id: ms1.id,
      status: "resolvida",
      resolvida_em_audit_id: ms2.id,
      resolvida_em: ms2.concluida_em,
      created_at: ms1.concluida_em,
    });
    review(ms2, pendById.r2, true);
  }
  if (r1Origin && r1Resolved) {
    const item = itemByKey(r1Origin.tipo, "equipamentos");
    pendById.r1 = pending("imigrantes-equipamentos", {
      unit_id: UNIT_IDS["imigrantes"],
      item_id: item.id,
      descricao: item.descricao,
      nota_origem: 2,
      observacao_origem: OBS_BY_CHAVE.equipamentos,
      origem_audit_id: r1Origin.id,
      status: "resolvida",
      resolvida_em_audit_id: r1Resolved.id,
      resolvida_em: r1Resolved.concluida_em,
      created_at: r1Origin.concluida_em,
    });
    review(r1Resolved, pendById.r1, true, "Fritadeira consertada e termostato trocado.");
  }
  // avaliações pendentes nos rascunhos de hoje
  for (const p of t.pending_issues.filter((p) => p.status === "aberta" && p.item_id && p.unit_id === draftUnitId)) review(draftGerente, p, null);
  for (const p of t.pending_issues.filter((p) => p.status === "aberta" && p.nutri_entry_id && p.unit_id === UNIT_IDS["moema-salao"])) review(draftNutri, p, null);

  // ----- ajuste do proprietário (pontualidade) -----
  if (adjAudit) {
    const ans = answerOf(adjAudit, "pontualidade");
    t.owner_adjustments.push({
      id: uuid("adj:1"),
      closing_id: uuid(`closing:${prevStart}:${adjAudit.unit_id}`),
      audit_id: adjAudit.id,
      answer_id: ans.id,
      criterio: "pontualidade",
      valor_original: 3,
      valor_novo: 4,
      justificativa: "Control iD confirma escala completa no dia; o atraso registrado foi falha do relógio de ponto.",
      user_id: USERS.antonio.id,
      created_at: atSP(addDays(curStart, 1), "16:20"),
    });
  }

  // ----- fechamento do mês anterior -----
  const prevAudits = t.audits.filter((a) => a.status === "concluida" && a.data >= prevStart && a.data < curStart);
  const rankInputs = [];
  const summaries = new Map();
  for (const u of t.units) {
    const mine = prevAudits.filter((a) => a.unit_id === u.id);
    const s = monthlyOperational(mine.filter((a) => a.tipo !== "nutricional"));
    const nutriNotas = mine.filter((a) => a.tipo === "nutricional").map((a) => a.nota_final);
    summaries.set(u.id, { s, nutri: { nota: nutriNotas.length ? round2(mean(nutriNotas)) : null, n: nutriNotas.length } });
    if (u.tipo === "loja") rankInputs.push({ unit_id: u.id, nota: s.nota, nota_seguranca: s.nota_seguranca, falhas_graves: s.falhas_graves, produto_vencido: s.produto_vencido, entra_no_ranking: u.entra_no_ranking });
  }
  const ranking = rankUnits(rankInputs);
  const fechadoEm = atSP(addDays(curStart, 1), "15:30");
  for (const u of t.units) {
    const { s, nutri } = summaries.get(u.id);
    const r = ranking.get(u.id);
    t.monthly_closings.push({
      id: uuid(`closing:${prevStart}:${u.id}`),
      mes: prevStart,
      unit_id: u.id,
      nota_operacional: s.nota,
      nota_nutricional: nutri.nota,
      nota_seguranca: s.nota_seguranca,
      notas_blocos: s.notas_blocos,
      n_auditorias: s.n_auditorias,
      n_auditorias_nutri: nutri.n,
      falhas_graves: s.falhas_graves,
      amostra_reduzida: s.amostra_reduzida,
      inelegivel_produto_vencido: s.produto_vencido,
      posicao_ranking: r?.posicao ?? null,
      elegivel: r?.elegivel ?? false,
      premiada: r?.premiada ?? false,
      empate: r?.empate ?? false,
      fechado_por: USERS.antonio.id,
      fechado_em: fechadoEm,
    });
  }

  // ----- indicadores 99Food (mês anterior) e relatórios -----
  const ind = [
    ["moema-salao", 4.8, 2, 31],
    ["moema-delivery", 4.6, 5, 38],
    ["imigrantes", 4.3, 7, 42],
  ];
  for (const [slug, nota_99food, cancelamentos, tempo] of ind) {
    t.external_indicators.push({ id: uuid(`ind:${prevStart}:${slug}`), mes: prevStart, unit_id: UNIT_IDS[slug], nota_99food, cancelamentos, tempo_medio_entrega: tempo, lancado_por: USERS.antonio.id, updated_at: atSP(curStart, "18:00") });
  }
  t.reports.push({ id: uuid(`report:${prevStart}:consolidado`), mes: prevStart, unit_id: null, tipo: "consolidado", storage_path: `${prevStart.slice(0, 7)}/consolidado.pdf`, gerado_por: USERS.antonio.id, gerado_em: addIsoMinutes(fechadoEm, 2) });
  t.reports.push({ id: uuid(`report:${prevStart}:moema-salao`), mes: prevStart, unit_id: UNIT_IDS["moema-salao"], tipo: "loja", storage_path: `${prevStart.slice(0, 7)}/moema-salao.pdf`, gerado_por: USERS.antonio.id, gerado_em: addIsoMinutes(fechadoEm, 3) });

  // limpa campos internos
  for (const a of t.audits) delete a.answers;

  ids.prevMonth = prevStart;
  ids.currentMonth = curStart;
  ids.naoCumprida = naoCumprida?.data ?? null;
  ids.sundayOff = sundayOff;
  ids.unitBySlug = Object.fromEntries(Object.entries(unitBySlug).map(([k, u]) => [k, u.id]));
  return { tables: t, ids };
}

const NUTRI_OBS = {
  "Bisnaga de água não identificada": "Bisnaga de água da chapa sem etiqueta de identificação.",
  "Saleiro e dispenser de cobertura de sorvetes sujos": "Saleiro com crosta e dispenser de calda com resíduos secos.",
  "Freezers de todas as áreas com acúmulo de gelo": "Freezer da área de lavagem com 3 cm de gelo na parede interna.",
  "Panos dentro do balde com água": "Três panos de chão dentro do balde com água parada no estoque.",
  "Sachês vencidos": "Sachês de ketchup vencidos em 05/08 no dispenser do salão.",
  [ETIQUETAS]: "Etiquetas de descongelamento sem data de validade em dois GNs.",
  "GN na pista desprotegidas": "GNs de tomate e alface sem tampa na pista fria durante o serviço.",
  "Ralos com resíduos de alimentos": "Ralo da cozinha com resíduos de batata e gordura.",
  "Funcionários com uniformes sujos": "Dois chapeiros com aventais manchados de gordura.",
  "Local desorganizado": "Produtos de limpeza misturados com descartáveis no estoque.",
  "Produtos não estão segregados por gêneros": "Carne crua na mesma prateleira dos hortifrutis na geladeira 1.",
  "Bebidas da geladeira fora do PVPS": "Latas novas colocadas na frente das antigas na geladeira do salão.",
  "POPs de higienização de todas as áreas não estão sendo preenchidos": "POP da chapa sem preenchimento desde a semana passada.",
  "Lâmpadas aquecedoras sujas": "Lâmpadas do passe com gordura acumulada.",
  "Funcionários com adornos, perfumes, maquiagem, cílios postiços": "Atendente com anel e unhas postiças no caixa/expedição.",
  [PLANILHAS_LOJA]: "Planilhas de temperatura do óleo e de banheiro sem registros da semana.",
};

function addIsoMinutes(iso, min) {
  return new Date(new Date(iso).getTime() + min * 60000).toISOString();
}

// execução direta: imprime resumo
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { tables, ids } = buildFixtures();
  for (const [k, v] of Object.entries(tables)) console.log(`${k.padEnd(24)} ${v.length}`);
  console.log(JSON.stringify({ ...ids, unitBySlug: undefined, units: undefined, templates: undefined }, null, 2));
}
