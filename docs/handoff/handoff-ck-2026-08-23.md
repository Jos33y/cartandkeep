# Cart & Keep, handoff

23 August 2026. Written because the build plan is clear except item 3, and item
3 is the largest single thing on it. Starting messaging at the end of a session
this long means starting it with the context already spent.

Read alongside, in this order:

- `decisions-2026-08-20.md`, the rules. Read first, nothing in it is open
- `messaging-plan-2026-08-20.md`, what item 3 actually is
- `build-plan-2026-08-20.md`, items 1 to 11, of which only 3, 5 and 7 remain
- `session-summary-ck-2026-08-23.md`, what was built over the last three days
- `feedback-ck-2026-08-23.md`, the mistakes and the patterns under them
- `meta-application.md`, why Meta is not a blocker

---

## Where the build is

**Everything on the build plan is done except messaging.**

```
1   AI descriptions and titles     done, with a gate on unread contradictions
2   shop dashboard                 done, rebuilt three times
3   messaging, stage one           NOT STARTED
4   variants and stock per variant done, buyer path and portal
5   basket threads                 waits on 3
6   reviews                        done, end to end including the fourth email
7   the offer                      waits on 3
8   customers                      done
9   subscribers                    done
10  categories she controls        done
11  low stock, archive, export     done
```

Four things shipped that were never on the plan: product requests, the checks
gate, department renaming, and archiving.

**The portal now has twenty navigation entries.** Dashboard, Products, Sections,
Orders, Reviews, Customers, Requests, Mailing list, Interest, Being found,
Finance, plus the research side unchanged.

---

## The only blocker

**Stripe.** The shop cannot take a payment and the checkout function cannot boot
without `STRIPE_SECRET_KEY`, so `checkout` and `stripe-webhook` are written,
tested and not deployed.

The account is hers, registered in her business name, and the ask has been on
the deliverables page as a client item since it was written. It was asked again
in writing on 21 August.

**Meta is not a blocker** and should not be described as one. `wa.me` opens a
customer's own WhatsApp into a chat with her, works today, and needs no
application. See `meta-application.md`. What needs Meta is stage two of
messaging, and its long pole is Business Verification, which itself needs her
trading address on the shop.

---

## What is waiting on her

None of this needs a developer. All of it is on the dashboard with a button
beside it.

```
Stripe test and live keys        the only launch blocker
trading name and address         currently a placeholder reading an address in
                                 Ontario. Blocks trading, and is a precondition
                                 for Meta Business Verification
25 returns policies              a suggestion and a reason sit on each one
8 chemicals                      hazard wording off the bottle
who pays return postage          a contract term. legal.js says it is undecided
                                 and the confirmation email used to assert it
where returns go                 no address exists for the instruction the
                                 email gives
```

---

## Before the shop opens

**Two fixture orders are still in the database and still inflating the
dashboard.** `CK-TEST-` from the lifecycle test and `CK-SAMPLE-` from the review
sample. They are the reason the dashboard shows £105.80 and the reason Customers
lists two people.

They are useful until launch, because every screen built this week was checked
against them and the reviews screen has nothing else in it. Clear them on the
morning the shop opens, not before:

```sql
delete from store_reviews
where order_item_id in (
  select oi.id from order_items oi
  join orders o on o.id = oi.order_id
  where o.reference like 'CK-SAMPLE-%'
);
delete from orders where reference like 'CK-SAMPLE-%';
delete from orders where reference like 'CK-TEST-%';
```

Reviews first. `order_item_id` is on delete restrict on purpose.

**One product is live carrying wrong data.** The Katy Sue sticker pack has
`Type: Foam` in its details, which the draft flagged against the photograph and
nobody acted on. The gate stops that happening again; it does not fix the row.

---

## What messaging needs before it starts

**Both halves of the codebase in one chat.** The manifest warns against running
two collectors into one context and it was right when the work was one sided.
Messaging is not: a thread starts on a product page and is answered in the
portal.

```
collect-ck-context.ps1        the admin half. Twenty two files changed since
                              the last bundle
collect-ck-store-context.ps1  the storefront half
```

**Four decisions already made in `messaging-plan-2026-08-20.md`**, and none of
them are open:

```
a thread belongs to a thing   product, order or basket, and it carries what it
                              is about with it
the token is the order token  the same one the confirmation email carries. No
                              new way to be wrong
email now, WhatsApp as a      wa.me, not the API. Two honest channels beats one
link, no SMS                  half built one
she has to answer             unanswered count in the navigation, an email the
                              moment a message lands, and a reply time computed
                              from her actual median rather than typed into a
                              settings box
```

---

## Things the next session will trip over

**`notify` now has five kinds**, and one of them is not about an order.
`low_stock` is handled before the `orderId` check, takes an items array, writes
no `order_emails` row, and is service role only. A sixth kind for messaging
follows the same shape.

**Two cron jobs exist**, at twenty past and twenty five past the hour, both
reading `app_config` for the notify URL and the service role key.

**The key in `app_config` is the legacy service role JWT**, the one starting
`eyJ`, not a new `sb_secret_` key. `notify` compares the bearer against the
string Supabase injects, and a secret key will not match, so the call would 401
and the job would report success while sending nothing.

**`alter database ... set` needs superuser**, which Supabase does not give you.
That is why the config is a table rather than a session setting, and 0060 in the
repository has been rewritten to match what actually ran.

**The publishable key question is still open.** `checkout.js` sends the key on
both the `Authorization` and `apikey` headers. If `VITE_SUPABASE_PUBLISHABLE_KEY`
holds an `sb_publishable_` value rather than the legacy anon JWT, that request
never reaches the function, and the same applies to `review`, `subscribe` and
`request`. It will surface the moment the Stripe key lands. Check what is in
`.env.local` before blaming the Stripe integration.

**Every portal screen built this week follows the same shape**, so a new one
should too: a hook, a page, a route in `constants.js` and `portalRouter.jsx`, a
nav item, its own icon, and a stylesheet. Icons are never reused across nav
entries; there is a comment above `IconShop` explaining why and I broke it once.

---

## Checks worth running before handing anything over

These caught real faults this week and cost minutes.

```
parse every source file       one duplicate declaration failed 1 of 75 and
                              stopped a function booting
render before handing over    two faults in the confirmation email were
                              invisible in the source
every token against tokens    --c-rule, --ts-page and #f0ece5 were all invented
.css and the store sheets     and would have rendered as nothing
every callback both ways      a rolled back patch left three undefined props
every helper imported         isArchived was used and not imported, because the
                              import was split across two lines and my pattern
                              assumed one
run SQL against real          apply_order_stock is not idempotent, and the
Postgres                      grants on store_reviews were missing entirely
```

The last one has the best record. Four migrations this week changed after being
run.
