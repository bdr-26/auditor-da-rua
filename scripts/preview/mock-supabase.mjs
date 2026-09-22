#!/usr/bin/env node
// =====================================================================
// Mock do Supabase para preview local (sem projeto real).
// Emula o subconjunto usado pelo app: GoTrue (login/refresh/user/logout),
// PostgREST (select com recursos embutidos, filtros, order/limit, insert/
// update/delete/upsert) e Storage (upload, URLs assinadas, placeholder).
// Dados em memória vindos de ./fixtures.mjs; GET /rest/v1/_reset recarrega.
// =====================================================================
import http from "node:http";
import zlib from "node:zlib";
import { randomUUID } from "node:crypto";
import { buildFixtures, FK, NUMERIC_COLS, PRIMARY_KEY, TABLE_DEFAULTS, TIMESTAMP_COLS, USERS } from "./fixtures.mjs";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const HOST = process.env.MOCK_SUPABASE_HOST ?? "127.0.0.1";

let db;
let fixtureIds;
function reload() {
  const { tables, ids } = buildFixtures();
  db = tables;
  fixtureIds = ids;
  return ids;
}
reload();

// ---------------------------------------------------------------------
// helpers HTTP
// ---------------------------------------------------------------------
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Range-Unit, Location, X-Total-Count");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function send(res, status, body, headers = {}) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body == null) {
    res.statusCode = status;
    res.end();
    return;
  }
  if (Buffer.isBuffer(body)) {
    res.statusCode = status;
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/octet-stream");
    res.end(body);
    return;
  }
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function parseJson(buf) {
  if (!buf || buf.length === 0) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Auth (GoTrue)
// ---------------------------------------------------------------------
const b64url = (s) => Buffer.from(s).toString("base64url");
function makeToken(user, exp) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: `http://${HOST}:${PORT}/auth/v1`,
      sub: user.id,
      aud: "authenticated",
      exp,
      iat: exp - 3600,
      email: user.email,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { nome: user.nome, role: user.role },
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: exp - 3600 }],
      session_id: randomUUID(),
      is_anonymous: false,
    }),
  );
  return `${header}.${payload}.${b64url("mock-signature")}`;
}
function decodeToken(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
function userObject(user) {
  const created = "2026-07-01T12:00:00.000Z";
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: created,
    phone: "",
    confirmed_at: created,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { nome: user.nome, role: user.role, email_verified: true },
    identities: [],
    created_at: created,
    updated_at: created,
    is_anonymous: false,
  };
}
function sessionFor(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: makeToken(user, exp),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: `rt-${user.id}-${randomUUID().slice(0, 8)}`,
    user: userObject(user),
    weak_password: null,
  };
}
const userByEmail = (email) => Object.values(USERS).find((u) => u.email === String(email ?? "").toLowerCase()) ?? null;
const userById = (id) => Object.values(USERS).find((u) => u.id === id) ?? null;

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const body = parseJson(await readBody(req)) ?? {};
    if (grant === "password") {
      const user = userByEmail(body.email);
      if (!user) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials", message: "Invalid login credentials" });
      return send(res, 200, sessionFor(user));
    }
    if (grant === "refresh_token") {
      const m = /^rt-([0-9a-f-]{36})-/.exec(String(body.refresh_token ?? ""));
      const user = m ? userById(m[1]) : null;
      if (!user) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token", message: "Invalid Refresh Token" });
      return send(res, 200, sessionFor(user));
    }
    return send(res, 400, { code: 400, error_code: "unsupported_grant_type", msg: "unsupported grant type", message: "unsupported grant type" });
  }
  if (path === "/user" && req.method === "GET") {
    const auth = String(req.headers.authorization ?? "");
    const token = auth.replace(/^Bearer\s+/i, "");
    const claims = decodeToken(token);
    const user = claims?.sub ? userById(claims.sub) : null;
    if (!user) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT", message: "invalid JWT" });
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "JWT expired", message: "JWT expired" });
    return send(res, 200, userObject(user));
  }
  if (path === "/logout" && req.method === "POST") return send(res, 204, null);
  if (path === "/health") return send(res, 200, { name: "GoTrue (mock)", version: "mock" });
  return send(res, 404, { code: 404, error_code: "not_found", msg: `rota de auth não emulada: ${req.method} ${path}` });
}

