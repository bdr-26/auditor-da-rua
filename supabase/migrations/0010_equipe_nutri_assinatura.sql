-- =====================================================================
-- Equipe de nutrição (chefe + estagiárias), cadastro de usuários pelo proprietário e
-- assinatura do supervisor da unidade na auditoria.
-- =====================================================================

-- ---------- Nível da equipe nutri ----------
alter table profiles add column if not exists nutri_nivel text;
alter table profiles drop constraint if exists profiles_nutri_nivel_check;
alter table profiles add constraint profiles_nutri_nivel_check check (nutri_nivel is null or nutri_nivel in ('chefe', 'estagiaria'));
-- quem já é nutricionista vira chefe (Daniele)
update profiles set nutri_nivel = 'chefe' where role = 'auditor_nutricao' and nutri_nivel is null;

create or replace function is_nutri_chefe() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'auditor_nutricao' and nutri_nivel = 'chefe');
$$;

-- Quem conduz uma auditoria: o próprio auditor, ou a nutricionista chefe nas nutricionais (edita as das estagiárias).
create or replace function can_manage_audit(a_auditor uuid, a_tipo audit_type) returns boolean language sql stable security definer set search_path = public as $$
  select a_auditor = auth.uid() or (a_tipo = 'nutricional' and is_nutri_chefe());
$$;

drop policy if exists audits_select on audits;
create policy audits_select on audits for select to authenticated
  using (is_owner() or can_manage_audit(auditor_id, tipo));
drop policy if exists audits_update_draft on audits;
create policy audits_update_draft on audits for update to authenticated
  using (can_manage_audit(auditor_id, tipo) and status = 'rascunho')
  with check (can_manage_audit(auditor_id, tipo));

drop policy if exists answers_select on audit_answers;
create policy answers_select on audit_answers for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and (is_owner() or can_manage_audit(a.auditor_id, a.tipo))));
drop policy if exists answers_write on audit_answers;
create policy answers_write on audit_answers for all to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'))
  with check (exists (select 1 from audits a where a.id = audit_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'));

drop policy if exists photos_select on audit_photos;
create policy photos_select on audit_photos for select to authenticated
  using (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                 where ans.id = answer_id and (is_owner() or can_manage_audit(a.auditor_id, a.tipo))));
drop policy if exists photos_write on audit_photos;
create policy photos_write on audit_photos for all to authenticated
  using (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                 where ans.id = answer_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'))
  with check (exists (select 1 from audit_answers ans join audits a on a.id = ans.audit_id
                      where ans.id = answer_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'));

drop policy if exists pending_reviews_select on audit_pending_reviews;
create policy pending_reviews_select on audit_pending_reviews for select to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and (is_owner() or can_manage_audit(a.auditor_id, a.tipo))));
drop policy if exists pending_reviews_write on audit_pending_reviews;
create policy pending_reviews_write on audit_pending_reviews for all to authenticated
  using (exists (select 1 from audits a where a.id = audit_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'))
  with check (exists (select 1 from audits a where a.id = audit_id and can_manage_audit(a.auditor_id, a.tipo) and a.status = 'rascunho'));

-- ---------- Assinatura do supervisor da unidade ----------
alter table audits
  add column if not exists assinatura_nome text,
  add column if not exists assinatura_cpf text,
  add column if not exists assinatura_cargo text,
  add column if not exists assinatura_path text,          -- PNG no bucket audit-photos (assinaturas/<audit_id>.png)
  add column if not exists assinada_em timestamptz,
  add column if not exists assinatura_registrada_por uuid references profiles(id);
