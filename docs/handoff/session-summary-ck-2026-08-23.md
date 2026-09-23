# Session summary, 21 to 23 August 2026

From a portal she could run a shop from to a shop with nothing left on the build
plan except messaging. Eleven migrations, 0056 through 0066, four new edge
functions, and seven new portal screens.

The reasoning is recorded where it is not obvious from the code. Where it is
obvious, it is not repeated here.

---

## 0. The lifecycle test, and what it found before it ran

The session opened on the lifecycle test from the previous handoff, and it could
not be run as written. Three things stopped it and only one was a typo.

**The checkout function did not boot.** `const base` was declared twice in the
same block, once for the postage before surcharge and once for the return URL.
That is a parse error rather than a runtime one, so the module never evaluated
and every request came back a worker boot error. Found by parsing all 75 source
files rather than by reading: it was the only one that failed.

**Migration 0052 had not run and the Products screen selected its columns.**
`useCatalogue` names `landed_cost`, `postage_cost`, `cost_note` and
`cost_updated_at`. Unrun, that select fails outright and the screen has no rows.
The same fault one screen over: every `store_events` insert names the UTM
columns 0053 adds.

**Nothing called `apply_order_stock`.** 0047 created it, granted it, and no
caller was ever written, so stock never came off and the oversold warning in her
seller alert could not fire. The handoff said the webhook applied stock. It did
not, and it also did not refuse short stock as claimed.

The function was run against a real Postgres before a caller was added, which
found that **it is not idempotent**: applied twice on one order it takes the
count off twice. Placement is the whole safety of it. It sits below the
`if (!orderId) break;` that the `.eq('status', 'pending')` guard produces, so a
Stripe retry updates no row and never reaches it.

**The emails were rendered for the first time**, by slicing the template
functions out of the deployed file rather than retyping them. Two faults, both
invisible in the source:

```
"Tell us by replying to this email or by replying to this email."
   the clause and its fallback were written as the same words, and with no
   trading address filled in, which is the state today, that is what the first
   real confirmation would have said

the dispatch cutoff was an hour late for seven months of the year
   every date used getUTCHours against a wall clock cutoff, so an order at
   14:30 BST was told the parcel goes out today, half an hour after the cutoff
```

Both fixed on London civil time, checked across a day of clock times rather than
reasoned about.

---

## 1. The shop would not load for a stranger

`tenants_read` from 0001 is `has_tenant(id)`, which is correct and which no
anonymous visitor can satisfy. `loadTenant` does `.single()`, so it threw and the
storefront rendered "No shop is configured for this address". It had never shown
up because every load until then had been a signed in one.

**0056 is a security definer function with a whitelist**, not a permissive policy
on `tenants`. That row carries `fees`, `scoring`, `research` and, since 0055,
`selling_costs`, which is her ad rate and her fee assumptions. Opening the table
would have put all of it in a shopper's browser, and at client two it would put
one client's fee card in another client's visitor's network tab.

A whitelist rather than subtracting the one sensitive key, so a key added next
year is not public the moment it is written. Verified by putting an invented
future key in a test row and confirming it did not come out.

`loadTenant` branches on session rather than on hostname: signed in takes the
full row, anonymous takes the function. No storefront file changed, which
mattered because I could not see them at the time.

---

## 2. Descriptions, drafted from the photograph

Build plan item 1. A `draft` edge function, `derived_fields.draft` via 0057, and
a panel on the product row.

**Sync per product rather than the Batch API.** The decisions file says every one
of these is a batch, and the arithmetic is worth recording: all 78 comes to
roughly $0.49 sent one at a time against $0.25 batched. Nineteen pence against a
stored job id, a poll loop, a retrieval path and a wait that can run to 24 hours.
Sync also means drafts land one at a time and she can start reading.

**The image goes before the fields in the message.** A model shown the fields
first reads the photograph as confirmation of them rather than as a check on
them, and catching the disagreement is the reason it is there. It has already
caught a sticker pack listed as foam, a load rating given as both 50kg and 330lb
on a bed rail, and a colour listed as clear on a photograph of purple.

