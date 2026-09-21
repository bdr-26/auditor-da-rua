import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audit, AuditPendingReview, NutriAnswer, NutriBankItem, NutriItemStatus, NutriItemVersion, PendingIssue, Unit, UnitNutriChecklistEntry } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

function normalizeAudit(a: Record<string, unknown>): Audit {
  return { ...(a as unknown as Audit), nota_final: a.nota_final == null ? null : Number(a.nota_final) };
}

// ---------------------------------------------------------------------
// Auditorias nutricionais (listas)
// ---------------------------------------------------------------------

export interface NutriAuditFilter {
  auditorId?: string;
  unitId?: string;
  status?: "rascunho" | "concluida";
  limit?: number;
}

/** Auditorias nutricionais, mais recentes primeiro (RLS: a nutricionista vê as próprias; proprietário vê todas). */
export async function getNutriAudits(supabase: AnyClient, f: NutriAuditFilter = {}): Promise<Audit[]> {
  let q = supabase.from("audits").select("*").eq("tipo", "nutricional").order("data", { ascending: false }).order("created_at", { ascending: false });
  if (f.auditorId) q = q.eq("auditor_id", f.auditorId);
  if (f.unitId) q = q.eq("unit_id", f.unitId);
  if (f.status) q = q.eq("status", f.status);
  if (f.limit) q = q.limit(f.limit);
  const { data } = await q;
  return (data ?? []).map(normalizeAudit);
}

/** Última auditoria nutricional concluída de cada unidade. */
export async function getLastNutriAuditByUnit(supabase: AnyClient): Promise<Map<string, Audit>> {
  const { data } = await supabase.from("audits").select("*").eq("tipo", "nutricional").eq("status", "concluida").order("data", { ascending: false });
  const map = new Map<string, Audit>();
  for (const row of data ?? []) {
    const a = normalizeAudit(row);
    if (!map.has(a.unit_id)) map.set(a.unit_id, a);
  }
  return map;
}

/** Auditoria nutricional existente para (unidade, data), se houver. */
export async function findNutriAudit(supabase: AnyClient, unitId: string, data: string): Promise<Audit | null> {
  const { data: row } = await supabase.from("audits").select("*").eq("unit_id", unitId).eq("tipo", "nutricional").eq("data", data).maybeSingle();
  return row ? normalizeAudit(row) : null;
}

// ---------------------------------------------------------------------
// Preenchimento / revisão / resumo
// ---------------------------------------------------------------------

export interface NutriFillPhoto {
  id: string;
  path: string;
}

export interface NutriFillAnswer {
  id: string;
  entry_id: string;
  item_id: string | null;
  version_id: string | null;
  area: string;
  area_ordem: number;
  ordem: number;
  peso: number;
  /** Texto do item na versão usada nesta auditoria (redação em negativo, como cadastrado). */
  descricao: string;
  resposta: NutriAnswer | null;
  observacao: string | null;
  photos: NutriFillPhoto[];
}

export interface NutriFillPending {
  review_id: string | null;
  pending_issue_id: string;
  resolvida: boolean | null;
  observacao: string | null;
  descricao: string;
  observacao_origem: string | null;
  visitas_sem_resolver: number;
  reincidente: boolean;
  origem_data: string | null;
}

export interface NutriArea {
  area: string;
  area_ordem: number;
  answers: NutriFillAnswer[];
}

export interface NutriFillData {
  audit: Audit;
  unit: Unit;
  answers: NutriFillAnswer[];
  areas: NutriArea[];
  pendings: NutriFillPending[];
  auditorNome: string;
}

