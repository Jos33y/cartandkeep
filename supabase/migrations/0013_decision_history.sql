-- decisions holds current state, one row per candidate. History is separate and
-- append only. Splitting them keeps every read a plain join instead of a window
-- function, and keeps reject_requires_reason meaningful on the live row.

create table decision_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  candidate_id    uuid references candidates(id) on delete set null,

  -- denormalised so the history survives a candidate being rebuilt or removed
  candidate_title text,
  external_ref    text,

  from_action     text,
  to_action       text,
  from_reason     text,
  to_reason       text,
  note            text,

  actor           uuid references auth.users(id),
  happened_at     timestamptz not null default now()
);

create index on decision_events (tenant_id, happened_at desc);
create index on decision_events (candidate_id);

comment on column decision_events.to_action is 'null means the decision was cleared';

-- Written by the trigger, never by hand, so a client that forgets cannot skip it.
create or replace function log_decision_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  target uuid;
begin
  target := coalesce(new.candidate_id, old.candidate_id);
  select title, external_ref into c from candidates where id = target;

  insert into decision_events (
    tenant_id, candidate_id, candidate_title, external_ref,
    from_action, to_action, from_reason, to_reason, note, actor
  ) values (
    coalesce(new.tenant_id, old.tenant_id),
    target,
    c.title,
    c.external_ref,
    case when tg_op in ('UPDATE', 'DELETE') then old.action end,
    case when tg_op = 'DELETE' then null else new.action end,
    case when tg_op in ('UPDATE', 'DELETE') then old.reason end,
    case when tg_op = 'DELETE' then null else new.reason end,
    case when tg_op = 'DELETE' then old.note else new.note end,
    auth.uid()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger decisions_audit
  after insert or update or delete on decisions
  for each row execute function log_decision_event();

-- The column existed and was never populated, so every decision was anonymous.
alter table decisions alter column decided_by set default auth.uid();

alter table decision_events enable row level security;

create policy decision_events_read on decision_events
  for select to authenticated using (has_tenant(tenant_id));

create policy decision_events_write on decision_events
  for insert to authenticated with check (has_tenant(tenant_id));

-- Reruns used to delete the batch and reinsert it, which cascaded her decisions
-- away. A candidate is now identified within its batch so a rerun can update.
create unique index candidates_batch_ref_key
  on candidates (batch_id, external_ref)
  where external_ref is not null;
