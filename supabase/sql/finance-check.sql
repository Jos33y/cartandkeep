-- finance-check.sql
-- Read only. What Finance is built on, so its eBay fees can be switched to eBay's real charges. Run it in the SQL
-- editor and send back the one row it returns.

select jsonb_build_object(
  -- The views Finance and Products read, as written.
  'views', (
    select jsonb_object_agg(c.relname, pg_get_viewdef(c.oid, true))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and (c.relname in ('store_channel_profit', 'store_product_margin')
        or pg_get_viewdef(c.oid, true) ~ '(channel_sales|selling_costs|ad_rate_pct|fees_estimated)')
  ),
  -- Functions that work out fees or read the selling costs.
  'functions', (
    select jsonb_object_agg(p.proname, pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '(ad_rate_pct|fees_estimated|selling_costs|fees ->|fees->)'
  ),
  'channel_sales_columns', (
    select jsonb_agg(column_name || ' ' || data_type order by ordinal_position)
    from information_schema.columns where table_schema = 'public' and table_name = 'channel_sales'
  ),
  -- The fee settings on the shop: rates only, nothing else from the row.
  'tenant_fees', (select jsonb_agg(jsonb_build_object('fees', t.fees, 'selling_costs', t.store -> 'selling_costs')) from tenants t),
  -- eBay sales by month: how many lines carry eBay's fee and how many are estimated.
  'ebay_sales', (
    select jsonb_agg(m order by m ->> 'month')
    from (
      select jsonb_build_object(
        'month', to_char(date_trunc('month', sold_at), 'YYYY-MM'),
        'lines', count(*),
        'gross', round(sum(gross)::numeric, 2),
        'fees', round(sum(fees)::numeric, 2),
        'with_fee', count(*) filter (where fees is not null),
        'estimated', count(*) filter (where fees_estimated)
      ) m
      from channel_sales where channel = 'ebay'
      group by date_trunc('month', sold_at)
    ) x
  )
) as finance_check;
