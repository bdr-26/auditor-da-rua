-- Verificações do esquema + seeds (rodar via scripts/db-local-test.sh)
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

do $$
declare n int; v int; u1 uuid; u2 uuid; a uuid; ans uuid; bank uuid;
begin
  -- unidades
  select count(*) into n from units; if n <> 6 then raise exception 'esperava 6 unidades, achou %', n; end if;
  select count(*) into n from units where entra_no_ranking; if n <> 5 then raise exception 'esperava 5 lojas no ranking'; end if;
  select count(*) into n from units where tipo = 'producao' and not entra_no_ranking; if n <> 1 then raise exception 'produção fora do ranking'; end if;

  -- templates
  select count(*) into n from template_items ti join template_blocks b on b.id = ti.block_id join audit_templates t on t.id = b.template_id where t.tipo = 'completa' and b.peso > 0;
  if n <> 21 then raise exception 'completa deve ter 21 itens pontuados, achou %', n; end if;
  select count(*) into n from template_items ti join template_blocks b on b.id = ti.block_id join audit_templates t on t.id = b.template_id where t.tipo = 'completa' and ti.falha_grave;
  if n <> 5 then raise exception 'completa deve ter 5 itens ⚠, achou %', n; end if;
  select count(*) into n from template_items ti join template_blocks b on b.id = ti.block_id join audit_templates t on t.id = b.template_id where t.tipo = 'simplificada';
  if n <> 12 then raise exception 'simplificada deve ter 12 itens, achou %', n; end if;
  select count(*) into n from template_items ti join template_blocks b on b.id = ti.block_id join audit_templates t on t.id = b.template_id where t.tipo = 'producao';
  if n <> 9 then raise exception 'produção deve ter 9 itens, achou %', n; end if;
  select count(*) into n from template_items where produto_vencido; if n <> 2 then raise exception 'produto_vencido em 2 itens (completa+simplificada), achou %', n; end if;

  -- nutricional: composição por unidade
  select count(*) into n from unit_nutri_checklist c join units u on u.id = c.unit_id where u.slug = 'moema-salao';
  if n <> 43 then raise exception 'Anexo A: 43 itens, achou %', n; end if;
  select count(*) into n from unit_nutri_checklist c join units u on u.id = c.unit_id where u.slug = 'moema-delivery';
  if n <> 76 then raise exception 'Anexo B: 76 itens, achou %', n; end if;
  select count(*) into n from unit_nutri_checklist c join units u on u.id = c.unit_id where u.slug = 'imigrantes';
  if n <> 43 then raise exception 'Anexo C: 43 itens, achou %', n; end if;
  select count(*) into n from unit_nutri_checklist c join units u on u.id = c.unit_id where u.slug in ('bela-vista', 'mooca');
  if n <> 86 then raise exception 'clones BV+Mooca: 86 itens, achou %', n; end if;
  select count(*) into n from units where nutri_checklist_em_revisao; if n <> 3 then raise exception '3 unidades em revisão'; end if;
  select count(*) into n from nutri_item_versions; select count(*) into v from nutri_item_bank;
  if n <> v then raise exception 'cada item do banco deve ter 1 versão inicial (% vs %)', n, v; end if;
  select count(*) into n from nutri_item_bank where descricao = 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)';
  if n <> 1 then raise exception 'item repetido deve ser 1 registro no banco'; end if;

  -- versionamento: editar texto cria nova versão
  select id into bank from nutri_item_bank where descricao = 'Saleiros sujos';
  update nutri_item_bank set descricao = 'Saleiros sujos (teste)' where id = bank;
  select versao into v from nutri_item_bank where id = bank; if v <> 2 then raise exception 'versão deveria ser 2'; end if;
  select count(*) into n from nutri_item_versions where bank_item_id = bank; if n <> 2 then raise exception '2 versões esperadas'; end if;
  update nutri_item_bank set descricao = 'Saleiros sujos' where id = bank;

  -- trigger de perfil a partir de auth.users
  insert into auth.users (email, raw_user_meta_data) values ('rodrigo@teste.com', '{"nome":"Rodrigo","role":"auditor_geral"}') returning id into u1;
  insert into auth.users (email, raw_user_meta_data) values ('antonio@teste.com', '{"nome":"Antonio","role":"proprietario"}') returning id into u2;
  select count(*) into n from profiles where role = 'auditor_geral'; if n <> 1 then raise exception 'perfil do auditor não criado'; end if;

  -- 1 auditoria por unidade/tipo/dia/auditor (gerente e proprietário podem auditar a mesma unidade no mesmo dia)
  select id into a from units where slug = 'mooca';
  insert into audits (unit_id, auditor_id, tipo, data) values (a, u1, 'completa', '2026-09-25');
  begin
    insert into audits (unit_id, auditor_id, tipo, data) values (a, u1, 'completa', '2026-09-25');
    raise exception 'constraint unique(unit,tipo,data,auditor) não bloqueou';
  exception when unique_violation then null;
  end;
  insert into audits (unit_id, auditor_id, tipo, data) values (a, u2, 'completa', '2026-09-25'); -- auditoria surpresa do proprietário
  delete from audits where unit_id = a and auditor_id = u2 and data = '2026-09-25';

  -- imutabilidade após conclusão (sem JWT de service_role)
  select id into a from audits limit 1;
  insert into audit_answers (audit_id, item_id, nota) select a, id, 4 from template_items limit 1 returning id into ans;
  update audits set status = 'concluida', concluida_em = now() where id = a;
  begin
    update audits set nota_final = 99 where id = a;
    raise exception 'auditoria concluída deveria ser imutável';
  exception when raise_exception then
    if sqlerrm not like '%imutável%' then raise; end if;
  end;
  begin
    update audit_answers set nota = 1 where id = ans;
    raise exception 'resposta de auditoria concluída deveria ser imutável';
  exception when raise_exception then
    if sqlerrm not like '%imutável%' then raise; end if;
  end;
  -- com service_role passa
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update audits set nota_final = 88 where id = a;
  perform set_config('request.jwt.claims', '', true);

  raise notice 'checks: OK';
end $$;

-- RLS: auditor só vê as próprias auditorias; proprietário vê tudo; nutricionista não cria auditoria completa
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from profiles where role = 'auditor_geral'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from profiles where role = 'auditor_geral'), true);
set local role authenticated;
select case when count(*) = 1 then 'rls auditor vê própria auditoria: OK' else 'FALHA rls auditor' end from audits;
select case when count(*) = 6 then 'rls auditor lê unidades: OK' else 'FALHA rls unidades' end from units;
select case when count(*) = 0 then 'rls auditor não vê relatórios: OK' else 'FALHA rls reports' end from reports;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from profiles where role = 'proprietario'), true);
set local role authenticated;
select case when count(*) = 1 then 'rls proprietário vê auditorias: OK' else 'FALHA rls proprietário' end from audits;
select case when is_owner() then 'is_owner(): OK' else 'FALHA is_owner' end;
insert into units (nome, slug) values ('Loja Nova', 'loja-nova');
select case when count(*) = 7 then 'rls proprietário cria unidade: OK' else 'FALHA criar unidade' end from units;
reset role;
rollback;
