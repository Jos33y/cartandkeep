-- 0098_portal_visits.sql
-- Who opens the portal, on which days, and which screens. One row per person, tenant and London day.
-- No clicks, no typing, no time on screen.

create table if not exists portal_visits (
  tenant_id          uuid not null references tenants(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  day                date not null,
  first_at           timestamptz not null default now(),
  last_at            timestamptz not null default now(),
  visits             integer not null default 1 check (visits > 0),
  -- End of the visit before the current one: the "last visit" a person is shown.
  previous_visit_at  timestamptz,
  -- [{ "screen": "/candidates", "opens": 2 }], in the order first opened that day.
  screens            jsonb not null default '[]'::jsonb check (jsonb_typeof(screens) = 'array'),
  primary key (tenant_id, user_id, day)
);

create index if not exists portal_visits_tenant_recent on portal_visits (tenant_id, last_at desc);

alter table portal_visits enable row level security;

-- Everyone reads their own record; the studio reads every member's.
drop policy if exists portal_visits_read on portal_visits;
create policy portal_visits_read on portal_visits
  for select to authenticated
  using (has_tenant(tenant_id) and (user_id = auth.uid() or is_platform_admin()));

drop policy if exists portal_visits_insert on portal_visits;
create policy portal_visits_insert on portal_visits
  for insert to authenticated
  with check (user_id = auth.uid() and has_tenant(tenant_id));

drop policy if exists portal_visits_update on portal_visits;
create policy portal_visits_update on portal_visits
  for update to authenticated
  using (user_id = auth.uid() and has_tenant(tenant_id))
  with check (user_id = auth.uid() and has_tenant(tenant_id));

revoke all on portal_visits from anon;
grant select, insert, update on portal_visits to authenticated;

create or replace function portal_visit_screens(screens jsonb, screen text)
returns jsonb
language sql immutable
set search_path = public
as $$
  select case
    when screen is null or length(screen) > 80 or screen !~ '^/[a-z0-9/_-]*$' then screens
    when exists (select 1 from jsonb_array_elements(screens) e where e->>'screen' = screen) then (
      select jsonb_agg(
        case when e->>'screen' = screen
          then jsonb_build_object('screen', screen, 'opens', (e->>'opens')::int + 1)
          else e end
        order by i)
      from jsonb_array_elements(screens) with ordinality as t(e, i)
    )
    -- A ceiling so a bad client cannot grow one row without bound.
    when jsonb_array_length(screens) >= 60 then screens
    else screens || jsonb_build_array(jsonb_build_object('screen', screen, 'opens', 1))
  end;
$$;

-- Invoker, so the policies above decide what may be written. Returns the caller's previous visit.
create or replace function record_portal_visit(p_tenant uuid, p_screen text default null)
returns timestamptz
language sql volatile security invoker
set search_path = public
as $$
  insert into portal_visits as v (tenant_id, user_id, day, previous_visit_at, screens)
  values (
    p_tenant,
    auth.uid(),
    (now() at time zone 'Europe/London')::date,
    (select max(p.last_at) from portal_visits p where p.tenant_id = p_tenant and p.user_id = auth.uid()),
    portal_visit_screens('[]'::jsonb, p_screen)
  )
  on conflict (tenant_id, user_id, day) do update set
    visits = v.visits + (now() - v.last_at > interval '30 minutes')::int,
    previous_visit_at = case when now() - v.last_at > interval '30 minutes' then v.last_at else v.previous_visit_at end,
    last_at = now(),
    screens = portal_visit_screens(v.screens, p_screen)
  returning v.previous_visit_at;
$$;

revoke all on function record_portal_visit(uuid, text) from public, anon;
grant execute on function record_portal_visit(uuid, text) to authenticated;
revoke all on function portal_visit_screens(jsonb, text) from public, anon;
grant execute on function portal_visit_screens(jsonb, text) to authenticated;

-- Members only, so the studio's own visits never read as the client's.
-- platform_admins is readable only by the studio, so a member sees exactly their own rows here.
create or replace view portal_member_visits
with (security_invoker = on) as
select v.*
from portal_visits v
where not exists (select 1 from platform_admins a where a.user_id = v.user_id);

revoke all on portal_member_visits from anon;
grant select on portal_member_visits to authenticated;
