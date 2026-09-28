-- Cards she can act on today: a UK shelf that sells the same product, and what it leaves per sale.
-- Read only. Paste into the Supabase SQL editor and run; export the result as CSV.
--   buy now      same product, same pack on the shelf; profit is measured from the shelf price
--   check pack   same brand on the shelf, pack not confirmed; shelf price against the buy-under figure
with c as (
  select
    c.title,
    c.margin -> 'match' ->> 'level'            as match_level,
    c.margin -> 'match' ->> 'via'              as matched_by,
    c.margin -> 'shelf' ->> 'shop'             as shop,
    (c.margin -> 'shelf' ->> 'price')::numeric as shelf_price,
    (c.margin ->> 'max_goods_cost')::numeric   as buy_under,
    (c.margin ->> 'sale_price')::numeric       as sell_at,
    (c.margin ->> 'net')::numeric              as profit,
    c.margin -> 'shelf' ->> 'url'              as shelf_link,
    c.reference_url                            as ebay_link,
    d.action                                   as her_decision,
    b.category_label                           as tab
  from candidates c
  join batches b on b.id = c.batch_id
  join tenants t on t.id = c.tenant_id and t.slug = 'cart-and-keep'
  left join decisions d on d.candidate_id = c.id
  where b.retired_at is null
    and coalesce(d.action, '') <> 'reject'
    and c.margin -> 'shelf' ->> 'price' is not null
)
select
  case
    when match_level = 'same_product_same_pack' and profit >= 2 then 'buy now'
    when match_level = 'same_product_same_pack' and profit > 0 then 'buy now, under £2'
    when match_level in ('same_product_different_pack', 'same_brand_pack_unknown')
         and shelf_price <= buy_under then 'check pack'
  end as tier,
  title, shop, shelf_price, buy_under, sell_at, profit, matched_by, her_decision, tab, shelf_link, ebay_link
from c
where (match_level = 'same_product_same_pack' and profit > 0)
   or (match_level in ('same_product_different_pack', 'same_brand_pack_unknown') and shelf_price <= buy_under)
order by
  case when match_level = 'same_product_same_pack' then 0 else 1 end,
  profit desc nulls last,
  buy_under - shelf_price desc;
