// Regera src/lib/reports/brand-logo.ts a partir de public/brand/darua-food-inc.png.
import { readFileSync, writeFileSync } from "node:fs";
const b64 = readFileSync("public/brand/darua-food-inc.png").toString("base64");
writeFileSync(
  "src/lib/reports/brand-logo.ts",
  `// Logo DA RUA FOOD INC (public/brand/darua-food-inc.png) embutido em base64: o PDF não depende do\n// sistema de arquivos do servidor (na Vercel os arquivos de public/ não vão junto com a função).\n// Regerar com: node scripts/embed-logo.mjs\nexport const BRAND_LOGO_DATA_URI = "data:image/png;base64,${b64}";\nexport const BRAND_LOGO_RATIO = 1858 / 986;\n`,
);
console.log("ok", b64.length);
