"""
Adds a postage band and a store afford figure to a listings export.

The band vocabulary is the tested one in `terapeak.screens`. It is not
reimplemented here and it must not be reimplemented in the seed script either,
because a vocabulary maintained in two languages drifts and the drift is
silent. This script exists so the JavaScript side never has to own a copy.

Store arithmetic, not eBay's. Her own site has no marketplace fee and no ad
rate, so the same product affords about 17.7 per cent of the sale price more
per unit than it does on eBay. That difference is the reason the store is worth
building at all, so it is the figure the catalogue is filtered on.

Usage:
    python scripts/band-listings.py --in=drops/bellatique-listings-034.csv
    python scripts/band-listings.py --in=... --out=drops/store-seed.csv
"""

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from terapeak.costs import BANDS, PACKAGING
from terapeak.rules import GATE_ABS, GATE_PCT
from terapeak.screens import postage_band, screen

# Stripe UK domestic cards. Her storefront checkout, which is not the studio's
# Flutterwave rail, and the two have been merged once already.
CARD_PCT = 0.015
CARD_FIXED = 0.20

PRICE = re.compile(r"([\d,]+\.\d\d)")
ITEM = re.compile(r"/itm/(\d+)")


def afford_on_store(price, band):
    after = price - (price * CARD_PCT + CARD_FIXED) - BANDS[band] - PACKAGING
    return round(min(after - GATE_ABS, after - price * GATE_PCT), 2)


def read(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            title = (row.get("str-text-span") or "").strip()
            href = row.get("str-item-card__link href") or ""
            ref = ITEM.search(href)
            money = PRICE.search(row.get("str-text-span 2") or "")
            if not title or not ref or not money:
                continue
            yield {
                "item_id": ref.group(1),
                "title": title,
                "price": float(money.group(1).replace(",", "")),
                "image_url": (row.get("landscape src") or row.get("portrait src") or "").strip(),
                "url": href,
            }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="source", required=True)
    parser.add_argument("--out", dest="target", default="drops/store-seed.csv")
    parser.add_argument("--floor", type=float, default=8.00)
    args = parser.parse_args()

    rows = []
    seen = set()
    duplicates = 0
    for row in read(args.source):
        if row["item_id"] in seen:
            duplicates += 1
            continue
        seen.add(row["item_id"])
        row["postage_band"] = postage_band(row["title"])
        row["afford_store"] = afford_on_store(row["price"], row["postage_band"])
        # A screened title is not a store decision, it is a flag for her. A
        # cosmetic or ingestible product carries a regime this project has not
        # read, and it is her call whether it goes in the shop, not ours.
        row["screens"] = "+".join(screen(row["title"]))
        rows.append(row)

    kept = [r for r in rows if r["afford_store"] >= args.floor and not r["screens"]]
    flagged = [r for r in rows if r["afford_store"] >= args.floor and r["screens"]]
    below = len(rows) - len(kept) - len(flagged)

    bands = {}
    for r in rows:
        bands[r["postage_band"]] = bands.get(r["postage_band"], 0) + 1

    print(f"  {len(rows) + duplicates} rows, {duplicates} duplicate reference(s) dropped")
    print(f"  bands: " + ", ".join(f"{k} {v}" for k, v in sorted(bands.items())))
    print(f"  {below} below the £{args.floor:.2f} store floor")
    print(f"  {len(flagged)} clear the floor and carry a screen, held for her call")
    print(f"  {len(kept)} to seed")

    target = Path(args.target)
    target.parent.mkdir(parents=True, exist_ok=True)
    columns = ["item_id", "title", "price", "postage_band", "afford_store",
               "screens", "image_url", "url"]
    with open(target, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        # Everything is written, including the rows below the floor and the
        # flagged ones, with the figures beside them. The seed script filters.
        # A file that silently drops rows cannot be checked against the source.
        for row in sorted(rows, key=lambda r: -r["afford_store"]):
            writer.writerow(row)

    print(f"\n  {target}")


if __name__ == "__main__":
    main()
