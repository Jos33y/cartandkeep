-- Reads only. Run as one; one JSON result. Every row security rule in the public schema, exactly as stored, and the
-- two functions they lean on, so the rewrite matches each rule word for word.
select jsonb_build_object(
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', policyname, 'permissive', permissive, 'roles', roles, 'cmd', cmd,
      'using', qual, 'check', with_check) order by tablename, policyname)
    from pg_policies where schemaname = 'public'),
  'rls_tables', (
    select jsonb_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity),
  'has_tenant', (select pg_get_functiondef('public.has_tenant(uuid)'::regprocedure)),
  'is_platform_admin', (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                        where n.nspname = 'public' and p.proname = 'is_platform_admin' limit 1),
  'memberships_columns', (select jsonb_agg(column_name || ' ' || data_type order by ordinal_position)
                          from information_schema.columns where table_schema = 'public' and table_name = 'memberships'),
  'memberships_indexes', (select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = 'public.memberships'::regclass),
  'admin_source', (select jsonb_agg(c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname ilike '%admin%')
) as found;
