import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Salva/remove a subscription de push do usuário logado. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const sub = (await req.json()) as { endpoint?: string };
  if (!sub?.endpoint) return NextResponse.json({ error: "subscription inválida" }, { status: 400 });
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: sub.endpoint, subscription: sub, user_agent: req.headers.get("user-agent") }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
