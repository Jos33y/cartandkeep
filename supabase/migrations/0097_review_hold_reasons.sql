-- A review can be held back only for a reason the published reviews policy names.
-- Concealing negative reviews is a banned practice under the DMCC Act 2024, so the reason is recorded, not just the status.

alter table store_reviews
  add column if not exists hidden_reason text;

alter table store_reviews drop constraint if exists store_reviews_hidden_reason_known;
alter table store_reviews add constraint store_reviews_hidden_reason_known
  check (hidden_reason is null or hidden_reason in ('abusive', 'personal_details', 'off_topic', 'advertising'));

-- A trigger rather than a check: reviews hidden before this policy keep their state and can still be replied to.
create or replace function store_reviews_hold_reason()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'hidden' then
    new.hidden_reason := null;
  elsif new.hidden_reason is null
    and (tg_op = 'INSERT' or old.status is distinct from 'hidden') then
    raise exception 'A review can only be hidden for one of the reasons on the reviews page'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists store_reviews_hold_reason on store_reviews;
create trigger store_reviews_hold_reason
  before insert or update on store_reviews
  for each row execute function store_reviews_hold_reason();

comment on column store_reviews.hidden_reason is
  'Why a review is held back. One of the four grounds on the shop''s reviews page; nothing else is permitted.';
