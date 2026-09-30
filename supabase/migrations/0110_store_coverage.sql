-- Coverage for the Google best sellers route, the store cards' own funnel: every product Google ranked in a
-- category's exports and where it stopped. research_queries is the eBay gate's funnel and keeps its own shape.
--
-- Stages, in the order a product passes them:
--   google   filtered before any shop was looked at: own label, not a shelf product, outside the price range
--   shelf    no UK shop on file stocks it, or only a part or a bigger pack was seen
--   page     the shop page was opened: wrong product, unsure, page gone, shop blocked, or never read
--   import   picked and confirmed, then held back: big brand, no price, bigger pack, over 20kg, a duplicate
--   sent     a card in her queue
-- Months and season carry the trend: how many of the exported months it ranked in, and when it sells.

create table if not exists public.store_coverage (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  batch_id      uuid not null references public.batches (id) on delete cascade,
  key           text not null,          -- brand|title, squashed: one Google product
  query         text,                   -- the card's external_ref when it became one
  title         text not null,
  brand         text,
  gtin          text,
  rank          integer,                -- best popularity rank across the exports
  months        smallint,               -- how many exported periods it ranked in
  periods       text[] not null default '{}',
  season        text,                   -- All year, Winter, Summer, Christmas, Halloween
  need          text,                   -- safety, pest, damp, part and so on; empty when browsed, not searched
  google_min    numeric(10,2),
  google_max    numeric(10,2),
  stage         text not null check (stage in ('google', 'shelf', 'page', 'import', 'sent')),
  reason        text check (reason is null or reason in (
                  'own_label', 'not_shelf', 'outside_price',
                  'not_seen', 'part_only', 'bigger_pack',
                  'page_wrong', 'page_unsure', 'page_gone', 'shop_blocked', 'page_unread',
                  'big_brand', 'no_price', 'bigger_pack_page', 'over_20kg', 'duplicate'
                )),
  shop          text,
  shop_url      text,
  cost          numeric(10,2),
  page_verdict  text,
  candidate_id  uuid references public.candidates (id) on delete set null,
  checked_at    timestamptz not null default now(),
  unique (batch_id, key)
);

create index if not exists store_coverage_tenant_batch_idx on public.store_coverage (tenant_id, batch_id, stage);

alter table public.store_coverage enable row level security;

drop policy if exists store_coverage_rw on public.store_coverage;
drop policy if exists store_coverage_read on public.store_coverage;
-- Read only from the portal: the import writes with the service key, so she can see coverage but never edit it.
create policy store_coverage_read on public.store_coverage
  for select to authenticated using (has_tenant(tenant_id));

-- The funnel as counts, so the page never pages through 25,000 rows to draw it.
create or replace view public.store_coverage_summary
with (security_invoker = true) as
select tenant_id, batch_id, stage, reason, season, count(*)::integer as products,
       count(*) filter (where months >= 2)::integer as ranked_more_than_once,
       count(*) filter (where need is not null and need <> '')::integer as searched_by_need
from public.store_coverage
group by tenant_id, batch_id, stage, reason, season;

grant select on public.store_coverage_summary to authenticated;

-- The gap: best sellers no UK shop on file stocks, by brand. Which shop to collect next is read from this.
create or replace view public.store_coverage_gap
with (security_invoker = true) as
select tenant_id, batch_id, season, brand, count(*)::integer as unseen, min(rank) as best_rank
from public.store_coverage
where stage = 'shelf' and reason = 'not_seen'
group by tenant_id, batch_id, season, brand;

grant select on public.store_coverage_gap to authenticated;

-- A reason opened on Coverage reads its products best ranked first, fifty at a time.
create index if not exists store_coverage_reason_idx on public.store_coverage (batch_id, stage, reason, rank);
