-- Written after the fact, on 13 August. The column exists in the database and
-- the 6 August handoff records this migration as applied, but the file was
-- never written. Recorded now so the directory describes the database.
--
-- eBay permits fulfilling an order from a wholesaler and does not permit
-- fulfilling it from another retailer. That distinction decides whether a
-- supplier can be used at all, so it is a column rather than a note: a
-- marketplace listing and a trade wholesaler are different kinds of source and
-- the margin computed from each means something different.

alter table suppliers
  add column if not exists kind text;

alter table suppliers
  drop constraint if exists suppliers_kind_check;

alter table suppliers
  add constraint suppliers_kind_check
  check (kind is null or kind in ('wholesale', 'retailer', 'marketplace', 'manufacturer'));

comment on column suppliers.kind is
  'wholesale, retailer, marketplace or manufacturer. eBay permits fulfilling '
  'from a wholesaler and not from another retailer, so this is a listing '
  'eligibility fact rather than a label.';
