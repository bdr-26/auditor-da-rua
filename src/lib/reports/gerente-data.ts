import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_TYPE_LABELS } from "../constants";
import { getAuditFillData, toScoringAnswers } from "../data/audit-flow";
import { formatDatePT, formatDateTimePT } from "../dates";
import { computeAuditScore } from "../domain/scoring";
import { photoDataUri } from "./data";
import type { GerenteAuditReportData, GerenteReportBlock, GerenteReportItem } from "./gerente-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export const MAX_PHOTOS_GERENTE = 24;

/** Relatório de uma auditoria do gerente: blocos, itens com nota, apontamentos com fotos, pendências. */
export async function buildGerenteAuditReport(admin: AdminClient, auditId: string): Promise<GerenteAuditReportData | null> {
  const fill = await getAuditFillData(admin, auditId);
  if (!fill) return null;
  const { audit, unit, template, blocks, answers, pendings, auditorNome } = fill;
  const result = computeAuditScore(audit.tipo, blocks, toScoringAnswers(answers));
  const rascunho = audit.status === "rascunho";
  const byItem = new Map(answers.map((a) => [a.item_id, a]));
  const budget = { left: MAX_PHOTOS_GERENTE, omitted: 0 };

  const blocos: GerenteReportBlock[] = [];
  let na = 0, atencao = 0, naoConformes = 0, criticos = 0;
  for (const b of template.blocks) {
    const itens: GerenteReportItem[] = [];
    for (const it of b.items) {
      const a = byItem.get(it.id);
      const nota = a && !a.na && a.nota != null ? a.nota : null;
      if (a?.na) na++;
      if (nota === 3) atencao++;
      if (nota === 2) naoConformes++;
      if (nota === 1) criticos++;
      const fotos: GerenteReportItem["fotos"] = [];
      if (nota != null && nota <= 3) {
        for (const p of a?.photos ?? []) {
          if (budget.left <= 0) {
            budget.omitted++;
            continue;
          }
          const uri = await photoDataUri(admin, p.path);
          if (uri) {
            fotos.push({ id: p.id, dataUri: uri });
            budget.left--;
          }
        }
      }
      itens.push({ descricao: it.descricao, nota, na: !!a?.na, falha_grave: it.falha_grave, produto_vencido: !!(a?.produto_vencido && nota === 1 && it.produto_vencido), observacao: a?.observacao ?? null, fotos });
    }
    const score = (rascunho ? result.notas_blocos : (audit.notas_blocos ?? result.notas_blocos)).find((s) => s.chave === b.chave);
    blocos.push({ chave: b.chave, nome: b.nome, peso: Number(b.peso), nota: score?.nota ?? null, zerado: score?.zerado ?? false, itens });
  }

  return {
    auditId,
    tipo: audit.tipo,
    tipoLabel: AUDIT_TYPE_LABELS[audit.tipo],
    unidade: { nome: unit.nome, endereco: unit.endereco, supervisor_nome: unit.supervisor_nome },
    data: formatDatePT(audit.data),
    dataIso: audit.data,
    concluidaEm: audit.concluida_em ? formatDateTimePT(audit.concluida_em) : null,
    rascunho,
    auditor: auditorNome,
    geradoEm: formatDateTimePT(new Date().toISOString()),
    nota: rascunho ? result.nota_final : audit.nota_final,
    notaSemTeto: result.nota_sem_teto,
    falhaGrave: rascunho ? result.falha_grave : audit.falha_grave,
    produtoVencido: rascunho ? result.produto_vencido : audit.produto_vencido,
    totais: { respondidos: result.respondidos, total: result.total, na, atencao, naoConformes, criticos },
    blocos,
    pendencias: pendings.map((p) => ({ descricao: p.descricao, resolvida: p.resolvida, nota_origem: p.nota_origem, origem_data: p.origem_data ? formatDatePT(p.origem_data) : null })),
    fotosOmitidas: budget.omitted,
  };
}

export function gerenteAuditFileName(unitSlug: string, tipo: string, dataIso: string): string {
  return `auditoria-${tipo}-${unitSlug}-${dataIso}.pdf`;
}