// ---------------------------------------------------------------------
// PostgREST — parsing de select / filtros
// ---------------------------------------------------------------------
/** Divide por vírgula respeitando parênteses e aspas. */
function splitTop(str, sep = ",") {
  const out = [];
  let depth = 0;
  let cur = "";
  let quoted = false;
  for (const ch of str) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === sep && depth === 0) {
        out.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.length) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** `a,b,rel!inner(x,y(z))` → [{kind:'col'|'embed', name, alias, inner, hint, children}] */
function parseSelect(str) {
  if (!str || str.trim() === "" ) return [{ kind: "col", name: "*" }];
  return splitTop(str).map((part) => {
    const open = part.indexOf("(");
    if (open >= 0 && part.endsWith(")")) {
      let head = part.slice(0, open);
      const inner = part.slice(open + 1, -1);
      let alias = null;
      const colon = head.indexOf(":");
      if (colon >= 0) {
        alias = head.slice(0, colon);
        head = head.slice(colon + 1);
      }
      const [name, ...mods] = head.split("!");
      const isInner = mods.includes("inner");
      const hint = mods.find((m) => m !== "inner" && m !== "left") ?? null;
      return { kind: "embed", name, alias: alias ?? name, inner: isInner, hint, children: parseSelect(inner) };
    }
    let name = part;
    let alias = null;
    const colon = part.indexOf(":");
    if (colon >= 0) {
      alias = part.slice(0, colon);
      name = part.slice(colon + 1);
    }
    name = name.split("::")[0]; // cast
    return { kind: "col", name, alias: alias ?? name };
  });
}

function parseValueList(raw) {
  const inner = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1) : raw;
  return splitTop(inner).map((v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v));
}

/** `not.is.null` / `eq.x` / `in.(a,b)` → { op, value, negate } */
function parseOp(raw) {
  let negate = false;
  let rest = raw;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  if (dot < 0) return { op: "eq", value: rest, negate };
  return { op: rest.slice(0, dot), value: rest.slice(dot + 1), negate };
}

