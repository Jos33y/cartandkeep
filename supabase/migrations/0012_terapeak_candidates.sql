-- The Terapeak route produces figures the pipeline route does not: headroom
-- before goods cost, a per-window unit series, and a same-SKU seller count.
-- None of them fit an existing column, and folding them into margin or signals
-- would hide what they are.

alter table candidates
  add column headroom          numeric(10,2),
  add column hold              numeric(5,2),
  add column same_sku_sellers  integer,
  add column bulky             boolean,
  add column routes            text,
  add column reference_url     text,
  -- [{ window, units, price }], oldest first. The windows are not contiguous,
  -- so the interface must show the gap rather than space them evenly.
  add column window_series     jsonb not null default '[]'::jsonb;

comment on column candidates.headroom is 'sale price less fees, postage, packaging and ads, before goods cost';
comment on column candidates.hold is 'latest window units against the product own average across windows';
comment on column candidates.reference_url is 'the eBay listing the demand figures were measured from, not a supplier';

-- The pattern vocabulary comes from the analysis script and carries a warning
-- the old three-value set cannot. Fading collapsed to unknown is a finding lost.
alter table candidates drop constraint if exists candidates_classification_check;
alter table candidates add constraint candidates_classification_check
  check (classification in (
    'evergreen', 'rising', 'new', 'erratic', 'intermittent', 'fading',
    'trend_spike', 'unknown'
  ));

create index on candidates (batch_id, headroom desc nulls last);
