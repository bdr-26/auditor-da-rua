// Renderiza os dois relatórios nutricionais (por auditoria e mensal) com dados fictícios, para validar o layout.
// Uso: npx tsx scripts/render-nutri-sample.tsx [pasta-de-saída]   (padrão: /tmp/auditor-reports)
// Empacota-se com esbuild e roda num node filho (mesmo motivo do render-report-sample.tsx: @react-pdf é ESM puro).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { NutriAuditReportData, NutriMonthlyReportData } from "../src/lib/reports/nutri-types";

const outDir = resolve(process.argv[2] ?? "/tmp/auditor-reports");
const projectRoot = process.env.AUDITOR_SAMPLE_ROOT ?? process.cwd();
const foto = `data:image/png;base64,${readFileSync(join(projectRoot, "public", "icons", "icon-192.png")).toString("base64")}`;

const auditoria: NutriAuditReportData = {
  auditId: "a1",
  unidade: { nome: "Moema Salão", endereco: "Av. Ibirapuera, 1234 · Moema", supervisor_nome: "Carla Souza" },
  data: "22/09/2026",
  dataIso: "2026-09-22",
  concluidaEm: "22/09/2026 11:42",
  rascunho: false,
  nutricionista: "Daniele Ramos",
  geradoEm: "22/09/2026 15:10",
  nota: 88.1,
  classificacao: "Satisfatório",
  totais: { conformes: 37, nao_conformes: 5, na: 1, avaliados: 43 },
  areas: [
    { area: "Cozinha / Chapa", conformes: 12, nao_conformes: 3, na: 0, aplicaveis: 15, nota: 80 },
    { area: "Área de Lavagem de Louças e Estoque", conformes: 5, nao_conformes: 0, na: 0, aplicaveis: 5, nota: 100 },
    { area: "Estoque de Produtos de Limpeza e Banheiro de Funcionário", conformes: 3, nao_conformes: 1, na: 0, aplicaveis: 4, nota: 75 },
    { area: "Salão 1 e 2", conformes: 3, nao_conformes: 0, na: 0, aplicaveis: 3, nota: 100 },
    { area: "Banheiro de Cliente", conformes: 1, nao_conformes: 0, na: 0, aplicaveis: 1, nota: 100 },
    { area: "Sala de Descartáveis", conformes: 0, nao_conformes: 0, na: 1, aplicaveis: 0, nota: null },
    { area: "Boas Práticas de Fabricação", conformes: 4, nao_conformes: 0, na: 0, aplicaveis: 4, nota: 100 },
    { area: "Higienização", conformes: 5, nao_conformes: 1, na: 0, aplicaveis: 6, nota: 83.3 },
    { area: "Funcionários", conformes: 3, nao_conformes: 0, na: 0, aplicaveis: 3, nota: 100 },
    { area: "Planilhas", conformes: 1, nao_conformes: 0, na: 0, aplicaveis: 1, nota: 100 },
  ],
  apontamentos: [
    { area: "Cozinha / Chapa", descricao: "Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)", observacao: "Duas GNs de cebola sem etiqueta na geladeira da chapa; uma etiqueta de maionese com data rasurada.", fotos: [{ id: "f1", dataUri: foto }, { id: "f2", dataUri: foto }] },
    { area: "Cozinha / Chapa", descricao: "Bisnaga de água não identificada", observacao: "Bisnaga na pista sem identificação.", fotos: [{ id: "f3", dataUri: foto }] },
    { area: "Cozinha / Chapa", descricao: "GN na pista desprotegidas", observacao: "Pista fria aberta durante o pico sem tampa.", fotos: [] },
    { area: "Estoque de Produtos de Limpeza e Banheiro de Funcionário", descricao: "Panos dentro do balde com água", observacao: "Balde com panos submersos ao lado do tanque.", fotos: [{ id: "f4", dataUri: foto }] },
    { area: "Higienização", descricao: "Freezers de todas as áreas com acúmulo de gelo", observacao: "Freezer da chapa com cerca de 1 cm de gelo nas paredes.", fotos: [] },
  ],
  pendencias: [
    { descricao: "Saleiros sujos", resolvida: true, origem_data: "15/09/2026" },
    { descricao: "Panos dentro do balde com água", resolvida: false, origem_data: "15/09/2026" },
  ],
  fotosOmitidas: 0,
};

