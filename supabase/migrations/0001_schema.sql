-- =====================================================================
-- AUDITOR DA RUA — esquema principal
-- Timezone de negócio: America/Sao_Paulo (datas de auditoria são DATE)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role as enum ('auditor_geral', 'auditor_nutricao', 'proprietario');
create type unit_kind as enum ('loja', 'producao');
create type audit_type as enum ('completa', 'simplificada', 'producao', 'nutricional');
create type audit_status as enum ('rascunho', 'concluida');
create type schedule_status as enum ('prevista', 'concluida', 'nao_cumprida');
create type pending_status as enum ('aberta', 'resolvida');
create type nutri_answer as enum ('conforme', 'nao_conforme', 'na');
create type nutri_item_status as enum ('ativo', 'pausado');
create type report_kind as enum ('loja', 'consolidado');

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  role user_role not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- UNITS ----------
create table units (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text not null unique,
  tipo unit_kind not null default 'loja',
  ativa boolean not null default true,
  entra_no_ranking boolean not null default true,
  ordem_rotacao integer not null default 0,
  endereco text,
  supervisor_nome text,
  nutri_checklist_em_revisao boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- TEMPLATES (auditorias do gerente) ----------
create table audit_templates (
  id uuid primary key default gen_random_uuid(),
  tipo audit_type not null,
  versao integer not null default 1,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo, versao)
);

create table template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references audit_templates(id) on delete cascade,
  chave text not null,             -- seguranca | operacao | limpeza | atendimento | equipe | producao | pendencias | geral
  nome text not null,
  peso numeric(6,3) not null default 1,  -- 0 = bloco informativo (ex.: pendências na completa)
  ordem integer not null,
  unique (template_id, chave)
);

create table template_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references template_blocks(id) on delete cascade,
  chave text not null,             -- chave estável p/ histórico entre templates (ex.: temperaturas)
  descricao text not null,
  falha_grave boolean not null default false,
  produto_vencido boolean not null default false,  -- nota 1 aqui marca a loja inelegível
  pendencias boolean not null default false,       -- item "pendências da visita anterior"
  bloco_ref text,                                  -- simplificada: bloco da completa ao qual o item se mapeia (histórico por critério)
  ordem integer not null,
  ativo boolean not null default true,
  unique (block_id, chave)
);

-- ---------- BANCO DE ITENS NUTRICIONAIS ----------
create table nutri_item_bank (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  versao integer not null default 1,
  area_padrao text not null,
  peso numeric(6,3) not null default 1,
  ativo boolean not null default true,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table nutri_item_versions (
  id uuid primary key default gen_random_uuid(),
  bank_item_id uuid not null references nutri_item_bank(id) on delete cascade,
  versao integer not null,
  descricao text not null,
  created_at timestamptz not null default now(),
  unique (bank_item_id, versao)
);

create table unit_nutri_checklist (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  bank_item_id uuid not null references nutri_item_bank(id) on delete cascade,
  area text not null,
  area_ordem integer not null default 0,
  ordem integer not null default 0,
  status nutri_item_status not null default 'ativo',
  created_at timestamptz not null default now(),
  unique (unit_id, bank_item_id, area)
);

-- ---------- AGENDA ----------
create table schedule_days (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  unit_id uuid not null references units(id),
  tipo audit_type not null,
  status schedule_status not null default 'prevista',
  auditor_id uuid references profiles(id),
  audit_id uuid,
  unit_original_id uuid references units(id),   -- preenchido quando houve troca manual
  trocado_por uuid references profiles(id),
  trocado_em timestamptz,
  motivo_troca text,
  created_at timestamptz not null default now(),
  unique (data, auditor_id)
);

-- ---------- AUDITORIAS ----------
create table audits (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  auditor_id uuid not null references profiles(id),
  template_id uuid references audit_templates(id),
  tipo audit_type not null,
  data date not null,
  status audit_status not null default 'rascunho',
  nota_final numeric(5,2),          -- 0..100
  notas_blocos jsonb,               -- [{chave, nome, nota, peso, zerado}]
  falha_grave boolean not null default false,
  produto_vencido boolean not null default false,
  classificacao text,               -- nutricional: Excelente | Satisfatório | Insatisfatório | Crítico
  etapa_atual integer not null default 0,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, tipo, data)
);

alter table schedule_days
  add constraint schedule_days_audit_fk foreign key (audit_id) references audits(id) on delete set null;

create table audit_answers (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  item_id uuid references template_items(id),           -- auditorias do gerente
  nutri_entry_id uuid references unit_nutri_checklist(id), -- auditorias nutricionais (entrada da composição)
  nutri_item_id uuid references nutri_item_bank(id),
  nutri_item_version_id uuid references nutri_item_versions(id),
  nutri_area text,
  nutri_peso numeric(6,3),
  nota smallint check (nota between 1 and 5),
  resposta nutri_answer,
  na boolean not null default false,
  produto_vencido boolean not null default false,  -- confirmado pelo auditor quando nota 1 no item de validades
  observacao text,
  updated_at timestamptz not null default now(),
  check (item_id is not null or nutri_entry_id is not null)
);
create unique index audit_answers_item_uidx on audit_answers (audit_id, item_id) where item_id is not null;
create unique index audit_answers_nutri_uidx on audit_answers (audit_id, nutri_entry_id) where nutri_entry_id is not null;

