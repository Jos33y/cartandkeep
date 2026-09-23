# Cart & Keep, handoff

25 August 2026. Written because the store build is being paused mid test run to
go back to product research, and a run stopped halfway is worse to inherit than
one not started.

Read alongside, in this order:

- `decisions-2026-08-20.md`, the rules. Nothing in it is open
- `session-summary-ck-2026-08-25.md`, what was built over the last two days
- `feedback-ck-2026-08-25.md`, the mistakes and the pattern under each
- `test-run-messaging-offers.md`, the thirteen steps, four of them done

---

## Where the build is

**The build plan is finished.** All eleven items, plus five that were never on
it: product requests, the checks gate, department renaming, archiving, and now
the receipt and the packing slip.

```
1   AI descriptions and titles     done
2   shop dashboard                 done
3   messaging, stage one           done, 24 to 25 August
4   variants and stock per variant done, and its checkout half was broken
                                   for weeks. Fixed, not yet proved
5   basket threads                 done, 25 August
6   reviews                        done
7   the offer                      done, 25 August. Never yet quoted
8   customers                      done
9   subscribers                    done
10  categories she controls        done
11  low stock, archive, export     done
```

**The portal has twenty one navigation entries.** Messages is new and is the
only one carrying a count.

---

## What is in the database now

```
0067  store_threads, store_messages, store_thread_inbox, store_reply_time
0068  two partial unique indexes the thread function depends on
0069  store_threads.basket, and the inbox view rebuilt to carry it
0070  store_offers, store_live_offers
0071  security_invoker on ten views, which were all reading past RLS
```

All five have run. `orders` gained `from_thread_id` in 0067 and `order_items`
is unchanged.

---

## The Stripe position

**She has registered and developer access has been granted.** That is the last
blocker on the platform side and it was outstanding for a fortnight.

Nothing has been done with it yet. In order:

```
1  live keys into STRIPE_SECRET_KEY on checkout and stripe-webhook
2  a webhook endpoint at the deployed stripe-webhook, subscribed to
   checkout.session.completed and charge.refunded, its signing secret into
   STRIPE_WEBHOOK_SECRET
3  verify_jwt OFF on stripe-webhook. Stripe sends no JWT and the gateway
   rejects the event before the function runs. This was found by the
   simulator being refused the same way, and it would otherwise have surfaced
   on the first real payment as money taken with no confirmation, no seller
   alert and no stock movement
4  delete CHECKOUT_SIMULATE on both. The guard disarms itself once a real key
   exists, but a placeholder key reading sk_test_... was enough to confuse it
   once already
5  check VITE_SUPABASE_PUBLISHABLE_KEY in .env.local before blaming anything
   else. Open since the last handoff, and the storefront function calls now
   work, so it is probably fine
```

---

## The test run, four of thirteen

`test-run-messaging-offers.md` has the steps. What has actually been proved:

```
done   a product conversation, both directions, both emails landing
done   a simulated payment through to a paid order
done   the receipt on screen and printed
done   the packing slip on screen
```

Everything else is untested. In the order I would do it:

```
10  a variant order. The only fault on the list known to have existed rather
    than suspected. CheckoutPage sent the product id alone, so two sizes
    merged into one line, were charged at the product price, and took stock
    off the product rather than the size
3   the basket ask. The snapshot is priced server side and that path has
    never run
5   quote, requote, and the offer email carrying one figure
7   take a price as far as the checkout page
11  pay it. Check from_thread_id lands and the offer is spent
13  abandon a checkout and check the price is not burnt
12  reuse a spent offer and be refused
8   an expired offer and a withdrawn one
9   the median appearing at five answers and nowhere on the shop
2   a second question, and no second acknowledgement email
```

Also never run: the failed and refunded outcomes on the simulator, which is
the only route to a refunded receipt. The checkout form surviving a trip back
to the basket. A three paragraph question. `select send_low_stock();`. And the
eight portal screens after 0071, which changed how every view resolves.

---

## Delivered but not confirmed deployed

Everything up to the print fix is confirmed working from screenshots. These
came after and have not been seen running:

```
src/hooks/useThreads.js            refetches a thread's messages after notify
                                   returns. Without it a reply that sent shows
                                   "Saved, but not emailed yet" forever
src/pages/store/CheckoutPage.jsx   the contact details persist across a trip
                                   back to the basket
statusItems.js, deliverables.js    the status page, updated to the 25th
```

---

## Waiting on her, unchanged

```
trading name and address    blocks trading, blocks the confirmation email, and
                            is a precondition for Meta business verification
who pays return postage     a contract term. legal.js records it as undecided
where returns go            no address exists for what the email instructs
25 returns policies         blocks 25 products
8 chemicals                 hazard wording off the bottle
```

**Stripe has come off this list.** The address is now the long pole for both
trading and Meta.

---

## Before the shop opens

**The fixture cleanup has changed.** `store_threads.order_id` restricts, so
threads have to go before orders now:

```sql
delete from store_threads where order_id in (
  select id from orders where reference like 'CK-TEST-%' or reference like 'CK-SAMPLE-%'
);
-- then reviews, then the two order deletes as written in the previous handoff
```

**The Katy Sue sticker pack still carries `Type: Foam`.** The gate stops
another one happening; it does not fix that row.

---

## Owed by me

```
a reachability sweep    every route in STORE_ROUTES and PORTAL_ROUTES should
                        either be linked from somewhere in src or be
                        deliberately unreachable and named. THREAD, RECEIPT
                        and PAY_SIMULATOR are legitimately reached only by
                        tokened links or a redirect. The receipt shipped with
                        no link at all and nobody noticed until it was asked
                        for
comments on 0067 to     between 51% and 80% comment lines. They have run, so
0071                    it changes nothing that executes and only changes what
                        somebody reads in six months
```

---

## What the research session needs

The store work is paused, not abandoned, and nothing above is half applied.

For research, collect the pipeline rather than the storefront. From memory of
the layout that is:

```
scripts/terapeak/            the package
scripts/analyse-terapeak.py
scripts/mine-terms.py
docs/                        whatever records the current scoring and the
                             admission rules
```

Ask for a collector rather than listing files in prose. The pattern is a
PowerShell script that validates `package.json`, copies named paths and globs,
writes a MANIFEST naming anything missing, and produces one zip.

**The rules that are not open**, and which any rework has to start from:

```
demand first             Terapeak, then competition via Browse, then trend by
                         windowed comparison, then supply as a targeted per
                         product lookup. Never supply first
price point              below roughly £25 the fixed costs of fees, ads,
                         postage and packaging eat the margin before goods
                         cost enters it
five over fifty          five real sourceable products beats fifty that
                         cannot be sourced
route is not product     a failed supply route is never reported as a failed
                         product
market price             a decision, not a fixed input
sell through             Terapeak does not compute it on windows longer than a
                         month, so it needs monthly loads
```
