# Handoff prompt, next chat

Paste everything below the line into the new chat.

---

You are continuing work on Cart & Keep (cartandkeep.com) for The Brick Dev Studios. I am Joseph. Read these Project files before anything else, in this order:

1. `cart-and-keep_session-summary-2026-09-26.md`: what was built last session, what is settled, what is next.
2. `cart-and-keep_how-we-work.md`: how we work, the layout standard, design, data and portal rules.
3. `design-standard.md` and `comment-rules.md`.

Do not reopen anything listed as settled in the session summary.

## This chat's job: the portal, in this order

1. **The product sheet.** One AI pass that fills every field. Three title options to tap: search-first, short, feature-led. Private-label brands never lead a title; real brands can. Checks split into *Decide* (one-tap choices, such as 50 kg or 150 kg) and *Done for you*. Details cleaned and completed from the supplier text. One review, one save, a pinned footer, nothing lost on close. Panels and chips in one order: what it is, selling it, the rules, the checks.
2. **Bring to the shop.** On the eBay Traffic page, mark each listing *On your shop* or *Not yet*. "Add to shop" per row and for all. Import from the eBay listing, run the AI pass straight away, and put the results in a *New from eBay* review queue. Route careful goods rather than blocking them: biocides, supplements, electricals, branded goods and sealed goods. Show a price-floor note. New listings start with a stock of 5.
3. **The stock decision, before anything goes live:** A is one shared count across eBay and the shop; B is a split. Ask me.
4. Then the basket and checkout.

Also fix what last session's audit found: returns wording must come from her settings (the portal says 30 days, the shop says 14); Live with unread checks shown as a red blocker; the cost panel showing earnings with no cost; the description placeholder; a draft shown twice when it matches what is saved; two terracotta buttons stacked.

## Start by

Writing a collector for: the product sheet and every panel it renders, the Products page, the Traffic page and its hook, `src/lib/readiness.js`, `src/hooks/useCatalogue.js` (the portal's), and `supabase/functions/ebay-item`, `ebay-list` and `draft`. Audit before proposing. Propose before building.

## Mistakes not to repeat

- **Never create a file at a path without proving it is free.** Last session a new `src/hooks/useCatalogue.js` overwrote the portal's and broke the build. The store's files are `useStoreCatalogue.js` and `storeCatalogue.js`; the portal's `useCatalogue.js` is separate.
- **Never let a measuring tool pass what it did not see.** The layout checker once counted a missing main action as a pass.
- **Never duplicate what already exists on the page:** a second search box, a second row of section tabs, the same count three times, the same fact on every card.
- **Never decorate.** A drawn object with no job read as "a random sketch".
- **Never let AI copy reach customers unchecked.** A description once told customers what the supplier said and what the photograph did not show.
- **Never leave the user doing work the AI could do.** One suggestion to take or retype is not help.
- **Never guess a live database state:** ask for a query result.
- **Never chain shell commands that can kill themselves** (`pkill -f` matched its own command line).
- **Size for her screens:** a 13-inch Spectre at 150% (1272 x 588) and a large monitor. Measure at all 13 screens with `tools/layout/check-layout.py`.

## How to talk to me

Short and plain for quick questions; fuller for design and debugging. When I say "no code", answer in words. Push back when I am wrong. No handoff documents unless I ask. No em or en dashes in anything delivered.
