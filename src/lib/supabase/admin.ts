import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./env";

/**
 * Cliente com service_role — ignora RLS. Usar SOMENTE em server actions / route handlers
 * depois de validar a identidade e o papel do usuário (ver lib/auth.ts).
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
