-- Notes are the team's, not one person's: the studio writes here too.

drop policy if exists notes_own_select on notes;
drop policy if exists notes_own_insert on notes;
drop policy if exists notes_own_update on notes;
drop policy if exists notes_own_delete on notes;

create policy notes_tenant_rw on notes
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on column notes.author_id is 'who wrote it. Everyone on the tenant can read and edit.';
