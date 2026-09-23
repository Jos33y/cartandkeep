-- Asking for a review, seven days after the parcel went out.
--
-- Nothing else on this platform is scheduled. Every email so far is sent in
-- reply to something happening: a payment, a dispatch. This one is sent because
-- time passed, so it is the first thing here that needs a clock.
--
-- A cron job rather than a sweep inside the webhook. A sweep that only runs
-- when somebody else buys something works while orders are frequent and stops
-- silently the moment they are not, which is exactly when a shop most needs the
-- reviews.
--
-- Requires pg_cron and pg_net, both available on Supabase and enabled from
-- Database, Extensions in the dashboard. Enable them before running this.

create extension if not exists pg_cron;
create extension if not exists pg_net;

/*
 * Which orders are due.
 *
 * Seven days after dispatch, not after payment. A parcel that took four days to
 * arrive has been in the house three days by then, which is long enough to have
 * an opinion and short enough to still remember ordering it.
 *
 * The thirty day floor stops a backfill: turning this on for the first time
 * should not email everybody who ever bought anything, and an order from March
 * asking how it went reads as a shop that has lost track of itself.
 */
create or replace view orders_due_a_review_request as
select o.id, o.tenant_id, o.reference, o.dispatched_at
from orders o
where o.status = 'paid'
  and o.dispatched_at is not null
  and o.dispatched_at < now() - interval '7 days'
  and o.dispatched_at > now() - interval '30 days'
  -- Never twice. `notify` writes a row per order and kind, so this is the same
  -- record that stops a Stripe retry sending a second confirmation.
  and not exists (
    select 1 from order_emails e
    where e.order_id = o.id and e.kind = 'review_request'
  );

comment on view orders_due_a_review_request is
  'Paid orders dispatched between seven and thirty days ago with no review request sent. The upper bound stops the first run emailing every historic customer at once.';

/*
 * Where the URL and the key live.
 *
 * Not in `alter database ... set app.notify_url`, which is what this file said
 * first and which cannot run: that needs superuser and Supabase does not give
 * it to you on the hosted platform. The error is a flat permission denied, so
 * it fails at the point of setting rather than at the point of sending.
 *
 * A table instead, with row level security on and nothing granted to anon or
 * authenticated. No policies either, so there is no path to it from a browser
 * at all. Only a security definer function, which bypasses both, can read it.
 */
create table if not exists app_config (
  key   text primary key,
  value text not null
);

alter table app_config enable row level security;
revoke all on app_config from anon, authenticated;

comment on table app_config is
  'Values the database itself needs to call out, such as the notify function URL and the service role key. No grants and no policies: unreachable from a browser, readable only by a security definer function.';

/*
 * The sender.
 *
 * Calls the notify function over http rather than rendering an email in SQL,
 * because the templates live in one place and a second copy of a statutory
 * footer is two footers that disagree within a month.
 *
 * The key is the legacy service_role JWT, not a new secret key. `notify`
 * decides who is calling by comparing the bearer against the
 * SUPABASE_SERVICE_ROLE_KEY it is handed, and a secret key does not match that
 * string, so the call would 401 and this job would report success while sending
 * nothing.
 *
 * Ten at a time. A shop that dispatches forty in a day should not fire forty
 * requests in one second, and the next run is an hour later.
 */
create or replace function send_review_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  sent integer := 0;
  fn_url text;
  fn_key text;
begin
  select value into fn_url from app_config where key = 'notify_url';
  select value into fn_key from app_config where key = 'service_key';

  -- Said plainly rather than failing quietly. Without these the job runs, finds
  -- work, posts nothing and reports success.
  if fn_url is null or fn_key is null then
    raise exception 'notify_url and service_key must be in app_config before this can send anything';
  end if;

  for o in select * from orders_due_a_review_request order by dispatched_at limit 10 loop
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || fn_key
      ),
      body := jsonb_build_object('orderId', o.id, 'kind', 'review_request')
    );
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

comment on function send_review_requests is
  'Posts up to ten review requests to the notify function. Reads its URL and key from app_config.';

revoke all on function send_review_requests() from public, anon, authenticated;

/*
 * Hourly, not daily.
 *
 * An order dispatched at 4pm becomes due at 4pm seven days later, and a daily
 * job at 9am would either send it seventeen hours late or, if the job ran
 * earlier, seven hours early on a parcel that may not have arrived. Hourly
 * costs nothing and the ten row limit keeps it small.
 *
 * Twenty past, so it is not competing with everything else on the hour.
 */
select cron.unschedule('review-requests')
where exists (select 1 from cron.job where jobname = 'review-requests');

select cron.schedule('review-requests', '20 * * * *', $$select send_review_requests();$$);

-- --- before this can send anything -------------------------------------------
--
-- Run this once, with the real values, from the SQL editor. It is not in this
-- file because a service role key does not belong in a repository.
--
--   insert into app_config (key, value) values
--     ('notify_url',  'https://<project>.supabase.co/functions/v1/notify'),
--     ('service_key', '<the legacy service_role JWT, the one starting eyJ>')
--   on conflict (key) do update set value = excluded.value;
--
-- Then:
--
--   select send_review_requests();
--
-- It returns how many it posted. Zero is the correct answer until an order has
-- been dispatched for seven days.
--
-- The key now lives in the database as well as in the functions. That is not a
-- new exposure, since anything with superuser on this database could already
-- read every row in it, but it is a second place it exists and the handoff
-- should say so.