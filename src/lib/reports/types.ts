// Dados "planos" que alimentam os documentos PDF. Montados por data.ts (a partir do Supabase)
// ou por scripts/render-report-sample.tsx (dados fictícios) — os componentes só renderizam.
import type { AuditType } from "../types";

export interface ReportBlockRow {
  chave: string;
  nome: string;
  nota: number | null; // 0..100
  nota_anterior: number | null;
  zerado: boolean;
}

export interface ReportItemStat {
  chave: string;
  descricao: string;
  media: number; // 1..5
  n: number; // respostas no mês
  ocorrencias: number; // respostas com nota <= 3
}

export interface ReportApontamento {
  data: string; // YYYY-MM-DD
  tipo: AuditType;
  item: string;
  nota: number; // 1..2
  falha_grave: boolean;
  observacao: string | null;
  fotos: string[]; // data URIs (jpeg/png)
}

export interface ReportNutriApontamento {
  data: string;
  area: string;
  item: string;
  observacao: string | null;
}

export interface ReportAuditRow {
  data: string;
  tipo: AuditType;
  nota: number | null;
  falha_grave: boolean;
  auditor: string;
}

export interface ReportFood99 {
  nota_99food: number | null;
  cancelamentos: number | null;
  tempo_medio_entrega: number | null;
}

export interface LojaReportData {
  mes: string; // YYYY-MM-01
  mesLabel: string; // "setembro de 2026"
  geradoEm: string; // "21/09/2026 18:30"
  oficial: boolean; // true = baseado no fechamento; false = prévia calculada na hora
  unidade: { id: string; nome: string; slug: string; tipo: "loja" | "producao"; supervisor_nome: string | null };
  nota: number | null;
  posicao: number | null;
  total_ranqueadas: number;
  fora_do_ranking: boolean;
  premiada: boolean;
  elegivel: boolean;
  empate: boolean;
  amostra_reduzida: boolean;
  produto_vencido: boolean;
  falhas_graves: number;
  n_auditorias: number;
  n_completas: number;
  n_simplificadas: number;
  anterior: { nota: number | null; posicao: number | null } | null;
  blocos: ReportBlockRow[];
  bons: ReportItemStat[];
  manter: ReportItemStat[];
  melhorar: ReportItemStat[];
  apontamentos: ReportApontamento[];
  auditorias: ReportAuditRow[];
  nutri: {
    nota: number | null;
    classificacao: string | null;
    n: number;
    anterior: number | null;
    apontamentos: ReportNutriApontamento[];
  } | null;
  food99: ReportFood99 | null;
}

export interface ReportRankingRow {
  posicao: number | null;
  nome: string;
  nota: number | null;
  nota_anterior: number | null;
  n_auditorias: number;
  falhas_graves: number;
  selos: string[]; // "Falha grave", "Inelegível", "Amostra reduzida"
  nota_nutricional: number | null;
  premiada: boolean;
  empate: boolean;
}

export interface ConsolidadoReportData {
  mes: string;
  mesLabel: string;
  geradoEm: string;
  oficial: boolean;
  ranking: ReportRankingRow[];
  premiadas: { nome: string; supervisor_nome: string | null }[]; // vazio = sem loja premiada
  premio_valor: number;
  producao: { nome: string; nota: number | null; nota_anterior: number | null; n_auditorias: number; falhas_graves: number } | null;
  media_rede: { atual: number | null; anterior: number | null };
  falhas_graves: { unidade: string; data: string; item: string; observacao: string | null }[];
  rotina: {
    previstos: number;
    cumpridos: number;
    nao_cumpridos: number;
    pendentes: number; // ainda "prevista" (mês em andamento)
    trocas: number;
    nao_cumpridos_lista: { data: string; unidade: string; tipo: AuditType }[];
  };
  nutri_frequencia: { unidade: string; n: number; datas: string[]; nota: number | null; classificacao: string | null }[];
  food99: { unidade: string; nota_99food: number | null; cancelamentos: number | null; tempo_medio_entrega: number | null }[];
  pendencias: { unidade: string; abertas: number; reincidentes: number }[];
}
