-- Telling her something is nearly out.
--
-- Rides the schedule 0060 already set up rather than adding a second cron job,
-- because two jobs on the same clock is two things to check when one of them
-- stops.
--
-- Hourly is right here for the same reason it is right for review requests:
-- something selling out at four in the afternoon is not news at nine the next
-- morning, and the ten row limit keeps each run small.

/*
 * Sending, and recording that it was sent.
 *
 * One email listing everything, not one per product. Four separate messages
 * about four shelves is four notifications on a Saturday and a shop owner who
 * mutes the sender.
 *
 * The alert rows are written after the post, so a Resend outage means she is
 * told an hour later rather than never. The cost is that a failed send which
 * Resend accepted and then bounced still counts as told, which is the same
 * trade every other email on this platform makes.
 */
create or replace function send_low_stock()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text;
  fn_key text;
  items jsonb;
  n integer;
begin
  -- Recovered stock arms the alert again, and doing it here rather than in a
  -- trigger means it happens on the same clock as the reporting, so the two
  -- cannot disagree about what is outstanding.
  perform clear_recovered_stock_alerts();

  select value into fn_url from app_config where key = 'notify_url';
  select value into fn_key from app_config where key = 'service_key';

  if fn_url is null or fn_key is null then
    raise exception 'notify_url and service_key must be in app_config before this can send anything';
  end if;

  select
    jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'variant_id', variant_id,
      'title', title,
      'label', label,
      'stock', stock
    )),
    count(*)
  into items, n
  from (select * from store_stock_to_report order by stock, title limit 10) x;

  if n is null or n = 0 then return 0; end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || fn_key
    ),
    body := jsonb_build_object('kind', 'low_stock', 'items', items)
  );

  /*
   * Recorded from the same set that was sent.
   *
   * Reading `store_stock_to_report` a second time here would pick up anything
   * that dropped between the two reads and mark it as told without it being in
   * the email, which is the one failure this table exists to prevent.
   */
  insert into store_stock_alerts (tenant_id, product_id, variant_id, at_stock)
  select
    (select id from tenants where slug = 'cart-and-keep'),
    (i->>'product_id')::uuid,
    nullif(i->>'variant_id', '')::uuid,
    (i->>'stock')::integer
  from jsonb_array_elements(items) i
  on conflict (product_id, variant_id) do nothing;

  return n;
end;
$$;

comment on function send_low_stock is
  'Posts one email listing everything on sale with three or fewer left that has not been reported. Writes the alert rows from the same set it sent, so nothing is marked as told without being in the email.';

revoke all on function send_low_stock() from public, anon, authenticated;

/*
 * Twenty five past, five minutes after the review requests.
 *
 * Staggered rather than sharing a minute, so a slow run of one does not delay
 * the other and so the two are distinguishable in a log.
 */
select cron.unschedule('low-stock')
where exists (select 1 from cron.job where jobname = 'low-stock');

select cron.schedule('low-stock', '25 * * * *', $$select send_low_stock();$$);
