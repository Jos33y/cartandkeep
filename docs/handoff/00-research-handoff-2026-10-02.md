# Research handoff: store categories, 2 October 2026

For the next research chat. This chat is the **research and scripts chat**. The portal and its design are another chat.

**Read in this order:**
1. this handoff;
2. `scripts-reference-2026-10-02.md`, every script, collector and flag, with the commands and the folders they write to;
3. `keepr-agent-01.md` (v3.2), how store cards are reviewed;
4. `store-rules-2026-09-30.md`, the rules and what each category run changed;
5. `keepr-agent-03.md` and `keepr-agent-04.md`, how her portal shows Candidates, Approved and Listings, so card fields and chips can be explained;
6. `candidates-section-brief-2026-09-29.md` and `store-cards-one-key-2026-09-29.md`, the price model and the one key;
7. `05-session-feedback-2026-10-01.md` and `02-how-we-work-and-where-we-are-2026-10-01.md`, how Joseph works across both chats.

---

## 1. What we are doing

We fill Mrs Sowande's portal with products she can source, one Google Merchant Center category at a time.

- **The products:** Google's UK best sellers. A product goes in only when a UK shop is seen selling it and its product page is checked as the same product. That shop is the **store card**.
- **What a store card proves:** the product can be sourced in the UK. The shop is evidence, not her supplier.
- **Price:** "Found it cheaper" (her suppliers) is what brings a card's price into the market. Sitting above Google's lowest price is never a reason to reject.
- **Deadline:** Christmas products need to be in her queue by mid November.

---

## 2. How we work (Joseph's rules, all in force)

**Tone and stance:**
- Nigerian/British English, casual professional. No em dashes, no emojis, no AI-tell words, no filler.
- Direct and action-first. Act as a senior research engineer: state the cost, the risk and the evidence. Push back once, with evidence, when he is wrong.
- Short replies for quick results, fuller ones when the decision is real. No recaps.

**Boundaries:**
- **Never touch the frontend** (`src/pages`, components, CSS). Joseph's words: "don't edit or do anything with frontend ooo.. I am working on the designs in another file". Portal changes go out as a handoff doc for the design chat.
- **"Just review, don't code yet"** means analysis only. Build only on "yes", "go" or "do this".
- **Scripts never change her work:** her decisions, notes, sources, or the figures on cards she has decided.

**The loop:**
- Joseph runs everything on Windows, PowerShell, in `C:\Users\josep\WebstormProjects\cartandkeep`.
- He pastes the output or attaches the file with "see the results". Read it, say what it means, give the next command.
- **This chat cannot see his repo.** When a script is needed, ask him to attach it. Work on a copy, test it on made-up data or the files he sends, then deliver.

**Deliveries:**
- **Format:** a zip of only the changed files, paths from the repo root (`scripts/store/...`), named `ck-<what>-<date>.zip`. He unzips at the repo root.
- **Commands:** always give the exact commands to run next, in order, dry or list-only first.
- **Review CSVs** go to him as files. He saves them in `research/review/`.

**After each category:** update the Project docs (`store-rules-2026-09-30.md` gets a section, and Keepr Agent-01 gets the review lessons).

### How Joseph works with this chat

- He runs a command and pastes the whole terminal output, or attaches the CSV, with "see the results". Read all of it, including files cut off past the first page, before answering.
- A screenshot without a question is context: say what it shows and what it means for her. Don't start an audit.
- Short confirmations ("done", "applied") close the item. Move on to the next command.
- He asks "what does this mean" about portal screens. Answer from the code and the data (find where the text is made), not from a guess.
- He wants the next step every time. End each reply with the exact command, or the one question that decides it.

### Decisions in force (do not reopen)

