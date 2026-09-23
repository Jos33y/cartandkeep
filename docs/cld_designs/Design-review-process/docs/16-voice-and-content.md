# 16 — Voice & Content

---

## Verdict

**Two different writers, effectively.**

The hand-written copy is genuinely strong. Top decile for a small UK shop. "The awkward middle", "Eight departments, one basket, one delivery", the entire "What we will not do" list, "Written by whoever supplied the product, not by us", the Consumer Rights Act line. That is a real voice with a real point of view, and it is the single most valuable asset in the project.

The product copy does not exist. And product copy is over ninety percent of the words on an ecommerce site.

> `8 Pack Nappy Bin Refill Bags,7.5M Each Nappy Bags 7-layer Anti-Odor | Diaper`

> `WERHE Adapter Set for Earth Auger, SDS Plus/sds Max Rotary Hammer, 2 Bolt`

Missing space after the comma. A pipe character. American spelling. Keyword stuffing. A shopper cannot tell what either of these things is.

So: a professional wrote eight pages and nobody wrote the shop.

The other content defects, briefly:
- Prices are cost-plus-margin outputs. `£119.16`, `£82.09`, `£117.24`. No shop prices like that.
- Category chips are taxonomy strings. "Bath & Body Mixed Items & Gift Sets" is a database field, not language.
- The eyebrow claims eight departments and the footer names six.
- Placeholder text is still on live pages: NEEDS HER WORDS, TO CONFIRM registered name, TO CONFIRM address.

---

## The voice

Already established and worth naming so it can be applied consistently at scale.

**Plain, specific, slightly dry, never pushy.**

The register is a competent shopkeeper who respects your time. Not a brand. Not a friend. Not an assistant with a personality.

### Rules

**Concrete nouns over categories.** "Pans, pet beds, floor lamps, drain unblocker" beats "homeware, pet supplies, lighting and cleaning" every time. Naming actual objects is what makes a general store feel real.

**Facts, not adjectives.** "300g" not "generously sized". "Two to four working days" not "fast delivery". "30 days" not "hassle-free returns".

**British English throughout.** Colour, organise, whilst is fine but plainly *while* is better, and no American spellings anywhere including in product titles imported from a feed.

**Contractions sparingly.** The current copy mostly avoids them and it reads as considered rather than stiff.

**Admit limits.** "Four things in here so far, and more every Monday" is better copy than any attempt to make four products sound like a range. The shop's honesty is its differentiator and it should extend to its own size.

**No exclamation marks.** Not one, anywhere.

**No emoji.** Not in the interface, not in email, not in error states.

### The banned list

Every one of these appears somewhere in a supplier feed or a default theme, and none should survive.

Discover · Elevate · Curated · Effortless · Seamless · Game-changing · Must-have · Perfect for · Say goodbye to · Look no further · Whether you're a... or a... · Premium quality · Unleash · Transform your · Level up · The ultimate · Simply · Just · Amazing · Incredible · Oops! · Yay! · We're excited

---

## Product titles at scale

The largest content problem in the project, and it has to be solved as a system because 1000 titles cannot be hand-written.

### The pattern

```
[Object], [the one qualifier that decides the purchase]
```

| Feed string | Written title |
|---|---|
| `WORKPRO 3.6V Electric Screwdriver Set with Offset Drive, 24-Piece Cordless` | Cordless electric screwdriver, 24 bits |
| `8 Pack Nappy Bin Refill Bags,7.5M Each Nappy Bags 7-layer Anti-Odor \| Diaper` | Nappy bin refill bags, 8 pack |
| `WERHE Adapter Set for Earth Auger, SDS Plus/sds Max Rotary Hammer, 2 Bolt` | SDS auger adapter set, 2 bolt |
| `Mr Muscle Drain Unblocker Gel 500ml Kitchen Sink Bathroom Fast Acting` | Mr Muscle drain unblocker, 500ml |

### Rules

- **60 characters maximum.** It must fit two lines at 15px on a card without truncating.
- **Sentence case.** Not Title Case, not ALL CAPS.
- **Brand only when the brand is the reason.** Mr Muscle yes, WERHE no. Nobody is buying WERHE.
- **One qualifier.** Capacity, count, size or power. Whichever decides the purchase. Never three.
- **No pipes, no slashes, no double spaces, no keyword strings.**
- **No marketing words.** The title is an identifier, not a pitch.

