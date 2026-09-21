-- =====================================================================
-- Agendamento nativo no Supabase (pg_cron + pg_net) — ALTERNATIVA ao Vercel Cron (vercel.json).
-- Chama as Edge Functions `daily-reminder` (08:00 SP = 11:00 UTC, ter–dom) e `end-of-day`
-- (23:05 SP = 02:05 UTC do dia seguinte). Horários em UTC (São Paulo = UTC-3, sem horário de verão).
--
-- Como usar (ver docs/NOTIFICACOES.md e docs/DEPLOY.md):
--   1. Deploy das functions:  supabase functions deploy daily-reminder end-of-day --no-verify-jwt
--   2. Crie os segredos no Vault (SQL Editor), substituindo os valores:
--        select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--        select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--   3. Agende os jobs:  select public.schedule_notification_jobs();
--
-- A migration é segura mesmo sem os segredos: só agenda se `project_url` já existir no Vault.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;

-- (Re)agenda os dois jobs lendo URL e segredo do Vault. Idempotente: desagenda antes de agendar.
create or replace function public.schedule_notification_jobs()
returns text
language plpgsql
security definer
set search_path = public, cron, extensions, vault
as $$
declare
  v_url text;
  v_secret text;
  v_headers text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return 'segredos project_url/cron_secret ausentes no Vault — nada agendado';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname in ('auditor-daily-reminder', 'auditor-end-of-day');

  v_headers := format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', v_secret);

  -- 08:00 São Paulo (11:00 UTC), terça a domingo
  perform cron.schedule(
    'auditor-daily-reminder',
    '0 11 * * 0,2-6',
    format(
      $job$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb, timeout_milliseconds := 30000) $job$,
      v_url || '/functions/v1/daily-reminder',
      v_headers
    )
  );

  -- 23:05 São Paulo = 02:05 UTC do dia seguinte (a function calcula o dia anterior em SP)
  perform cron.schedule(
    'auditor-end-of-day',
    '5 2 * * *',
    format(
      $job$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb, timeout_milliseconds := 30000) $job$,
      v_url || '/functions/v1/end-of-day',
      v_headers
    )
  );

  return 'jobs agendados: auditor-daily-reminder (0 11 * * 0,2-6 UTC), auditor-end-of-day (5 2 * * * UTC)';
end $$;

revoke all on function public.schedule_notification_jobs() from public;

-- Agenda automaticamente se os segredos já existirem (ex.: re-execução da migration em projeto configurado).
do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'project_url')
     and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret') then
    perform public.schedule_notification_jobs();
  end if;
end $$;
