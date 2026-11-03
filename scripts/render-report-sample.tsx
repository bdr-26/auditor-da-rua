// Renderiza os dois relatórios com dados fictícios para validar o layout sem banco.
// Uso: npx tsx scripts/render-report-sample.tsx [pasta-de-saída]   (padrão: /tmp/auditor-reports)
//
// Como funciona: o tsx não consegue carregar o @react-pdf/renderer 4.x (ESM puro com subpath exports),
// então este script se empacota com o esbuild (dependência do próprio tsx) em um .mjs dentro de
// node_modules/.cache e executa esse bundle em um processo `node` comum, onde o import nativo funciona.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ConsolidadoReportData, LojaReportData } from "../src/lib/reports/types";

const outDir = resolve(process.argv[2] ?? "/tmp/auditor-reports");
const projectRoot = process.env.AUDITOR_SAMPLE_ROOT ?? process.cwd();

// foto fictícia: ícone do app como data URI (PNG)
const png = readFileSync(join(projectRoot, "public", "icons", "icon-192.png"));
const foto = `data:image/png;base64,${png.toString("base64")}`;

const loja: LojaReportData = {
  mes: "2026-09-01",
  mesLabel: "setembro de 2026",
  mesAnteriorLabel: "agosto de 2026",
  geradoEm: "01/10/2026 09:12",
  oficial: true,
  unidade: { id: "u-bela-vista", nome: "Bela Vista", slug: "bela-vista", tipo: "loja", supervisor_nome: "Carla Souza" },
  nota: 83.4,
  posicao: 2,
  total_ranqueadas: 5,
  fora_do_ranking: false,
  premiada: false,
  elegivel: true,
  empate: false,
  amostra_reduzida: false,
  produto_vencido: false,
  falhas_graves: 1,
  n_auditorias: 4,
  n_completas: 2,
  n_simplificadas: 2,
  anterior: { nota: 79.1, posicao: 3 },
  blocos: [
    { chave: "seguranca", nome: "Segurança Alimentar", nota: 62.5, nota_anterior: 80, zerado: true },
    { chave: "operacao", nome: "Operação e Produto", nota: 88, nota_anterior: 85, zerado: false },
    { chave: "limpeza", nome: "Limpeza e Estrutura", nota: 91.7, nota_anterior: 78, zerado: false },
    { chave: "atendimento", nome: "Atendimento e Delivery", nota: 95.8, nota_anterior: 90, zerado: false },
    { chave: "equipe", nome: "Equipe e Gestão", nota: 79.2, nota_anterior: 62.5, zerado: false },
  ],
  bons: [
    { chave: "atendimento_cliente", descricao: "Qualidade do atendimento ao cliente", media: 5, n: 2, ocorrencias: 0 },
    { chave: "apresentacao", descricao: "Apresentação geral da loja (organização e padrão visual)", media: 5, n: 2, ocorrencias: 0 },
  ],
  manter: [
    { chave: "limpeza_geral", descricao: "Limpeza geral (salão, cozinha, banheiros, área externa)", media: 4.5, n: 4, ocorrencias: 0 },
    { chave: "montagem_peso", descricao: "Padronização de montagem e peso do hambúrguer (ficha técnica)", media: 4.25, n: 4, ocorrencias: 1 },
    { chave: "uniforme", descricao: "Uniforme limpo, conservado e completo", media: 4, n: 4, ocorrencias: 0 },
  ],
  melhorar: [
    { chave: "temperaturas", descricao: "Controle de temperatura dos alimentos (quente/frio)", media: 2.25, n: 4, ocorrencias: 3 },
    { chave: "planilhas", descricao: "Preenchimento correto das planilhas e registros de controle", media: 2.75, n: 4, ocorrencias: 3 },
    { chave: "pontualidade", descricao: "Pontualidade e cumprimento da escala", media: 3, n: 4, ocorrencias: 2 },
  ],
  recorrentes: [
    { chave: "temperaturas", descricao: "Controle de temperatura dos alimentos (quente/frio)", media: 2.25, media_anterior: 2.75, ocorrencias: 3, ocorrencias_anterior: 2 },
    { chave: "planilhas", descricao: "Preenchimento correto das planilhas e registros de controle", media: 2.75, media_anterior: 3, ocorrencias: 3, ocorrencias_anterior: 2 },
  ],
  pendencias: [
    { descricao: "Termômetro da câmara fria sem calibração", origem: "gerente", desde: "2026-08-14", visitas_sem_resolver: 3, reincidente: true, nota_origem: 1 },
    { descricao: "Planilha de temperatura sem registro das 14h e 18h", origem: "gerente", desde: "2026-09-05", visitas_sem_resolver: 1, reincidente: false, nota_origem: 2 },
    { descricao: "GN na pista desprotegidas", origem: "nutri", desde: "2026-09-10", visitas_sem_resolver: 0, reincidente: false, nota_origem: null },
  ],
  recado: "Setembro foi de evolução no atendimento — parabéns à equipe. Em outubro o foco é temperatura e planilhas: nenhuma auditoria pode fechar com esses itens abaixo de 4.",
  apontamentos: [
    { data: "2026-09-05", tipo: "completa", item: "Controle de temperatura dos alimentos (quente/frio)", nota: 1, falha_grave: true, observacao: "Câmara fria a 9 °C no início do turno; termômetro descalibrado.", fotos: [foto, foto] },
    { data: "2026-09-05", tipo: "completa", item: "Preenchimento correto das planilhas e registros de controle", nota: 2, falha_grave: false, observacao: "Planilha de temperatura sem registro das 14h e 18h.", fotos: [foto] },
    { data: "2026-09-16", tipo: "simplificada", item: "Escala cumprida no dia", nota: 2, falha_grave: false, observacao: "Um funcionário chegou 40 min atrasado sem aviso.", fotos: [] },
  ],
  auditorias: [
    { data: "2026-09-26", tipo: "completa", nota: 89.2, falha_grave: false, auditor: "Rodrigo" },
    { data: "2026-09-16", tipo: "simplificada", nota: 84.1, falha_grave: false, auditor: "Rodrigo" },
    { data: "2026-09-09", tipo: "simplificada", nota: 90.9, falha_grave: false, auditor: "Rodrigo" },
    { data: "2026-09-05", tipo: "completa", nota: 50, falha_grave: true, auditor: "Rodrigo" },
  ],
  nutri: {
    nota: 86.4,
    classificacao: "Bom",
    n: 2,
    anterior: 91.2,
    apontamentos: [
      { data: "2026-09-10", area: "Cozinha / Chapa", item: "GN na pista desprotegidas", observacao: "Duas GNs de molho sem tampa na pista fria." },
      { data: "2026-09-10", area: "Área de Lavagem de Louças e Estoque", item: "Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)", observacao: null },
      { data: "2026-09-24", area: "Cozinha / Chapa", item: "Amostras de água não foram coletadas", observacao: "Coleta do dia 22 não realizada." },
    ],
  },
  food99: { nota_99food: 4.6, cancelamentos: 125, tempo_medio_entrega: 30, pedidos: 2320, detalhe: {"periodo": {"de": "2026-09-01", "ate": "2026-09-30"}, "dias": 30, "lojas_99": [{"id": "5764616347963886742", "nome": "Burger da Rua- Bela Vista", "pedidos": 1480}, {"id": "5764617019115439184", "nome": "Smash da Rua- Bela Vista", "pedidos": 52}], "pedidos_total": 2615, "concluidos": 2320, "cancelados": 125, "cancel_pct": 5.1, "cancel_resp": {"Responsabilidade da plataforma": 9, "Responsabilidade do entregador": 6, "Responsabilidade do cliente": 5, "Sem informação": 2}, "desistencias": 170, "nao_aceitos": 98, "nao_aceitos_pct": 4.0, "cancel_loja": 5, "cancel_motivos_loja": {"Fechado": 3, "Itens esgotados": 2}, "cancel_apos_aceite": 22, "avaliacoes": 198, "nota_media": 4.6, "distribuicao": {"1": 11, "2": 5, "3": 6, "4": 11, "5": 165}, "tags_negativas": {"Itens faltando": 6, "Comida ruim": 3, "Porções pequenas": 2}, "tags_positivas": {"Comida excelente": 48, "Recomendaria": 41, "Bem embalado": 40}, "comentarios_negativos": [{"data": "2026-09-18", "nota": 1, "texto": "Faltou a batata do combo e o lanche chegou frio."}, {"data": "2026-09-09", "nota": 2, "texto": "Na foto é grande, na vida real pequeno."}], "atrasados": 55, "atraso_pct": 2.4, "itens_em_falta": 1, "novos_clientes": 960, "novos_pct": 41.4, "tempo_total_medio": 29.5, "tempo_entrega_medio": 22.5, "tempo_preparo_medio": 11.6, "tempo_aceite_medio": 2.8} },
};

