-- Reads only, and rolls back. Times the Candidates and Approved reads as the portal makes them, as a signed-in member,
-- and how much each sends to the browser. One result; paste it.
begin;
select set_config('ck.tenant', (select id::text from tenants where slug = 'cart-and-keep'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select m.user_id from memberships m join tenants t on t.id = m.tenant_id where t.slug = 'cart-and-keep' limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
create temp table if not exists _took (page text, ms numeric, cards int, mb numeric) on commit drop;
do $$
declare t0 timestamptz; v_n int; v_b bigint;
begin
  -- Candidates: every card in the shop's delivered batches, with what the page selects.
  t0 := clock_timestamp();
  select count(*), coalesce(sum(octet_length(j::text)), 0) into v_n, v_b from (
    select row_to_json(x) as j from (
      select c.id, c.batch_id, c.category_id, c.category_top_id, c.category_level2_id, c.category_source, c.category_flag, c.source_labels,
        c.title, c.category, c.image_url, c.supplier_url, c.reference_url, c.external_ref, c.classification, c.tier, c.score,
        c.component_count, c.breakdown, c.ebay_category_id, c.ebay_category_path, c.cluster, c.variation_count, c.monthly_headroom,
        c.confidence, c.signal_count, c.signals, c.margin, c.listing, c.headroom, c.hold, c.same_sku_sellers, c.bulky, c.routes,
        c.window_series, c.entry, c.sold_30d, c.avg_sold_price, c.active_listings, c.sell_through, c.trend, c.seller_concentration,
        c.competition, c.window_start, c.window_end, c.recommended_channels, c.recommended_volume, c.analyst_note,
        (select json_agg(d) from (select id, action, reason, note, decided_at from decisions where candidate_id = c.id) d) as decisions,
        (select json_agg(nt) from (select id, body, created_at from candidate_notes where candidate_id = c.id) nt) as notes,
        (select json_agg(s) from candidate_sources s where s.candidate_id = c.id) as sources
      from candidates c join batches bt on bt.id = c.batch_id and bt.status = 'delivered'
      where c.tenant_id = current_setting('ck.tenant')::uuid) x) y;
  insert into _took values ('Candidates', round(extract(epoch from clock_timestamp() - t0) * 1000), v_n, round(v_b / 1048576.0, 1));

  -- Approved: every approved card, with what the page selects.
  t0 := clock_timestamp();
  select count(*), coalesce(sum(octet_length(j::text)), 0) into v_n, v_b from (
    select row_to_json(x) as j from (
      select c.id, c.title, c.category, c.external_ref, c.reference_url, c.classification, c.image_url, c.ebay_category_id,
        c.ebay_category_path, c.variation_count, c.score, c.breakdown, c.margin, c.headroom, c.hold, c.same_sku_sellers, c.bulky,
        c.entry, c.monthly_headroom, c.active_listings, c.listing, c.draft, c.ebay, c.competition, c.photo_checks, c.supplier_read,
        c.sold_30d, c.avg_sold_price, c.window_start, c.window_series, c.recommended_channels,
        (select json_agg(p) from (select id, status, slug from store_products where candidate_id = c.id) p) as store_products,
        (select json_agg(s) from candidate_sources s where s.candidate_id = c.id) as sources
      from candidates c join decisions d on d.candidate_id = c.id and d.action = 'approve'
      where c.tenant_id = current_setting('ck.tenant')::uuid) x) y;
  insert into _took values ('Approved', round(extract(epoch from clock_timestamp() - t0) * 1000), v_n, round(v_b / 1048576.0, 1));
end $$;
select * from _took;
rollback;
