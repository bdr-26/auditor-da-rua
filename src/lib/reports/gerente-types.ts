// Dados planos do relatório de uma auditoria do gerente (completa, simplificada ou produção).
import type { AuditType } from "../types";

export interface GerenteReportItem {
  descricao: string;
  nota: number | null; // 1..5, null = N/A
  na: boolean;
  falha_grave: boolean;
  produto_vencido: boolean; // confirmado pelo auditor
  observacao: string | null;
  fotos: { id: string; dataUri: string }[];
}

export interface GerenteReportBlock {
  chave: string;
  nome: string;
  peso: number;
  nota: number | null;
  zerado: boolean;
  itens: GerenteReportItem[];
}

export interface GerenteReportPendencia {
  descricao: string;
  resolvida: boolean | null;
  nota_origem: number | null;
  origem_data: string | null;
}

export interface GerenteAuditReportData {
  auditId: string;
  tipo: AuditType;
  tipoLabel: string;
  unidade: { nome: string; endereco: string | null; supervisor_nome: string | null };
  data: string;
  dataIso: string;
  concluidaEm: string | null;
  rascunho: boolean;
  auditor: string;
  geradoEm: string;
  nota: number | null;
  notaSemTeto: number | null;
  falhaGrave: boolean;
  produtoVencido: boolean;
  totais: { respondidos: number; total: number; na: number; atencao: number; naoConformes: number; criticos: number };
  blocos: GerenteReportBlock[];
  pendencias: GerenteReportPendencia[];
  fotosOmitidas: number;
}
