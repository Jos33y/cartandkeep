# Handoff: research pipeline chat, 2 October 2026

Cart & Keep · The Brick Dev Studios · internal

This chat ran the product research pipeline (shelves, scan, gate, import, review) from 24 September to 2 October. A second chat (the "store chat") owns the portal, the store side (store-picks, page check, import-store, rules, pricing.js, categories, Keepr). Read this first, then the files listed at the end.

---

## 1. How we work

Joseph's standing brief for this chat:

- **Senior research engineer stance.** Say what is measured and what is assumed. Push back when he is wrong. Name costs and risks. Small experiments before big spends.
- **Tone:** short and action-first for runs and quick fixes; fuller reasoning for design questions. No preamble, no recaps.
- **Commands:** PowerShell, one line each (Windows `cmd` breaks backslash continuations). Paths with backslashes in PowerShell, forward slashes in node arguments.
- **Writes to her data:** always list first, then the same command with `--apply`. Pick cards by `--id`, never by title alone (the portal shows the shop's product name; the card title comes from the query; two cards can share a name).
- **Her decisions stand.** Scripts never change a decided card. `decide.js --override` only with her go-ahead, and the decisions history keeps her original.
- **House style for every file:** plain British English, no em dashes, no emojis, no filler. Check with `grep -n '—\|–'` before handing over.
- **Never score.** Refuse, keep and order. No composite numbers.
- **Files:** give complete files to overwrite, tested where possible, with the exact command. Say plainly what was not tested (anything needing eBay or the database).
- **Before using an uploaded file**, check it is the version being edited (diff against the last delivered copy).

### What he uploads

- Run output pasted as text; gate snapshots (`.gate/<timestamp>.json`) as uploads, which are read with Python to rank passes by the small seller's monthly rate.
- `checked.csv` from the store chat's page check, per Google category.

---

## 2. The daily routine and budget

- **eBay Browse budget:** 5,000 calls a day, resets 08:00 UK. `node scripts/limits.js` shows what is left.
- **Scan:** 1 call per phrase. **Gate** at `--sample=6`: about 7 calls per phrase.
- **Order each day:** gate what was scanned the night before; then scan and gate the day's source; scan ahead with what is left; keep about 50 calls in hand.
- `node scripts/ledger.mjs` gives each query file's state and the exact `--start=` to resume.
- If the gate hits the daily limit it stops cleanly, writes the rest to `<file>-rest.txt`, and says to gate that file after the reset with a different `--csv`.

### The commands

```powershell
node scripts/scan.js --file=<queries.txt> [--start=N] [--max=N] --csv=research/scans/<name>.csv --out=research/queries/gated-<name>.txt --band=evri5 --max-listings=600 --min-results=5
node scripts/gate.js --file=research/queries/gated-<name>.txt [--max=N] --band=evri5 --sample=6 --csv=research/gates/gate-<name>.csv --out=research/queries/passes-<name>.txt
node scripts/import-gate.js --csv=research/gates/gate-<name>.csv --date=<YYYY-MM-DD> --term=<term> --label="<Google category>"
node scripts/store/import-store.mjs --category=<folder> --label="<Google category>"
node scripts/decide.js --id=<card id> --action=approve|reject|defer [--reason=<code>] --note="..." [--override] [--apply]
node scripts/export-ebay.mjs [--status=open|approved|all] [--label="..."]
node scripts/backfill-categories.mjs [--max=N]
node scripts/count-shelves.cjs
```

### Labels and terms (since the switch to category tabs)

- The **tab comes from each card's Google category** (set from its eBay category after import). `--label` names the batch and source only.
- Use the **Google category as the label** on both sides, matching the store import: `--label="Home & Garden"`, `"Health & Beauty"`, `"Hardware"`, `"Toys & Games"`.
- Terms used: `google` (Home & Garden), `google-hb`, `google-hw`. Use `google-toys` for Toys & Games. Shop shelves keep their terms (`general`, `trade`).
- One term per date: a date already holding another term is refused unless `--replace`.

---

## 3. What works: measured yields

Cards per 1,000 eBay calls (scan plus gate):

| Source | Yield |
|---|---|
| Google best sellers, confirmed at a UK shop, need products first | about 35 (Home & Garden slice A 36; Health & Beauty 35) |
| Google confirmed, big brands cut | about 33 (Home & Garden slice C) |
| Lakeland refills, Hannworld | 30 to 33 |
| B&M and general shops, Essential Aids | about 24 to 28 |
| Google Hardware | about 23 (parts: many small markets) |
| Care shops (Ability, Millercare, Manage at Home) | about 14: care sells, but each eBay market is small |
| Toolstation, CPC, Maplin | 5 to 14 |

**Conclusion:** Google best sellers confirmed at a UK shop are the best source by a clear margin. They lead the rotation.

**Three patterns:** forced search wins (refills, filters, valves, alarms by model); care is her category (best through Google picks and the store, weak through care-shop shelves on eBay); famous means crowded (cut big brands before gating).

---

## 4. State on 2 October

### Google categories

| Category | Picks | Confirmed queries | State | With eBay evidence |
|---|---|---|---|---|
| Home & Garden | 4,488 (rerun, big brands out) | 882 | done: slices A to D gated and imported | about 139 |
| Health & Beauty | 7,395 | 539 | done | 92 |
| Hardware | 5,195 | 778 | done (`gate-hw-confirmed-a` and `-b`) | 87 + 2 from `-b` |
| Toys & Games | 3,425 | 1,035 | **list to build, scan and gate: next** | |
| Animals & Pet Supplies | | | export next, in the store chat | |

### Her portal (1 October)

2,404 cards, 346 decided, 92 approved (about £716 a month), 254 rejected. Tabs are Google categories (Hardware 754, Home & Garden 597, Health & Beauty 572, Toys & Games 51, Electronics 19, Pets and others).

### Reviews done in this chat

- **Approved list re-checked with her go-ahead (30 Sept):** 7 rejected with `--override`: NMN Pro (novel food), Wylex 2-way unit (consumer unit, trade), 2 FTTP router, Drybase TS-Plus 20kg, Magimix 4200XL (wrong match), Cleaning essentials bundle, Whiskas 80x85 duplicate. Fairy Platinum lemon and original are variants, both kept.
- **eBay review of 628 cards** (`cart-and-keep/ebay-review-2026-09-30.csv`): 1 reject, 90 check, 48 find cheaper, 73 weak, 276 fine needing a cost, 140 fine.
- **Strongest 50 for eBay** (`cart-and-keep/ebay-strongest-50-2026-09-30.csv`): all now approved (16 hers, 34 approved with her go-ahead, with notes for her). Method written into Keepr Part 8.
- **Still to reject:** KIKI Health NMN (open card): `node scripts/decide.js --match="KIKI Health NMN" --action=reject --reason=other --note="NMN is an unauthorised novel food in the UK" --apply`.

### Shelves

About 820,000 different products from 44 shops; 98 shops probed. See `cart-and-keep/shops-status.md` (updated 30 Sept). New Hardware shops from the store chat (Trade Door Handles, Decorating Centre Online, Electricals Online, The Switch Depot, Bathroom Tiles, Wood Finishes Direct) are collected, not drafted.

---

## 5. The next command (where we stopped)

**1. Import the last Hardware gate** (`gate-hw-confirmed-b`: Thetford Duo tank cleaner passed, Soudal Fix All Turbo set aside):

```powershell
node scripts/import-gate.js --csv=research/gates/gate-hw-confirmed-b.csv --date=2026-10-02 --term=google-hw --label="Hardware"
```

**2. Toys & Games: build the list and scan all of it** (about 1,035 calls). The file is the store chat's page check; change the path if it lives elsewhere:

```powershell
$seen = @{}
Import-Csv research\picks\toys-games\checked.csv | Where-Object { $_.verdict -like 'confirmed*' -and $_.query } | ForEach-Object {
  if (-not $seen.ContainsKey($_.query)) { $seen[$_.query] = 1; "{0,-46}# {1}" -f $_.query, $_.title }
} | Set-Content research\queries\queries-toys-confirmed.txt -Encoding UTF8
(Get-Content research\queries\queries-toys-confirmed.txt).Count
node scripts/scan.js --file=research/queries/queries-toys-confirmed.txt --csv=research/scans/scan-toys-confirmed-a.csv --out=research/queries/gated-toys-confirmed-a.txt --band=evri5 --max-listings=600 --min-results=5
```

**3. Before gating toys, trim the gate file:** counterfeit-prone lines need a note, not a cut (LEGO, Pokémon, Squishmallows, licensed figures: genuine stock only); cut keys too vague to judge ("matchbox", "tiny harlow", "polaroid game" and similar one-word or brand-only keys); cut anything sized (costumes).

**4. Gate toys** with `--max=` set to what is left divided by 7 (about 550 today after the scan). The rest goes first thing tomorrow with `--start=`. Import with `--term=google-toys --label="Toys & Games"`.

Toys are time-critical: Christmas listings need to be live by mid November.

---

## 6. Open items

### Waiting on the re-imports (the pack-match fix is in)

After the store chat fixed the "same product, same pack" assertion in `addEbay()` (import-gate) and its mirror in import-store, the joined cards' eBay figures need refreshing. Done so far: `gate-store-confirmed-a`. Still to run (no eBay calls; her decided cards are left alone):

```powershell
node scripts/import-gate.js --csv=research/gates/gate-store-confirmed-b.csv --date=2026-09-29 --term=google --label="Home & Garden"
node scripts/import-gate.js --csv=research/gates/gate-store-confirmed-c.csv --date=2026-09-30 --term=google --label="Home & Garden"
node scripts/import-gate.js --csv=research/gates/gate-store-confirmed-d.csv --date=2026-09-30 --term=google --label="Home & Garden"
node scripts/import-gate.js --csv=research/gates/gate-hb-confirmed-a.csv --date=2026-09-30 --term=google-hb --label="Health & Beauty"
node scripts/import-gate.js --csv=research/gates/gate-hw-confirmed-a.csv --date=2026-10-01 --term=google-hw --label="Hardware"
node scripts/store/import-store.mjs --category=hg-rerun --label="Home & Garden"
node scripts/store/import-store.mjs --category=health-beauty --label="Health & Beauty"
node scripts/store/import-store.mjs --category=hardware --label="Hardware"
```

Test card: "Fairy Liquid Non Bio". Its eBay evidence is item 366649869055, Fairy Non Bio Pods, 140 washes, at £28.79; the store card is the liquid, about 19 washes. After the re-import its eBay side must read as a different pack or product, not "same pack".

### Sent to the store chat (check they landed)

1. The eBay link on store cards that gained eBay: "See it on eBay" from the entry item id (stored as `v1|<number>|0`), with the eBay title shown beside the shop product's name. Reported fixed 2 Oct.
2. Product-type words in the matcher: liquid against pods or capsules, powder against tablets, refill against starter kit.
3. `proposeShops` returned cut-off JSON on 91 products ("Unterminated string in JSON"): batch it (about 25 at a time) or raise the reply length.
4. `queryOf()` splits possessives: "thompson s ronseal". Drop possessive 's.
5. Store rules: `not-shelf.mjs` stops parts and accessories with appliance words (fridge filter, dishwasher tablets, oven element, radiator valve, mattress protector, artificial Christmas tree). `NOT_RESTRICTED` should unlock only the alcohol and nicotine rules, not every restricted rule. Missing names: niquitin, nicorette, nicotinell, fybogel, acnecide, olbas, echinaforce, nmn, test strips. Calpol vapour plugs are not medicine.
6. One common rules layer for both channels: `risk.js` (eBay scan) should import the store's `RESTRICTED` and `CANT_POST`, keeping only eBay-only checks (second hand, sized clothing, dated calendars, fragrance houses with the home-scent and barware exceptions).
7. import-store: title re-key only when brand or barcode also agrees; add the under-40%-of-Google part guard; keep the shop photo in a separate `reference_image`; remove the stale "Above the market" text.
8. Candidates screen: for cards without a real cost, lead with "list at market if you can buy for £X or less"; rename lanes by action ("Needs a cost", "Find it cheaper"); bring back "Worth approving"; sort by evidence (sold a month, then smallest seller).

### Pipeline to-dos

- Gate the rotation sources still waiting: Spares2you (4,278 queries), pets (12,328), Festive Lights (564, Christmas), supplements test slice (250 of 10,096), John Lewis home brands test slice.
- Care shops: low eBay yield (14 per 1,000): move down the eBay rotation, keep as store sources.
- Bundle candidates (under £2 of room but busy): reacher, sock aid, reading rest, Topro lamp, Shimano mineral oil, cheap sealants.
- A food rule in `risk.js` (biscuits, teabags, chocolate, selection boxes) was offered and not yet done; supplements are allowed by her decision.
- Weather (Met Office Global Spot, free plan, key in `.env` as `METOFFICE_KEY`) and Google Trends (Apify) briefs are written for the store chat to build.
- Apify eBay sold-listings test: 100 already-gated queries through one actor (caffein.dev/ebay-sold-listings or memo23), compare its 30-day sales with the gate's estimate and record the cost.
- Scope reconciliation with the client: eBay delivered; Google Trends replaced by Merchant Center best sellers, Trends now being added; Met Office being added; CJ blocked (API disabled); Zik and AliExpress proposed to drop or keep as manual checks.

---

## 7. Files this chat produced (in outputs; add the md files to the Project)

| File | What |
|---|---|
| `cart-and-keep/00-handoff-research-2026-10-02.md` | this file |
| `cart-and-keep/keepr-agent-02.md` | Keepr spec v2.1, with Part 8 (eBay review method) and Part 9 (improvements) |
| `cart-and-keep/categories-2026-09-29.md` | Google taxonomy decisions, tabs and subcategories with real IDs |
| `cart-and-keep/shops-status.md` | every shop: collected, answered, out; Google categories |
| `cart-and-keep/google-trends-apify-2026-09-30.md` | Trends brief |
| `cart-and-keep/met-office-weather-2026-09-30.md` | weather brief (Global Spot, free plan) |
| `cart-and-keep/ebay-review-2026-09-30.csv`, `ebay-strongest-50-2026-09-30.csv` | the eBay review and strongest 50 |
| `scripts/gate.js`, `scripts/lib/market.js` | the gate saves each listing's eBay category (two CSV columns at the end) |
| `scripts/backfill-categories.mjs` | eBay category for cards gated before that (done: 596 of 610) |
| `scripts/export-ebay.mjs` | read-only export of eBay cards for review |
| `scripts/decide.js` | `--id=` added |
| `scripts/lib/risk.js` | vet prescription diets added |
| `scripts/shelf-queries.js` | compatible/universal skipped; pet-food two-word brands |
| `shelf-shopify.mjs` | reads a shop's prices at a thousandth when its median is in the thousands (Festive Lights) |
| `scripts/count-shelves.cjs` | written on his machine: counts lines, so Shopify files read high |

Also in the Project from earlier: the 1 October handoff, update and how-we-work files (store chat), `research-rules-v1`, `store-cards-one-key-2026-09-29.md`, the store rules files.
