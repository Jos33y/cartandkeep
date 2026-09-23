-- A note only existed as a field on a rejection, so anything worth writing down
-- about a product she was keeping had nowhere to go. Notes are separate from
-- decisions because they are not decisions: a supplier lead, a size question, a
-- reason to look again in October.

create table candidate_notes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,

  body          text not null check (length(btrim(body)) > 0),

  author        uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

create index on candidate_notes (candidate_id, created_at desc);
create index on candidate_notes (tenant_id, created_at desc);

alter table candidate_notes enable row level security;

create policy candidate_notes_rw on candidate_notes
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