function toLike(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`);
}

function compare(rowVal, op, value) {
  switch (op) {
    case "is": {
      const v = value.toLowerCase();
      if (v === "null") return rowVal == null;
      if (v === "true") return rowVal === true;
      if (v === "false") return rowVal === false;
      if (v === "unknown") return rowVal == null;
      return false;
    }
    case "eq":
      if (rowVal == null) return false;
      if (typeof rowVal === "boolean") return String(rowVal) === value.toLowerCase();
      if (typeof rowVal === "number") return Number(value) === rowVal;
      return String(rowVal) === value;
    case "neq":
      if (rowVal == null) return false;
      return !compare(rowVal, "eq", value);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (rowVal == null) return false;
      let a = rowVal;
      let b = value;
      if (typeof rowVal === "number" || (/^-?\d+(\.\d+)?$/.test(value) && /^-?\d+(\.\d+)?$/.test(String(rowVal)))) {
        a = Number(rowVal);
        b = Number(value);
      } else {
        a = String(rowVal);
        b = String(value);
      }
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
    case "in": {
      if (rowVal == null) return false;
      const list = parseValueList(value);
      return list.some((v) => compare(rowVal, "eq", v));
    }
    case "like":
      return rowVal != null && toLike(value).test(String(rowVal));
    case "ilike":
      return rowVal != null && new RegExp(toLike(value).source, "i").test(String(rowVal));
    case "cs": {
      // contains (arrays/jsonb) — suporte mínimo
      if (Array.isArray(rowVal)) return parseValueList(value.replace(/^\{|\}$/g, "")).every((v) => rowVal.map(String).includes(v));
      return false;
    }
    default:
      console.warn(`[mock] operador não suportado: ${op}`);
      return true;
  }
}

/** Avalia um filtro `col.op.value` (formato usado em or=(...)) contra uma linha. */
function evalLogicTerm(row, term) {
  const m = /^(and|or)\((.*)\)$/.exec(term);
  if (m) {
    const parts = splitTop(m[2]);
    return m[1] === "and" ? parts.every((p) => evalLogicTerm(row, p)) : parts.some((p) => evalLogicTerm(row, p));
  }
  const dot = term.indexOf(".");
  const col = term.slice(0, dot);
  const { op, value, negate } = parseOp(term.slice(dot + 1));
  const r = compare(row[col], op, value);
  return negate ? !r : r;
}

// ---------------------------------------------------------------------
// PostgREST — resolução de recursos embutidos
// ---------------------------------------------------------------------
function resolveEmbed(parentTable, parentRow, embed) {
  const child = embed.name;
  const parentFks = Object.entries(FK[parentTable] ?? {}).filter(([, ref]) => ref === child);
  const childFks = Object.entries(FK[child] ?? {}).filter(([, ref]) => ref === parentTable);
  const pk = PRIMARY_KEY[child] ?? "id";
  const parentPk = PRIMARY_KEY[parentTable] ?? "id";
  let toOneCol = null;
  let toManyCol = null;
  if (embed.hint) {
    if (parentFks.some(([c]) => c === embed.hint)) toOneCol = embed.hint;
    else if (childFks.some(([c]) => c === embed.hint)) toManyCol = embed.hint;
  }
  if (!toOneCol && !toManyCol) {
    if (parentFks.length) toOneCol = parentFks[0][0];
    else if (childFks.length) toManyCol = childFks[0][0];
  }
  const rows = db[child] ?? [];
  if (toOneCol) {
    const key = parentRow[toOneCol];
    return { kind: "one", rows: key == null ? [] : rows.filter((r) => r[pk] === key) };
  }
  if (toManyCol) {
    return { kind: "many", rows: rows.filter((r) => r[toManyCol] === parentRow[parentPk]) };
  }
  console.warn(`[mock] sem FK conhecida entre ${parentTable} e ${child}`);
  return { kind: "many", rows: [] };
}

/** Projeta a linha conforme o select (recursivo), aplicando filtros em caminhos embutidos. Retorna null se !inner falhar. */
function project(table, row, select, embedFilters, path = "") {
  const out = {};
  for (const item of select) {
    if (item.kind === "col") {
      if (item.name === "*") Object.assign(out, formatRow(table, row));
      else out[item.alias] = formatValue(table, item.name, row[item.name]);
      continue;
    }
    const childPath = path ? `${path}.${item.alias}` : item.alias;
    const childPathByName = path ? `${path}.${item.name}` : item.name;
    const { kind, rows } = resolveEmbed(table, row, item);
    const filters = [...(embedFilters.get(childPath) ?? []), ...(childPath !== childPathByName ? embedFilters.get(childPathByName) ?? [] : [])];
    let matched = rows.filter((r) => filters.every((f) => evalFilter(r, f)));
    const projected = matched.map((r) => project(item.name, r, item.children, embedFilters, childPath)).filter((r) => r != null);
    if (item.inner && projected.length === 0) return null;
    out[item.alias] = kind === "one" ? (projected[0] ?? null) : projected;
  }
  return out;
}

function evalFilter(row, f) {
  if (f.logic) return evalLogicTerm(row, f.logic);
  const r = compare(row[f.col], f.op, f.value);
  return f.negate ? !r : r;
}

function formatValue(table, col, v) {
  if (typeof v === "number" && NUMERIC_COLS[col] != null && Number.isFinite(v)) return v.toFixed(NUMERIC_COLS[col]);
  return v === undefined ? null : v;
}
function formatRow(table, row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = formatValue(table, k, v);
  return out;
}

function applyOrder(rows, orderParam) {
  if (!orderParam) return rows;
  const keys = orderParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [col, ...mods] = s.split(".");
      const desc = mods.includes("desc");
      const nullsFirst = mods.includes("nullsfirst") ? true : mods.includes("nullslast") ? false : desc; // padrão PG
      return { col, desc, nullsFirst };
    });
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const va = a[k.col];
      const vb = b[k.col];
      if (va == null && vb == null) continue;
      if (va == null) return k.nullsFirst ? -1 : 1;
      if (vb == null) return k.nullsFirst ? 1 : -1;
      let c = 0;
      if (typeof va === "number" && typeof vb === "number") c = va - vb;
      else if (typeof va === "boolean" && typeof vb === "boolean") c = Number(va) - Number(vb);
      else c = String(va).localeCompare(String(vb));
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function parseQuery(url) {
  const filters = []; // nível superior
  const embedFilters = new Map(); // caminho → filtros
  for (const [key, raw] of url.searchParams.entries()) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and") {
      filters.push({ logic: `${key}${raw}` });
      continue;
    }
    if (key.includes(".")) {
      const idx = key.lastIndexOf(".");
      const path = key.slice(0, idx);
      const col = key.slice(idx + 1);
      if (col === "or" || col === "and") {
        embedFilters.set(path, [...(embedFilters.get(path) ?? []), { logic: `${col}${raw}` }]);
      } else {
        embedFilters.set(path, [...(embedFilters.get(path) ?? []), { col, ...parseOp(raw) }]);
      }
      continue;
    }
    filters.push({ col: key, ...parseOp(raw) });
  }
  return { filters, embedFilters, select: parseSelect(url.searchParams.get("select")), order: url.searchParams.get("order"), limit: url.searchParams.get("limit"), offset: url.searchParams.get("offset") };
}

/** Linhas da tabela que passam nos filtros de nível superior e nos filtros !inner. */
function selectRows(table, q) {
  const rows = (db[table] ?? []).filter((r) => q.filters.every((f) => evalFilter(r, f)));
  return rows;
}

function projectAll(table, rows, q) {
  let out = rows.map((r) => ({ src: r, row: project(table, r, q.select, q.embedFilters) })).filter((x) => x.row != null);
  const ordered = applyOrder(
    out.map((x) => x.src),
    q.order,
  );
  const byRef = new Map(out.map((x) => [x.src, x.row]));
  let result = ordered.map((r) => byRef.get(r));
  const offset = q.offset ? Number(q.offset) : 0;
  if (offset) result = result.slice(offset);
  if (q.limit != null && q.limit !== "") result = result.slice(0, Number(q.limit));
  return result;
}

// ---------------------------------------------------------------------
// PostgREST — mutações
// ---------------------------------------------------------------------
function nowIso() {
  return new Date().toISOString();
}
function applyInsertDefaults(table, row) {
  const pk = PRIMARY_KEY[table] ?? "id";
  const out = { ...(TABLE_DEFAULTS[table] ?? {}), ...row };
  if (pk === "id" && out.id == null) out.id = randomUUID();
  for (const c of TIMESTAMP_COLS[table] ?? []) if (out[c] == null) out[c] = nowIso();
  return out;
}
function afterInsert(table, row) {
  if (table === "nutri_item_bank") {
    db.nutri_item_versions.push({ id: randomUUID(), bank_item_id: row.id, versao: row.versao ?? 1, descricao: row.descricao, created_at: nowIso() });
  }
}
function beforeUpdate(table, row, patch) {
  if (table === "nutri_item_bank" && patch.descricao != null && patch.descricao !== row.descricao) {
    patch.versao = (row.versao ?? 1) + 1;
    db.nutri_item_versions.push({ id: randomUUID(), bank_item_id: row.id, versao: patch.versao, descricao: patch.descricao, created_at: nowIso() });
  }
  if ((TIMESTAMP_COLS[table] ?? []).includes("updated_at") && patch.updated_at == null) patch.updated_at = nowIso();
}
function cascadeDelete(table, row) {
  // on delete cascade das FKs principais
  const pk = PRIMARY_KEY[table] ?? "id";
  for (const [child, fks] of Object.entries(FK)) {
    for (const [col, ref] of Object.entries(fks)) {
      if (ref !== table) continue;
      const cascade = ["audit_answers", "audit_photos", "audit_pending_reviews", "template_blocks", "template_items", "nutri_item_versions", "unit_nutri_checklist", "pending_issues"].includes(child);
      const rows = db[child] ?? [];
      if (cascade && !(child === "pending_issues" && col !== "origem_audit_id")) {
        const victims = rows.filter((r) => r[col] === row[pk]);
        db[child] = rows.filter((r) => r[col] !== row[pk]);
        for (const v of victims) cascadeDelete(child, v);
      } else if (child === "schedule_days" && col === "audit_id") {
        for (const r of rows) if (r[col] === row[pk]) r[col] = null;
      }
    }
  }
}

function uniqueViolation(table, row, ignoreRow) {
  const uniques = {
    audits: [["unit_id", "tipo", "data"]],
    audit_pending_reviews: [["audit_id", "pending_issue_id"]],
    schedule_days: [["data", "auditor_id"]],
    unit_nutri_checklist: [["unit_id", "bank_item_id", "area"]],
    monthly_closings: [["mes", "unit_id"]],
    external_indicators: [["mes", "unit_id"]],
    push_subscriptions: [["endpoint"]],
    notifications_log: [["user_id", "chave_dedup"]],
    units: [["nome"], ["slug"]],
    profiles: [["email"]],
    template_blocks: [["template_id", "chave"]],
    template_items: [["block_id", "chave"]],
    auditor_days_off: [["data", "auditor_id"]],
  };
  const pk = PRIMARY_KEY[table] ?? "id";
  const rows = db[table] ?? [];
  if (rows.some((r) => r !== ignoreRow && r[pk] === row[pk])) return `duplicate key value violates unique constraint "${table}_pkey"`;
  for (const cols of uniques[table] ?? []) {
    if (cols.some((c) => row[c] == null)) continue;
    if (rows.some((r) => r !== ignoreRow && cols.every((c) => r[c] === row[c]))) return `duplicate key value violates unique constraint "${table}_${cols.join("_")}_key"`;
  }
  // índices parciais de audit_answers
  if (table === "audit_answers") {
    if (row.item_id != null && rows.some((r) => r !== ignoreRow && r.audit_id === row.audit_id && r.item_id === row.item_id)) return 'duplicate key value violates unique constraint "audit_answers_item_uidx"';
    if (row.nutri_entry_id != null && rows.some((r) => r !== ignoreRow && r.audit_id === row.audit_id && r.nutri_entry_id === row.nutri_entry_id)) return 'duplicate key value violates unique constraint "audit_answers_nutri_uidx"';
  }
  return null;
}

async function handleRest(req, res, url) {
  const table = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\/?/, "").split("/")[0]);
  const prefer = String(req.headers.prefer ?? "");
  const accept = String(req.headers.accept ?? "");
  const wantsObject = accept.includes("application/vnd.pgrst.object+json");
  const wantsRepresentation = prefer.includes("return=representation");
  const wantsCount = /count=(exact|planned|estimated)/.test(prefer);

  if (table === "_reset") {
    const ids = reload();
    return send(res, 200, { ok: true, reloaded: true, today: ids.today });
  }
  if (table === "_ids") return send(res, 200, fixtureIds);
  if (table === "" || table === "_health") return send(res, 200, { ok: true, tables: Object.keys(db) });

  if (!(table in db)) {
    console.warn(`[mock] tabela desconhecida: ${table}`);
    if (req.method === "GET" || req.method === "HEAD") return send(res, 200, wantsObject ? null : [], { "Content-Range": "*/0" });
    db[table] = [];
  }

  const q = parseQuery(url);

  const finish = (rows, status) => {
    if (wantsObject) {
      if (rows.length !== 1) {
        return send(res, 406, {
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        });
      }
      return send(res, status, rows[0], { "Content-Range": "0-0/1" });
    }
    const total = rows.length;
    const range = total ? `0-${total - 1}/${wantsCount ? total : "*"}` : `*/${wantsCount ? 0 : "*"}`;
    return send(res, status, rows, { "Content-Range": range });
  };

  if (req.method === "GET" || req.method === "HEAD") {
    const rows = projectAll(table, selectRows(table, q), q);
    if (req.method === "HEAD") {
      const total = rows.length;
      res.setHeader("Content-Range", total ? `0-${total - 1}/${total}` : "*/0");
      return send(res, 200, null);
    }
    return finish(rows, 200);
  }

  const body = parseJson(await readBody(req));

  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : body ? [body] : [];
    const upsert = prefer.includes("resolution=merge-duplicates") || prefer.includes("resolution=ignore-duplicates");
    const ignoreDup = prefer.includes("resolution=ignore-duplicates");
    const conflictCols = (url.searchParams.get("on_conflict") ?? PRIMARY_KEY[table] ?? "id").split(",").map((s) => s.trim());
    const result = [];
    for (const r of rows) {
      const row = applyInsertDefaults(table, r);
      const existing = upsert ? (db[table] ?? []).find((x) => conflictCols.every((c) => row[c] != null && x[c] === row[c])) : null;
      if (existing) {
        if (ignoreDup) {
          result.push(existing);
          continue;
        }
        const patch = { ...r };
        delete patch.id;
        beforeUpdate(table, existing, patch);
        Object.assign(existing, patch);
        result.push(existing);
        continue;
      }
      const dup = uniqueViolation(table, row, null);
      if (dup) return send(res, 409, { code: "23505", details: dup, hint: null, message: dup });
      db[table].push(row);
      afterInsert(table, row);
      result.push(row);
    }
    if (!wantsRepresentation) return send(res, 201, null, { "Content-Range": `*/${result.length}` });
    return finish(projectAll(table, result, { ...q, filters: [], order: null, limit: null, offset: null }), 201);
  }

  if (req.method === "PATCH") {
    const targets = selectRows(table, q);
    const patch = body ?? {};
    for (const row of targets) {
      const p = { ...patch };
      delete p[PRIMARY_KEY[table] ?? "id"];
      const merged = { ...row, ...p };
      const dup = uniqueViolation(table, merged, row);
      if (dup) return send(res, 409, { code: "23505", details: dup, hint: null, message: dup });
      beforeUpdate(table, row, p);
      Object.assign(row, p);
    }
    if (!wantsRepresentation) return send(res, 204, null, { "Content-Range": `*/${targets.length}` });
    return finish(projectAll(table, targets, { ...q, filters: [], order: q.order, limit: null, offset: null }), 200);
  }

  if (req.method === "DELETE") {
    const targets = selectRows(table, q);
    const set = new Set(targets);
    db[table] = db[table].filter((r) => !set.has(r));
    for (const r of targets) cascadeDelete(table, r);
    if (!wantsRepresentation) return send(res, 204, null, { "Content-Range": `*/${targets.length}` });
    return finish(projectAll(table, targets, { ...q, filters: [], order: null, limit: null, offset: null }), 200);
  }

  return send(res, 405, { code: "405", message: `método não suportado: ${req.method}` });
}

// ---------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------
let placeholderPng = null;
function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** PNG 400x300: fundo âmbar da marca com uma faixa diagonal escura e uma "moldura" (parece uma foto de auditoria). */
function getPlaceholderPng() {
  if (placeholderPng) return placeholderPng;
  const w = 400;
  const h = 300;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      const border = x < 12 || y < 12 || x >= w - 12 || y >= h - 12;
      const band = Math.abs(x - y * (w / h) - 40) < 28;
      const grid = (x % 40 < 2 || y % 40 < 2) && !border;
      let r = 213, g = 146, b = 3; // #D59203
      if (border) [r, g, b] = [30, 30, 30];
      else if (band) [r, g, b] = [52, 52, 52];
      else if (grid) [r, g, b] = [236, 178, 44];
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  placeholderPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
  return placeholderPng;
}

async function handleStorage(req, res, url) {
  const path = url.pathname.replace(/^\/storage\/v1/, "");
  const parts = path.split("/").filter(Boolean); // ["object", ...]
  if (parts[0] !== "object") {
    if (parts[0] === "bucket") return send(res, 200, [{ id: "audit-photos", name: "audit-photos", public: false }, { id: "reports", name: "reports", public: false }]);
    return send(res, 404, { statusCode: "404", error: "not_found", message: `rota de storage não emulada: ${path}` });
  }
  const sub = parts[1];

  // URLs assinadas
  if (sub === "sign" && req.method === "POST") {
    const bucket = parts[2];
    const objectPath = parts.slice(3).map(decodeURIComponent).join("/");
    const body = parseJson(await readBody(req)) ?? {};
    const token = "mock";
    if (!objectPath) {
      const paths = Array.isArray(body.paths) ? body.paths : [];
      return send(
        res,
        200,
        paths.map((p) => ({ error: null, path: p, signedURL: `/object/sign/${bucket}/${p}?token=${token}`, signedUrl: `http://${HOST}:${PORT}/storage/v1/object/sign/${bucket}/${p}?token=${token}` })),
      );
    }
    return send(res, 200, { signedURL: `/object/sign/${bucket}/${objectPath}?token=${token}` });
  }

  // download (assinado, público ou autenticado) → imagem placeholder
  if (req.method === "GET" || req.method === "HEAD") {
    const isPdf = path.endsWith(".pdf");
    if (isPdf) {
      const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
      return send(res, 200, req.method === "HEAD" ? null : pdf, { "Content-Type": "application/pdf", "Cache-Control": "no-store" });
    }
    const png = getPlaceholderPng();
    return send(res, 200, req.method === "HEAD" ? null : png, { "Content-Type": "image/png", "Content-Length": String(png.length), "Cache-Control": "public, max-age=60" });
  }

  // upload
  if (req.method === "POST" || req.method === "PUT") {
    const bucket = parts[1];
    const objectPath = parts.slice(2).map(decodeURIComponent).join("/");
    await readBody(req);
    return send(res, 200, { Key: `${bucket}/${objectPath}`, Id: randomUUID() });
  }

  // remoção
  if (req.method === "DELETE") {
    const body = parseJson(await readBody(req)) ?? {};
    const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
    return send(res, 200, prefixes.map((p) => ({ bucket_id: parts[1], name: p })));
  }
  return send(res, 405, { statusCode: "405", error: "method_not_allowed", message: req.method });
}

