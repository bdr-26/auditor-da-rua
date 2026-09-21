-- =====================================================================
-- Políticas de acesso (RLS)
-- auditor_geral: auditorias operacionais próprias; auditor_nutricao: nutricionais próprias;
-- proprietario: leitura total + cadastros + fechamento. Escritas sensíveis (conclusão,
-- pendências, agenda, notificações) são feitas por server actions com service_role.
-- =====================================================================

alter table profiles enable row level security;
alter table units enable row level security;
alter table audit_templates enable row level security;
alter table template_blocks enable row level security;
alter table template_items enable row level security;
alter table nutri_item_bank enable row level security;
alter table nutri_item_versions enable row level security;
alter table unit_nutri_checklist enable row level security;
alter table schedule_days enable row level security;
alter table audits enable row level security;
alter table audit_answers enable row level security;
alter table audit_photos enable row level security;
alter table pending_issues enable row level security;
alter table audit_pending_reviews enable row level security;
alter table monthly_closings enable row level security;
alter table owner_adjustments enable row level security;
alter table external_indicators enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications_log enable row level security;
alter table reports enable row level security;
alter table app_settings enable row level security;

-- profiles: todos autenticados leem (nomes nos relatórios); ninguém edita via client
create policy profiles_select on profiles for select to authenticated using (true);

-- cadastros de leitura geral
create policy units_select on units for select to authenticated using (true);
create policy units_owner_write on units for all to authenticated using (is_owner()) with check (is_owner());

create policy templates_select on audit_templates for select to authenticated using (true);
create policy blocks_select on template_blocks for select to authenticated using (true);
create policy items_select on template_items for select to authenticated using (true);

-- banco nutricional: leitura geral; escrita por proprietário ou nutricionista
create policy nutri_bank_select on nutri_item_bank for select to authenticated using (true);
create policy nutri_bank_write on nutri_item_bank for all to authenticated
  using (current_user_role() in ('proprietario', 'auditor_nutricao'))
  with check (current_user_role() in ('proprietario', 'auditor_nutricao'));
create policy nutri_versions_select on nutri_item_versions for select to authenticated using (true);
create policy nutri_versions_insert on nutri_item_versions for insert to authenticated
  with check (current_user_role() in ('proprietario', 'auditor_nutricao'));
create policy unit_nutri_select on unit_nutri_checklist for select to authenticated using (true);
create policy unit_nutri_write on unit_nutri_checklist for all to authenticated
  using (current_user_role() in ('proprietario', 'auditor_nutricao'))
  with check (current_user_role() in ('proprietario', 'auditor_nutricao'));

-- agenda: leitura geral; escrita só proprietário (troca manual); geração via service_role
create policy schedule_select on schedule_days for select to authenticated using (true);
create policy schedule_owner_update on schedule_days for update to authenticated using (is_owner()) with check (is_owner());

-- auditorias
create policy audits_select on audits for select to authenticated
  using (is_owner() or auditor_id = auth.uid());
create policy audits_insert on audits for insert to authenticated
  with check (
    auditor_id = auth.uid()
    and (
      (current_user_role() = 'auditor_geral' and tipo in ('completa', 'simplificada', 'producao'))
      or (current_user_role() = 'auditor_nutricao' and tipo = 'nutricional')
    )
  );
create policy audits_update_draft on audits for update to authenticated
  using (auditor_id = auth.uid() and status = 'rascunho')
  with check (auditor_id = auth.uid());

-- respostas: auditor da auditoria (rascunho) escreve; proprietário lê tudo
create policy answers_select on audit_answers for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and (a.auditor_id = auth.uid() or is_owner())));
create policy answers_write on audit_answers for all to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and a.auditor_id = auth.uid() and a.status = 'rascunho'))
  with check (exists (select 1 from audits a where a.id = audit_id and a.auditor_id = auth.uid() and a.status = 'rascunho'));

create policy photos_select on audit_photos for select to authenticated
  using (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                 where ans.id = answer_id and (a.auditor_id = auth.uid() or is_owner())));
create policy photos_write on audit_photos for all to authenticated
  using (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                 where ans.id = answer_id and a.auditor_id = auth.uid() and a.status = 'rascunho'))
  with check (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                      where ans.id = answer_id and a.auditor_id = auth.uid() and a.status = 'rascunho'));

-- pendências: leitura geral (auditores precisam ver as da loja); escrita via service_role
create policy pending_select on pending_issues for select to authenticated using (true);

create policy pending_reviews_select on audit_pending_reviews for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and (a.auditor_id = auth.uid() or is_owner())));
create policy pending_reviews_write on audit_pending_reviews for all to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and a.auditor_id = auth.uid() and a.status = 'rascunho'))
  with check (exists (select 1 from audits a where a.id = audit_id and a.auditor_id = auth.uid() and a.status = 'rascunho'));

-- fechamento e ajustes: só proprietário
create policy closings_select on monthly_closings for select to authenticated using (true);
create policy closings_owner on monthly_closings for all to authenticated using (is_owner()) with check (is_owner());
create policy adjustments_select on owner_adjustments for select to authenticated using (true);
create policy adjustments_owner on owner_adjustments for insert to authenticated with check (is_owner() and user_id = auth.uid());
create policy indicators_select on external_indicators for select to authenticated using (true);
create policy indicators_owner on external_indicators for all to authenticated using (is_owner()) with check (is_owner());

-- push: cada usuário gerencia as próprias subscriptions
create policy push_own on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own on notifications_log for select to authenticated using (user_id = auth.uid() or is_owner());

create policy reports_select on reports for select to authenticated using (is_owner());
create policy settings_select on app_settings for select to authenticated using (true);
create policy settings_owner on app_settings for all to authenticated using (is_owner()) with check (is_owner());

-- ---------- STORAGE ----------
create policy "audit photos read" on storage.objects for select to authenticated
  using (bucket_id = 'audit-photos');
create policy "audit photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'audit-photos' and current_user_role() in ('auditor_geral', 'auditor_nutricao'));
create policy "audit photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'audit-photos' and owner = auth.uid());
create policy "reports read owners" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and is_owner());
