-- =====================================================================
-- Relatório mensal por loja para os supervisores:
--  1. `external_indicators.pedidos`: nº de pedidos da loja no mês (informativo, lançado pelo proprietário).
--  2. `external_indicators.recado`: recado do mês para a loja, impresso no relatório do supervisor.
-- Idempotente.
-- =====================================================================
alter table external_indicators
  add column if not exists pedidos integer check (pedidos is null or pedidos >= 0),
  add column if not exists recado text;
