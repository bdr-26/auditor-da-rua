-- =====================================================================
-- Demandas: tarefas que os proprietários atribuem ao gerente (título, descrição, prazo, anexos),
-- com status, comentários e conclusão obrigatória com o relato do que foi feito.
-- =====================================================================

create type demanda_status as enum ('aberta', 'em_andamento', 'concluida', 'cancelada');
create type demanda_prioridade as enum ('normal', 'alta');

create table demandas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  prazo date,
  prioridade demanda_prioridade not null default 'normal',
  status demanda_status not null default 'aberta',
  unit_id uuid references units(id),
  responsavel_id uuid not null references profiles(id),
  criado_por uuid not null references profiles(id),
  conclusao_texto text,                    -- obrigatório ao concluir (validado na server action)
  concluida_em timestamptz,
  concluida_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index demandas_responsavel_status_idx on demandas (responsavel_id, status, prazo);
create trigger demandas_updated_at before update on demandas for each row execute function set_updated_at();

create table demanda_comentarios (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references demandas(id) on delete cascade,
  user_id uuid not null references profiles(id),
  texto text not null check (length(trim(texto)) > 0),
  status_novo demanda_status,              -- preenchido quando o comentário registra uma mudança de status
  created_at timestamptz not null default now()
);
create index demanda_comentarios_demanda_idx on demanda_comentarios (demanda_id, created_at);

create table demanda_anexos (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references demandas(id) on delete cascade,
  storage_path text not null,
  nome text not null,
  mime text,
  tamanho integer,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table demandas enable row level security;
alter table demanda_comentarios enable row level security;
alter table demanda_anexos enable row level security;

-- proprietário: tudo; responsável: vê as suas e atualiza status/conclusão (campos restritos na server action)
create policy demandas_select on demandas for select to authenticated using (is_owner() or responsavel_id = auth.uid());
create policy demandas_owner_write on demandas for all to authenticated using (is_owner()) with check (is_owner());
create policy demandas_resp_update on demandas for update to authenticated using (responsavel_id = auth.uid()) with check (responsavel_id = auth.uid());

create policy dcom_select on demanda_comentarios for select to authenticated
  using (exists (select 1 from demandas d where d.id = demanda_id and (is_owner() or d.responsavel_id = auth.uid())));
create policy dcom_insert on demanda_comentarios for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from demandas d where d.id = demanda_id and (is_owner() or d.responsavel_id = auth.uid())));

create policy danx_select on demanda_anexos for select to authenticated
  using (exists (select 1 from demandas d where d.id = demanda_id and (is_owner() or d.responsavel_id = auth.uid())));
create policy danx_insert on demanda_anexos for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from demandas d where d.id = demanda_id and (is_owner() or d.responsavel_id = auth.uid())));
create policy danx_delete on demanda_anexos for delete to authenticated using (user_id = auth.uid() or is_owner());

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demandas', 'demandas', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "demandas anexos read" on storage.objects for select to authenticated
  using (bucket_id = 'demandas' and current_user_role() in ('proprietario', 'auditor_geral'));
create policy "demandas anexos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'demandas' and current_user_role() in ('proprietario', 'auditor_geral'));
create policy "demandas anexos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'demandas' and (owner = auth.uid() or is_owner()));
