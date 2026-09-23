-- Two reasons a product dies that the list could not express.
--
-- `not_sourceable` is the most common cause of death on this project and
-- there was no code for it. A garment rail where freight is four times the
-- goods price, bedding below container tier, a moulded toilet seat that ships
-- at 69% of what it cost. Every one of those had to go in as `other`, which
-- is where signal goes to die.
--
-- `not_profitable` is not `margin_thin` and the difference matters. Margin
-- thin is our word for headroom being small, which is measured before goods
-- cost. Not profitable is hers: she puts a supplier price in and the number
-- that comes out does not work. Two different measurements of two different
-- things, and collapsing them into one code would lose the only feedback the
-- research pipeline has ever had.
--
-- The constraint is dropped by its default Postgres name. Check yours first:
--
--   select conname from pg_constraint
--    where conrelid = 'decisions'::regclass and contype = 'c';
--
-- If it comes back as something else, change the drop line to match rather
-- than adding a second constraint alongside the first.

alter table decisions drop constraint if exists decisions_reason_check;

alter table decisions add constraint decisions_reason_check
  check (
    reason is null
    or reason in (
      'too_much_competition',
      'wrong_category',
      'margin_thin',
      'not_profitable',
      'not_sourceable',
      'previous_underperformer',
      'other'
    )
  );

comment on column decisions.reason is
  'Why a candidate was rejected. Mirrored in REJECTION_REASONS in the portal; '
  'drift between the two fails the insert rather than saving a bad value.';