const producao: LojaReportData = {
  ...loja,
  unidade: { id: "u-moema-producao", nome: "Moema Produção", slug: "moema-producao", tipo: "producao", supervisor_nome: null },
  nota: 91,
  posicao: null,
  fora_do_ranking: true,
  falhas_graves: 0,
  n_auditorias: 5,
  n_completas: 0,
  n_simplificadas: 0,
  anterior: { nota: 88.5, posicao: null },
  blocos: [{ chave: "producao", nome: "Cozinha central", nota: 91, nota_anterior: 88.5, zerado: false }],
  apontamentos: [],
  recorrentes: [],
  pendencias: [],
  recado: null,
  nutri: null,
  food99: null,
  auditorias: [{ data: "2026-09-01", tipo: "producao", nota: 91, falha_grave: false, auditor: "Rodrigo" }],
};

const consolidado: ConsolidadoReportData = {
  mes: "2026-09-01",
  mesLabel: "setembro de 2026",
  geradoEm: "01/10/2026 09:12",
  oficial: false,
  ranking: [
    { posicao: 1, nome: "Mooca", nota: 88.7, nota_anterior: 84.2, n_auditorias: 5, falhas_graves: 0, selos: [], nota_nutricional: 93, premiada: true, empate: false },
    { posicao: 2, nome: "Bela Vista", nota: 83.4, nota_anterior: 79.1, n_auditorias: 4, falhas_graves: 1, selos: ["Falha grave"], nota_nutricional: 86.4, premiada: false, empate: false },
    { posicao: 3, nome: "Imigrantes", nota: 81, nota_anterior: 85, n_auditorias: 4, falhas_graves: 0, selos: [], nota_nutricional: null, premiada: false, empate: false },
    { posicao: 4, nome: "Moema Salão", nota: 74.5, nota_anterior: 76, n_auditorias: 2, falhas_graves: 0, selos: ["Amostra reduzida"], nota_nutricional: 78, premiada: false, empate: false },
    { posicao: 5, nome: "Moema Delivery", nota: 61.2, nota_anterior: 70.3, n_auditorias: 4, falhas_graves: 2, selos: ["Falha grave", "Inelegível"], nota_nutricional: 70.1, premiada: false, empate: false },
  ],
  premiadas: [{ nome: "Mooca", supervisor_nome: "João Pereira" }],
  premio_valor: 200,
  producao: { nome: "Moema Produção", nota: 91, nota_anterior: 88.5, n_auditorias: 5, falhas_graves: 0 },
  media_rede: { atual: 77.8, anterior: 78.9 },
  falhas_graves: [
    { unidade: "Bela Vista", data: "2026-09-05", item: "Controle de temperatura dos alimentos (quente/frio)", observacao: "Câmara fria a 9 °C." },
    { unidade: "Moema Delivery", data: "2026-09-12", item: "Validade e rotação de insumos — PVPS, sem itens vencidos", observacao: "Maionese vencida em uso." },
    { unidade: "Moema Delivery", data: "2026-09-27", item: "Uso correto de EPIs (luvas, touca, proteção)", observacao: null },
  ],
  rotina: {
    previstos: 26,
    cumpridos: 22,
    nao_cumpridos: 2,
    pendentes: 2,
    trocas: 1,
    nao_cumpridos_lista: [
      { data: "2026-09-13", unidade: "Imigrantes", tipo: "completa" },
      { data: "2026-09-23", unidade: "Moema Salão", tipo: "simplificada" },
    ],
  },
  nutri_frequencia: [
    { unidade: "Moema Salão", n: 1, datas: ["2026-09-03"], nota: 78, classificacao: "Insatisfatório" },
    { unidade: "Moema Delivery", n: 1, datas: ["2026-09-03"], nota: 70.1, classificacao: "Insatisfatório" },
    { unidade: "Imigrantes", n: 0, datas: [], nota: null, classificacao: null },
    { unidade: "Bela Vista", n: 2, datas: ["2026-09-10", "2026-09-24"], nota: 86.4, classificacao: "Bom" },
    { unidade: "Mooca", n: 1, datas: ["2026-09-17"], nota: 93, classificacao: "Excelente" },
  ],
  food99: [
    { unidade: "Moema Salão", nota_99food: 4.6, cancelamentos: 2, tempo_medio_entrega: 41, pedidos: null },
    { unidade: "Moema Delivery", nota_99food: 4.3, cancelamentos: 9, tempo_medio_entrega: 47, pedidos: null },
    { unidade: "Imigrantes", nota_99food: 4.8, cancelamentos: 1, tempo_medio_entrega: 35, pedidos: null },
    { unidade: "Bela Vista", nota_99food: 4.7, cancelamentos: 3, tempo_medio_entrega: 38, pedidos: null },
    { unidade: "Mooca", nota_99food: 4.9, cancelamentos: 0, tempo_medio_entrega: 33, pedidos: null },
  ],
  pendencias: [
    { unidade: "Moema Salão", abertas: 3, reincidentes: 1 },
    { unidade: "Moema Delivery", abertas: 6, reincidentes: 2 },
    { unidade: "Imigrantes", abertas: 1, reincidentes: 0 },
    { unidade: "Bela Vista", abertas: 2, reincidentes: 0 },
    { unidade: "Mooca", abertas: 0, reincidentes: 0 },
  ],
};

