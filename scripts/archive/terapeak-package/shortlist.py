"""
The two CSVs.

`{term}_merged.csv` is one run. `shortlist.csv` accumulates across every run
and every term, deduped on eBay item ID, because the useful artefact is the
accumulation rather than one category's output.
"""

import csv
import os
from datetime import date

from .costs import affordable_goods, cost_lines, headroom
from .rules import MIN_LIST
from .screens import (band_needs_measuring, band_word, is_bulky, is_powered,
                      postage_band, shape)

COLUMNS = ["item_id", "product_key", "term", "status", "title", "price", "headroom",
           "afford",
           "platform_fee", "ads", "postage", "packaging", "postage_band",
           "band_word", "band_measure",
           "recent_units", "momentum", "hold", "bulky", "powered", "shape",
           "stock_candidate", "same_sku_sellers", "routes", "cluster",
           "total_units", "windows_present", "windows_total", "pattern",
           "item_url", "first_added", "last_seen", "dropped_reason",
           "dropped_on"]


def write_merged(out_dir, term, products, windows):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, term + "_merged.csv")
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["item_id", "title", "pattern", "screens", "powered",
                         "shape", "last_price", "headroom_small_parcel",
                         "headroom_large_letter", "total_units"]
                        + ["units_" + w for w in windows]
                        + ["price_" + w for w in windows]
                        + ["item_url"])
        for item_id, entry in sorted(products.items(), key=lambda kv: -kv[1]["total"]):
            last = entry["prices"].get(windows[-1]) or next(
                iter(reversed(list(entry["prices"].values()))), None)
            writer.writerow(
                [item_id, entry["title"], entry["pattern"],
                 "|".join(entry["screens"]),
                 "yes" if is_powered(entry["title"]) else "",
                 shape(entry["title"]),
                 last or "",
                 headroom(last, postage_band(entry["title"])) if last else "",
                 headroom(last, "large_letter") if last else "",
                 entry["total"]]
                + [entry["series"].get(w, "") for w in windows]
                + [entry["prices"].get(w, "") for w in windows]
                + ["https://www.ebay.co.uk/itm/" + item_id]
            )
    return path


def read_existing(path):
    existing = {}
    if not os.path.exists(path):
        return existing
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            existing[row["item_id"]] = row
    return existing


def update_shortlist(out_dir, term, candidates, stock, products, windows, latest):
    """
    Returns (path, existing, added, refreshed, dropped_out).

    Nothing is deleted. A product that qualified on an earlier run and does not
    now is marked dropped with a reason and a date, because a shortlist that
    quietly forgets its own history is a list of things that were once true.
    """
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "shortlist.csv")
    existing = read_existing(path)
    today = date.today().isoformat()
    stock_ids = {e["item_id"] for e in stock}
    added, refreshed = 0, 0

    for entry in candidates:
        item_id = entry["item_id"]
        row = {
            "item_id": item_id,
            # Several sellers list the same product under different item ids.
            # The item id is the listing, this is the product.
            "product_key": entry.get("product_key") or item_id,
            "term": term,
            "status": "listable",
            "title": entry["title"],
            "price": entry["price"],
            "headroom": entry["headroom"],
            # What the goods may cost, which is the question a supplier is
            # asked. Headroom is what is left before them, which is not the
            # same question and cannot be taken to a quote.
            "afford": affordable_goods(entry["price"], entry["band"]),
            "postage_band": entry["band"],
            # The band is a defensible default, not a measurement. These two
            # say which word set it and whether that word does two jobs, so a
            # figure can be argued with rather than only trusted.
            "band_word": band_word(entry["title"]),
            "band_measure": "yes" if band_needs_measuring(entry["title"]) else "",
            "total_units": entry["total"],
            "recent_units": entry["recent"],
            "momentum": entry["momentum"] or "",
            "hold": entry.get("hold", ""),
            "bulky": "yes" if entry["bulky"] else "",
            "powered": "yes" if entry["powered"] else "",
            "shape": entry["shape"],
            "stock_candidate": "yes" if item_id in stock_ids else "",
            "same_sku_sellers": entry["same_sku"],
            "routes": "+".join(entry["routes"]),
            # Assigned from the term that found the product, never derived from
            # the title. A title word list is what the brand screen is, and it
            # missed Helping Hand on a term where Helping Hand was the top row.
            "cluster": term,
            "windows_present": len(entry["series"]),
            "windows_total": len(windows),
            "pattern": entry["pattern"],
            "item_url": "https://www.ebay.co.uk/itm/" + item_id,
            "first_added": existing.get(item_id, {}).get("first_added", today),
            "last_seen": today,
        }
        row.update(cost_lines(entry["price"], entry["band"]) or {})
        if item_id in existing:
            refreshed += 1
        else:
            added += 1
        existing[item_id] = row

    qualifying = {e["item_id"] for e in candidates}
    dropped_out = []
    for item_id, row in existing.items():
        if row.get("term") != term or item_id in qualifying:
            continue
        entry = products.get(item_id)
        recent = entry["series"].get(latest, 0) if entry else 0
        # Screens run before anything is measured, so a screened row never
        # reached the headroom test and must not be recorded as failing it. A
        # wrong reason is worse than a vague one, because it gets believed.
        screens = entry["screens"] if entry else None
        if not entry:
            reason = "not scraped"
        elif screens:
            reason = "screened: " + "|".join(screens)
        elif recent < MIN_LIST:
            reason = str(recent) + " in " + latest
        else:
            reason = "headroom below gate"
        if row.get("status") != "dropped":
            dropped_out.append((row, reason))
        row["status"] = "dropped"
        row["dropped_reason"] = reason
        row["dropped_on"] = today

    # Rows written before the column existed, including dropped ones, are
    # backfilled from their own price and band rather than left blank. A blank
    # would read as unknown when it is only unrecorded.
    for row in existing.values():
        if not row.get("afford"):
            price = row.get("price")
            band = row.get("postage_band") or "small_parcel"
            try:
                price = float(price)
            except (TypeError, ValueError):
                price = None
            row["afford"] = affordable_goods(price, band) if price else ""

    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        # Dropped rows sink to the bottom but are never deleted, because a
        # product that stopped selling is a finding worth keeping.
        for row in sorted(
                existing.values(),
                key=lambda r: (r.get("status") == "dropped",
                               -(float(r.get("recent_units") or 0)
                                 * float(r.get("headroom") or 0)))):
            writer.writerow(row)

    return path, existing, added, refreshed, dropped_out
