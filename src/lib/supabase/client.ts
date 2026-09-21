"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente Supabase para o navegador (usa RLS com a sessão do usuário). */
export function createClient() {
  if (client) return client;
  client = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return client;
}
