-- =====================================================================
-- Ajustes dos testes em loja (Daniele):
--  1. Catálogos da nutrição (fornecedores com CNPJ, produtos, marcas, preparações transportadas,
--     hortifrútis) para escolher na lista em vez de digitar.
--  2. Equipamentos de Moema Delivery: Freezer nº 07 é da Produção; Geladeira nº 10 no Delivery.
-- Idempotente.
-- =====================================================================
create table if not exists nutri_catalogo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('fornecedor', 'produto', 'marca', 'preparacao', 'hortifruti')),
  nome text not null,
  detalhe text,                        -- ex.: CNPJ do fornecedor
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (categoria, nome)
);
create index if not exists nutri_catalogo_cat_idx on nutri_catalogo (categoria, ativo, nome);
drop trigger if exists nutri_catalogo_updated_at on nutri_catalogo;
create trigger nutri_catalogo_updated_at before update on nutri_catalogo for each row execute function set_updated_at();

alter table nutri_catalogo enable row level security;
drop policy if exists nutri_catalogo_select on nutri_catalogo;
create policy nutri_catalogo_select on nutri_catalogo for select to authenticated
  using (is_owner() or current_user_role() = 'auditor_nutricao');
drop policy if exists nutri_catalogo_manage on nutri_catalogo;
create policy nutri_catalogo_manage on nutri_catalogo for all to authenticated
  using (is_owner() or is_nutri_chefe()) with check (is_owner() or is_nutri_chefe());

-- preparações transportadas (lista da distribuição) e hortifrútis comuns, para começar
insert into nutri_catalogo (categoria, nome, ordem)
select 'preparacao', n, o from (values
  ('Cebola caramelizada', 1), ('Picles', 2), ('Maionese verde', 3), ('Maionese da Rua', 4), ('Maionese de mostarda', 5),
  ('Molho smash', 6), ('Molho caipira', 7), ('Farofa de bacon', 8), ('Carne de hambúrguer', 9), ('Pão', 10)
) as t(n, o)
on conflict (categoria, nome) do nothing;

insert into nutri_catalogo (categoria, nome, ordem)
select 'hortifruti', n, o from (values
  ('Alface', 1), ('Tomate', 2), ('Cebola', 3), ('Cebola roxa', 4), ('Pepino', 5), ('Limão', 6), ('Rúcula', 7), ('Salsinha', 8), ('Cebolinha', 9)
) as t(n, o)
on conflict (categoria, nome) do nothing;

-- equipamentos de Moema Delivery
update nutri_equipamentos e set area = 'Produção'
from units u where u.id = e.unit_id and u.slug = 'moema-delivery' and e.nome = 'Freezer nº 07';

insert into nutri_equipamentos (unit_id, nome, tipo, area, ordem)
select u.id, 'Geladeira nº 10', 'Geladeira', 'Delivery', coalesce((select max(ordem) from nutri_equipamentos x where x.unit_id = u.id), 0) + 1
from units u
where u.slug = 'moema-delivery' and not exists (select 1 from nutri_equipamentos e where e.unit_id = u.id and e.nome = 'Geladeira nº 10');
