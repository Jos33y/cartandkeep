# 18 — Measurement

How you know any of this worked, and how to argue about it afterwards with something other than taste.

---

## Verdict

There is no instrumentation visible in the build.

That is the more expensive gap than it appears, because it means every future design decision will be argued on opinion. A shop that cannot measure cannot improve, and a studio that cannot show what changed cannot justify a second engagement.

---

## The job

Three separate jobs that get conflated.

1. **Prove the work.** Did the redesign move a number that matters?
2. **Find the next problem.** Where are people leaving, and why?
3. **Feed the buyer.** What should Mrs Sowande stock next?

The third is the one nobody builds, and for a growing general store it is the most commercially valuable.

---

## The numbers that matter

Almost every ecommerce dashboard measures thirty things and acts on none of them. Six numbers, reviewed weekly.

| Number | Why |
|---|---|
| Conversion rate, split by device | The single number. Mobile and desktop split, always, because they are different shops. |
| Average order value against £40 | Tells you whether the delivery threshold mechanic is working. |
| PLP to PDP rate | Card quality: image, title, price. |
| PDP to basket rate | Page quality: spec, delivery, trust. |
| Basket to order rate | Checkout quality. Where the money leaks. |
| Repeat purchase at 60 days | Post-purchase quality. The retention number. |

Each one maps to a document in this set. If a number is bad, you know which file to open.

---

## Instrumentation

### Events worth logging

**Discovery**
- `search_performed` with query, result count, whether from header or a page
- `search_zero_result` with query. **The most valuable event in the shop.**
- `search_suggestion_clicked` with type: product, category or answer
- `nav_group_opened`
- `facet_applied` with facet, value, result count
- `facet_zero_result` with the full applied combination

**Product**
- `product_viewed` with source: PLP, search, cross-sell, direct
- `quick_view_opened` and whether it led to add or to PDP
- `gallery_zoomed`
- `spec_table_expanded`. High rates mean the key facts strip has the wrong facts.
- `back_in_stock_requested`. A direct purchasing signal.

**Basket and checkout**
- `add_to_basket` with source surface
- `basket_line_removed` with product
- `threshold_crossed`
- `threshold_suggestion_clicked`. Isolatable merchandising value.
- `checkout_section_completed`
- `checkout_field_error` with field name
- `payment_failed` with reason
- `payment_retried` and outcome

**Post-purchase**
- `tracking_page_visited` with visit number for that order
- `return_started` with reason code
- `help_answer_opened`, `help_answer_voted`, `help_link_copied`

**Requests**
- `stock_request_submitted` with the free-text query and the source surface

### What not to log

- Nothing personally identifying beyond what the order requires
- No session recording without a clear, honest notice
- No third-party analytics that costs more in performance than it returns in insight

A single first-party analytics tool is sufficient. Plausible, Fathom or a self-hosted Umami will answer every question in this document at a fraction of the performance cost of the usual stack, and without a consent banner that costs more than the storefront.

---

## The feedback loops

The instrumentation only matters if something happens as a result. Four loops, each with an owner and a cadence.

### 1. Zero-result search → stock and synonyms

**Weekly.** Every search returning nothing is a customer telling you exactly what to buy or what to call something.

Two outcomes: it is a product the shop should stock, which goes to Mrs Sowande as a buying list, or it is a word for something already stocked, which goes into the synonym list. Both are ten minutes of work with a direct revenue effect.

### 2. Help centre No votes and zero-result help searches → content

**Monthly.** An answer with a high No rate is wrong, not just unclear. A help search returning nothing is a missing answer.

This is what turns the help centre into a recurring deliverable rather than a page that ships once and rots.

### 3. Return reason codes → product data

**Monthly.** Three returns against one product with the same reason is a data defect.

- "Not as described" → the title or spec is wrong
- "Wrong size" → dimensions are missing
- "Looked different" → the image is wrong

This loop pays for itself faster than any other, because returns cost more than any design work in this document.

### 4. Facet zero-results → taxonomy and stock

**Monthly.** A filter combination that returns nothing is either a taxonomy gap or a genuine hole in the range. Both are worth knowing.

---

## Testing

At current traffic, A/B testing will not reach significance on anything. Say so plainly rather than running underpowered tests and drawing confident conclusions from noise.

What to do instead, in order:

1. **Fix the known defects.** Everything in this document set is a defect against established research. None of it needs testing to justify.
2. **Measure before and after**, with a long enough window and an honest acknowledgement of seasonality.
3. **Qualitative testing with five people.** Five sessions finds roughly 80% of usability problems and costs a day. At this traffic level it is worth more than any quantitative approach.
4. **Session recordings on checkout only**, with a clear notice, reviewed rather than accumulated.

Once the shop is doing meaningful daily order volume, revisit. Not before.

---

## Reporting

The number a client should see, and the format that makes the work legible.

**Monthly, one page:**
- The six numbers, this month against last
- What changed on the site and when
- What the data suggested and what was done about it
- The buying list from zero-result searches
- What is next

Not a dashboard. A dashboard is something a client looks at once. A page with a recommendation on it is something they act on.

---

## Study

- Baymard Institute. Their research is the reason most of this document set can assert things without testing them. Worth the subscription for a commerce project.
- Google Analytics 4 ecommerce event schema, as a reference for event naming even if using a lighter tool.
- Plausible, Fathom, Umami. First-party, privacy-respecting, fast.
- Nielsen Norman Group on the five-user finding, which is frequently misquoted and worth reading in the original.
- Evan Miller's writing on sample size and significance, for anyone tempted to A/B test at low volume.
- Shopify's analytics documentation for the standard commerce funnel definitions, so numbers are comparable to industry benchmarks.