**Three attempts at getting structured output back**, recorded because the first
two are the interesting part:

```
"respond with JSON only"    a request a model can decline by writing a
                            sentence first, and it did
prefill the reply with {    this model refuses a conversation that does not
                            end with a user message
a forced tool schema        no format to disobey and nothing to parse
```

The tool call is found by type rather than by index, because a reply can carry a
text block before the tool block and reading position zero would put the model
thinking out loud into her shop copy.

**The cleaners matter more than the prompt.** Every row carries her eBay policy
ids, and the supplier text runs to four thousand characters of Amazon page
including a leaked page script and an invented rating. Two leaks the first run
caught: the script nests two closures so a non greedy match left the outer `});`
in the prose, and eBay puts invisible directional marks in front of numbers.

**A gate, not a nag.** A pack of stickers went live carrying `Type: Foam` after
the draft had flagged it, because nothing stood between reading the flag and
taking the product live. `checksUnread` now blocks release until she has read
them, and discarding a draft copies the flags out first so Discard cannot be
used to clear the gate.

---

## 3. The shop dashboard

Build plan item 2, rebuilt three times, and the rebuilds are the useful record.

**Version one was a single column of full width rows.** Every count alone with
eight hundred pixels of nothing after it, and the takings chart a single green
block floating in whitespace. Correct data, unreadable screen.

What fixed it, after reading Cloudflare's 2026 security overview rebuild and a
current practice guide:

```
one number top left     the F pattern position, answering "where am I" before
                        anything else
a comparison on every    "up £105.80, £0.00 this day last week". A figure with
figure                   nothing to measure against does not answer the
                         question it was asked
ranked by what it        three rows stop a product going on sale and four do
blocks                   not, in three distinct treatments rather than three
                         shades of one
impact on every row      not "25 returns policies" but "blocks 25 products,
                         sets what the confirmation email promises"
the actions in the rows  the row that can be cleared from here has a button
                         that clears it
photographs              she has 78 products with nine images each, and a shop
                         dashboard that never shows the shop is the flat thing
```

**The funnel had to be remodelled after the real data broke it on day one.**
Looked 8, Saved 0, Basket 3. Saving is not a stage on the way to buying, so a
step with three in it sat below a step with none and the line above read
"100% went no further" while three people were demonstrably going further. Three
steps now, with saves reported beside it as a parallel signal.

---

## 4. Variants

Build plan item 4, and the only item on the plan that was already wrong rather
than absent. "Size 5, 6 and 7" was three products inside one title.

**A table, not columns and not jsonb.** A variant has its own price, stock,
barcode and sometimes photograph, three of which already exist as columns with
checks on them. Duplicating them into a document would mean `apply_order_stock`
learning to decrement inside jsonb, and the atomic single statement decrement is
worth more than the tidiness.

**One axis, free text.** "Size 5", not "Size 5 / Blue". A second axis is a matrix
and a matrix is combinations that do not exist.

**Null price means the product price applies.** Copying it into every row is how
one goes stale the first time she changes the price.

The case that would have been silent, and was tested for: a line carrying a
variant must not also come off the product's own count, or one sale is
subtracted twice.

**The basket line key became `product:variant`.** It matched on product id, so
adding a double and then a king would have merged into one line of two and the
buyer would have received two of whichever went in first. Storage key bumped to
`v2`, because dropping old baskets is visible and misreading them is not.

**The checkout prices and refuses per variant**, and the guards were tested as
attacks rather than as edge cases: a variant belonging to another product, a
made up id, a sold out size, all refused by name.

---

## 5. Reviews

Build plan item 6. 0059, a `review` function, a token page, a portal screen, a
fourth email, and 0060 for the schedule.

**A review is keyed to an order line.** There is no form on a product page and no
link from the grid, so the only way to write one is to have bought the thing and
to hold the reference and token from the confirmation email. That is what makes
the rating on a product page a fact rather than a decoration, and it is why the
schema markup can finally emit an aggregate rating without inventing one.

