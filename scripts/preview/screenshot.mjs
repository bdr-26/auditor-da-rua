#!/usr/bin/env node
// =====================================================================
// Screenshots mobile de todas as telas de um perfil, usando o preview local.
// Uso: node scripts/preview/screenshot.mjs <dani|rodrigo|antonio> <pasta-saida> [largura=390] [altura=844]
// Requer: scripts/preview/run.sh no ar (mock em 54321 + next dev em 3000).
// Gera <pasta>/NN-rota.png, <pasta>/contact-sheet.html e <pasta>/summary.json.
// =====================================================================
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { USERS, buildFixtures } from "./fixtures.mjs";

const [, , roleArg, outArg, widthArg, heightArg] = process.argv;
if (!roleArg || !outArg) {
  console.error("Uso: node scripts/preview/screenshot.mjs <dani|rodrigo|antonio> <pasta-saida> [largura=390] [altura=844]");
  process.exit(2);
}
const role = roleArg.toLowerCase();
if (!USERS[role]) {
  console.error(`Perfil desconhecido: ${role}. Use dani, rodrigo ou antonio.`);
  process.exit(2);
}
const width = Number(widthArg ?? 390);
const height = Number(heightArg ?? 844);
const outDir = resolve(outArg);
const BASE = (process.env.PREVIEW_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MOCK = (process.env.MOCK_SUPABASE_URL ?? "http://127.0.0.1:54321").replace(/\/$/, "");
const NAV_TIMEOUT = Number(process.env.PREVIEW_NAV_TIMEOUT ?? 180000);

// ids das fixtures: prefere os do mock em execução (mesmo "hoje"), senão recalcula localmente
let ids;
try {
  const r = await fetch(`${MOCK}/rest/v1/_ids`);
  if (r.ok) ids = await r.json();
} catch {
  /* mock fora do ar: usa cálculo local */
}
if (!ids) ids = buildFixtures().ids;

const ROUTES = {
  dani: [
    "/nutri",
    "/nutri/nova",
    "/nutri/historico",
    "/nutri/checklists",
    "/nutri/checklists/banco",
    `/nutri/checklists/${ids.units["imigrantes"]}`,
    `/nutri/auditorias/${ids.draftNutri}`,
    `/nutri/auditorias/${ids.draftNutri}?etapa=2`,
    `/nutri/auditorias/${ids.draftNutri}/revisao`,
    `/nutri/auditorias/${ids.concludedNutri}/resumo`,
  ],
  rodrigo: [
    "/auditor",
    "/auditor/agenda",
    "/auditor/historico",
    "/auditor/nova",
    `/auditorias/${ids.draftGerente}`,
    `/auditorias/${ids.draftGerente}?etapa=2`,
    `/auditorias/${ids.draftGerente}/revisao`,
    `/auditorias/${ids.concludedGerente}/resumo`,
  ],
  antonio: [
    "/dashboard",
    `/dashboard/lojas/${ids.units["mooca"]}`,
    "/dashboard/calendario",
    "/dashboard/auditores",
    "/dashboard/criterios",
    "/dashboard/pendencias",
    "/dashboard/fechamento",
    `/dashboard/fechamento/${ids.prevMonth}`,
    "/admin/unidades",
    "/admin/configuracoes",
    "/nutri/checklists",
  ],
};

function chromiumPath() {
  if (process.env.PREVIEW_CHROMIUM && existsSync(process.env.PREVIEW_CHROMIUM)) return process.env.PREVIEW_CHROMIUM;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const direct = join(root, "chromium");
    if (existsSync(direct) && !existsSync(join(direct, "chrome-linux"))) return direct; // symlink para o binário
    const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort();
    for (const d of dirs.reverse()) {
      const bin = join(root, d, "chrome-linux", "chrome");
      if (existsSync(bin)) return bin;
    }
  }
  return undefined; // deixa o playwright-core procurar o padrão
}

