-- =====================================================================
-- Módulo nutricional: agenda da equipe (chefe programa as estagiárias) e controles digitais
-- (planilhas de temperatura, óleo, recebimento, transporte, hortifruti, manutenção) com rascunho.
-- =====================================================================

-- ---------- Agenda da equipe nutri ----------
create table if not exists nutri_agenda (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  responsavel_id uuid not null references profiles(id),
  unit_id uuid references units(id),
  tipo text not null default 'auditoria' check (tipo in ('auditoria', 'controles', 'outro')),
  descricao text,
  status text not null default 'prevista' check (status in ('prevista', 'concluida', 'cancelada')),
  concluida_em timestamptz,
  audit_id uuid references audits(id) on delete set null,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutri_agenda_resp_data_idx on nutri_agenda (responsavel_id, data);
create index if not exists nutri_agenda_data_idx on nutri_agenda (data);
drop trigger if exists nutri_agenda_updated_at on nutri_agenda;
create trigger nutri_agenda_updated_at before update on nutri_agenda for each row execute function set_updated_at();

alter table nutri_agenda enable row level security;
drop policy if exists nutri_agenda_select on nutri_agenda;
create policy nutri_agenda_select on nutri_agenda for select to authenticated
  using (is_owner() or is_nutri_chefe() or responsavel_id = auth.uid());
drop policy if exists nutri_agenda_manage on nutri_agenda;
create policy nutri_agenda_manage on nutri_agenda for all to authenticated
  using (is_owner() or is_nutri_chefe()) with check (is_owner() or is_nutri_chefe());
drop policy if exists nutri_agenda_self_update on nutri_agenda;
create policy nutri_agenda_self_update on nutri_agenda for update to authenticated
  using (responsavel_id = auth.uid()) with check (responsavel_id = auth.uid());

-- ---------- Controles digitais ----------
create table if not exists nutri_controles (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                       -- código do tipo (definições em src/lib/nutri/controle-tipos.ts)
  unit_id uuid not null references units(id),
  data date not null,
  responsavel_id uuid not null references profiles(id),
  status text not null default 'rascunho' check (status in ('rascunho', 'finalizado')),
  dados jsonb not null default '{}'::jsonb, -- { cabecalho: {...}, linhas: [{...}] }
  observacoes text,
  finalizado_em timestamptz,
  finalizado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutri_controles_unit_tipo_data_idx on nutri_controles (unit_id, tipo, data desc);
create index if not exists nutri_controles_resp_status_idx on nutri_controles (responsavel_id, status);
drop trigger if exists nutri_controles_updated_at on nutri_controles;
create trigger nutri_controles_updated_at before update on nutri_controles for each row execute function set_updated_at();

alter table nutri_controles enable row level security;
drop policy if exists nutri_controles_select on nutri_controles;
create policy nutri_controles_select on nutri_controles for select to authenticated
  using (is_owner() or current_user_role() = 'auditor_nutricao');
drop policy if exists nutri_controles_insert on nutri_controles;
create policy nutri_controles_insert on nutri_controles for insert to authenticated
  with check (current_user_role() = 'auditor_nutricao' and (responsavel_id = auth.uid() or is_nutri_chefe()));
drop policy if exists nutri_controles_update on nutri_controles;
create policy nutri_controles_update on nutri_controles for update to authenticated
  using (is_owner() or is_nutri_chefe() or (responsavel_id = auth.uid() and status = 'rascunho'))
  with check (is_owner() or is_nutri_chefe() or responsavel_id = auth.uid());
drop policy if exists nutri_controles_delete on nutri_controles;
create policy nutri_controles_delete on nutri_controles for delete to authenticated
  using (is_owner() or is_nutri_chefe() or (responsavel_id = auth.uid() and status = 'rascunho'));