**Rating is null rather than zero when there are none.** A shop rendering 0.0 out
of 5 across a catalogue it listed last week is telling customers its own stock is
bad.

**No verified badge.** Every review is from a purchase by construction, so a
badge on all of them says nothing, and a badge is what a shop adds when some of
them are not.

**Editing replaces rather than being refused**, and puts it back in front of her,
because the words she approved are not the words that would be showing.

The email that asks goes seven days after dispatch, not after payment, with a
thirty day upper bound so turning it on for the first time does not email
everybody who ever bought anything.

---

## 6. Customers, subscribers, requests

Items 8 and 9, plus one that was never on the plan.

**Customers is a view, not a table.** Every order already carries the name, email
and address, so a customer is what you get when you group orders by email. A
separate record would be a second copy of an address that goes stale the first
time somebody moves house. Name and address come from the most recent order.

**The mailing list is single opt in, and the row is the consent record.** When,
from which page, and what the box said at the time. That last one is what makes
consent provable after the copy has changed. Unsubscribing sets a date rather
than deleting, because the record of having left is the evidence the opt out
worked. The unsubscribe link is an HMAC of the address, so there is no token
table, which would itself have been a list of subscribers.

**Requests was not on the plan and is worth more than most of what is.** The
band on the home page had promised "ask us to stock it" since the shop was built
and it opened an email client, which is where a request goes to die. It is a page
now, collecting what they want, what they pay for it now and where they buy it,
with anything asked for twice grouped and averaged.

That last part is the argument for the whole thing: the research pipeline pays
for demand signal, and this arrives free, from her own visitors, with a price
attached.

---

## 7. Sections, archiving, low stock

Items 10 and 11.

**Sections rename rather than reorganise.** A category is an eBay path and the
shop groups on its segments, which is why the navigation reads "Vehicle Parts &
Accessories". 0064 maps a path to a name she chose, longest match wins, and the
product keeps its path so the Google feed is untouched.

**Renaming does not move a URL.** The slug stays derived from eBay's name unless
she sets one, so a copy edit cannot break a link somebody has shared. That was
the one decision in it that could have cost something.

**Archiving is a status, not a delete.** An order still points at the product
row, and a shop that stopped stocking something still has to say what it was when
somebody asks about an order from March. An archived product's page stays
readable, because a saved link returning a dead page is worse than one saying the
shop moved on.

**Low stock reports once per drop, not per order.** `store_stock_alerts` holds
one row per thing currently below the line, deleted when the count recovers,
which arms the alert again. One email listing everything rather than one per
product.

---

## 8. Two decisions that were mine and were wrong

Recorded because both were caught by Joseph rather than by me.

**The subscribe box.** The band on the home page promised "no newsletter". Asked
to put a box in the footer, I pointed out the contradiction and then, rather than
saying the box had nowhere to live, attached it to the request confirmation and
argued for it. That solved my placement problem rather than the actual question,
which was whether the shop wants a list at all. It is in the footer now, in one
place, and the band says "no account needed".

**The band itself.** I designed it as a subscribe box in an earlier session, then
in a later one replaced it with a request and wrote a comment justifying the
change as though the earlier version had been somebody else's mistake. Building
both and defending both means the argument for either was worth less than it
sounded.

---

## What is in the database now

```
0056  public_store, the anon read path for the shop
0057  set_product_draft, drafts beside the real columns
0058  store_variants, order_items.variant_id, apply_order_stock rewritten
0059  store_reviews, store_product_ratings
0060  review requests, app_config, pg_cron and pg_net
0061  store_customers
0062  store_subscribers, store_mailing_list
0063  store_requests, store_request_demand
0064  store_category_names, store_category_map
0065  archive, store_stock_alerts, store_low_stock
0066  send_low_stock, the second cron job
```

Four edge functions added: `draft`, `review`, `subscribe`, `request`. Three
redeployed: `notify`, `checkout`, `stripe-webhook`.
