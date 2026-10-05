-- =====================================================================
-- Lojas em abertura: continuam na rotação do gerente, mas o dia é uma "visita de abertura"
-- (checklist de abertura lançado como demandas) em vez de auditoria. Quando a loja é marcada
-- como ativa (em_abertura = false), as auditorias passam a valer normalmente.
-- Demandas ganham categoria: 'geral' ou 'checklist_abertura' (esta exige a unidade).
-- =====================================================================

alter table units add column if not exists em_abertura boolean not null default false;

alter table demandas add column if not exists categoria text not null default 'geral';
alter table demandas drop constraint if exists demandas_categoria_check;
alter table demandas add constraint demandas_categoria_check check (categoria in ('geral', 'checklist_abertura'));
alter table demandas drop constraint if exists demandas_checklist_unit_check;
alter table demandas add constraint demandas_checklist_unit_check check (categoria <> 'checklist_abertura' or unit_id is not null);

-- Mooca e Bela Vista começam em abertura
update units set em_abertura = true where slug in ('mooca', 'bela-vista');
