/**
 * Leitura das variáveis do Supabase com fallback para os nomes criados pela
 * integração Supabase ↔ Vercel (SUPABASE_URL, *_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY…).
 * No navegador só as NEXT_PUBLIC_* existem (o Next as embute no bundle).
 */
export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!v) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)");
  return v;
}

export function supabaseAnonKey(): string {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("Configure NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
  return v;
}

export function supabaseServiceKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!v) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY)");
  return v;
}
