-- =====================================================================
-- Importação do relatório "Dados do pedido" da 99Food no fechamento:
-- além dos quatro números da aba de indicadores, guarda o detalhe do mês
-- (cancelamentos por responsável e motivo, avaliações, tags, comentários
-- negativos, atrasos, itens em falta, clientes novos, tempos) para o
-- relatório do supervisor. Idempotente.
-- =====================================================================
alter table external_indicators
  add column if not exists detalhe_99 jsonb,
  add column if not exists importado_99_em timestamptz,
  add column if not exists arquivo_99 text;
