-- =====================================================================
-- ZERAR LANÇAMENTOS (uso único, antes de começar a operar de verdade).
-- Apaga: auditorias (gerente e nutricional) com respostas, fotos e avaliações de pendências;
-- pendências; agenda (é regerada automaticamente); fechamentos e ajustes; indicadores 99Food;
-- relatórios gerados; demandas (comentários e anexos); log de notificações.
-- Mantém: unidades, usuários, templates, banco e composição nutricional, configurações,
-- folgas e as ativações de push dos celulares.
-- Rode no SQL Editor do Supabase. Depois, se quiser liberar espaço, esvazie os buckets
-- audit-photos, reports e demandas pelo painel Storage (o Supabase bloqueia DELETE em
-- storage.objects via SQL; os arquivos órfãos não aparecem no app).
-- =====================================================================

truncate table
  owner_adjustments,
  audit_pending_reviews,
  audit_photos,
  audit_answers,
  pending_issues,
  schedule_days,
  monthly_closings,
  external_indicators,
  reports,
  notifications_log,
  demanda_anexos,
  demanda_comentarios,
  demandas,
  audits
restart identity cascade;

select
  (select count(*) from audits) as auditorias,
  (select count(*) from schedule_days) as agenda,
  (select count(*) from demandas) as demandas,
  (select count(*) from pending_issues) as pendencias,
  (select count(*) from monthly_closings) as fechamentos;
