-- Why money went back on an eBay sale, so a product that keeps coming back is seen before it is listed again.
--
-- `status` already says refunded or cancelled. These say how much went back, when, why in her words, and whose
-- doing it was: the product (damaged, faulty, not as described, never arrived), her (cancelled, usually out of
-- stock, which eBay counts against her account) or the buyer (changed their mind). A part refund on a paid sale
-- fills `refunded` too, and its line's gross is already the takings after it.

alter table channel_sales add column if not exists refunded numeric(10, 2);
alter table channel_sales add column if not exists refunded_at timestamptz;
alter table channel_sales add column if not exists refund_reason text;
alter table channel_sales add column if not exists refund_fault text
  check (refund_fault is null or refund_fault in ('product', 'her', 'buyer'));

comment on column channel_sales.refund_reason is
  'Why the money went back, in plain words, from eBay''s cancellation, return or item-not-received case. Null when eBay gave none.';
comment on column channel_sales.refund_fault is
  'product, her or buyer: what the refund says needs changing. Null when eBay gave no reason.';

-- The refunds, read on Finance and on Traffic. Under the same tenant policy as the table.
create index if not exists channel_sales_refunds_idx
  on channel_sales (tenant_id, sold_at desc) where status <> 'paid' or refunded is not null;