async function render() {
  // import dinâmico: só o processo filho (node puro, sem tsx) carrega o react-pdf
  const { renderConsolidadoReport, renderLojaReport } = await import("../src/lib/reports/render");
  mkdirSync(outDir, { recursive: true });
  const jobs: [string, () => Promise<Buffer>][] = [
    ["loja-bela-vista.pdf", () => renderLojaReport(loja)],
    ["loja-moema-producao.pdf", () => renderLojaReport(producao)],
    ["consolidado.pdf", () => renderConsolidadoReport(consolidado)],
  ];
  for (const [name, run] of jobs) {
    const buf = await run();
    const path = join(outDir, name);
    writeFileSync(path, buf);
    const size = statSync(path).size;
    console.log(`${size > 0 ? "OK " : "ERR"} ${path} (${(size / 1024).toFixed(1)} KB)`);
    if (size === 0) process.exitCode = 1;
  }
}

async function bundleAndRun() {
  const esbuild = await import("esbuild");
  const entry = resolve(process.argv[1]);
  const bundle = join(projectRoot, "node_modules", ".cache", "auditor-reports", "render-sample.mjs");
  mkdirSync(dirname(bundle), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    jsx: "automatic",
    outfile: bundle,
    logLevel: "warning",
  });
  const r = spawnSync(process.execPath, [bundle, outDir], {
    stdio: "inherit",
    env: { ...process.env, AUDITOR_SAMPLE_CHILD: "1", AUDITOR_SAMPLE_ROOT: projectRoot },
  });
  process.exit(r.status ?? 1);
}

const main = process.env.AUDITOR_SAMPLE_CHILD ? render : bundleAndRun;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
