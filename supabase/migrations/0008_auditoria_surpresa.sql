-- =====================================================================
-- Auditoria surpresa: proprietários fazem auditorias (completa/simplificada/produção) a qualquer
-- momento, em qualquer unidade. Valem como qualquer outra: entram no relatório e na nota mensal.
--
-- 1) A unicidade por (unidade, tipo, dia) passa a considerar o auditor: o gerente e um proprietário
--    podem auditar a mesma unidade, do mesmo tipo, no mesmo dia (a rotina do gerente não é substituída).
-- 2) Proprietário pode inserir auditorias dos tipos do gerente e enviar fotos ao bucket.
-- =====================================================================

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'audits'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (unit_id, tipo, data)';
  if c is not null then
    execute format('alter table audits drop constraint %I', c);
  end if;
end $$;

alter table audits drop constraint if exists audits_unit_tipo_data_auditor_key;
alter table audits add constraint audits_unit_tipo_data_auditor_key unique (unit_id, tipo, data, auditor_id);

drop policy if exists audits_insert on audits;
create policy audits_insert on audits for insert to authenticated
  with check (
    auditor_id = auth.uid()
    and (
      (current_user_role() in ('auditor_geral', 'proprietario') and tipo in ('completa', 'simplificada', 'producao'))
      or (current_user_role() = 'auditor_nutricao' and tipo = 'nutricional')
    )
  );

drop policy if exists "audit photos upload" on storage.objects;
create policy "audit photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'audit-photos' and current_user_role() in ('auditor_geral', 'auditor_nutricao', 'proprietario'));