/** Respostas da auditoria nutricional com o texto da versão do item e as fotos. */
export async function getNutriAnswers(supabase: AnyClient, auditId: string): Promise<NutriFillAnswer[]> {
  const { data } = await supabase
    .from("audit_answers")
    .select(
      "id, nutri_entry_id, nutri_item_id, nutri_item_version_id, nutri_area, nutri_peso, resposta, observacao, updated_at, nutri_item_versions(descricao), unit_nutri_checklist(area_ordem, ordem), audit_photos(id, storage_path, created_at)",
    )
    .eq("audit_id", auditId)
    .not("nutri_entry_id", "is", null);
  const rows = (data ?? []) as Array<{
    id: string;
    nutri_entry_id: string;
    nutri_item_id: string | null;
    nutri_item_version_id: string | null;
    nutri_area: string | null;
    nutri_peso: string | number | null;
    resposta: NutriAnswer | null;
    observacao: string | null;
    nutri_item_versions: { descricao: string } | { descricao: string }[] | null;
    unit_nutri_checklist: { area_ordem: number; ordem: number } | { area_ordem: number; ordem: number }[] | null;
    audit_photos: { id: string; storage_path: string; created_at: string }[] | null;
  }>;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const list = rows.map((r) => {
    const version = one(r.nutri_item_versions);
    const entry = one(r.unit_nutri_checklist);
    return {
      id: r.id,
      entry_id: r.nutri_entry_id,
      item_id: r.nutri_item_id,
      version_id: r.nutri_item_version_id,
      area: r.nutri_area ?? "Sem área",
      area_ordem: entry?.area_ordem ?? 9999,
      ordem: entry?.ordem ?? 9999,
      peso: r.nutri_peso == null ? 1 : Number(r.nutri_peso),
      descricao: version?.descricao ?? "(item sem texto)",
      resposta: r.resposta,
      observacao: r.observacao,
      photos: (r.audit_photos ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((p) => ({ id: p.id, path: p.storage_path })),
    } satisfies NutriFillAnswer;
  });
  return sortNutriAnswers(list);
}

export function sortNutriAnswers(list: NutriFillAnswer[]): NutriFillAnswer[] {
  return [...list].sort((a, b) => a.area_ordem - b.area_ordem || a.area.localeCompare(b.area) || a.ordem - b.ordem || a.descricao.localeCompare(b.descricao));
}

/** Agrupa as respostas por área (na ordem da composição no momento da auditoria). */
export function groupNutriAreas(answers: NutriFillAnswer[]): NutriArea[] {
  const map = new Map<string, NutriArea>();
  for (const a of sortNutriAnswers(answers)) {
    const g = map.get(a.area) ?? { area: a.area, area_ordem: a.area_ordem, answers: [] };
    g.area_ordem = Math.min(g.area_ordem, a.area_ordem);
    g.answers.push(a);
    map.set(a.area, g);
  }
  return Array.from(map.values()).sort((x, y) => x.area_ordem - y.area_ordem || x.area.localeCompare(y.area));
}

/** Avaliações das pendências (apontamentos da visita anterior) desta auditoria. */
export async function getNutriPendings(supabase: AnyClient, auditId: string): Promise<NutriFillPending[]> {
  const { data: reviews } = await supabase.from("audit_pending_reviews").select("*").eq("audit_id", auditId);
  const list = (reviews ?? []) as AuditPendingReview[];
  if (list.length === 0) return [];
  const ids = list.map((r) => r.pending_issue_id);
  const { data: issues } = await supabase.from("pending_issues").select("*").in("id", ids);
  const byId = new Map((issues ?? []).map((i) => [i.id as string, i as PendingIssue]));
  const origemIds = Array.from(new Set((issues ?? []).map((i) => i.origem_audit_id as string)));
  const { data: origens } = origemIds.length ? await supabase.from("audits").select("id, data").in("id", origemIds) : { data: [] };
  const origemData = new Map((origens ?? []).map((o) => [o.id as string, o.data as string]));
  return list
    .map((r): NutriFillPending | null => {
      const issue = byId.get(r.pending_issue_id);
      if (!issue) return null;
      return {
        review_id: r.id,
        pending_issue_id: r.pending_issue_id,
        resolvida: r.resolvida,
        observacao: r.observacao,
        descricao: issue.descricao,
        observacao_origem: issue.observacao_origem,
        visitas_sem_resolver: issue.visitas_sem_resolver,
        reincidente: issue.reincidente,
        origem_data: origemData.get(issue.origem_audit_id) ?? null,
      };
    })
    .filter((p): p is NutriFillPending => p != null)
    .sort((a, b) => (a.origem_data ?? "").localeCompare(b.origem_data ?? "") || a.descricao.localeCompare(b.descricao));
}

/** Tudo que o preenchimento, a revisão e o resumo de uma auditoria nutricional precisam. */
export async function getNutriFillData(supabase: AnyClient, auditId: string): Promise<NutriFillData | null> {
  const { data: a } = await supabase.from("audits").select("*").eq("id", auditId).eq("tipo", "nutricional").maybeSingle();
  if (!a) return null;
  const audit = normalizeAudit(a);
  const [{ data: unit }, answers, pendings, { data: auditor }] = await Promise.all([
    supabase.from("units").select("*").eq("id", audit.unit_id).maybeSingle(),
    getNutriAnswers(supabase, auditId),
    getNutriPendings(supabase, auditId),
    supabase.from("profiles").select("nome").eq("id", audit.auditor_id).maybeSingle(),
  ]);
  if (!unit) return null;
  return {
    audit,
    unit: unit as Unit,
    answers,
    areas: groupNutriAreas(answers),
    pendings,
    auditorNome: (auditor?.nome as string | undefined) ?? "Nutricionista",
  };
}

// ---------------------------------------------------------------------
// Banco de itens e composição por unidade
// ---------------------------------------------------------------------

export interface NutriBankItemWithUsage extends NutriBankItem {
  /** nº de unidades que têm o item na composição (qualquer status) */
  unidades: number;
  versions: NutriItemVersion[];
}

function normalizeBank(b: Record<string, unknown>): NutriBankItem {
  return { ...(b as unknown as NutriBankItem), peso: Number(b.peso), versao: Number(b.versao) };
}

/** Banco central de itens com uso por unidade e histórico de versões. */
export async function getNutriBank(supabase: AnyClient, opts: { ativos?: boolean } = {}): Promise<NutriBankItemWithUsage[]> {
  let q = supabase.from("nutri_item_bank").select("*, unit_nutri_checklist(unit_id)").order("area_padrao").order("descricao");
  if (opts.ativos) q = q.eq("ativo", true);
  const { data } = await q;
  const rows = (data ?? []) as Array<Record<string, unknown> & { unit_nutri_checklist: { unit_id: string }[] | null }>;
  const ids = rows.map((r) => r.id as string);
  const { data: versions } = ids.length
    ? await supabase.from("nutri_item_versions").select("*").in("bank_item_id", ids).order("versao", { ascending: false })
    : { data: [] };
  const byItem = new Map<string, NutriItemVersion[]>();
  for (const v of (versions ?? []) as NutriItemVersion[]) {
    const l = byItem.get(v.bank_item_id) ?? [];
    l.push({ ...v, versao: Number(v.versao) });
    byItem.set(v.bank_item_id, l);
  }
  return rows.map((r) => {
    const { unit_nutri_checklist, ...rest } = r;
    const item = normalizeBank(rest);
    return {
      ...item,
      unidades: new Set((unit_nutri_checklist ?? []).map((u) => u.unit_id)).size,
      versions: byItem.get(item.id) ?? [],
    };
  });
}

export interface CompositionEntry extends UnitNutriChecklistEntry {
  item: NutriBankItem;
}

export interface CompositionArea {
  area: string;
  area_ordem: number;
  entries: CompositionEntry[];
}

/** Composição do checklist de uma unidade (todas as entradas, ativas e pausadas), agrupada por área. */
export async function getUnitComposition(supabase: AnyClient, unitId: string): Promise<CompositionArea[]> {
  const { data } = await supabase
    .from("unit_nutri_checklist")
    .select("*, nutri_item_bank(*)")
    .eq("unit_id", unitId)
    .order("area_ordem")
    .order("ordem")
    .order("created_at");
  const rows = (data ?? []) as Array<Record<string, unknown> & { nutri_item_bank: Record<string, unknown> | null }>;
  const map = new Map<string, CompositionArea>();
  for (const r of rows) {
    const { nutri_item_bank, ...rest } = r;
    if (!nutri_item_bank) continue;
    const entry: CompositionEntry = {
      ...(rest as unknown as UnitNutriChecklistEntry),
      area_ordem: Number(rest.area_ordem),
      ordem: Number(rest.ordem),
      item: normalizeBank(nutri_item_bank),
    };
    const g = map.get(entry.area) ?? { area: entry.area, area_ordem: entry.area_ordem, entries: [] };
    g.area_ordem = Math.min(g.area_ordem, entry.area_ordem);
    g.entries.push(entry);
    map.set(entry.area, g);
  }
  return Array.from(map.values()).sort((a, b) => a.area_ordem - b.area_ordem || a.area.localeCompare(b.area));
}

export interface UnitCompositionStats {
  unit_id: string;
  ativos: number;
  pausados: number;
  areas: number;
}

/** Contagem de itens ativos/pausados por unidade. */
export async function getCompositionStats(supabase: AnyClient): Promise<Map<string, UnitCompositionStats>> {
  const { data } = await supabase.from("unit_nutri_checklist").select("unit_id, status, area");
  const map = new Map<string, UnitCompositionStats & { _areas: Set<string> }>();
  for (const r of (data ?? []) as { unit_id: string; status: NutriItemStatus; area: string }[]) {
    const s = map.get(r.unit_id) ?? { unit_id: r.unit_id, ativos: 0, pausados: 0, areas: 0, _areas: new Set<string>() };
    if (r.status === "ativo") s.ativos++;
    else s.pausados++;
    s._areas.add(r.area);
    map.set(r.unit_id, s);
  }
  const out = new Map<string, UnitCompositionStats>();
  for (const [k, v] of map) out.set(k, { unit_id: v.unit_id, ativos: v.ativos, pausados: v.pausados, areas: v._areas.size });
  return out;
}

/** Entradas ATIVAS da composição de uma unidade em ordem (usadas para pré-criar as respostas). */
export async function getActiveComposition(supabase: AnyClient, unitId: string): Promise<CompositionEntry[]> {
  const areas = await getUnitComposition(supabase, unitId);
  return areas.flatMap((a) => a.entries.filter((e) => e.status === "ativo"));
}