create table audit_photos (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references audit_answers(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- PENDÊNCIAS ----------
create table pending_issues (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  item_id uuid references template_items(id),
  nutri_entry_id uuid references unit_nutri_checklist(id),
  nutri_item_id uuid references nutri_item_bank(id),
  descricao text not null,                 -- snapshot do texto do item
  nota_origem smallint,
  observacao_origem text,
  origem_audit_id uuid not null references audits(id) on delete cascade,
  status pending_status not null default 'aberta',
  resolvida_em_audit_id uuid references audits(id),
  resolvida_em timestamptz,
  visitas_sem_resolver integer not null default 0,
  reincidente boolean not null default false,
  reincidente_notificado_em timestamptz,
  created_at timestamptz not null default now()
);

-- avaliação das pendências dentro de uma auditoria (etapa "pendências da visita anterior")
create table audit_pending_reviews (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  pending_issue_id uuid not null references pending_issues(id) on delete cascade,
  resolvida boolean,                        -- null = ainda não avaliada
  observacao text,
  updated_at timestamptz not null default now(),
  unique (audit_id, pending_issue_id)
);

-- ---------- FECHAMENTO MENSAL ----------
create table monthly_closings (
  id uuid primary key default gen_random_uuid(),
  mes date not null,                        -- sempre dia 1
  unit_id uuid not null references units(id),
  nota_operacional numeric(5,2),
  nota_nutricional numeric(5,2),
  nota_seguranca numeric(5,2),
  notas_blocos jsonb,
  n_auditorias integer not null default 0,
  n_auditorias_nutri integer not null default 0,
  falhas_graves integer not null default 0,
  amostra_reduzida boolean not null default false,
  inelegivel_produto_vencido boolean not null default false,
  posicao_ranking integer,
  elegivel boolean not null default false,
  premiada boolean not null default false,
  empate boolean not null default false,
  fechado_por uuid references profiles(id),
  fechado_em timestamptz not null default now(),
  unique (mes, unit_id)
);

create table owner_adjustments (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid references monthly_closings(id) on delete set null,
  audit_id uuid not null references audits(id),
  answer_id uuid not null references audit_answers(id),
  criterio text not null,
  valor_original smallint,
  valor_novo smallint,
  justificativa text not null check (length(trim(justificativa)) > 0),
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table external_indicators (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  unit_id uuid not null references units(id),
  nota_99food numeric(4,2),
  cancelamentos integer,
  tempo_medio_entrega integer,             -- minutos
  lancado_por uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (mes, unit_id)
);

-- ---------- NOTIFICAÇÕES ----------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  tipo text not null,                      -- lembrete_8h | auditoria_concluida | rotina_nao_cumprida | pendencia_reincidente
  chave_dedup text,
  titulo text not null,
  corpo text not null,
  url text,
  enviado_em timestamptz not null default now(),
  unique (user_id, chave_dedup)
);

-- ---------- RELATÓRIOS ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  unit_id uuid references units(id),
  tipo report_kind not null,
  storage_path text not null,
  gerado_por uuid references profiles(id),
  gerado_em timestamptz not null default now()
);

-- ---------- CONFIGURAÇÕES ----------
create table app_settings (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index audits_unit_data_idx on audits (unit_id, data desc);
create index audits_auditor_data_idx on audits (auditor_id, data desc);
create index audits_status_idx on audits (status);
create index audit_answers_audit_idx on audit_answers (audit_id);
create index pending_issues_unit_status_idx on pending_issues (unit_id, status);
create index schedule_days_data_idx on schedule_days (data);
create index unit_nutri_checklist_unit_idx on unit_nutri_checklist (unit_id, area_ordem, ordem);

-- ---------- TRIGGERS ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger audits_updated_at before update on audits for each row execute function set_updated_at();
create trigger audit_answers_updated_at before update on audit_answers for each row execute function set_updated_at();
create trigger nutri_item_bank_updated_at before update on nutri_item_bank for each row execute function set_updated_at();

-- versão inicial de cada item do banco nutricional
create or replace function nutri_item_bank_version() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into nutri_item_versions (bank_item_id, versao, descricao) values (new.id, new.versao, new.descricao);
  elsif new.descricao is distinct from old.descricao then
    new.versao = old.versao + 1;
    insert into nutri_item_versions (bank_item_id, versao, descricao) values (new.id, new.versao, new.descricao);
  end if;
  return new;
end $$;

create trigger nutri_item_bank_version_ins after insert on nutri_item_bank for each row execute function nutri_item_bank_version();
create trigger nutri_item_bank_version_upd before update on nutri_item_bank for each row execute function nutri_item_bank_version();

-- auditoria concluída é imutável para o auditor (só proprietário pode ajustar via owner_adjustments)
create or replace function audits_immutable_when_concluded() returns trigger language plpgsql as $$
begin
  if old.status = 'concluida' and (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Auditoria concluída é imutável';
  end if;
  return new;
end $$;

create trigger audits_immutable before update on audits for each row execute function audits_immutable_when_concluded();

create or replace function answers_immutable_when_concluded() returns trigger language plpgsql as $$
declare s audit_status;
begin
  select status into s from audits where id = coalesce(new.audit_id, old.audit_id);
  if s = 'concluida' and (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Auditoria concluída é imutável';
  end if;
  return coalesce(new, old);
end $$;

create trigger audit_answers_immutable before insert or update or delete on audit_answers for each row execute function answers_immutable_when_concluded();

-- perfil criado automaticamente a partir do metadata do auth.user (seed/admin)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'auditor_geral')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- FUNÇÕES AUXILIARES ----------
create or replace function current_user_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_owner() returns boolean language sql stable as $$
  select current_user_role() = 'proprietario';
$$;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audit-photos', 'audit-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
