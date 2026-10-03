# Research scripts reference

2 October 2026, categories brought up to date 3 October. Every research script Joseph runs, what it does, its flags, and where it writes. Commands run from the repo root (`C:\Users\josep\WebstormProjects\cartandkeep`) in PowerShell. The order for a category is in `00-research-handoff-2026-10-02.md`, section 3.

---

## Folders

| Folder | Holds |
|---|---|
| `research/google/<category>/` | Merchant Center exports, `best-sellers-*.csv`, one per month |
| `research/google/taxonomy-with-ids.en-GB.txt` | Google's product taxonomy, version 2021-09-21, 5,595 rows |
| `research/shelf/` | shop shelves: `shelf-<tag>.csv` (Shopify, with prices) and `shelf-<tag>-names.csv` (sitemap, names only); `<tag>-urls.txt` is a sitemap's cached URL list |
| `research/picks/<category>/` | `all.csv` (picks), `checked.csv` (page check), `coverage.csv`, `gap-brands.csv` |
| `research/queries/` | `queries-store-<category>.txt`, the eBay queries for the store cards, one key each |
| `research/review/` | exports (`store-<category>-<date>.csv`), reviews (`store-<category>-review-<date>.csv`), re-source results (`resource-<category>-<date>.csv`), `recheck-pack-<date>.csv` |
| `research/categories/` | AI category cache, previews, the second opinion and its cache, duplicates |

`<category>` is the folder name (`toys-games`, `baby-toddler`). `--label` is the category's name as her portal shows it ("Toys & Games").

---

## 1. Shelf collectors (what UK shops sell)

### `scripts/shelf-shopify.mjs`: a Shopify shop, with prices

```
node scripts/shelf-shopify.mjs --base=https://wigwamtoys.co.uk --sample     # one page, prints the raw product and the row; writes nothing
node scripts/shelf-shopify.mjs --base=https://wigwamtoys.co.uk              # the whole shop
```

- Reads `/products.json` 250 at a time.
- **Writes** `research/shelf/shelf-<tag>.csv`: name, brand (vendor), price, was, available, sku, grams, category, tags, image, url. There are no barcodes; see `shelf-barcodes.mjs`.
- **Behaviour:**
  - it stops only on an empty page;
  - past 25,000 products it falls back to collection by collection;
  - Ctrl+C saves what it has;
  - a rerun resumes.
- **Flags:**
  - `--tag=` names the shelf (defaults from the domain);
  - `--pause=` sets the milliseconds between requests;
  - `--price-scale=` is for a shop that stores prices in pence.
- **`--sample` tells you:** whether "page 2 is different" (paging works) or "SAME AS PAGE 1" (paging ignored). If paging is ignored, use the sitemap collector instead (board-game.co.uk).

### `scripts/shelf-from-sitemap.mjs`: names from a shop's sitemap, no prices

```
node scripts/shelf-from-sitemap.mjs --tag=thetoyshop --base=https://www.thetoyshop.com --match="/p/[0-9]+$"
node scripts/shelf-from-sitemap.mjs --tag=elementgames --base=https://elementgames.co.uk --maps=products
node scripts/shelf-from-sitemap.mjs --tag=zatu --match="^https://zatu\.com/products/"      # cached list, filtered, no fetching
```

- It reads `robots.txt` and `/sitemap.xml`, follows the indexes, and unpacks gzip. It never fetches a product page; the page check reads the price later.
- **Writes:** `research/shelf/<tag>-urls.txt` (the cached list) and `research/shelf/shelf-<tag>-names.csv`.
- **Flags:**
  - `--base=` the shop's home page;
  - `--match=` a regex the product URLs must match;
  - `--maps=` follow only child sitemaps whose address contains this text (`products`);
  - `--sitemap=` start from one sitemap and skip robots;
  - `--verbose` print each index and how many URLs each sitemap gave.
- **Behaviour:**
  - A sitemap that answers 200 with no `<loc>` prints the start of the page. "Pardon Our Interruption", "Just a moment" or "Access Denied" means a bot block: skip the shop.
  - An empty read caches nothing.
  - **To read again,** delete `research/shelf/<tag>-urls.txt` and `shelf-<tag>-names.csv` first. To refilter a cached list, just rerun with a new `--match`.

### `scripts/shelf-barcodes.mjs`: barcodes for a Shopify shelf

```
node scripts/shelf-barcodes.mjs --tag=<tag> --google=research/google/<category> --dry
node scripts/shelf-barcodes.mjs --tag=<tag> --google=research/google/<category>
```

It reads each product's `/products/<handle>.js`, but only for shelf products that could be one of the category's best sellers. Use it when a Shopify shop's matches are all by name.

### Shops

**On file:** about 1.13 million products in 55 files. See the handoff, section 5.

