-- 0040: email_events, idempotency for the webhook receiver
--
-- Guarded: email_events was never created by any migration, no function reads or writes it, and the
-- resend-webhook receiver this was written for was never built. On a database without the table
-- this does nothing, so a fresh rebuild runs straight through. If the table is ever added, this
-- applies as originally intended.

do $$
begin
  if to_regclass('public.email_events') is null then
    raise notice '0040 skipped: public.email_events does not exist';
    return;
  end if;

  alter table public.email_events add column if not exists provider_event_id text;

  comment on column public.email_events.provider_event_id is
    'svix-id from the Resend webhook delivery. Null for rows written by a sender.';

  -- Partial: rows a sender writes at send time have no Svix id and would otherwise collide on null.
  create unique index if not exists email_events_provider_event_id_key
    on public.email_events (provider_event_id)
    where provider_event_id is not null;
end
$$;
