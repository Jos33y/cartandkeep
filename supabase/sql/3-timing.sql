-- Step 3. Listings as the portal reads it, as a signed-in member, timed. Rolls back. Paste the result.
begin;
select set_config('ck.tenant', (select id::text from tenants where slug = 'cart-and-keep'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select m.user_id from memberships m join tenants t on t.id = m.tenant_id where t.slug = 'cart-and-keep' limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
create temp table if not exists _took (what text, ms numeric, said text) on commit drop;
do $$
declare t0 timestamptz; n int;
begin
  t0 := clock_timestamp();
  select count(*) into n from (select * from live_listings where tenant_id = current_setting('ck.tenant')::uuid order by key) x;
  insert into _took values ('Listings', round(extract(epoch from clock_timestamp() - t0) * 1000), n || ' rows');
  t0 := clock_timestamp();
  select count(*) into n from candidates c join decisions d on d.candidate_id = c.id and d.action = 'approve' where c.tenant_id = current_setting('ck.tenant')::uuid;
  insert into _took values ('Approved cards', round(extract(epoch from clock_timestamp() - t0) * 1000), n || ' rows');
  t0 := clock_timestamp();
  select count(*) into n from candidates where tenant_id = current_setting('ck.tenant')::uuid;
  insert into _took values ('All cards', round(extract(epoch from clock_timestamp() - t0) * 1000), n || ' rows');
end $$;
select * from _took;
rollback;
