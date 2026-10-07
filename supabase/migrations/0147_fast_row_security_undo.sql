-- 0147_fast_row_security_undo.sql
-- Only if 0147 ever needs taking back: every rule it changed goes back to has_tenant(...), word for word as before.
-- Not a migration to run in order; kept beside 0147 for the day it is wanted. Safe to run twice.
do $$
declare
  p record;
  pat constant text := '\(\( SELECT is_platform_admin\(\) AS is_platform_admin\) OR \(([a-z_]+(\.[a-z_]+)?) = ANY \(\( SELECT my_tenant_ids\(\) AS my_tenant_ids\)::uuid\[\]\)\)\)';
  q text;
  c text;
  n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public' and (qual ~ 'my_tenant_ids\(' or with_check ~ 'my_tenant_ids\(')
  loop
    q := case when p.qual is not null then regexp_replace(p.qual, pat, 'has_tenant(\1)', 'g') end;
    c := case when p.with_check is not null then regexp_replace(p.with_check, pat, 'has_tenant(\1)', 'g') end;
    execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
      || case when q is not null then format(' using (%s)', q) else '' end
      || case when c is not null then format(' with check (%s)', c) else '' end;
    n := n + 1;
  end loop;
  raise notice 'Rules put back: %', n;
  if exists (select 1 from pg_policies where schemaname = 'public' and (qual ~ 'my_tenant_ids\(' or with_check ~ 'my_tenant_ids\(')) then
    raise exception 'A rule could not be put back; nothing was changed.';
  end if;
end $$;
