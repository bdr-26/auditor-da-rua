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
    classificacao: "Satisfatório",
    n: 2,
    anterior: 91.2,
    apontamentos: [
      { data: "2026-09-10", area: "Cozinha / Chapa", item: "GN na pista desprotegidas", observacao: "Duas GNs de molho sem tampa na pista fria." },
      { data: "2026-09-10", area: "Área de Lavagem de Louças e Estoque", item: "Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)", observacao: null },
      { data: "2026-09-24", area: "Cozinha / Chapa", item: "Amostras de água não foram coletadas", observacao: "Coleta do dia 22 não realizada." },
    ],
  },
  food99: { nota_99food: 4.7, cancelamentos: 3, tempo_medio_entrega: 38 },
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
    { unidade: "Bela Vista", n: 2, datas: ["2026-09-10", "2026-09-24"], nota: 86.4, classificacao: "Satisfatório" },
    { unidade: "Mooca", n: 1, datas: ["2026-09-17"], nota: 93, classificacao: "Excelente" },
  ],
  food99: [
    { unidade: "Moema Salão", nota_99food: 4.6, cancelamentos: 2, tempo_medio_entrega: 41 },
    { unidade: "Moema Delivery", nota_99food: 4.3, cancelamentos: 9, tempo_medio_entrega: 47 },
    { unidade: "Imigrantes", nota_99food: 4.8, cancelamentos: 1, tempo_medio_entrega: 35 },
    { unidade: "Bela Vista", nota_99food: 4.7, cancelamentos: 3, tempo_medio_entrega: 38 },
    { unidade: "Mooca", nota_99food: 4.9, cancelamentos: 0, tempo_medio_entrega: 33 },
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
