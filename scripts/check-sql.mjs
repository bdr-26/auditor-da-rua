// Valida a sintaxe de todas as migrations com o parser real do Postgres (libpg_query).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "pgsql-parser";

const dir = "supabase/migrations";
let failed = false;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(dir, f), "utf8");
  try {
    const ast = await parse(sql);
    const n = Array.isArray(ast) ? ast.length : ast?.stmts?.length ?? "?";
    console.log(`OK  ${f} (${n} statements)`);
  } catch (e) {
    failed = true;
    console.error(`ERR ${f}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
