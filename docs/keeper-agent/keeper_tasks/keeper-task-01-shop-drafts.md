# Keeper task 01: shop drafts, returns and labels

**Draft 4, 2 October 2026** (returns from the words, titles added, scope settled) | The Brick Dev Studios | Internal

Keeper's first task run, and the first one she watches. Read with keepr-agent-04.md (Part 12, returns and label warnings) and keepr-agent-01.md (checks 3, 6 and 9).

---

## Why this task first

- 190 shop drafts wait only on "Returns to confirm". All 190 are her eBay listings copied to the shop, and all 190 were suggested standard.
- The cause is the eBay import, not the products: `ebay-import` writes `derived_fields.returns_class: 'standard'` on every copy, which marks standard as unconfirmed. Keeper's own rule (0115) says standard is confirmed as it lands.
- None of the 190 has been checked by Keeper, so none has had a label check either. Some are chemicals (the cockroach gel bait, the weedkiller).
- It is small, real and finishes in minutes: the right size to build the run and the office view on.

## What the Products page shows today (screenshots, 1 October)

- **216 products:** 22 live, 1 ready, 187 "Needs you", 6 blocked. 192 came from eBay.
- **Needs you:** "Before it can go live: 1 to decide", and that one is the returns. Returns read 1 of 187 done.
- **Blocked, all 6 on the label (Hazard):** Cockroach Gel Bait, Fungus Fighter Plus, HG Mould Remover twice, Pest Sticky Pads, Rootblast Weed Killer.
- **Already drafted by Keeper and waiting for her, but not holding anything back:** the title choice, the description ("Written for you. Read it and save."), the details, what is in the box and the section. They sit under "To finish".
- **Cost:** missing on 186 of 187. It never blocks, but without it nothing can say what a sale keeps.
- **One at a time:** the "Biggest gap" button confirms returns on one product per press ("Confirm returns on #winning Coin Slot"). 190 presses.

Two things found in the screenshots:

- **A wrong fact in a drafted description.** The Blind Valance Clips are 2.5 inch (title, details), but the drafted description says "5 inch blinds". It looks like "2." was cut from "2.5" (inferred, cause not yet found in the code). Keeper's own drafts need a check against the facts before she reads them.
- **A word rule, not judgement.** Pest Sticky Pads are glue traps with no poison, yet they are blocked for a label. A person would not ask for a hazard label on a sticky pad.

## Level

**Level 1: Keeper suggests, she acts.** It writes suggestions on each draft. It never puts a product on sale, never saves a hazard record, and never changes a returns class she has saved.

## Scope

- Her shop drafts: `store_products` with status draft, not archived, not a sample.
- Not yet checked by Keeper: no `derived_fields.rules`.
- On 1 October that is 194: the 190 eBay copies, 3 more eBay copies and 1 product she made by hand. The 6 blocked chemicals are among them.
- Products on sale are never touched.

## What Keeper reads, per draft

- Title, brand, category, description, specifications, what is in the box.
- Her eBay listing's own description (`source_description`). These are her listings, so it is her wording and her facts.
- **Photos only when the words are not enough:** returns are judged from the title and description. Photos are read only for a chemical's label, or when the words leave the product unclear. Fewer photos, a cheaper and faster run.
- When the draft came from a card: the card's shop page facts and eBay facts.

## What Keeper decides

1. **Returns:** standard, sealed only, or no return, with one line of reason, judged from the title and description.
2. **Chemical:** yes or no, with one line of reason.
3. **The label, when it is a chemical:** the signal word, hazard and precaution statements with their codes, the symbols and any HSE number. Only what is printed in the facts or legible on a photo, and it says where it read each one. Nothing guessed.
4. **Not a chemical after all:** when a product was flagged by a word (pest, mould, killer) but is not a chemical, Keeper says so with its reason ("Glue trap, no poison, no label needed"). Ticking "no warning label" stays hers; Keeper puts the reason beside the tick.
5. **The shop title (see below).**
6. **Its own drafts, checked against the facts:** the drafted title and description she has not saved yet are read against the details, the box contents and the photos. A wrong number, size, count or pack is corrected in Keeper's own draft and the change is shown ("Description said 5 inch, the product is 2.5 inch: corrected"). Anything she has saved is hers and never changed.

### The shop title

Most of the eBay copies came with eBay titles: stuffed for eBay's search, with counts in front ("10Pcs"), hashtags ("#winning"), repeated words and seller phrases. On her shop the title has a different job: Google, Google Shopping and AI answer engines (ChatGPT, Gemini, Perplexity) read it to decide what the product is and who it is for.

What a good shop title is:

