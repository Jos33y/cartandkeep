-- Written after the fact. Both changes were run as loose SQL on 13 August and
-- the migrations directory no longer described the database, which is the
-- thing an append only directory exists to prevent.
--
-- Status is the build lifecycle: building, delivered, failed. Whether a
-- delivered batch turned out to be worth anything is a different fact, so it
-- gets its own column rather than a fourth status word. The 10 August pet
-- batch was delivered and then retired because she could not source it.

alter table batches
  add column if not exists retired_at timestamptz,
  add column if not exists retired_reason text;

-- Units times headroom. What a product would be worth in a month at the rate it
-- actually sold, before goods cost. Sorted on where the score has too few
-- components behind it to be honest, which is any batch under three windows.

alter table candidates
  add column if not exists monthly_headroom numeric(10,2);