const mensal: NutriMonthlyReportData = {
  unidade: auditoria.unidade,
  mes: "2026-09-01",
  mesLabel: "setembro de 2026",
  geradoEm: "01/10/2026 09:00",
  nutricionistas: ["Daniele Ramos"],
  resultado: { nota: 86.4, classificacao: "Satisfatório", n: 4, melhor: 93, pior: 79.1 },
  anterior: { nota: 81.9, classificacao: "Satisfatório", n: 4 },
  auditorias: [
    { auditId: "1", data: "01/09", nota: 79.1, classificacao: "Insatisfatório", nao_conformes: 9, nutricionista: "Daniele Ramos" },
    { auditId: "2", data: "08/09", nota: 85.7, classificacao: "Satisfatório", nao_conformes: 6, nutricionista: "Daniele Ramos" },
    { auditId: "3", data: "15/09", nota: 93, classificacao: "Excelente", nao_conformes: 3, nutricionista: "Daniele Ramos" },
    { auditId: "4", data: "22/09", nota: 88.1, classificacao: "Satisfatório", nao_conformes: 5, nutricionista: "Daniele Ramos" },
  ],
  areas: [
    { area: "Cozinha / Chapa", conformes: 46, nao_conformes: 14, na: 0, aplicaveis: 60, nota: 76.7 },
    { area: "Área de Lavagem de Louças e Estoque", conformes: 18, nao_conformes: 2, na: 0, aplicaveis: 20, nota: 90 },
    { area: "Estoque de Produtos de Limpeza e Banheiro de Funcionário", conformes: 13, nao_conformes: 3, na: 0, aplicaveis: 16, nota: 81.3 },
    { area: "Salão 1 e 2", conformes: 12, nao_conformes: 0, na: 0, aplicaveis: 12, nota: 100 },
    { area: "Banheiro de Cliente", conformes: 3, nao_conformes: 1, na: 0, aplicaveis: 4, nota: 75 },
    { area: "Sala de Descartáveis", conformes: 3, nao_conformes: 0, na: 1, aplicaveis: 3, nota: 100 },
    { area: "Boas Práticas de Fabricação", conformes: 15, nao_conformes: 1, na: 0, aplicaveis: 16, nota: 93.8 },
    { area: "Higienização", conformes: 22, nao_conformes: 2, na: 0, aplicaveis: 24, nota: 91.7 },
    { area: "Funcionários", conformes: 12, nao_conformes: 0, na: 0, aplicaveis: 12, nota: 100 },
    { area: "Planilhas", conformes: 4, nao_conformes: 0, na: 0, aplicaveis: 4, nota: 100 },
  ],
  recorrentes: [
    { descricao: "Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)", ocorrencias: 4, areas: ["Cozinha / Chapa", "Área de Lavagem de Louças e Estoque"] },
    { descricao: "Panos dentro do balde com água", ocorrencias: 3, areas: ["Estoque de Produtos de Limpeza e Banheiro de Funcionário"] },
    { descricao: "GN na pista desprotegidas", ocorrencias: 2, areas: ["Cozinha / Chapa"] },
  ],
  apontamentos: auditoria.apontamentos.map((a, i) => ({ ...a, data: ["01/09", "08/09", "15/09", "22/09", "22/09"][i] })),
  pendenciasAbertas: [
    { descricao: "Panos dentro do balde com água", desde: "01/09/2026", visitas_sem_resolver: 3, reincidente: true },
    { descricao: "Freezers de todas as áreas com acúmulo de gelo", desde: "22/09/2026", visitas_sem_resolver: 0, reincidente: false },
  ],
  fotosOmitidas: 0,
};

async function main() {
  const { renderNutriAuditReport, renderNutriMonthlyReport } = await import("../src/lib/reports/render");
  mkdirSync(outDir, { recursive: true });
  for (const [name, buf] of [
    ["nutri-auditoria-moema-salao.pdf", await renderNutriAuditReport(auditoria)],
    ["nutri-mensal-moema-salao.pdf", await renderNutriMonthlyReport(mensal)],
  ] as const) {
    const p = join(outDir, name);
    writeFileSync(p, buf);
    console.log(`OK  ${p} (${(statSync(p).size / 1024).toFixed(1)} KB)`);
  }
}

if (process.env.AUDITOR_SAMPLE_BUNDLED) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  (async () => {
    const esbuild = await import("esbuild");
    const entry = resolve(process.argv[1]);
    const bundle = join(projectRoot, "node_modules", ".cache", "auditor-reports", "render-nutri-sample.mjs");
    mkdirSync(dirname(bundle), { recursive: true });
    await esbuild.build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: bundle, packages: "external", jsx: "automatic", logLevel: "silent" });
    const r = spawnSync(process.execPath, [bundle, outDir], { stdio: "inherit", env: { ...process.env, AUDITOR_SAMPLE_BUNDLED: "1", AUDITOR_SAMPLE_ROOT: projectRoot } });
    process.exit(r.status ?? 1);
  })();
}
