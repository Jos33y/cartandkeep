# Handoff, Cart & Keep

**Session close:** 14 August 2026, WAT. Continues 13 August.

**Load with:** this file, `feedback-ck-2026-08-14.md`,
`session-summary-ck-2026-08-14.md`, plus `docs/design-system.md`,
`docs/research-process.md`, `docs/research-process-update-2026-08-10.md`,
`docs/terapeak.md`, `docs/supplier-apis.md`,
`docs/supplier-leads-2026-08-13.md`.

Read the feedback file first.

---

## Opening message for the new chat

> Continuing Cart & Keep. Two batches are live and undecided: 50 mobility
> candidates for 17 August and 41 bedding for 18 August, both with seven
> windows of history, honest postage per row, duplicate listings collapsed to
> products, and a 33 test suite behind the screens.
>
> The research half is done. The supply half is not, and that is the project
> now. Four routes were priced for bedding and every one that avoids a
> container loses money. Mobility is the opposite: good margin, too little
> volume to import, and the only route that fits how she trades is a UK trade
> account selling single units. Aidapt were emailed on 14 August and have not
> replied. That is the open thread.
>
> Do not sweep another term. Two categories are on screen undecided and four
> terms were swept yesterday afternoon, which was thrashing.
>
> One thing outranks everything: she has 67 live listings and six sales. Until
> that is explained, more products do not help.

---

## Where the work stands

| | |
|---|---|
| Candidates | 50 mobility, 41 bedding, on separate batches with a switcher |
| Coverage | 13 terms recorded |
| Metrics | every figure explained |
| Tests | `python scripts/run-tests.py`, 33 green |
| Approved | empty |

---

## The three things to do first, in order

**1. Chase Aidapt.** 01744 745020, trade sales. Emailed 14 August from
`purchasing@cartandkeep.com`, no reply. Two questions only: do they supply an
online retailer paying upfront, and what is the minimum order. On the raised
toilet seat at £18.80 with £9.01 of headroom, anything they quote under £9 is
profit from the first unit with no container, no import VAT and no stock risk.
That is the strongest position in the project and it is waiting on a phone
call.

**2. Explain six sales from 67 listings.** He cannot see her sold report, but
her sold history is visible through Terapeak with the seller filter rather than
a keyword, and public sold counts show on live listings. Some of those 67 may
be days old, in which case there is nothing to explain. If they are not, the
problem is listing quality and no batch will fix it. Titles like `Amazing
friend mug with multi coloured poka dot` are sentences rather than eBay titles,
while `Bed Rails for Elderly Adults Adjustable Bed Assist Rail Safety Handle
Seniors` is correct. That difference is checkable.

**3. Put the supply question into the model.** Every product died on supply
yesterday and the pipeline cannot see it. Two changes, both small:

- `candidate_sources` has no import VAT line, so a landed cost is understated
  by 20% for an unregistered buyer. A quote of £12.73 will read as clearing
  £13.63 of headroom when the true landed figure is £20.41.
- Nothing anywhere records whether she is VAT registered. She is not. It
  changes every import figure by a sixth and it should be a tenant setting
  rather than an assumption.

---

## What was established about supply, so it is not rediscovered

**Shape decides whether a Chinese route is possible, and it is now proven three
times.** A cushion shipped for 80p, a satin set ships as a packet, a rigid
toilet seat took £28.50 from one AliExpress seller and £3.88 a unit at 50
pieces from a factory, which is 69% of the goods price.

**The specification is the margin.** Plain reversible duvet sets sell at £10 to
£12 with £2 to £4 of headroom and fail. Egyptian cotton, satin and stated
thread counts sell at £14 to £25 with £5 to £15 and clear. The words are worth
about £3.65 a set.

**Volume and margin trade against each other and nothing has beaten both.**

```
mobility   £9 to £15 headroom, 1 to 4 sellers, 10 to 120 a month   too thin to import
bedding    £3 to £8 headroom, hundreds of sellers, 200 to 440      deep enough to import
```

**The winner, if there is one, looks like this.** Headroom £9 to £15 at the
real band, monthly worth above £400, under 200 live listings on the phrase,
soft or flat in shape, and a route that sells single units. Four of those five
are computable today. The route is not.

---

## Do not reopen

**`disability aids` as a term.** It returns the elderly batch under a different
name. Swept 14 August.

**`orthopaedic support` as a term.** The £40.46 average is mattresses. The
pillow leaf alone is £12.30 with 22% sell-through and £3.53 of headroom.

**`beauty` as a term.** It is a body piercing jewellery market with cosmetics
underneath. Its gate share on the piercing vocabulary is zero.

**Temu, AliExpress, Homefords and the small Alibaba tier for bedding.** All
four priced, all four lose money. The 1,000 piece tier at £7.12 works and
requires a container and VAT registration.

**July 2025 windows on any term.** Proven twice as an eBay artefact.

---

## Rotting

- Aidapt no reply, Tenura unsent
- CJ account needed a transaction by roughly 24 August
- `run.js` still deletes then inserts
- The decision trigger writes a null actor on delete
- `monthly_headroom` exists in the database and in no migration
- The raised toilet seat is costed at small parcel and is 400 x 355mm
- `candidate_sources` has no import VAT line
- No VAT registration switch anywhere
- `BatchScatter` prints its `£4 floor` label over the two busiest dots
- `useLatestBatch` is dead code
- Duty rates of 12% and 6.5% were asserted from memory, not read off the tariff
- Two flags on her live listings: a licensed Disney pyjama set, and five
  cosmetics by our own boundary
