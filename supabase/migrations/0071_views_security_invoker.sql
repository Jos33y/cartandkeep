-- Every view on this platform reads past row level security.
--
-- Found while wiring the offers view into the thread function, and it is not
-- only the views written this week. All ten that are granted to a signed in
-- role have it.
--
-- A view in Postgres runs as its owner unless it is told otherwise, and the
-- owner here is the migration role. So a policy on the table underneath is
-- checked against the owner rather than against whoever is asking, and it
-- passes every time. The tables are correct. The views walk around them.
--
-- Proved rather than reasoned about, against a role granted exactly the way
-- `authenticated` is:
--
--   before   a session with has_tenant false read 6 threads and a live offer
--            through the views, and 0 rows from the tables directly
--   after    the same session reads 0 through the views, and a session with
--            has_tenant true still reads all 6
--
-- Two reasons this matters now rather than at client two.
--
-- Any authenticated session is enough. It does not need to be a member of the
-- shop, only signed in, so this is live with one tenant and not only with two.
-- And the portal filters by tenant in the browser, which is a convenience and
-- was never the boundary. The boundary is supposed to be the policy.
--
-- `security_invoker` runs the view as the caller, which is what makes the
-- policy apply. It needs the caller to hold grants on the tables underneath as
-- well, which `authenticated` already does for every table these read.

alter view store_thread_inbox    set (security_invoker = on);
alter view store_reply_time      set (security_invoker = on);
alter view store_live_offers     set (security_invoker = on);

-- Written before this week and carrying the same fault. Customers and the
-- mailing list are the two that matter most: one is every address the shop has
-- ever delivered to, the other is a consent record.
alter view store_customers       set (security_invoker = on);
alter view store_mailing_list    set (security_invoker = on);
alter view store_request_demand  set (security_invoker = on);
alter view store_low_stock       set (security_invoker = on);
alter view store_stock_to_report set (security_invoker = on);

/*
 * The two a shopper reads, which need the anon policies to hold rather than
 * the owner's rights.
 *
 * store_reviews grants select to anon and carries a public read policy for
 * approved rows, and store_category_names does the same, so both still answer
 * a signed out visitor. Without those policies this pair would go quiet on the
 * storefront rather than leak, which is the failure worth knowing about before
 * running it.
 */
alter view store_product_ratings set (security_invoker = on);
alter view store_category_map    set (security_invoker = on);

/*
 * Left alone: orders_due_a_review_request.
 *
 * Granted to nobody. Only the cron job reads it and the service role bypasses
 * row level security anyway, so turning this on changes nothing and touching a
 * working scheduled path for no gain is not worth the risk.
 */

comment on view store_thread_inbox is
  'Threads with what they are about attached, and whether each is waiting on a reply. security_invoker, so the policy on store_threads applies to whoever is asking rather than to the role that created this.';