### How to do this for 1000 products

1. **Rules engine first.** Strip brand noise, normalise units, fix spacing and punctuation, convert American spellings, truncate at the first structural delimiter. This alone gets perhaps 60% of titles to acceptable.
2. **LLM pass second**, with the pattern above as the prompt and the extracted attributes as input. Gets to perhaps 90%.
3. **Human review on the top 200 by revenue.** Never on all 1000. The tail does not justify it.
4. **Review queue** for anything the engine flags as low confidence.
5. **Never overwrite a hand-written title on a feed update.** This is the failure that undoes all of the above.

The same pipeline generates alt text, from the written title rather than the feed string.

---

## Microcopy library

Write these once, use them everywhere. The same fact phrased three different ways across three surfaces is how a shop starts feeling untrustworthy.

| Fact | The line |
|---|---|
| Delivery threshold, below | "£21.35 to go for free delivery." |
| Delivery threshold, met | "Delivery is free on this order." |
| Delivery cost | "£4.95, or free over £40." |
| Delivery time | "Arriving Tuesday 26 August." |
| Returns | "30 days to change your mind. We pay the return postage." |
| Statutory rights | "Nothing here removes your statutory rights." |
| No account | "No account needed. We do not create one." |
| Payment | "Stripe takes the payment. We never see your card." |
| Supplier text | "Written by whoever supplied this product, not by us." |
| Low stock | "5 left." |
| Out of stock | "Out of stock. Tell us and we will let you know when it is back." |
| Support | "One person reads these and she replies herself, usually the same day." |
| Request | "Tell us what it is and what you pay for it now. One person reads these." |
| Sort honesty | "Sorted by what people keep buying. Nothing here is boosted or sponsored." |

---

## Pricing

Not a copy decision, but it surfaces as one, and it is currently the weakest data in the shop.

`£26.17`, `£82.09`, `£117.24`, `£19.88`, `£18.23`. These are cost-plus-margin outputs. No shop prices like that, and a customer reads it, correctly, as a machine setting prices.

The conversation to have with Mrs Sowande, and it is a half-hour conversation, not a design decision:

- Round to `.00`, `.50`, `.95` or `.99`. Pick one convention and apply it everywhere.
- `.95` sits well with the shop's honest positioning. `.99` is slightly more aggressive but universally understood.
- Round **up**, never down, so margin is never lost.
- Never show a struck-through was-price. Already promised, already correct.

This blocks [06 — Homepage & Hero](06-homepage-and-hero.md) direction 2c, the Price Board, which is otherwise the most distinctive hero of the three.

---

## Content operations

At 1000 products, content is an operation, not a project.

- **Product titles**: rules engine, LLM, human review on the top 200.
- **Attributes**: extracted from the feed, mapped to a controlled vocabulary per department. This is what fixes the one-row spec table.
- **Category names**: hand-written, never taxonomy strings. There are perhaps 60 of them and they are worth an afternoon.
- **Synonym list**: hand-written from search logs, reviewed weekly.
- **Help answers**: written from the zero-result log and the No votes.
- **Nothing publishes with placeholder text.** A build check should fail on TO CONFIRM, NEEDS, TBD or Lorem.

---

## Measure

- **Titles over 60 characters.** Should be zero.
- **Titles containing a pipe, a double space or American spelling.** Should be zero.
- **Products with fewer than four extracted attributes.** This is the spec-table completeness metric.
- **Return rate by reason.** "Not as described" correlates directly with title quality.
- **Search zero-result rate**, which is partly a synonym problem and partly a naming problem.

## Study

- GOV.UK content design guidance and the A to Z of style. The best public writing standard in existence, and it is free.
- Apple's Human Interface Guidelines on writing. Particularly on being specific rather than encouraging.
- Nicely Said, Kissane & Kim, on voice and tone for interfaces.
- Mailchimp's content style guide for structure, though the register is far chattier than this shop should be.
- Erika Hall, *Conversational Design*, on why plainness beats personality.
- Amazon and eBay title conventions, as a study in what happens when nobody writes the shop. Instructive as a negative example.
