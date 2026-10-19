import { NextResponse } from "next/server";
import { getMonthOverview } from "@/lib/data/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Integração com o DA RUA RH: nota NUTRICIONAL do mês de cada unidade, para
 * o fechamento da caixinha (o 2º ponto de cada funcionário depende da nota
 * da loja dele). Só leitura.
 *
 * POST { ano, mes } com o cabeçalho `x-token: ${INTEGRACAO_RH_TOKEN}`.
 * Mês fechado no ROTA → nota congelada em monthly_closings; mês aberto → a
 * parcial calculada do mesmo jeito que o painel (média das auditorias
 * nutricionais concluídas no mês). O RH mapeia unidade → loja pelo nome/slug.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-token",
};
const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const token = clean(process.env.INTEGRACAO_RH_TOKEN);
  if (!token)
    return NextResponse.json({ ok: false, erro: "INTEGRACAO_RH_TOKEN não configurado na Vercel do ROTA." }, { status: 500, headers: CORS });
  if (clean(req.headers.get("x-token")) !== token)
    return NextResponse.json({ ok: false, erro: "Token inválido." }, { status: 401, headers: CORS });

  let body: { ano?: number; mes?: number } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const ano = Number(body?.ano);
  const mes = Number(body?.mes);
  if (!ano || !mes || mes < 1 || mes > 12)
    return NextResponse.json({ ok: false, erro: "Informe ano e mes." }, { status: 400, headers: CORS });

  try {
    const ov = await getMonthOverview(createAdminClient(), `${ano}-${String(mes).padStart(2, "0")}-01`);
    const unidades = ov.units.map((um) => {
      const fechada = um.closing?.nota_nutricional ?? null;
      return {
        nome: um.unit.nome,
        slug: um.unit.slug,
        nota: fechada ?? um.nutri.nota,
        n_auditorias: um.closing?.n_auditorias_nutri ?? um.nutri.n,
        fechado: um.closing != null,
      };
    });
    return NextResponse.json({ ok: true, ano, mes, fechado: ov.closed, unidades }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500, headers: CORS });
  }
}