**Blocked, don't retry:**
- Smyths (Imperva, even sitemaps);
- IronmongeryDirect and The Paint Shed (403);
- Magic Madhouse (`products.json` 404).

---

## 2. Before picks: tune the rules and keys (read only)

### `scripts/store/rules-check.mjs`

```
node scripts/store/rules-check.mjs --google=research/google/<category>
node scripts/store/rules-check.mjs --google=research/google/<category> --show=20 --out=research/rules-check-<category>.csv
```

What each rule stops, with the best-ranked examples; what passes with a postage note; and the need words found. Fix the false stops and gaps in `scripts/store/rules/` before store-picks.

### `scripts/store/key-check.mjs`

```
node scripts/store/key-check.mjs --google=research/google/<category>
```

Keys (`queryOf`) that lump different models together, worst first. Fix them in `scripts/store/match.mjs`. `--show=` and `--out=` work as above.

### Rules files (`scripts/store/rules/`)

| File | Stops |
|---|---|
| `own-label.mjs` | brands only their own shop sells |
| `not-shelf.mjs` | `[word, only, unless]` entries: furniture, appliances, made to measure, plants, experiences, personalised, second hand |
| `restricted.mjs` | medicines, formula, alcohol, tobacco, weapons and so on |
| `post.mjs` | `CANT_POST`, plus `POST_CHECK` notes (aerosols, perfume, knives, lithium, paint) |
| `categories/<category>.mjs` | extras for one category: `NOT_SHELF`, `RESTRICTED`, `CANT_POST`, `OWN_LABEL`, `BRANDED`, `OWN_TITLE`, `LINES` |
| `index.mjs` | `stopOf`, `postCheckOf`, `linesOf`; **register a new category file here** (keyed by the category name) |

Need words: `scripts/store/needs/<category>.mjs`, registered in `needs/index.mjs`.

---

## 3. Picks and the page check

### `scripts/store/store-picks.mjs`

```
node scripts/store/store-picks.mjs --google=research/google/<category>
node scripts/store/store-picks.mjs --google=research/google/<category> --skip-shops=lakeland,towsure
```

- **Matching:** best sellers in the price window (`--min=8 --max=60` by default) are matched against every shelf by barcode, model or name. Toys also matched under the maker's ranges (`LINES`).
- **Writes** `research/picks/<category>/all.csv`, `coverage.csv` and `gap-brands.csv`, plus `research/queries/queries-store-<category>.txt`.
- **Other flags:**
  - `--shelves=` another shelf folder;
  - `--big-brand=30` sets how many best sellers make a big brand.
- **Read these lines:**
  - "seen in a UK shop" (barcode, model, name, name to check);
  - "not seen in any shop on file", with the most-missed brands. That's the list of shops to collect next.

### `scripts/store/check-picks.mjs`

```
node scripts/store/check-picks.mjs --category=<category> --top=all
node scripts/store/check-picks.mjs --category=<category> --top=all --with-big-brands
```

- Opens each pick's shop page and checks it is the same product: barcode first, then model, then name.
- **Writes** `research/picks/<category>/checked.csv`, with a verdict and the page's name, price, VAT, stock, image and barcode.
- **Behaviour:**
  - It saves every 25.
  - A page already read with a price is reused, so a rerun only fetches what's new.
  - It stops on a block (403, 429 or 503).
- **Flags:**
  - `--top=100` or `--top=all`;
  - `--with-big-brands` reads big-brand pages (needed for Toys);
  - `--recheck` re-judges the pages already read, with no fetching;
  - `--refetch` reads every page again;
  - `--read-all` also opens loose matches that share almost no words.

### `scripts/store/save-page.mjs`

```
node scripts/store/save-page.mjs "<url>" page.html
```

Saves one page exactly as check-picks reads it, and prints what the reader found (name, price, stock, barcode). Use it when a shop's confirmed pages come back with no price; attach the html so the reader in `page.mjs` can be fixed. Don't use curl: some shops refuse it.

### `scripts/store/vat-check.mjs`

```
node scripts/store/vat-check.mjs --tags=completecareshop,medisave
```

Shows whether a shop prices with VAT, without it, or with VAT relief. Shops that don't include VAT go in `page.mjs` (`EX_VAT_HOSTS`, `VAT_RELIEF_HOSTS`).

---

## 4. Import, export, coverage

### `scripts/store/import-store.mjs`

```
node scripts/store/import-store.mjs --category=<category> --label="<Label>" --dry
node scripts/store/import-store.mjs --category=<category> --label="<Label>"
node scripts/store/import-store.mjs --category=<category> --label="<Label>" --big-brands
```

