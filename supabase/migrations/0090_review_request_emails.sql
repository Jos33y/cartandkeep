-- The review request was never allowed into order_emails: the kind check predates it. notify sent
-- the email, the insert was refused without an error being read, and orders_due_a_review_request
-- kept offering the same order, so each buyer would be emailed every hour for three weeks.

alter table order_emails drop constraint if exists order_emails_kind_check;
alter table order_emails add constraint order_emails_kind_check
  check (kind in ('confirmation', 'dispatch', 'seller_alert', 'review_request'));

-- The read policy was using (true), so any signed in account could read every tenant's order emails.
drop policy if exists order_emails_portal_read on order_emails;
create policy order_emails_portal_read on order_emails
  for select to authenticated
  using (has_tenant(tenant_id));
