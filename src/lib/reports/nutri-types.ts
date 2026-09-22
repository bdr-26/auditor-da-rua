// Dados planos dos relatórios nutricionais (por auditoria e mensal por unidade).

export interface NutriReportPhoto {
  id: string;
  dataUri: string;
}

export interface NutriReportApontamento {
  area: string;
  descricao: string;
  observacao: string | null;
  fotos: NutriReportPhoto[];
  data?: string; // usado no mensal (dd/mm)
}

export interface NutriReportArea {
  area: string;
  conformes: number;
  nao_conformes: number;
  na: number;
  aplicaveis: number;
  nota: number | null;
}

export interface NutriReportPendencia {
  descricao: string;
  resolvida: boolean | null;
  origem_data: string | null;
}

export interface NutriAuditReportData {
  auditId: string;
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  data: string; // dd/mm/aaaa
  dataIso: string;
  concluidaEm: string | null;
  rascunho: boolean;
  nutricionista: string;
  geradoEm: string;
  nota: number | null;
  classificacao: string | null;
  totais: { conformes: number; nao_conformes: number; na: number; avaliados: number };
  areas: NutriReportArea[];
  apontamentos: NutriReportApontamento[];
  pendencias: NutriReportPendencia[];
  fotosOmitidas: number;
}

export interface NutriMonthlyAuditRow {
  auditId: string;
  data: string; // dd/mm
  nota: number | null;
  classificacao: string | null;
  nao_conformes: number;
  nutricionista: string;
}

export interface NutriMonthlyRecorrente {
  descricao: string;
  ocorrencias: number;
  areas: string[];
}

export interface NutriMonthlyReportData {
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  mes: string; // YYYY-MM-01
  mesLabel: string;
  geradoEm: string;
  nutricionistas: string[];
  resultado: { nota: number | null; classificacao: string | null; n: number; melhor: number | null; pior: number | null };
  anterior: { nota: number | null; classificacao: string | null; n: number };
  auditorias: NutriMonthlyAuditRow[];
  areas: NutriReportArea[];
  recorrentes: NutriMonthlyRecorrente[];
  apontamentos: NutriReportApontamento[];
  pendenciasAbertas: { descricao: string; desde: string; visitas_sem_resolver: number; reincidente: boolean }[];
  fotosOmitidas: number;
}
