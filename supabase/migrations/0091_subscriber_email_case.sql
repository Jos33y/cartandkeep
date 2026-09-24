-- The list was unique on email as typed, so Ada@Example.com and ada@example.com could both sit on it,
-- and an unsubscribe from one left the other being mailed. Emails are now stored lower case, once.

-- Where two rows are the same address, the keeper takes the latest unsubscribe from either, so nobody
-- who left is put back on.
with ranked as (
  select id, tenant_id, lower(trim(email)) as addr,
         row_number() over (partition by tenant_id, lower(trim(email)) order by created_at, id) as n,
         max(unsubscribed_at) over (partition by tenant_id, lower(trim(email))) as left_at
  from store_subscribers
)
update store_subscribers s set unsubscribed_at = r.left_at
from ranked r
where s.id = r.id and r.n = 1 and r.left_at is not null and s.unsubscribed_at is null;

delete from store_subscribers s
using (
  select id, row_number() over (partition by tenant_id, lower(trim(email)) order by created_at, id) as n
  from store_subscribers
) d
where s.id = d.id and d.n > 1;

update store_subscribers set email = lower(trim(email)) where email <> lower(trim(email));

alter table store_subscribers drop constraint if exists store_subscribers_email_lower;
alter table store_subscribers add constraint store_subscribers_email_lower check (email = lower(trim(email)));