- **What comes in:** confirmed matches only. Each card is priced through `src/lib/pricing.js` (cost, postage by weight, floor, list price).
- **What it rechecks:**
  - it re-applies the rules to Google's title and to the page name;
  - it drops bigger packs (cost over twice Google's highest) and anything over 20kg.
- **eBay cards:** an existing eBay card with the same key gains the Shop label.
- **Coverage:** it writes coverage for the batch.
- **Flags:**
  - `--dry` lists only;
  - `--big-brands` keeps big brands;
  - `--with-unsure` and `--without-price` are not normally used;
  - `--coverage=` points at another coverage file.
- **The tally to read:** stopped by rules, wrong, unsure, no price, bigger pack, over 20kg, kept; then new cards and eBay cards gaining the Shop label.

### `scripts/store/export-store.mjs`

```
node scripts/store/export-store.mjs --label="<Label>"
```

Read only. Writes `research/review/store-<category>-<date>.csv`, which holds every store card she has (all batches). Filter it by `category_path` for the review.

### `scripts/store/store-coverage.mjs`

```
node scripts/store/store-coverage.mjs --category=<category> --label="<Label>"
node scripts/store/store-coverage.mjs --category=<category> --label="<Label>" --apply
```

The Google funnel for the batch: one row per best seller, with where it stopped. Every sent card should be accounted for. `--checked=` and `--coverage=` point at other files.

---

## 5. Review and re-source

### `scripts/store/apply-review.mjs`

```
node scripts/store/apply-review.mjs --review=research/review/<review>.csv            # list only
node scripts/store/apply-review.mjs --review=research/review/<review>.csv --apply
```

- **What it writes:** reject (a decision with its reason), defer (Later), and note (a note, never added twice).
- **What it leaves:** keep and resource.
- **Her decided cards** are never changed. `--override` exists but is not used.

### `scripts/store/resource.mjs`

```
node scripts/store/resource.mjs --review=research/review/<review>.csv --google=research/google/<category>
node scripts/store/resource.mjs --apply --from=research/review/resource-<category>-<date>.csv
```

- **The search:** for cards marked resource, it looks for another shop, opening pages to confirm.
- **Writes** `research/review/resource-<category>-<date>.csv`.
- **What `--apply` does with each status:**
  - `found` (a barcode match): repoints the card;
  - `found, check it`: adds a lead note;
  - `not found`: adds a note, never a reject.
- `--no-fetch` judges from the shelf files only.

**Before `--apply`, read the results and turn bad leads into "not found":**

```
$f = 'research/review/resource-<category>-<date>.csv'
$bad = 'Title start one*','Title start two*'
$rows = Import-Csv $f
foreach ($r in $rows) { foreach ($b in $bad) { if ($r.title -like $b) { $r.status = 'not found'; $r.shop = ''; $r.url = ''; $r.price = '' } } }
$rows | Export-Csv $f -NoTypeInformation -Encoding utf8
```

### `scripts/store/fix-vat-costs.mjs`

```
node scripts/store/fix-vat-costs.mjs
node scripts/store/fix-vat-costs.mjs --apply
```

Re-costs store cards from shops that don't include VAT, adding 20%. It marks each card, so a card is never done twice.

---

## 6. eBay side and one-offs

### `scripts/import-gate.js`

```
node scripts/import-gate.js --csv=<gate csv> --label="<Label>" --dry
```

- **What it does:** takes an eBay gate run into her Candidates.
- **Store cards:** a gate pass on a store card adds eBay to it, and the pack is judged by `matchOf`.
- **Flags:** `--dry`, `--date`, `--term`, `--products`, `--shelf`, `--no-shops`, `--min-goods`, `--include-fail`, `--refresh`, `--refresh-decided`, `--replace`, `--allow-duplicates`, `--coverage-only`.
- **Still to do:** chunk the `.in()` requests to 100 ids, and add a duplicate guard after a key change.

### `scripts/store/recheck-pack.mjs`

```
node scripts/store/recheck-pack.mjs                     # list only
node scripts/store/recheck-pack.mjs --apply --decided   # writes; her decided cards get the evidence, never a new decision
```

Re-judges the old asserted "same pack" markings. It ran on 1 October and wrote 136 cards. Writes `research/review/recheck-pack-<date>.csv`.

### Small read-only helpers

```
node scripts/store/brand-rank.mjs --picks=research/picks/<category>/checked.csv   # brands by best sellers covered: where a trade account pays back
node scripts/store/approved-barcodes.mjs                                         # approved cards and barcodes, for eBay catalogue tests
node scripts/store/icecat-check.mjs --top=200                                    # how many picks have brand photos in Open Icecat
```

---

## 7. Categories (`scripts/categories/`)

Google's taxonomy decides the shop's sections, its filter tabs and the Merchant category. Every product carries `google_category_id` and a source: `ebay` (from the eBay category), `ai` (from the title), `checked` (corrected by the studio), `manual` (hers), `default` (a top level only, not used for placing). `checked` and `manual` are never overwritten by a script.

### Once, and after Google changes the file

```
node scripts/categories/load-taxonomy.mjs --dry       # loads Google's taxonomy into google_categories; safe to rerun
node scripts/categories/load-taxonomy.mjs
```

### Research cards

```
node scripts/categories/fill-categories.mjs --dry     # then without --dry; writes only the category columns
node scripts/categories/preview.mjs                   # what the eBay to Google mapping does, read only
```

The importers categorise their own cards: eBay category mapping first, then AI on the title, cached in `research/categories/ai-cache.json`.

### Her shop's products, in this order

**1. `load-ebay-map.mjs`: the eBay to Google table into the database**

```
node scripts/categories/load-ebay-map.mjs --dry
node scripts/categories/load-ebay-map.mjs
```

- Puts `EBAY_TO_GOOGLE` (`ebay-to-google.mjs`, first prefix match wins) into `google_from_ebay`, then runs `fill_product_google` (0129) so every product the table can place better is placed. Her choices are never touched.
- A Google path not in the taxonomy stops the run before anything is written.
- **Run after any change to `ebay-to-google.mjs`.** The SQL copy of the rules (`google_for_listing`) and the script must agree; `test/google_parity_test.ts` checks it.
- `--taxonomy=` points at another taxonomy file.

**2. `fill-product-categories.mjs`: products eBay could only place at the top, or not at all**

```
node scripts/categories/fill-product-categories.mjs --dry    # counts, examples, research/categories/products-preview.csv
node scripts/categories/fill-product-categories.mjs          # writes google_category_id, source "ai"
```

- Classifies by title the same way the research cards are classified, then applies the title rules (`refineFor`).
- The dry run makes the calls too, so its counts are real. A product it cannot place keeps what it has.
- `--tenant=` another shop (default `cart-and-keep`).

**3. `second-opinion.mjs`: every category checked again before a sort**

```
node scripts/categories/second-opinion.mjs                                                   # reads, writes CSVs, changes nothing
node scripts/categories/second-opinion.mjs --apply=research/categories/second-opinion.csv    # writes the rows still marked yes
```

- Reads every title against the full taxonomy to the third level, 80 a call, cached in `research/categories/second-opinion-cache.json` (a rerun only asks about what changed).
- **Flags only a change that would move a product to another section:** a different top level, a different second level, or a different third level inside Health & Beauty > Healthcare (which the shop splits a level deeper).
- **Writes** `research/categories/second-opinion.csv` (id, title, now, suggested, suggested_id, apply) and `research/categories/duplicates.csv` (the same title on the shop more than once).
- **`--apply`** writes the yes rows as source `checked`, skipping anything set by hand since the list was made.
- **Review before applying.** On 3 October it suggested bird supplies for an umbrella and pet vitamins for human supplements. Set those rows to no:

```
$f = 'research/categories/second-opinion.csv'
$no = 'Title start one*','Title start two*'
$rows = Import-Csv $f
foreach ($r in $rows) { foreach ($n in $no) { if ($r.title -like $n) { $r.apply = 'no' } } }
$rows | Export-Csv $f -NoTypeInformation -Encoding utf8
```

**4. Then sort the shop from the portal:** Sections, "Sort with Keeper". The sections come from Google's tree in code (`shop-sort`); Keeper only names them.

### Files

| File | Holds |
|---|---|
| `ebay-to-google.mjs` | `EBAY_TO_GOOGLE` (121 rows) and `refineFor` (title rules: heating part numbers, appliance consumables and parts) |
| `taxonomy.mjs` | `loadTaxonomy`: path to id and back |
| `classify.mjs` | the title classifier shared with the research cards |

---

## 8. Shared modules (not run directly)

| File | What it holds |
|---|---|
| `scripts/store/match.mjs` | `queryOf` (the one key), `sameProduct`, `modelsIn`, `barcodeVerdict`, `seasonOf`, `needOf` |
| `scripts/store/shelf.mjs` | `loadShelves` (keeps only rows that could match), `titleGrams` (weight from the title) |
| `scripts/store/page.mjs` | `readPage`, `fetchPage`, `paidPrice`, VAT host lists, shop-specific price spots |
| `scripts/store/price-store.mjs` | store figures for one product, shared by import and resource |
| `scripts/store/coverage.mjs` | the coverage funnel |
| `scripts/lib/row.js` | `packOf` and `matchOf`: pack levels; weights read as grams or ml, so 15kg shows as 15000 |
| `src/lib/pricing.js` | the one price model, for portal and scripts. Shared with the design chat: agree any change with Joseph first. |
| `scripts/lib/extless.mjs` | optional resolve hook for imports with no extension (no longer needed after the `src/lib` fix) |
