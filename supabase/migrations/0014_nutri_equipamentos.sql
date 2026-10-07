-- =====================================================================
-- Cadastro de equipamentos por unidade (planilha de temperatura de equipamentos do Drive:
-- geladeiras, freezers, pistas por área). Pré-preenche as linhas dos controles de
-- temperatura e de manutenção. Chefe/proprietário gerenciam; equipe nutri lê. Idempotente.
-- =====================================================================
create table if not exists nutri_equipamentos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  nome text not null,                 -- ex.: "Geladeira nº 02"
  tipo text not null,                 -- Geladeira, Freezer, Pista fria, Pista quente, Câmara fria, Estufa, Banho-maria
  area text,                          -- Produção, Delivery, Salão, Açougue, Estoque 1…
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutri_equipamentos_unit_idx on nutri_equipamentos (unit_id, ordem);
drop trigger if exists nutri_equipamentos_updated_at on nutri_equipamentos;
create trigger nutri_equipamentos_updated_at before update on nutri_equipamentos for each row execute function set_updated_at();

alter table nutri_equipamentos enable row level security;
drop policy if exists nutri_equipamentos_select on nutri_equipamentos;
create policy nutri_equipamentos_select on nutri_equipamentos for select to authenticated
  using (is_owner() or current_user_role() = 'auditor_nutricao');
drop policy if exists nutri_equipamentos_manage on nutri_equipamentos;
create policy nutri_equipamentos_manage on nutri_equipamentos for all to authenticated
  using (is_owner() or is_nutri_chefe()) with check (is_owner() or is_nutri_chefe());

-- Moema Delivery: inventário da planilha "CONTROLE DE TEMPERATURA DOS EQUIPAMENTOS - DELIVERY"
do $$
declare v_unit uuid; i int := 0; r record;
begin
  select id into v_unit from units where slug = 'moema-delivery';
  if v_unit is null or exists (select 1 from nutri_equipamentos where unit_id = v_unit) then return; end if;
  for r in select * from (values
    ('Geladeira nº 02', 'Geladeira', 'Produção'), ('Geladeira nº 05', 'Geladeira', 'Produção'), ('Geladeira nº 06', 'Geladeira', 'Produção'), ('Geladeira nº 09', 'Geladeira', 'Produção'),
    ('Geladeira nº 01', 'Geladeira', 'Delivery'), ('Geladeira nº 03', 'Geladeira', 'Delivery'), ('Geladeira nº 04', 'Geladeira', 'Delivery'), ('Freezer nº 05', 'Freezer', 'Delivery'),
    ('Pista quente nº 02', 'Pista quente', 'Delivery'), ('Pista quente nº 01', 'Pista quente', 'Delivery'), ('Pista fria nº 01', 'Pista fria', 'Delivery'),
    ('Geladeira nº 07', 'Geladeira', 'Açougue'),
    ('Freezer nº 08', 'Freezer', 'Estoque 1'), ('Geladeira nº 08', 'Geladeira', 'Estoque 1'), ('Freezer nº 01', 'Freezer', 'Estoque 1'), ('Freezer nº 03', 'Freezer', 'Estoque 1'), ('Freezer nº 04', 'Freezer', 'Estoque 1'),
    ('Freezer nº 07', 'Freezer', 'Estoque 2')
  ) as t(nome, tipo, area) loop
    i := i + 1;
    insert into nutri_equipamentos (unit_id, nome, tipo, area, ordem) values (v_unit, r.nome, r.tipo, r.area, i);
  end loop;
end $$;
