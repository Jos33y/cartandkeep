-- One malformed basket line made the inbox view throw, which took down Messages and the
-- waiting count on every portal screen. Totals now skip a line they cannot read.

drop view if exists store_thread_inbox;
create view store_thread_inbox with (security_invoker = on) as
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

  t.basket,
  case when jsonb_typeof(t.basket) = 'array' then jsonb_array_length(t.basket) end as basket_lines,
  case when t.basket is not null then (
    select round(sum(
      case when l->>'qty' ~ '^[0-9]+$' and l->>'price' ~ '^[0-9]+(\.[0-9]+)?$'
        then (l->>'qty')::integer * (l->>'price')::numeric end), 2)
    from jsonb_array_elements(case when jsonb_typeof(t.basket) = 'array' then t.basket else '[]'::jsonb end) l
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
