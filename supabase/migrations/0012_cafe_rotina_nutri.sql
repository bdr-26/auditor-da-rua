-- =====================================================================
-- Rotina da nutrição (áudios da Daniele):
--  1. Café da Rua: unidade só da nutrição (fora da auditoria/rotação/ranking do gerente) — `units.somente_nutri`.
--  2. Assinatura dupla no relatório: equipe de qualidade (auditora) + supervisor da unidade.
--  3. Por item não conforme: "corrigido na hora" e orientação dada ao funcionário.
--  4. Rotina padrão da equipe (`nutri_rotinas`): visitas recorrentes por unidade/responsável
--     (semanal em dias fixos ou mensal em dia fixo) que geram a `nutri_agenda` automaticamente.
-- Idempotente.
-- =====================================================================

-- 1. unidade só da nutrição ------------------------------------------------
alter table units add column if not exists somente_nutri boolean not null default false;

insert into units (nome, slug, tipo, ativa, entra_no_ranking, ordem_rotacao, somente_nutri, nutri_checklist_em_revisao, endereco)
select 'Café da Rua', 'cafe-da-rua', 'loja', true, false, 0, true, true, null
where not exists (select 1 from units where slug = 'cafe-da-rua');

update units set somente_nutri = true, entra_no_ranking = false where slug = 'cafe-da-rua';

-- checklist do Café: cópia de Imigrantes (em revisão) + item das etiquetas das produções vindas de Moema
insert into unit_nutri_checklist (unit_id, bank_item_id, area, area_ordem, ordem, status)
select c.id, e.bank_item_id, e.area, e.area_ordem, e.ordem, e.status
from units c, units i
join unit_nutri_checklist e on e.unit_id = i.id
where c.slug = 'cafe-da-rua' and i.slug = 'imigrantes'
  and not exists (select 1 from unit_nutri_checklist x where x.unit_id = c.id)
on conflict (unit_id, bank_item_id, area) do nothing;

do $$
declare v_item uuid; v_unit uuid; v_ordem int;
begin
  select id into v_unit from units where slug = 'cafe-da-rua';
  if v_unit is null then return; end if;
  select id into v_item from nutri_item_bank where descricao = 'Produções recebidas da cozinha central (Moema) sem etiqueta ou com etiqueta incompleta/incorreta (nome, data de produção, validade, responsável)';
  if v_item is null then
    insert into nutri_item_bank (descricao, area_padrao, peso) values ('Produções recebidas da cozinha central (Moema) sem etiqueta ou com etiqueta incompleta/incorreta (nome, data de produção, validade, responsável)', 'Produções recebidas de Moema', 1) returning id into v_item;
  end if;
  v_ordem := 1;
  insert into unit_nutri_checklist (unit_id, bank_item_id, area, area_ordem, ordem)
  values (v_unit, v_item, 'Produções recebidas de Moema', 9, v_ordem)
  on conflict (unit_id, bank_item_id, area) do nothing;
end $$;

-- 2. assinatura da equipe de qualidade (lado esquerdo do relatório) ---------
alter table audits
  add column if not exists assinatura_auditor_nome text,
  add column if not exists assinatura_auditor_cpf text,
  add column if not exists assinatura_auditor_cargo text,
  add column if not exists assinatura_auditor_path text,
  add column if not exists assinada_auditor_em timestamptz;

-- 3. corrigido na hora + orientação por item -------------------------------
alter table audit_answers
  add column if not exists corrigido_na_hora boolean not null default false,
  add column if not exists orientacao text;

-- 4. rotina padrão da nutrição --------------------------------------------
create table if not exists nutri_rotinas (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  responsavel_id uuid not null references profiles(id),
  tipo text not null default 'auditoria' check (tipo in ('auditoria', 'controles', 'outro')),
  frequencia text not null default 'semanal' check (frequencia in ('semanal', 'mensal')),
  -- semanal: dias da semana (0 = domingo … 6 = sábado); diária = todos os dias de funcionamento
  dias_semana smallint[] not null default '{}',
  -- mensal: dia do mês (1–28)
  dia_mes smallint check (dia_mes between 1 and 28),
  descricao text,
  ativa boolean not null default true,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((frequencia = 'semanal' and cardinality(dias_semana) > 0) or (frequencia = 'mensal' and dia_mes is not null))
);
create index if not exists nutri_rotinas_unit_idx on nutri_rotinas (unit_id);
create index if not exists nutri_rotinas_resp_idx on nutri_rotinas (responsavel_id);
drop trigger if exists nutri_rotinas_updated_at on nutri_rotinas;
create trigger nutri_rotinas_updated_at before update on nutri_rotinas for each row execute function set_updated_at();

alter table nutri_rotinas enable row level security;
drop policy if exists nutri_rotinas_select on nutri_rotinas;
create policy nutri_rotinas_select on nutri_rotinas for select to authenticated
  using (is_owner() or is_nutri_chefe() or responsavel_id = auth.uid());
drop policy if exists nutri_rotinas_manage on nutri_rotinas;
create policy nutri_rotinas_manage on nutri_rotinas for all to authenticated
  using (is_owner() or is_nutri_chefe()) with check (is_owner() or is_nutri_chefe());

-- tarefas geradas pela rotina: uma por rotina e data (nulos não conflitam)
alter table nutri_agenda add column if not exists rotina_id uuid references nutri_rotinas(id) on delete set null;
create unique index if not exists nutri_agenda_rotina_data_uidx on nutri_agenda (rotina_id, data);