- **Her supplier wins.** Cost order: her supplier, then the shelf price. The shelf price is proof of stock, and an estimate until the pack is confirmed.
- **Never reject for price alone.** Over market means "find it cheaper". The lanes are "To list on the shop" and "Over Google's price".
- **Never touch her decided cards.** Notes may be added; decisions and figures never change.
- **Only a barcode repoints a card.** A name match is a lead for her to check. Nothing found is a note, never a reject.
- **Reuse the gate's pack match, don't assert it** (Joseph's words). Pack levels come from `matchOf` in `scripts/lib/row.js`.
- **Courier only** is the wording for anything Royal Mail won't take: loose lithium batteries, rigid lengths over 61cm, bulky toys. Joseph accepted it: "courier only is understandable".
- **One key per product:** `queryOf` in `match.mjs`, used as the store card's `external_ref` and the eBay query. Never redraft query lines by hand.
- **Big brands:** held back by default, but read and imported for a category where they are the category (Toys).
- **Judgment calls with counts:** selective-distribution rejects and similar are stated as judgment calls, with the count, before they go live.

### Lessons from this session (where Joseph had to push)

| Joseph said | What was wrong | The lesson |
|---|---|---|
| "you did not save the picks in hardware folder? you have forgotten or what?" | Every category's picks went to one `research/picks/all.csv` and overwrote each other | Every output is per category. Check paths before delivering. |
| "hahan we have sitemap collector na" | I said there was no sitemap collector | Ask for, or search, the existing scripts before saying a tool is missing. |
| "reuse the gate's pack match, don't assert it" | Importers wrote "same pack" without comparing | Never assert a fact the code can check. Call the existing check. |
| "stucked on this screen for long?" | A long collection ran silently | Long runs print progress, save on Ctrl+C, and say how long they take. |
| (Toys) | I called 2,215 "check it" matches mostly junk; the real junk was about 160 | Measure before characterising. Say so plainly when an estimate was wrong. |
| (Toys) | The page check skipped 89% of toy picks as big brands | Check what a default does to a new category before running it. A rule from one category can empty another. |

---

## 3. The pipeline, per category

Exports go in `research/google/<category>/`, one CSV per month: `best-sellers-*.csv` from Merchant Center, 6 months is good. The `<category>` name is the folder name, for example `toys-games` or `baby-toddler`.

```
# 1. Read-only checks, then fix the rules and keys
node scripts/store/rules-check.mjs --google=research/google/<category>
node scripts/store/key-check.mjs --google=research/google/<category>

# 2. Picks: which best sellers a shop on file sells
node scripts/store/store-picks.mjs --google=research/google/<category>
#    writes research/picks/<category>/all.csv, coverage.csv, gap-brands.csv

# 3. Collect more shelves if the gap shows missing shops (see section 5), rerun picks

# 4. Page check (slow; saves every 25; reuses pages already read)
node scripts/store/check-picks.mjs --category=<category> --top=all
#    add --with-big-brands when big brands are the category (Toys was 89%)

# 5. Import, dry first
node scripts/store/import-store.mjs --category=<category> --label="<Label>" --dry
node scripts/store/import-store.mjs --category=<category> --label="<Label>"
#    add --big-brands if step 4 used --with-big-brands

# 6. Export and coverage
node scripts/store/export-store.mjs --label="<Label>"
node scripts/store/store-coverage.mjs --category=<category> --label="<Label>"   # add --apply if it only lists

# 7. Keepr review: Joseph sends the export CSV; we return store-<cat>-review-<date>.csv
node scripts/store/apply-review.mjs --review=research/review/<review>.csv
node scripts/store/apply-review.mjs --review=research/review/<review>.csv --apply
node scripts/store/resource.mjs --review=research/review/<review>.csv --google=research/google/<category>
#    read the results file: turn bad "found, check it" leads into "not found" (PowerShell, as done for Toys), then
node scripts/store/resource.mjs --apply --from=research/review/resource-<category>-<date>.csv
```

**Reviewing (Keepr Agent-01 method):**
- Filter the export to the category (`category_path` starts with its name).
- List the shared shop pages first; that's the duplicate test.
- Read every name and model match. Barcode matches only need the odd-name or odd-price ones.
- Look for bulky and battery items.
- Write the review with a small Python script: rules for the patterns, plus hand calls by card id.
- Check that the counts add up before sending.

---

## 4. Where each category stands

| Category | Cards in her queue | State |
|---|---|---|
| Home & Garden | from late September | done, reviewed, re-sourced |
| Health & Beauty | 483 | done, reviewed, re-sourced |
| Hardware | 745 | done 1 October: 38 rejects, 64 notes, 58 re-sourced (2 repointed, 12 not found, 44 leads) |
| Toys & Games | 1,024 (1,005 new, 19 eBay cards gained Shop) | done 2 October: 967 keep, 27 re-source (1 repointed, 3 leads, 23 not found), 24 notes, 8 rejects |
| **Baby & Toddler** | not started | **next** |
| Arts & Entertainment, Sporting Goods, Electronics, Office Supplies, Vehicles & Parts, Animals & Pet Supplies | not started | later; watch lists are in Keepr Agent-01 |

**Toys facts worth carrying:**
- 994 of 1,024 Toys cards sit above Google's lowest price. Toy shelves are full retail, so Toys is supplier work for her.
- A card that ranks only in December needs listing by mid November.

---

## 5. Shelves on file (`research/shelf/`, 55 files, about 1.13 million products)

**Collectors:**
- `scripts/shelf-shopify.mjs --base=<url>`: Shopify `products.json`, with real prices, weights and vendor. `--sample` first. It stops only on an empty page, falls back to collection by collection past 25,000, and Ctrl+C saves.
- `scripts/shelf-from-sitemap.mjs --tag=<t> --base=<url> [--maps=<text>] [--match=<regex>] [--verbose]`: names from sitemap URLs, no prices. The page check reads the price later.
  - An empty read caches nothing.
  - `--verbose` shows each sitemap, and prints the start of any page with no `<loc>` (how blocks are spotted).
  - A cached list is reused: delete `research/shelf/<tag>-urls.txt` to read again, or rerun with a new `--match` to filter the cache with no fetching.

**Added for Toys:**
- The Entertainer (`thetoyshop`, sitemap, 5,021);
- The Kid Collective (2,433) and Wigwam Toys (969), both Shopify;
- Zatu (96,841): board-game.co.uk is Zatu now. Filter `--match="^https://zatu\.com/products/"`;
- Element Games (91,491): use `--maps=products`, or category pages come in.

**Blocked or skipped** (don't retry): Smyths (Imperva "Pardon Our Interruption", even for sitemaps), IronmongeryDirect and The Paint Shed (403), Magic Madhouse (`products.json` 404).

**Earlier shops** include John Lewis, B&M, Studio, Hannworld, Home Bargains (`hb`, `hb-seasonal`), Harts of Stur, Long Acres, The Works, Toolstation, City Plumbing, Lakeland, Medisave, the care shops, and the Hardware gap shops: Decorating Centre Online, Electricals Online, The Switch Depot, Trade Door Handles, Bathroom Tiles, Wood Finishes Direct.

**Page reader (`scripts/store/page.mjs`):**
- It reads structured data, then meta tags, then shop-specific spots: Harts of Stur, Studio's analytics "detail" block, and The Entertainer's `data-pricePDP` and `data-productavailable`.
- When a shop's confirmed pages come back with no price, have Joseph run `node scripts/store/save-page.mjs "<url>" <file>.html` and attach the file. curl is refused by some shops.

---

## 6. What changed this session (all delivered and in his repo)

- **Rules:**
  - `rules/categories/toys-games.mjs`: `OWN_TITLE`, `BRANDED` and the new `LINES` (maker to ranges, about 27 makers). `rules/index.mjs` exports `linesOf(category)`.
  - Toy own labels, plus not-shelf and restricted fixes.
  - `rules/categories/hardware.mjs`.
- **`store-picks.mjs`:**
  - searches a best seller under its maker's ranges named in its title;
  - a no-brand title is searched under any best-seller brand it names (everyday words skipped);
  - first-word fallback only when the shelf row names the whole brand, or its brand column is that word;
  - writes per category in `research/picks/<category>/`.
- **Pack match:**
  - The importers use the gate's own `matchOf`, and no longer assert "same pack".
  - `recheck-pack.mjs` re-judged 136 older cards on 1 October.
- **`page.mjs`:** Entertainer and Studio prices, Entertainer stock, and the " | Shop" ending dropped from `<title>` names. `save-page.mjs` is new.
- **Other scripts:** `shelf-from-sitemap.mjs` (diagnostics, no empty cache); `resource.mjs` (lead guard, barcode-with-no-price becomes a lead).

---

## 7. Open items, in order

1. **Postage band on heavy eBay cards. Check first.**
   - The case: on 2 October the Sika jointing compound eBay card (15kg tub on the shelf, 14kg on eBay) showed "Postage, Evri to 5kg, £2.62" and "You keep £5.08". A 15kg parcel costs £8 to £12 or more, so the card really loses money.
   - Likely cause: the eBay pricing has no weight for the card and falls back to the small band.
   - What to do: find where the eBay card's postage band is chosen (`src/lib/pricing.js` or the import-gate costing; ask Joseph to attach them). Then see whether it can read the weight from the title or pack ("15kg") the way store-picks' `titleGrams` does, and count how many eBay cards are affected.
   - This is scripts-side. If the fix is in `src/lib`, agree it with Joseph first, because the design chat also edits there.
2. **Pack chip units (design chat handoff, not written yet).** The flag "Shelf 15000, eBay 14000" is grams. It should read "Shelf 15kg, eBay 14kg", and counts should stay plain ("Shelf 19, eBay 113"). Each pack carries `kind` (count or weight) and `n`. Write a short handoff doc if Joseph wants it.
3. **import-gate.js:**
   - chunk the `.in()` requests to 100 ids at a time (point 3 of the importer review);
   - decide a duplicate guard after a key change, for example a query-to-title map (point 2).
4. **eBay link on store cards:** handoff written (`ebay-link-handoff-2026-10-01.md`), for the design chat.
5. **Optional hand rejects from Hardware:** the Clark Drain recessed manhole cover and the Microclimate vivarium thermostat.

---

## 8. Next command (start of the new chat)

Baby & Toddler. Joseph saves the Merchant Center exports to `research/google/baby-toddler/`, then runs:

```
node scripts/store/rules-check.mjs --google=research/google/baby-toddler
node scripts/store/key-check.mjs --google=research/google/baby-toddler
```

**Before store-picks:**
- add `rules/categories/baby-toddler.mjs` and `needs/baby-toddler.mjs`, and register both;
- confirm the category name the exports carry (for example "Baby & Toddler"), because `rules/index.mjs` keys categories by it.

**Expect to stop or note:**
- infant formula (already stopped);
- teething gels with lidocaine or benzocaine (medicines);
- sleep positioners, nests and weighted sleep products (safety claims);
- car seats (out);
- cot mattresses, prams and pushchairs (bulky, courier);
- Mamas & Papas own label (already in the list).

The toy shops already on file (John Lewis, Kid Collective, Wigwam, The Entertainer) will cover part of the shelf.
