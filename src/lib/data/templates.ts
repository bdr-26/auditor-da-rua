import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditTemplate, AuditType, TemplateBlockWithItems, TemplateItem } from "../types";
import type { ScoringBlock } from "../domain/scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface TemplateWithBlocks extends AuditTemplate {
  blocks: TemplateBlockWithItems[];
}

/** Template ativo (versão mais recente) de um tipo, com blocos e itens ordenados. */
export async function getActiveTemplate(supabase: AnyClient, tipo: AuditType): Promise<TemplateWithBlocks | null> {
  const { data: t } = await supabase.from("audit_templates").select("*").eq("tipo", tipo).eq("ativo", true).order("versao", { ascending: false }).limit(1).maybeSingle();
  if (!t) return null;
  return getTemplateById(supabase, t.id as string);
}

export async function getTemplateById(supabase: AnyClient, id: string): Promise<TemplateWithBlocks | null> {
  const [{ data: t }, { data: blocks }] = await Promise.all([
    supabase.from("audit_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("template_blocks").select("*, template_items(*)").eq("template_id", id).order("ordem"),
  ]);
  if (!t) return null;
  const withItems: TemplateBlockWithItems[] = (blocks ?? []).map((b) => {
    const { template_items, ...rest } = b as typeof b & { template_items: TemplateItem[] };
    return {
      ...(rest as TemplateBlockWithItems),
      peso: Number(rest.peso),
      items: (template_items ?? []).filter((i) => i.ativo).sort((a, b) => a.ordem - b.ordem),
    };
  });
  return { ...(t as AuditTemplate), blocks: withItems };
}

/** Converte o template em blocos de pontuação (lib/domain/scoring). */
export function toScoringBlocks(t: TemplateWithBlocks): ScoringBlock[] {
  return t.blocks.map((b) => ({
    chave: b.chave,
    nome: b.nome,
    peso: Number(b.peso),
    ordem: b.ordem,
    items: b.items.map((i) => ({
      id: i.id,
      chave: i.chave,
      descricao: i.descricao,
      falha_grave: i.falha_grave,
      produto_vencido: i.produto_vencido,
      pendencias: i.pendencias,
      bloco_ref: i.bloco_ref,
      ordem: i.ordem,
    })),
  }));
}
