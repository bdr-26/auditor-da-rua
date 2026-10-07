"use server";

import { revalidatePath } from "next/cache";
import { canManageAudit, requireProfile } from "./auth";
import { createAdminClient } from "./supabase/admin";

export type SignResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): SignResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function signaturePath(auditId: string): string {
  return `assinaturas/${auditId}.png`;
}

/**
 * Registra a aprovação do supervisor da unidade numa auditoria concluída: nome, CPF, cargo e a
 * assinatura desenhada na tela (PNG). Quem registra: o auditor da visita, a nutricionista chefe
 * (nutricionais) ou o proprietário. Grava via service_role (auditoria concluída é imutável para o resto).
 */
export async function signAudit(auditId: string, input: { nome: string; cpf: string; cargo: string; pngDataUrl: string }): Promise<SignResult> {
  try {
    const profile = await requireProfile();
    const admin = createAdminClient();
    const { data: audit } = await admin.from("audits").select("id, auditor_id, tipo, status, unit_id").eq("id", auditId).maybeSingle();
    if (!audit) throw new Error("Auditoria não encontrada.");
    if (!canManageAudit(profile, audit)) throw new Error("Sem permissão para registrar a assinatura nesta auditoria.");
    if (audit.status !== "concluida") throw new Error("Conclua a auditoria antes de colher a assinatura.");

    const nome = input.nome.trim();
    const cargo = input.cargo.trim() || "Supervisor(a)";
    const cpf = input.cpf.replace(/\D/g, "");
    if (nome.length < 3) throw new Error("Informe o nome de quem assina.");
    if (cpf.length !== 11) throw new Error("CPF deve ter 11 dígitos.");
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.pngDataUrl);
    if (!m) throw new Error("Assinatura inválida: desenhe no quadro antes de confirmar.");
    const png = Buffer.from(m[1], "base64");
    if (png.length < 200) throw new Error("Assinatura vazia: desenhe no quadro antes de confirmar.");
    if (png.length > 2_000_000) throw new Error("Assinatura muito grande.");

    const path = signaturePath(auditId);
    const { error: upErr } = await admin.storage.from("audit-photos").upload(path, png, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;
    const { error } = await admin
      .from("audits")
      .update({ assinatura_nome: nome, assinatura_cpf: cpf, assinatura_cargo: cargo, assinatura_path: path, assinada_em: new Date().toISOString(), assinatura_registrada_por: profile.id })
      .eq("id", auditId);
    if (error) throw error;

    revalidatePath(`/auditorias/${auditId}/resumo`);
    revalidatePath(`/nutri/auditorias/${auditId}/resumo`);
    revalidatePath(`/dashboard/lojas/${audit.unit_id}`);
    return { ok: true, message: "Assinatura registrada." };
  } catch (e) {
    return fail(e);
  }
}