function fileNameFor(route, index) {
  const clean = route
    .replace(/^\//, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => m.slice(0, 8))
    .replace(/\//g, "__")
    .replace(/\?/g, "_")
    .replace(/[=&]/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
  return `${String(index + 1).padStart(2, "0")}-${clean || "root"}.png`;
}

/** Percorre a página até o fim (carrega imagens lazy), esconde o badge de dev do Next e volta ao topo. */
async function settle(page) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.8);
    const max = document.documentElement.scrollHeight;
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    // imagens lazy que o scroll rápido não disparou: força o carregamento e espera terminar (máx. 6 s)
    const imgs = Array.from(document.images);
    for (const img of imgs) if (img.loading === "lazy") img.loading = "eager";
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && imgs.some((i) => !i.complete)) await new Promise((r) => setTimeout(r, 100));
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

async function inspect(page) {
  return page.evaluate(() => {
    const text = (sel) => Array.from(document.querySelectorAll(sel)).map((e) => e.textContent?.trim() ?? "").filter(Boolean);
    const body = document.body?.innerText ?? "";
    const errorPanel = Array.from(document.querySelectorAll("div")).find((d) => /Não foi possível|Application error|Unhandled Runtime Error|This page could not be found/.test(d.textContent ?? "") && d.className?.includes?.("bg-red-50"));
    const empty = /Nenhum(a)? (auditoria|pendência|unidade|auditor|item)/i.test(body) || /Ainda não há/i.test(body);
    return {
      title: document.title,
      h1: text("h1").slice(0, 3),
      hasErrorPanel: !!errorPanel || /Application error|Unhandled Runtime Error|This page could not be found/.test(body),
      errorText: errorPanel ? errorPanel.textContent?.trim().slice(0, 300) : /Application error|This page could not be found/.test(body) ? body.slice(0, 200) : null,
      emptyStateHint: empty,
      bodyHeight: document.documentElement.scrollHeight,
      snippet: body.replace(/\s+/g, " ").slice(0, 160),
    };
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const user = USERS[role];
  const executablePath = chromiumPath();
  console.log(`[shots] perfil=${role} (${user.email}) viewport=${width}x${height} saída=${outDir}`);
  if (executablePath) console.log(`[shots] chromium: ${executablePath}`);

  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const mobile = width <= 500;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    serviceWorkers: "block",
  });
  context.setDefaultNavigationTimeout(NAV_TIMEOUT);
  context.setDefaultTimeout(NAV_TIMEOUT);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));

  // ---- login pelo formulário real ----
  console.log("[shots] login…");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", user.email);
  await page.fill("#password", "preview");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: NAV_TIMEOUT }), page.click('button[type="submit"]')]);
  await page.waitForLoadState("networkidle");
  console.log(`[shots] logado → ${new URL(page.url()).pathname}`);
  await settle(page);
  await page.screenshot({ path: join(outDir, "00-login-destino.png"), fullPage: true });

  // ---- rotas ----
  const summary = [];
  const routes = ROUTES[role];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const file = fileNameFor(route, i);
    const t0 = Date.now();
    consoleErrors.length = 0;
    let status = null;
    let info = null;
    let error = null;
    try {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      status = resp?.status() ?? null;
      await settle(page);
      info = await inspect(page);
      await page.screenshot({ path: join(outDir, file), fullPage: true });
    } catch (e) {
      error = e.message.split("\n")[0];
      try {
        await page.screenshot({ path: join(outDir, file), fullPage: true });
      } catch {
        /* sem screenshot */
      }
    }
    const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    const redirected = finalPath !== route;
    const flag = error ? "ERRO" : info?.hasErrorPanel ? "PAINEL-ERRO" : status && status >= 400 ? `HTTP ${status}` : redirected ? "REDIRECT" : info?.emptyStateHint ? "vazio?" : "ok";
    console.log(`[shots] ${String(i + 1).padStart(2, "0")} ${route.padEnd(70)} ${flag.padEnd(12)} ${Date.now() - t0}ms  h1=${JSON.stringify(info?.h1?.[0] ?? "")}${redirected ? ` → ${finalPath}` : ""}`);
    if (info?.errorText) console.log(`        ${info.errorText}`);
    if (error) console.log(`        ${error}`);
    summary.push({ route, file, status, finalPath, redirected, flag, h1: info?.h1 ?? [], snippet: info?.snippet ?? null, errorText: info?.errorText ?? null, error, consoleErrors: consoleErrors.slice(0, 5) });
  }

  await browser.close();

  // ---- contact sheet + resumo ----
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ role, email: user.email, base: BASE, viewport: { width, height }, generatedAt: new Date().toISOString(), today: ids.today, shots: summary }, null, 2));
  writeFileSync(join(outDir, "contact-sheet.html"), contactSheet(role, summary, width, height));
  const bad = summary.filter((s) => s.flag !== "ok");
  console.log(`[shots] concluído: ${summary.length} telas, ${bad.length} com aviso. Contact sheet: ${join(outDir, "contact-sheet.html")}`);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function contactSheet(role, summary, width, height) {
  const cards = [
    `<figure><img src="00-login-destino.png" alt="destino após login"><figcaption><strong>login → destino</strong></figcaption></figure>`,
    ...summary.map(
      (s) => `<figure class="${s.flag === "ok" ? "" : "warn"}"><a href="${esc(s.file)}" target="_blank"><img src="${esc(s.file)}" alt="${esc(s.route)}" loading="lazy"></a><figcaption><strong>${esc(s.route)}</strong><br><span class="flag">${esc(s.flag)}</span> ${s.h1?.[0] ? "· " + esc(s.h1[0]) : ""}${s.errorText ? `<br><em>${esc(s.errorText)}</em>` : ""}</figcaption></figure>`,
    ),
  ].join("\n");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preview · ${esc(role)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f5f5f4;color:#1c1917}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#57534e;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${Math.min(width, 420)}px,1fr));gap:20px;align-items:start}
figure{margin:0;background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
figure.warn{border-color:#f59e0b;background:#fffbeb}
img{width:100%;height:auto;max-height:${height * 1.6}px;object-fit:cover;object-position:top;border-radius:10px;border:1px solid #e7e5e4;background:#fff}
figcaption{font-size:12px;margin-top:8px;word-break:break-all}
.flag{display:inline-block;padding:1px 6px;border-radius:999px;background:#e7e5e4;font-size:11px}
</style></head><body>
<h1>Preview · ${esc(role)} · ${width}×${height}</h1>
<p>${summary.length} rotas · gerado em ${esc(new Date().toLocaleString("pt-BR"))} · hoje (SP) = ${esc(ids.today)}. Clique numa imagem para abrir em tamanho real.</p>
<div class="grid">${cards}</div>
</body></html>`;
}

main().catch((e) => {
  console.error("[shots] falhou:", e);
  process.exit(1);
});
