# Keepr task 01: shop drafts, returns and labels

**Draft 1, 1 October 2026** | The Brick Dev Studios | Internal

Keepr's first task run, and the first one she watches. Read with keepr-agent-04.md (Part 12, returns and label warnings) and keepr-agent-01.md (checks 3, 6 and 9).

---

## Why this task first

- 190 shop drafts wait only on "Returns to confirm". All 190 are her eBay listings copied to the shop, and all 190 were suggested standard.
- The cause is the eBay import, not the products: `ebay-import` writes `derived_fields.returns_class: 'standard'` on every copy, which marks standard as unconfirmed. Keepr's own rule (0115) says standard is confirmed as it lands.
- None of the 190 has been checked by Keepr, so none has had a label check either. Some are chemicals (the cockroach gel bait, the weedkiller).
- It is small, real and finishes in minutes: the right size to build the run and the office view on.

## Level

**Level 1: Keepr suggests, she acts.** It writes suggestions on each draft. It never puts a product on sale, never saves a hazard record, and never changes a returns class she has saved.

## Scope

- Her shop drafts: `store_products` with status draft, not archived, not a sample.
- Not yet checked by Keepr: no `derived_fields.rules`.
- On 1 October that is 194: the 190 eBay copies, 3 more eBay copies and 1 product she made by hand.
- Products on sale are never touched.

## What Keepr reads, per draft

- Title, brand, category, description, specifications, what is in the box.
- Her eBay listing's own description (`source_description`). These are her listings, so it is her wording and her facts.
- Up to 3 photos, the first one first.
- When the draft came from a card: the card's shop page facts and eBay facts.

## What Keepr decides

1. **Returns:** standard, sealed only, or no return, with one line of reason.
2. **Chemical:** yes or no, with one line of reason.
3. **The label, when it is a chemical:** the signal word, hazard and precaution statements with their codes, the symbols and any HSE number. Only what is printed in the facts or legible on a photo, and it says where it read each one. Nothing guessed.

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
| Ready for sale | standard returns, and no label needed | put it on sale, if nothing else is missing |
| Label to copy | a chemical, label read or not | check the label against the bottle and save |
| Yours to choose | sealed only or no return suggested | choose, with Keepr's reason beside it |
| Could not read | the check failed, or no facts and no photos | open it, or run it again |

The trays always add up to the number done.

## What Keepr writes

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
- **Cost:** one Claude call per draft, with up to 3 photos. Measured on the first 20, then shown as "spent so far" and "about £x for the rest". No figure is quoted before it is measured.
- **Stop and Pause** work at any point. A paused run carries on from where it stopped.

## What she sees: Keepr's office

The run looks like a person working at a desk, and every movement is a real event from the run. No fake progress.

- **The in-tray:** the drafts still to check, as a pile on the left, going down as it works.
- **The desk:** the draft being checked, with its photos laid out. Keepr reads it and marks what it finds on the page: the bottle caps circled, the hazard statement underlined on the box photo.
- **The stamp:** Keepr's mark. It lifts while weighing, then presses down, and the verdict is stamped on the draft.
- **The out-trays:** the four trays on the right. Each stamped draft slides into its tray, and the count goes up.
- **Keepr's notes:** a quiet running log of each line it wrote, in her words.
- **The clock:** done, left, time to go, spent.
- **At the end:** a short report of what landed where, then her buttons:
  - Put N on sale (the ready tray, only drafts with nothing else missing);
  - Open the labels to copy;
  - Choose the returns.

## Learning from her

- Every time she changes Keepr's suggestion (a sealed she makes standard, a label she corrects), it is recorded with the product and her choice.
- The next run reads those records first.
- When she makes the same change three times, Keepr proposes it as a lesson ("You make sealed toiletry sets standard. Do the same from now on?"). Accepted, it joins this file's knowledge.

## Also in this task

- `ebay-import` stops writing the standard flag, and runs Keepr's check on each new copy, as drafts from approved cards already do. New copies stop piling up.

## Open questions

1. Should "Put N on sale" also need her photos and description checked, or is the current release check enough? It already holds a draft with no description or no photos.
2. Is a product she made by hand (1 of the 194) in scope, or only the eBay copies?
