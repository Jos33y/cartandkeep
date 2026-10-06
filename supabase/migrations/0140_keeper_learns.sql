-- 0140_keeper_learns.sql
-- Keeper learns (Joseey, 4 October: "keeper learn shouldn't be about my corrections but also its own"; "no need to
-- always wait for approval"). After each run of getting cards ready, Keeper looks back at what happened: what it sent
-- to Needs you, what failed, what eBay refused once listed, what she changed of its work, which of Keepr's matches she
-- turned down. It writes short lessons in plain words, each for a brand, a category or everything, and counts the
-- cards behind each. A lesson seen on two cards or more, and more often for than against, is used straight away; she
-- can remove any in the office, and a removed lesson never comes back by itself. Writes go through keeper_learn only.

create table if not exists keeper_lessons (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  -- Keeper's own short name for the lesson, so the same lesson seen again is counted, not written twice.
  key           text not null,
  scope_kind    text not null default 'all' check (scope_kind in ('all', 'brand', 'category')),
  scope         text not null default '',
  -- What the lesson is about: the words, the photos, eBay's item details, the listing match, the parcel, or general.
  area          text not null default 'general' check (area in ('writing', 'photos', 'details', 'match', 'parcel', 'general')),
  -- A step Keeper takes on it, beyond reading it: go to eBay's catalogue photos first for this brand.
  action        text not null default 'none' check (action in ('none', 'catalogue_photos_first')),
  lesson        text not null,
  -- Where it was learned: Keeper's own work, eBay's answer, her changes.
  source        text not null default 'keeper' check (source in ('keeper', 'ebay', 'her')),
  evidence      integer not null default 1 check (evidence >= 0),
  against       integer not null default 0 check (against >= 0),
  removed_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, key)
);

alter table keeper_lessons enable row level security;
drop policy if exists keeper_lessons_read on keeper_lessons;
create policy keeper_lessons_read on keeper_lessons for select to authenticated using (has_tenant(tenant_id));

-- In use: on two cards or more, more often for than against, not removed.
create or replace function lesson_in_use(l keeper_lessons)
returns boolean
language sql
immutable
as $$ select l.removed_at is null and l.evidence >= 2 and l.evidence > l.against; $$;

-- When Keeper last looked back, so the next look takes only what happened since.
alter table keeper_runs add column if not exists reviewed_at timestamptz;

/*
 * Keeper's lessons from one look back, as [{key, scope_kind, scope, area, action, lesson, source, evidence, against}].
 * A lesson seen before has its counts added and its words brought up to date; a removed one is left removed.
 */
create or replace function keeper_learn(p_tenant uuid, p_run uuid, p_lessons jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  x jsonb;
  n integer := 0;
begin
  for x in select value from jsonb_array_elements(coalesce(p_lessons, '[]'::jsonb)) loop
    continue when coalesce(btrim(x ->> 'key'), '') = '' or coalesce(btrim(x ->> 'lesson'), '') = '';
    insert into keeper_lessons as l (tenant_id, key, scope_kind, scope, area, action, lesson, source, evidence, against)
    values (
      p_tenant, left(lower(btrim(x ->> 'key')), 80),
      case when x ->> 'scope_kind' in ('all', 'brand', 'category') then x ->> 'scope_kind' else 'all' end,
      left(coalesce(btrim(x ->> 'scope'), ''), 80),
      case when x ->> 'area' in ('writing', 'photos', 'details', 'match', 'parcel', 'general') then x ->> 'area' else 'general' end,
      case when x ->> 'action' = 'catalogue_photos_first' then 'catalogue_photos_first' else 'none' end,
      left(btrim(x ->> 'lesson'), 300),
      case when x ->> 'source' in ('keeper', 'ebay', 'her') then x ->> 'source' else 'keeper' end,
      greatest(coalesce((x ->> 'evidence')::int, 1), 0), greatest(coalesce((x ->> 'against')::int, 0), 0)
    )
    on conflict (tenant_id, key) do update set
      evidence = l.evidence + excluded.evidence,
      against = l.against + excluded.against,
      lesson = case when l.removed_at is null then excluded.lesson else l.lesson end,
      action = case when l.removed_at is null then excluded.action else l.action end,
      updated_at = now();
    n := n + 1;
  end loop;
  if p_run is not null then update keeper_runs set reviewed_at = now() where id = p_run; end if;
  return n;
end;
$$;

revoke all on function keeper_learn(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function keeper_learn(uuid, uuid, jsonb) to service_role;

-- She removes a lesson in the office. It stays removed, whatever Keeper sees again.
create or replace function keeper_lesson_remove(p_id uuid)
returns keeper_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  l keeper_lessons;
begin
  select * into l from keeper_lessons where id = p_id for update;
  if not found or not has_tenant(l.tenant_id) then raise exception 'No such lesson.' using errcode = '42501'; end if;
  update keeper_lessons set removed_at = now(), updated_at = now() where id = p_id returning * into l;
  return l;
end;
$$;

revoke all on function keeper_lesson_remove(uuid) from public, anon;
grant execute on function keeper_lesson_remove(uuid) to authenticated;

-- What Keeper has already looked back on, so a change of hers or a refusal of eBay's is counted once, not at every look.
create table if not exists keeper_seen (
  tenant_id  uuid not null references tenants (id) on delete cascade,
  ref        text not null,
  seen_at    timestamptz not null default now(),
  primary key (tenant_id, ref)
);
alter table keeper_seen enable row level security;
