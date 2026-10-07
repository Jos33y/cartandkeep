-- 0147_fast_row_security.sql
-- Row security that costs once per request, not once per row (Joseey, 7 October: Listings timing out at 8 seconds).
--
-- Every rule read has_tenant(tenant_id), a function Postgres runs again for each row it looks at: about 61,000 times
-- for one Listings read, at 0.12 ms each. The same check is now written so Postgres works it out once per request:
--
--   has_tenant(x)   becomes   ((SELECT is_platform_admin()) OR x = ANY ((SELECT my_tenant_ids())::uuid[]))
--
-- which says exactly what has_tenant says (a platform admin, or a member of that shop), with both halves worked out
-- once and reused for every row. Nothing anyone can see or change moves: the scratch run compared every table's
-- visible rows, inserts, updates and deletes, as a member, a stranger, an admin and the public, before and after.
--
-- Each rule is changed in place (ALTER POLICY): its name, command, roles and the rest of its wording stay as they are.
-- has_tenant itself is kept: functions still call it once each. Safe to run twice: a rule already changed has nothing
-- left to match. 0147_fast_row_security_undo.sql puts every rule back as it was.

-- The shops the signed-in user belongs to, read once.
create or replace function my_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(tenant_id), '{}') from memberships where user_id = auth.uid();
$$;

revoke all on function my_tenant_ids() from public, anon;
grant execute on function my_tenant_ids() to authenticated;

do $$
declare
  p record;
  pat constant text := 'has_tenant\(([a-z_]+(\.[a-z_]+)?)\)';
  rep constant text := '((SELECT is_platform_admin()) OR \1 = ANY ((SELECT my_tenant_ids())::uuid[]))';
  q text;
  c text;
  n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and (qual ~ 'has_tenant\(' or with_check ~ 'has_tenant\(')
  loop
    q := case when p.qual is not null then regexp_replace(p.qual, pat, rep, 'g') end;
    c := case when p.with_check is not null then regexp_replace(p.with_check, pat, rep, 'g') end;
    execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
      || case when q is not null then format(' using (%s)', q) else '' end
      || case when c is not null then format(' with check (%s)', c) else '' end;
    n := n + 1;
  end loop;
  raise notice 'Rules changed: %', n;
  if exists (select 1 from pg_policies where schemaname = 'public' and (qual ~ 'has_tenant\(' or with_check ~ 'has_tenant\(')) then
    raise exception 'A rule still calls has_tenant row by row; nothing was changed.';
  end if;
end $$;
