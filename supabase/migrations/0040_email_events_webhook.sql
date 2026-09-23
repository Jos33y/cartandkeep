-- 0040: email_events, idempotency for the webhook receiver
--
-- email_events has held zero rows since it shipped. Not because the webhook
-- broke: there was never a receiver. Eight Edge Functions, all senders, none
-- listening. dev-track-v4.7 recorded the webhook as working and whatever was
-- checked that day was not this.
--
-- This adds the one thing a receiver needs that was missing. The function is
-- supabase/functions/resend-webhook.

-- ============ Idempotency ============

-- Resend retries on any non-2xx, so a transient failure would otherwise land
-- the same event twice.
--
-- (message_id, event_type) looks like the natural key and is wrong: opening an
-- email twice produces two legitimate email.opened events for one message.
-- The key is the Svix delivery id, which is unique per event rather than per
-- message.
alter table public.email_events
  add column if not exists provider_event_id text;

comment on column public.email_events.provider_event_id is
  'svix-id from the Resend webhook delivery. Null for rows written by a sender.';

-- Partial, because a sender writing its own row at send time has no Svix id
-- and several such rows would otherwise collide on null.
create unique index if not exists email_events_provider_event_id_key
  on public.email_events (provider_event_id)
  where provider_event_id is not null;

-- ============ Read paths, deliberately not touched ============
--
-- The first version of this migration added indexes on (message_id) and on
-- (user_id, created_at desc). Both already existed as email_events_message_idx
-- and email_events_user_recent_idx. Different names, identical definitions
-- including the partial clause, so `if not exists` said nothing and Postgres
-- maintained two of each on every insert.
--
-- They were dropped. The cause was querying information_schema.columns and
-- pg_constraint for this table and never pg_indexes: the part was checked, not
-- the whole thing.
--
-- Existing indexes, all sufficient:
--   email_events_email_idx        (email)
--   email_events_message_idx      (message_id) where message_id is not null
--   email_events_user_recent_idx  (user_id, created_at desc)
--   email_events_bounces_idx      (user_id, created_at desc)
--                                 where event_type in (bounced, complained, failed)
--
-- That last one is worth reading. Somebody built a read path for an admin
-- email-health view against a table that has never had a row, and it expects
-- short event names rather than Resend's 'email.bounced'. The receiver strips
-- the prefix to match it.

-- ============ Notes ============
--
-- No policy change. email_events_select_admin_or_self already governs reads and
-- there is no INSERT policy, which is correct: the receiver holds the service
-- role and writes past RLS, the same shape as admin_actions and notifications.
--
-- template_key stays null for now. Nothing captures it, because the senders
-- discard the Resend response body on success and with it the message id. That
-- is a separate decision, deliberately deferred until this table has a week of
-- real rows to design against.
--
-- ============ Verification ============
--
-- 1. Column present
--
--    select column_name, data_type from information_schema.columns
--     where table_schema = 'public' and table_name = 'email_events'
--       and column_name = 'provider_event_id';
--
-- 2. Six indexes, and the unique one is partial
--
--    select indexname, indexdef from pg_indexes
--     where schemaname = 'public' and tablename = 'email_events'
--     order by indexname;
--
-- 3. After the function is deployed and Resend is pointed at it, the only test
--    that counts: send one reminder to yourself and watch rows arrive.
--
--    select event_type, email, message_id, bounce_type, created_at
--      from public.email_events order by created_at desc limit 20;
