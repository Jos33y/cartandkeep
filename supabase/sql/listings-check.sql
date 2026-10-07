-- Reads only. Run as one; one JSON result. The live_listings view: what it is built from, how big those tables are,
-- their indexes and row security, and how long the Listings read takes with and without the portal's row checks.
with t as (select id from tenants where slug = 'cart-and-keep')
select jsonb_build_object(
  'view', pg_get_viewdef('live_listings'::regclass, true),
  'view_options', (select reloptions from pg_class where oid = 'live_listings'::regclass),
  'tables', (
    select jsonb_object_agg(c.relname, jsonb_build_object(
      'rows', c.reltuples::bigint, 'size', pg_size_pretty(pg_total_relation_size(c.oid)), 'rls', c.relrowsecurity,
      'indexes', (select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = c.oid),
      'policies', (select jsonb_agg(jsonb_build_object('name', p.polname, 'using', pg_get_expr(p.polqual, p.polrelid)))
                   from pg_policy p where p.polrelid = c.oid and p.polcmd in ('r', '*'))))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.oid in (
      select d.refobjid from pg_depend d join pg_rewrite w on w.oid = d.objid
      where w.ev_class = 'live_listings'::regclass and d.refobjid <> 'live_listings'::regclass)),
  'views_used', (
    select jsonb_agg(distinct c.relname) from pg_depend d join pg_rewrite w on w.oid = d.objid join pg_class c on c.oid = d.refobjid
    where w.ev_class = 'live_listings'::regclass and c.relkind in ('v', 'm') and c.oid <> 'live_listings'::regclass),
  'rows_for_her', (select count(*) from live_listings l, t where l.tenant_id = t.id)
) as found;