- **What it is first,** in the words a person would search: "Blind Valance Clips", not "10Pcs Blind Valance Clips 2.5" Window Blinds Hidden Clip Retainer Holder".
- **Then what tells it apart:** brand when it matters, size, count or pack, material or colour, model number.
- **Plain and readable:** about 50 to 70 characters, normal capitals, no hashtags, no "UK seller", "fast dispatch", "new" or "free postage", no repeated words, no emoji.
- **True to the product:** every number in the title matches the details and the photos.

What Keeper does:

- Keeper already drafts title choices on these products (screenshot: "Blind Valance Clips 2.5 inch, Pack of 10"). It picks the best of them by the rules above, or writes a better one, and checks it against the facts.
- The chosen title is set as her draft's title, marked as Keeper's, with the eBay title kept beside it. She can switch back with one press.
- **Her eBay listing is not touched.** The shop title and the eBay title are separate. The eBay title is her own wording, so it stays as she wrote it on eBay.
- A title that cannot be made clear from the words (a vague product, no size where one matters) goes to "Yours to choose" with what is missing.

### How it judges

Judgement, not a checklist. What it knows:

- **The law gives standard.** A customer can cancel within 14 days for any reason. Refusing a return they are entitled to is the worse mistake, so when in doubt it is standard.
- **Sealed only** is for goods that cannot go back on sale once opened, for health or hygiene: toiletries, cosmetics, razors, toothbrush heads, intimate care. Returns are still accepted while the seal is intact.
- **No return** is for goods made to order or personalised, or that go off quickly.
- **Judge the goods, not the packaging.** A boxed pan is standard. A cleaning spray is ordinary goods for returns, and a chemical for the label.
- **It may go beyond this file.** When the product in front of it says something these notes do not cover, it follows the product and says why in its line. Example: "Marked as cleaning, but it is a sealed contact lens solution: sealed only."

## The trays

Every draft lands in exactly one.

| Tray | When | What she does |
|---|---|---|
| Ready for sale | standard returns, no label needed, nothing holding it | put it on sale |
| Label to copy | a chemical, label read or not | check the label against the bottle and save |
| Not a chemical | flagged by a word, but it is not one | tick "no warning label", with Keeper's reason beside it |
| Yours to choose | sealed only or no return suggested | choose, with Keeper's reason beside it |
| Could not read | the check failed, or no facts and no photos | open it, or run it again |

Every tray card also shows the new shop title beside the old one.

A draft corrected by the facts check still lands in its tray; the correction is shown on it.

The trays always add up to the number done.

## What Keeper writes

- Through `set_product_rules` (0115) only: suggestions in `derived_fields`.
- Standard clears "Returns to confirm" by itself (`derivedPatch`).
- Sealed only or no return stays a question for her.
- A chemical gets `hazard_suspect` and the label it read in `hazard_draft`.
- A run record per draft: tray, the one line, where it read it, how long it took and what it cost.

## Hard lines

- Never puts anything on sale. "Put N on sale" is her button.
- Never writes `hazard`, and never ticks "no warning label". Those are hers.
- Never changes a returns class she saved (`returns_by: 'her'`).
- Never invents a label element. An unreadable label leaves the boxes empty.
- Never touches a product on sale.

## Pace and cost

- 3 drafts at a time, the way `shop-rules` already works.
- **Watch:** about one draft every 3 to 4 seconds, so she can follow each one. 194 takes about 12 minutes.
- **Normal:** as fast as the check allows.
- **Cost:** one Claude call per draft, returns and title together, with photos only for labels and unclear products. Measured on the first 20, then shown as "spent so far" and "about £x for the rest". No figure is quoted before it is measured.
- **Stop and Pause** work at any point. A paused run carries on from where it stopped.

## What she sees: Keeper's office

The run looks like a person working at a desk, and every movement is a real event from the run. No fake progress.

- **The in-tray:** the drafts still to check, as a pile on the left, going down as it works.
- **The desk:** the draft being checked, with its photos laid out. Keeper reads it and marks what it finds on the page: the bottle caps circled, the hazard statement underlined on the box photo.
- **The stamp:** Keeper's mark. It lifts while weighing, then presses down, and the verdict is stamped on the draft.
- **The out-trays:** the four trays on the right. Each stamped draft slides into its tray, and the count goes up.
- **Keeper's notes:** a quiet running log of each line it wrote, in her words.
- **The clock:** done, left, time to go, spent.
- **At the end:** a short report of what landed where, then her buttons:
  - Put N on sale (the ready tray, only drafts with nothing else missing);
  - Open the labels to copy;
  - Choose the returns.

## Learning from her

- Every time she changes Keeper's suggestion (a sealed she makes standard, a label she corrects), it is recorded with the product and her choice.
- The next run reads those records first.
- When she makes the same change three times, Keeper proposes it as a lesson ("You make sealed toiletry sets standard. Do the same from now on?"). Accepted, it joins this file's knowledge.

## The name