// ---------------------------------------------------------------------
// servidor
// ---------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  cors(req, res);
  const label = url.pathname.startsWith("/rest/v1/") ? url.pathname.slice(9).split("/")[0] : url.pathname;
  res.on("finish", () => {
    console.log(`[mock] ${req.method.padEnd(6)} ${label.padEnd(26)} ${res.statusCode} ${Date.now() - started}ms${url.search && url.pathname.startsWith("/rest") ? "  " + decodeURIComponent(url.search).slice(0, 140) : ""}`);
  });
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);
    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url);
    if (url.pathname.startsWith("/rest/v1")) return await handleRest(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await handleStorage(req, res, url);
    if (url.pathname === "/" || url.pathname === "/health") return send(res, 200, { ok: true, service: "mock-supabase", today: fixtureIds.today });
    return send(res, 404, { message: `não emulado: ${req.method} ${url.pathname}` });
  } catch (e) {
    console.error("[mock] erro", e);
    return send(res, 500, { code: "MOCK500", message: e?.message ?? String(e), details: null, hint: null });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[mock] Supabase mock em http://${HOST}:${PORT}  (hoje SP = ${fixtureIds.today})`);
  console.log(`[mock] usuários: ${Object.values(USERS).map((u) => `${u.email} (${u.role})`).join(", ")} — qualquer senha`);
  console.log(`[mock] ids das fixtures: GET /rest/v1/_ids · recarregar: GET /rest/v1/_reset`);
});
