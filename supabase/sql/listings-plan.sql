-- Reads only, and rolls back. Paste every line of the result. The Listings read as the portal makes it, timed with
-- the row checks the portal's signed-in role gets.
begin;
select set_config('ck.tenant', (select id::text from tenants where slug = 'cart-and-keep'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select m.user_id from memberships m join tenants t on t.id = m.tenant_id where t.slug = 'cart-and-keep' limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
set local statement_timeout = '30s';
explain (analyze, buffers, format text)
select * from live_listings where tenant_id = current_setting('ck.tenant')::uuid order by key limit 1000;
rollback;
