-- Notes are the one table in this schema without an admin bypass. Every other
-- policy allows is_platform_admin() through, because the studio operates the
-- platform. Here that would make "private" untrue in the interface, so the
-- policy is author only.
--
-- This is privacy from the portal, not from the database owner. The pipeline
-- runs on the secret key and bypasses RLS like any other service role.

create table notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,

  title       text,
  body        text not null default '',
  pinned      boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on notes (author_id, pinned desc, updated_at desc);
create index on notes (tenant_id);

alter table notes enable row level security;

create policy notes_own_select on notes for select to authenticated
  using (author_id = auth.uid());

create policy notes_own_insert on notes for insert to authenticated
  with check (author_id = auth.uid() and has_tenant(tenant_id));

create policy notes_own_update on notes for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy notes_own_delete on notes for delete to authenticated
  using (author_id = auth.uid());

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_touch_updated_at
  before update on notes
  for each row execute function touch_updated_at();

comment on table notes is 'author only, no platform admin bypass by design';


-- https://cartandkeep.com,https://www.cartandkeep.com,https://portal.cartandkeep.com,https://status.cartandkeep.com