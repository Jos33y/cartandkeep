# Feedback, 22 September 2026

**Cart & Keep** · read this first, before writing anything

Every correction Joseph made this session, what I was doing wrong, and the rule that stops it happening again. The earlier feedback files still stand; this adds to them.

---

## How he wants to work

- Action first. Short answers for small things, full reasoning for design and debugging.
- Every file delivered with its path, and whether it is new or an overwrite.
- British and Nigerian English. No em dashes anywhere, including code comments.
- Design at senior level, first time. "Lazy", "playing it safe" and "looks like a spreadsheet" were all fair descriptions of first passes this session.
- Visuals over text. Explanation belongs in tooltips and info icons, not in paragraphs on the screen.
- Interface copy never refers to the client in the third person. Either "you", or a neutral statement of fact.
- Comments follow `comment-rules.md`: one line, the why, never the history.
- Push back when he is wrong, and say plainly when I am.

---

## What went wrong, and the rule it produced

**Guessing instead of reading.** I wrote an RLS policy from an invented JWT path instead of reading how every other table does it (`has_tenant()`), so the traffic page read an empty table while the rows existed. I assumed eBay's date format, its refresh behaviour, its status words and its scope list. Each cost a round trip.
Rule: before writing against a system, read how the project already does it, and make the failure message carry the system's own words.

**Status codes instead of the actual answer.** Three rounds went on 403s that one field would have explained: which scopes the consent actually granted. I also stored the scope list I asked for as though it were the one granted, which broke refresh the moment I added a scope.
Rule: surface what the other system says, not a status code, and store what it returned, not what was requested.

**Silent edits.** A `str.replace` with no assertion matched nothing, so the panel styles never landed. Later a failed run overwrote the delivered finance stylesheet with an eight-line fragment, because a copy command still copied the one file that existed.
Rule: every replacement asserts it matched. Before delivering, check the working folder still has the files, and after, check every class a page uses exists in its stylesheet.

**Restraint read as "use less".** The portal was flat because I treated "no gradients, no glass" as "no visual interest". That is how `design-standard.md` came to be written.
Rule: nothing is banned. Use a technique where it does a job. Build tokens and primitives before screens.

**Adding features to a flat layout.** The first Approved rebuild put a price scale and a composer into the same stack of hairline sections, which Joseph rightly called zero improvement.
Rule: when a page is wrong structurally, redesign the structure; do not decorate it.

**Copy drift.** "A seller her size", "Her selling listings convert", "Pulls her orders" all reached screens she reads.
Rule: sweep every rendered string for "her", "she" and "your size" before delivering.

**The model reconciling contradictions.** The rewrite turned "8 x 150g" in text and "4x" on the box into "two of each", a fact nobody stated. It also narrowed "fully recyclable" to "trays are fully recyclable".
Rule: generated copy uses stated facts only, never narrows a claim, keeps suitability limits verbatim, and refuses with a conflict message when sources disagree.

**Claiming what I could not know.** I said Cesar had reformulated Country Stew with nothing to support it. I said the view definition arrived empty when it had not.
Rule: say "I don't know" and name the check that would settle it.

**Deleting without checking the consumers.** Deleting 74 shop products stripped the cost link from past sales, which is why Finance then said "no cost recorded" on everything.
Rule: before deleting, check what reads the rows, not only what references them.

**Showing a guess as a number.** Finance showed "Kept: £0.00" when nothing was costed.
Rule: unknown is displayed as unknown, never as zero, and never as a flattering figure.

**Sequencing.** A whole Saturday went on tooling while the first product still was not listed.
Rule: when the product is one step from shipping, ship it first.

**Guessing a value twice.** eBay refused the parcel's package type, and I tried "mailing box" and then "parcel or padded envelope" before asking eBay which types it accepts. Joseph had to ask whether I was guessing.
Rule: after one refused value, stop and ask the system for its list. The function now returns eBay's accepted package types in the error.

**Noticing and not building.** I spotted the 200-listing traffic cap on the day and left it.
Rule: if I name a gap that makes a figure incomplete, fix it or put it at the top of the handoff.

---

## Things he said that should guide the next chat

- "Look at it with senior level eyes and not lowball the whole thing, no guess work or assumptions."
- "Moderation in all things makes everything better and avoids AI aesthetics."
- "The page should give answers to questions one doesn't even know they are supposed to ask."
- "Visually give answers." Charts, bars and drawn funnels over paragraphs.
- "Every time she opens the portal it looks like nothing happened." The overview has to show that something did.
