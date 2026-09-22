-- =====================================================================
-- Folgas do auditor: segundas são folga fixa (nunca há agenda); além disso o proprietário
-- escolhe 1 domingo de folga por mês antes de gerar a rotina. Dias de folga não recebem
-- schedule_days e não contam no indicador de rotina.
-- =====================================================================

create table auditor_days_off (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  auditor_id uuid references profiles(id) on delete cascade,   -- null = vale para todos os auditores gerais
  motivo text not null default 'Folga de domingo',
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (data, auditor_id)
);
create index auditor_days_off_data_idx on auditor_days_off (data);

alter table auditor_days_off enable row level security;
create policy days_off_select on auditor_days_off for select to authenticated using (true);
create policy days_off_owner on auditor_days_off for all to authenticated using (is_owner()) with check (is_owner());
