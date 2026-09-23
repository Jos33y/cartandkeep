-- A conversation about a basket.
--
-- Build plan item 5, and nearly free because 0067 put 'basket' in the check
-- constraint and left the column out on purpose: adding a nullable jsonb is
-- free and widening a check is a drop and an add.
--
-- She opens the message and sees the four things they are deciding on, so she
-- can say the lamp is back Thursday or that she can do the pair for seventy.
-- Without it a basket conversation is somebody describing their own basket
-- back to her, which is the work the software is supposed to be doing.
--
-- A snapshot rather than a live basket, and that is the whole decision. The
-- conversation is about what they had when they asked. A basket that changes
-- underneath it makes both sides wrong, and there is no version of "which four
-- things did you mean" that is not a worse conversation.
--
-- jsonb rather than a table of lines. This is a frozen record: never joined,
-- never queried across, never updated. Rows would look live, and something
-- would eventually update one.

alter table store_threads add column if not exists basket jsonb;

/*
 * A basket conversation has a basket.
 *
 * Safe as a constraint where the product one was not, because nothing can null
 * this by deleting something else. A product thread loses its product_id when
 * a product goes, which is why that shape is guaranteed by the function rather
 * than by a check.
 */
alter table store_threads drop constraint if exists store_threads_basket_present;
alter table store_threads add constraint store_threads_basket_present
  check (subject_kind <> 'basket' or basket is not null);

comment on column store_threads.basket is
  'What was in the basket when they asked, priced from the catalogue at that moment rather than from the browser. Frozen: the conversation is about what they had, and the offer in stage three is quoted against these lines.';

/*
 * The inbox, again.
 *
 * Dropped and recreated rather than replaced. `create or replace view` cannot
 * add a column in the middle or reorder one, and this adds three. The rest is
 * unchanged from 0067 and is repeated here in full because a view definition
 * is the whole statement or it is nothing.
 */
drop view if exists store_thread_inbox;
create view store_thread_inbox as
select
  t.id,
  t.tenant_id,
  t.subject_kind,
  t.channel,
  t.status,
  t.email,
  t.name,
  t.created_at,
  t.last_message_at,
  t.last_customer_at,
  t.last_reply_at,

  -- The same predicate as the partial index in 0067. If one changes, both do.
  (t.last_customer_at is not null
   and (t.last_reply_at is null or t.last_customer_at > t.last_reply_at)) as awaiting,

  t.product_id,
  p.title     as product_title,
  p.slug      as product_slug,
  p.image_url as product_image,

  t.order_id,
  o.reference as order_reference,

  /*
   * The basket, and two figures off it.
   *
   * Counted and totalled here rather than in the browser, so the list can say
   * "4 things, £58.65" without carrying every line of every basket into a
   * screen that is showing one row each. The lines themselves come with it
   * because she opens them in place.
   */
  t.basket,
  case when t.basket is not null then jsonb_array_length(t.basket) end as basket_lines,
  case when t.basket is not null then (
    select round(sum((l->>'qty')::integer * (l->>'price')::numeric), 2)
    from jsonb_array_elements(t.basket) l
  ) end as basket_total,

  (select count(*) from store_messages m where m.thread_id = t.id)::bigint as messages,

  -- Trimmed here rather than in the browser, so the inbox does not carry two
  -- thousand characters per row for a preview showing one line of it.
  (select left(m.body, 160) from store_messages m
    where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
  (select m.sender from store_messages m
    where m.thread_id = t.id order by m.created_at desc limit 1) as last_sender
from store_threads t
left join store_products p on p.id = t.product_id
left join orders o on o.id = t.order_id;

comment on view store_thread_inbox is
  'Threads with what they are about attached, and whether each is waiting on a reply. Waiting is derived from the three timestamps rather than stored, so nothing can disagree about it.';

grant select on store_thread_inbox to authenticated;
