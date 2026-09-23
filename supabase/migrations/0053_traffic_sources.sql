-- Where people came from.
--
-- The last month one analytics commitment that does not wait on orders
-- existing. Section 5 names Google, TikTok, direct, email and referral.
--
-- Half of it was already here: `store_events.referrer` has carried the host and
-- path since 0039, with the query string stripped because an inbound link
-- routinely carries somebody's email address or a click id from whatever sent
-- them. Nothing ever read it and nothing classified it.
--
-- The missing half is campaign tags, and they are the half that matters most
-- for her. TikTok's in-app browser sends no referrer, so a visit from the bio
-- link arrives looking exactly like somebody typing the address in. Without a
-- tag on that link the one channel she already has an audience on is the one
-- channel that is invisible.

alter table store_events
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

comment on column store_events.utm_source is
  'From the link she shared, captured once on arrival. The only reliable signal from apps that strip the referrer, which includes TikTok.';

/*
 * One row per visit, not per event.
 *
 * A session firing thirty events is one visit from one place, and counting the
 * events would make a browsing session look like thirty arrivals and quietly
 * favour whichever channel sends people who scroll.
 *
 * `distinct on` with the earliest event takes the arrival rather than a later
 * row, which matters because a tag only appears on the first page.
 */
create or replace view store_visit_sources as
with arrival as (
  select distinct on (e.session_id)
    e.tenant_id,
    e.session_id,
    e.created_at,
    e.referrer,
    lower(btrim(e.utm_source)) as utm_source,
    lower(btrim(e.utm_medium)) as utm_medium,
    e.utm_campaign
  from store_events e
  where e.session_id is not null
  order by e.session_id, e.created_at
),
tagged as (
  select
    a.*,
    -- Host only, so google.co.uk and google.com are one thing rather than two.
    split_part(coalesce(a.referrer, ''), '/', 1) as host
  from arrival a
)
select
  t.tenant_id,
  t.session_id,
  t.created_at,
  date_trunc('day', t.created_at)::date as day,
  t.referrer,
  t.host,
  t.utm_source,
  t.utm_campaign,

  /*
   * Classified here rather than in the browser, deliberately.
   *
   * These rules will be wrong about something within a month, and a rule in a
   * view can be corrected once and applies to every visit already recorded. The
   * same rule compiled into the front end would only ever fix the future and
   * would leave the past classified by a version of the rules nobody can see.
   *
   * A tag beats a referrer, because a tag is a deliberate statement about where
   * a link was put and a referrer is a guess from a hostname.
   */
  case
    when t.utm_source in ('tiktok', 'tiktok_shop', 'tt') then 'tiktok'
    when t.utm_source in ('google', 'gmb', 'google_business') then 'google'
    when t.utm_source in ('email', 'newsletter', 'zoho') or t.utm_medium = 'email' then 'email'
    when t.utm_source in ('instagram', 'ig', 'facebook', 'fb', 'whatsapp') then 'social'
    when t.utm_source is not null and t.utm_source <> '' then 'referral'

    when t.host = '' or t.host is null then 'direct'
    when t.host like 'www.google.%' or t.host like 'google.%'
      or t.host like '%.google.com' then 'google'
    when t.host like '%tiktok.%' then 'tiktok'
    when t.host like '%instagram.%' or t.host like '%facebook.%'
      or t.host like '%whatsapp.%' or t.host like '%pinterest.%'
      or t.host like '%x.com%' or t.host like '%twitter.%' then 'social'
    when t.host like '%bing.%' or t.host like '%duckduckgo.%'
      or t.host like '%yahoo.%' or t.host like '%ecosia.%' then 'search'
    when t.host like '%mail.%' or t.host like '%outlook.%'
      or t.host like '%zoho.%' then 'email'
    else 'referral'
  end as source
from tagged t;

comment on view store_visit_sources is
  'One row per visit with where it came from. A campaign tag beats a referrer, because a tag says where a link was deliberately placed and a referrer is a guess from a hostname. Classified in the view so a correction applies to visits already recorded rather than only to future ones.';

/*
 * Visits by source by day, with what those visits went on to do.
 *
 * The counts are of visits rather than of people. Nothing is stored on a
 * visitor's device, so the reference dies on reload and somebody who refreshes
 * counts twice. That is the price of needing no consent banner and the label
 * has to say so rather than dress it up as a headcount.
 *
 * Orders are joined on the session id the checkout carried through Stripe, so a
 * sale is attributed to where the visit came from rather than to the payment
 * page.
 */
create or replace view store_source_days as
select
  v.tenant_id,
  v.day,
  v.source,
  count(*)::bigint as visits,
  count(*) filter (where exists (
    select 1 from store_events e
    where e.session_id = v.session_id and e.event = 'add_to_basket'
  ))::bigint as visits_with_a_basket,
  count(distinct o.id)::bigint as orders,
  coalesce(sum(o.total) filter (where o.status = 'paid'), 0) as revenue
from store_visit_sources v
left join orders o
  on o.session_id = v.session_id and o.status = 'paid'
group by v.tenant_id, v.day, v.source;

comment on view store_source_days is
  'Visits, baskets, orders and revenue by source by day. Visits rather than people: a reload counts twice, and nothing filters crawlers.';
