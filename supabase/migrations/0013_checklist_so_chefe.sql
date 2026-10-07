-- =====================================================================
-- Checklist nutricional (banco de itens, versões e composição por unidade): edição só pela
-- nutricionista chefe ou proprietário. Estagiárias continuam lendo (preenchem auditorias).
-- Idempotente.
-- =====================================================================
drop policy if exists nutri_bank_write on nutri_item_bank;
create policy nutri_bank_write on nutri_item_bank for all to authenticated
  using (is_owner() or is_nutri_chefe())
  with check (is_owner() or is_nutri_chefe());

drop policy if exists nutri_versions_insert on nutri_item_versions;
create policy nutri_versions_insert on nutri_item_versions for insert to authenticated
  with check (is_owner() or is_nutri_chefe());

drop policy if exists unit_nutri_write on unit_nutri_checklist;
create policy unit_nutri_write on unit_nutri_checklist for all to authenticated
  using (is_owner() or is_nutri_chefe())
  with check (is_owner() or is_nutri_chefe());
