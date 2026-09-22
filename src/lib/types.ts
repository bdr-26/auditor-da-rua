// Tipos de domínio espelhando o esquema Postgres (supabase/migrations/0001_schema.sql)

export type UserRole = "auditor_geral" | "auditor_nutricao" | "proprietario";
export type UnitKind = "loja" | "producao";
export type AuditType = "completa" | "simplificada" | "producao" | "nutricional";
export type AuditStatus = "rascunho" | "concluida";
export type ScheduleStatus = "prevista" | "concluida" | "nao_cumprida";
export type PendingStatus = "aberta" | "resolvida";
export type NutriAnswer = "conforme" | "nao_conforme" | "na";
export type NutriItemStatus = "ativo" | "pausado";
export type Score = 1 | 2 | 3 | 4 | 5;

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  nome: string;
  slug: string;
  tipo: UnitKind;
  ativa: boolean;
  entra_no_ranking: boolean;
  ordem_rotacao: number;
  endereco: string | null;
  supervisor_nome: string | null;
  nutri_checklist_em_revisao: boolean;
  created_at: string;
}

export interface AuditTemplate {
  id: string;
  tipo: AuditType;
  versao: number;
  nome: string;
  ativo: boolean;
}

export interface TemplateBlock {
  id: string;
  template_id: string;
  chave: string;
  nome: string;
  peso: number;
  ordem: number;
}

export interface TemplateItem {
  id: string;
  block_id: string;
  chave: string;
  descricao: string;
  falha_grave: boolean;
  produto_vencido: boolean;
  pendencias: boolean;
  bloco_ref: string | null;
  ordem: number;
  ativo: boolean;
}

export interface TemplateBlockWithItems extends TemplateBlock {
  items: TemplateItem[];
}

export interface BlockScore {
  chave: string;
  nome: string;
  peso: number;
  nota: number | null; // 0..100, null quando nenhum item aplicável
  zerado: boolean; // zerado por falha grave
  itens_respondidos: number;
  itens_aplicaveis: number;
}

export interface Audit {
  id: string;
  unit_id: string;
  auditor_id: string;
  template_id: string | null;
  tipo: AuditType;
  data: string; // YYYY-MM-DD
  status: AuditStatus;
  nota_final: number | null;
  notas_blocos: BlockScore[] | null;
  falha_grave: boolean;
  produto_vencido: boolean;
  classificacao: string | null;
  etapa_atual: number;
  iniciada_em: string;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditAnswer {
  id: string;
  audit_id: string;
  item_id: string | null;
  nutri_entry_id: string | null;
  nutri_item_id: string | null;
  nutri_item_version_id: string | null;
  nutri_area: string | null;
  nutri_peso: number | null;
  nota: Score | null;
  resposta: NutriAnswer | null;
  na: boolean;
  produto_vencido: boolean;
  observacao: string | null;
  updated_at: string;
}

export interface AuditPhoto {
  id: string;
  answer_id: string;
  storage_path: string;
  created_at: string;
}

export interface PendingIssue {
  id: string;
  unit_id: string;
  item_id: string | null;
  nutri_entry_id: string | null;
  nutri_item_id: string | null;
  descricao: string;
  nota_origem: number | null;
  observacao_origem: string | null;
  origem_audit_id: string;
  status: PendingStatus;
  resolvida_em_audit_id: string | null;
  resolvida_em: string | null;
  visitas_sem_resolver: number;
  reincidente: boolean;
  reincidente_notificado_em: string | null;
  created_at: string;
}

export interface AuditPendingReview {
  id: string;
  audit_id: string;
  pending_issue_id: string;
  resolvida: boolean | null;
  observacao: string | null;
  updated_at: string;
}

export interface ScheduleDay {
  id: string;
  data: string;
  unit_id: string;
  tipo: AuditType;
  status: ScheduleStatus;
  auditor_id: string | null;
  audit_id: string | null;
  unit_original_id: string | null;
  trocado_por: string | null;
  trocado_em: string | null;
  motivo_troca: string | null;
  created_at: string;
}

export type DemandaStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";
export type DemandaPrioridade = "normal" | "alta";

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  prioridade: DemandaPrioridade;
  status: DemandaStatus;
  unit_id: string | null;
  responsavel_id: string;
  criado_por: string;
  conclusao_texto: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandaComentario {
  id: string;
  demanda_id: string;
  user_id: string;
  texto: string;
  status_novo: DemandaStatus | null;
  created_at: string;
}

export interface DemandaAnexo {
  id: string;
  demanda_id: string;
  storage_path: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
  user_id: string;
  created_at: string;
}

export interface AuditorDayOff {
  id: string;
  data: string;
  auditor_id: string | null;
  motivo: string;
  criado_por: string | null;
  created_at: string;
}

export interface NutriBankItem {
  id: string;
  descricao: string;
  versao: number;
  area_padrao: string;
  peso: number;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutriItemVersion {
  id: string;
  bank_item_id: string;
  versao: number;
  descricao: string;
  created_at: string;
}

export interface UnitNutriChecklistEntry {
  id: string;
  unit_id: string;
  bank_item_id: string;
  area: string;
  area_ordem: number;
  ordem: number;
  status: NutriItemStatus;
  created_at: string;
}

export interface MonthlyClosing {
  id: string;
  mes: string;
  unit_id: string;
  nota_operacional: number | null;
  nota_nutricional: number | null;
  nota_seguranca: number | null;
  notas_blocos: BlockScore[] | null;
  n_auditorias: number;
  n_auditorias_nutri: number;
  falhas_graves: number;
  amostra_reduzida: boolean;
  inelegivel_produto_vencido: boolean;
  posicao_ranking: number | null;
  elegivel: boolean;
  premiada: boolean;
  empate: boolean;
  fechado_por: string | null;
  fechado_em: string;
}

export interface OwnerAdjustment {
  id: string;
  closing_id: string | null;
  audit_id: string;
  answer_id: string;
  criterio: string;
  valor_original: number | null;
  valor_novo: number | null;
  justificativa: string;
  user_id: string;
  created_at: string;
}

export interface ExternalIndicator {
  id: string;
  mes: string;
  unit_id: string;
  nota_99food: number | null;
  cancelamentos: number | null;
  tempo_medio_entrega: number | null;
  lancado_por: string | null;
  updated_at: string;
}

export interface Report {
  id: string;
  mes: string;
  unit_id: string | null;
  tipo: "loja" | "consolidado";
  storage_path: string;
  gerado_por: string | null;
  gerado_em: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: unknown;
  user_agent: string | null;
  created_at: string;
}

export interface AppSetting {
  chave: string;
  valor: unknown;
  descricao: string | null;
  updated_at: string;
}
