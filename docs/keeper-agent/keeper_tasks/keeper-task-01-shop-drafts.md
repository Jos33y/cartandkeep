# Keeper task 01: shop drafts, returns and labels

**Draft 6, 3 October 2026** (after the first real runs) | The Brick Dev Studios | Internal

Keeper's first task run, and the first one she watches. Read with keepr-agent-04.md (Part 12, returns and label warnings) and keepr-agent-01.md (checks 3, 6 and 9). How it was built: `keeper-task-01-build-plan.md`.

---

## The blocker rule

**Nothing becomes a blocker until the source has been read:** eBay's own policy page, or the law itself. Her live eBay listings count as evidence: if eBay already sells it, Keeper does not stop it. Anything not checked is a note at most.

Why it is written down: on 2 October an HSE number was called a blocker for the cockroach gel from memory. eBay's pesticides policy does not ask for one in a listing, and her listing is live. Built in, Keeper would have held back a product eBay already sells. What the law does ask of a biocide's advert (HSE, advertising requirements) is one line, "Use insecticides safely. Always read the label and product information before use.", and no "non-toxic", "harmless" or "natural". Keeper adds the line and points out those words.

Sources: [eBay UK fertiliser and pesticides policy](https://www.ebay.co.uk/help/policies/prohibited-restricted-items/fertiliser-pesticides-policy?id=4630), [HSE advertising requirements for biocidal products](https://hse.gov.uk/biocides/advertisement-requirements.htm).

## Why this task first

- 190 shop drafts waited only on "Returns to confirm". All were her eBay listings copied to the shop, all suggested standard.
- The cause was the eBay import: it wrote `derived_fields.returns_class: 'standard'` on every copy, which marks standard as unconfirmed. Fixed in the first build for new copies. The copies made before the fix still carry it (157 on 3 October) until Keeper checks them.
- None had been checked by Keeper. Some are chemicals (the cockroach gel bait, the weed killer).

## Level

**Level 1, as a seller.** Keeper decides what an experienced seller decides without asking: returns, label warnings it can read, the shop title, the address, questions an earlier pass left, a disputed detail left out. It never puts a product on sale, never changes anything she has saved, and never touches a product on sale.

## Scope

- Her shop drafts: status draft, not archived, not a sample, not yet checked (`derived_fields.rules`). 194 on 2 October; 108 left on 3 October.
- Every draft goes through every step. The one product added by hand is stock she keeps at home.
- What matters most for Google and AI search: the title, the address and the description. Details are kept only where the sources agree.

## When Keeper reads

**Only when a check is started from Products or the office.** A copy from eBay arrives as an unchecked draft and waits; nothing reads it on arrival, and opening a product does not start a read. Nothing is paid for until she, or the studio, starts a check.

## What Keeper reads, per draft

- Title, brand, category, description, details, box contents, her eBay description.
- Products already on the shop that look like the same thing (shortlisted in code).
- Questions an earlier pass left on the product.
- Photos only for a chemical's label or an unclear product.

## What Keeper decides

1. **Returns:** standard, sealed only or no return, decided and saved (`returns_by: keeper`). Only a real either way comes to her.
2. **Label warnings:** read from the photos and the words; when read, put on the page (`hazard`, `hazard_by: keeper`). When not readable, a note. Never a hold.
3. **The biocide safety line:** added at the end of the description of an insect, rodent or weed killer, repellent or disinfectant. Her words are not changed; words the law does not allow are pointed out.
4. **The shop title:** rewritten for search on eBay copies nobody has titled. A title that breaks a rule is left as a suggestion, not a hold.
5. **The address:** six words at most, about forty characters, no listing number. Drafts only; a live address is never changed by the check.
6. **Questions left earlier:** answered from the facts. A detail the sources disagree on (50 kg against 150 kg) is left out of the details, never guessed. Notes that only needed reading are cleared.
7. **The same product twice:** certain in code (barcode, same eBay listing or supplier page); otherwise up to three close live products go to Claude in the same call, lettered.
8. **Its own drafts against the facts:** a wrong number in Keeper's own unsaved description is corrected and shown.
9. **Empty boxes:** a draft with nothing written gets the writing job first; the check fills only boxes still empty (description, brand, box contents, section).

## The trays

| Tray | When | What she does |
|---|---|---|
| Ready for sale | nothing holding it | put it on sale |
| Warnings added | a chemical whose label warnings Keeper put on the page | put it on sale; look at the warnings if she likes |
| Needs you | already on the shop or another draft, a returns call either way, or something only she can add (a price, a photo, an answer) | the line says which |
| Could not read | three tries failed | the next check tries again |

"Put N on sale" covers Ready and Warnings added, only for drafts the shop's release check passes.

After the run, the report shows where each draft is **now**: an **On sale** tray for those that have gone live since (from the report or from Products), the other trays holding only what is still a draft, and a line for any archived since.

## What Keeper writes

One database function, `set_keeper_check` (0124, 0128): drafts only; nothing if she saved since Keeper read it; her returns and her title never replaced; warnings and the biocide number only where none is saved; the description only ever grows at the end; empty boxes only from the writer's work; the first address kept in `slug_before`.

## What she sees

- **On Products:** the Keeper card with the number of drafts to check, and "Check N with Keeper" for drafts she ticks (search included, so she can check a handful by name).
- **Starting a check:** "How many": 20, 50, 100 or all, the first ones in going first. One button: "Check 20 drafts" or "Check all N drafts". No money, no pace, no rehearsal: those are the studio's (`isStudio`).
- **The office:** in-tray, the desk with real steps from the server (reading the words, looking at the photos, writing it up), the out-trays, the log.
- **At the end:** where each draft is now, each listed in place, and "Put N on sale".

## Pace and cost

- First rehearsal: £0.08 for 5 drafts, about 1.6p each.
- First real runs, 3 October: 18 drafts for £0.34, then 50 for £0.85. About 1.7p a draft; the whole catalogue once is about £3.
- Her spending limit is worked out (about 3p a draft, never under £5). The studio can set it.
- Retries: 3 a draft, 20 seconds apart; 5 failures in a row pause the run.
- A draft checked again is paid for again, so "Check them again" is for drafts that have changed.

## Learning from her

Her changes to Keeper's work are recorded (`keeper_overrides`) and the last 20 go into the next check. Three of the same change becomes a proposed lesson.

## The name

The engine is what the studio sells; the name is per shop (`tenants.store.agent.name`). For Cart & Keep it is **Keeper**.

## Found in the first rehearsal (2 October)

- "Ready for sale" with 3 questions still open: the tray ignored the earlier pass's questions. Fixed: Keeper answers them, and ready means the release check passes.
- The bed rail was already live: the duplicate check only looked at drafts. Fixed: it compares with the shop.
- "Copy the label from the bottle": wrong for a dropshipping shop. Removed.
- Internal field names and jargon reached her ("in_the_box field is null", "GB CLP"). Lines are now short and plain.
- The desk steps ran on a timer. Now they are the server's real steps.
- Slugs carried the eBay listing number. Now short.

## Found in the first real runs (3 October)

- Live drafts stayed under "Ready for sale" in the report. Fixed: the On sale tray.
- No way to take part of the pile. Fixed: the batch picker.
- "Needs you" on Products read 159 when 1 needed her: the old blanket returns suggestion. It falls as Keeper checks the rest; left as is.
- The two pamper sets came back "Same as another draft". Hers to compare: different contents stay with their new titles, the same set at another price is archived.

## Still to check

- The draft function still writes questions in technical words for new imports; Keeper clears them in the same pass, but the source should be fixed.
- The older label hints on Products and Listings ("Copy the label") still show for drafts Keeper has not checked yet.
- Whether AI answer engines see the shop's product markup, which is added by script.