What the studio sells is how the agent works: the engine, the task files, the levels, the office she watches. The name is the client's. For Cart & Keep it is **Keeper**, from her brand, and it is the name the portal already shows (Ask Keeper again, the Keeper chips). Another client's portal can call the same engine something that fits their brand.

So in the build:

- the name she sees is a setting per shop, not written into the code or the copy;
- code and tables use a neutral name for the engine, so a second client needs no renaming;
- the agent files (keepr-agent-01 to 04) move to "Keeper" at their next revision.

## Also in this task

- `ebay-import` stops writing the standard flag, and runs Keeper's check on each new copy, as drafts from approved cards already do. New copies stop piling up.

## Decided (2 October)

- **Returns are judged from the title and description.** Photos only for labels and unclear products.
- **Titles are part of this task.** The shop title is rewritten for Google and AI search; the eBay listing is not touched.
- **"Put N on sale":** the button at the end of a run that takes every draft in the Ready tray live in one press. N is how many are in that tray. It is the same as "Save and take live" on one product, done for all of them, and only for drafts the release check already passes. It stays her press; Keeper never takes a draft live.
- **Every draft goes through every step,** whatever its source. The one product added by hand is stock she keeps at home, not a hand-made product, so it is judged like the rest.

## Risks found before building

Each one is handled in the build, not left to be found by her. Confirmed means read in the code or the data; inferred means still to prove.

| # | Risk | Status | How it is handled |
|---|---|---|---|
| 1 | `keeper_jobs` allows one open job per product, of any kind (0102). A product with a "fill" job still open would refuse the new check, and the reverse. | Confirmed | The open-job rule becomes one per product per kind, and the kind list gains the new check. Migration, run on Postgres here first. |
| 2 | `keeper_jobs.kind` only accepts `fill` (0102 check constraint). | Confirmed | Same migration. |
| 3 | Keeper writes a draft while she has it open in the product sheet: one overwrites the other. | Inferred | Keeper writes only its own fields through one database function, and skips a draft changed in the last few minutes; that draft is checked at the end of the run. |
| 4 | A title she has already chosen or typed gets replaced. | Inferred: no marker today says who set a title | Keeper changes a title only when nobody has saved one in the portal. Every change keeps the old title (`title_before`) and marks itself (`title_by: keeper`). Saving a title in the sheet marks it hers, and Keeper never touches it again. |
| 5 | The shop address keeps the eBay title: `/p/10pcs-blind-valance-clips-2-5-window-blinds-hidden-clip-reta-318730969073`. Search engines read the address too. | Confirmed: the slug is set once, when the product is made | For drafts only, the address is made again from the new title. Never for a product on sale, so no live link breaks. |
| 6 | The same product twice among the drafts (HG Mould Remover at £10.18 and at £9.85). | Confirmed in the screenshots | Keeper flags pairs with the same product and sends both to "Yours to choose", naming the other. It never removes one. |
| 7 | Claude is busy, slow or refuses a draft. | Expected | Up to 3 tries with a pause between, then "Could not read". Five failures in a row pauses the run and says why. |
| 8 | The run costs more than planned. | Guarded | A spending cap per run, shown before it starts. The run pauses at the cap. |
| 9 | A function call runs out of time with many drafts at once. | Inferred: edge functions have a time limit | Small batches per call, picked up every minute by the existing schedule, so the run carries on with the portal closed. |
| 10 | The office view does not update live. | Confirmed: the portal already reads Keeper's queue every 2.5 seconds (`useKeeper`) | The office reads the run the same way. No new live-update service needed. |
| 11 | eBay photos refused when Claude fetches them. | Handled today | The check already retries without photos (`shop-rules`). |
| 12 | Customer copy breaks a house rule (dashes, "she", American spelling). | Guarded today | The same clean-up the writing already uses (`dashless`), plus a check on every title before it is saved. |
| 13 | Products go on sale before the shop is promoted. | Confirmed with Joseph, 2 October: Stripe is live and the shop is not promoted yet | Intended. Putting products on sale is the point of this task. |
| 14 | The same stock sold twice: the shop and eBay keep separate counts (5 each on import). | Confirmed | Not this task. Noted for her: a product that sells on one channel needs its count lowered on the other until stock is shared. |
| 15 | A product on sale is changed by mistake. | Guarded | Every write is for drafts only, checked in the database function as well as in the run. |

## Testing before her run

1. Five drafts, Watch pace, Joseph watching: every tray, every title, every write read back from the database.
2. Twenty more: measure the time and the cost per draft, and set the cap from it.
3. Then the rest, with her watching.

## Still to check

- **Structured data for Google and AI search:** whether her shop's product pages carry Product markup (brand, barcode, price, stock). A good title helps; the markup is what Google Shopping and AI engines rely on. To audit before or alongside this task.
