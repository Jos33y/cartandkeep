#!/usr/bin/env python3
"""
Reads Terapeak sold-listing scrapes across several windows and works out which
products keep selling, which only sell in season, and which are fading.

Identity comes from the eBay item ID in the listing URL, which is stable across
windows. That is what turns four separate scrapes into a history rather than
four unrelated lists.

Files must be named  {term}_{YYYY-MM}.csv  so the window is read from the name:

    drops/terapeak/dog-bowl_2025-08.csv
    drops/terapeak/dog-bowl_2025-09.csv
    drops/terapeak/dog-bowl_2026-06.csv
    drops/terapeak/dog-bowl_2026-07.csv

Strip figures live in {term}_strips.csv, because sell-through and seller count
appear nowhere in the row export and are half the answer:

    window,avg_price,price_min,price_max,avg_postage,free_postage,sell_through,sellers
    2025-08,9.56,0.99,207.67,3.02,94,9.15,1239

Usage:  python analyse-terapeak.py drops/terapeak/dog-bowl_*.csv
        python analyse-terapeak.py --slow --record drops/terapeak/dog-bowl_*.csv
"""

import csv
import glob
import os
import re
import sys
import time
from collections import Counter, defaultdict

if os.name == "nt":
    os.system("")

_COLOUR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
_PACE = 0.0
_LOG = None
_write = print

_ANSI = re.compile(r"\033\[[\d;]*m")


def print(*args, **kwargs):
    _write(*args, **kwargs)
    sys.stdout.flush()
    if _LOG:
        _LOG.write(_ANSI.sub("", " ".join(str(a) for a in args)) + "\n")
    if _PACE:
        time.sleep(_PACE)


def _c(code):
    return (lambda t: f"\033[{code}m{t}\033[0m") if _COLOUR else (lambda t: str(t))


SAGE = _c("38;5;108")
TERRA = _c("38;5;173")
CREAM = _c("38;5;230")
DIM = _c("38;5;244")
BOLD = _c("1")
HEAD = _c("1;38;5;230")
GOOD = _c("38;5;114")
WARN = _c("38;5;179")
BAD = _c("38;5;167")


def rule(title):
    if _PACE:
        time.sleep(_PACE * 6)
    print(f"\n{HEAD(title)} {DIM('─' * max(4, 66 - len(title)))}")


def bar(share, width=20):
    filled = int(round(min(share, 100) / 100 * width))
    return SAGE("█" * filled) + DIM("░" * (width - filled))


# The scrape layout is not stable. Across the files seen so far there were 10
# and 14 column variants, with the title repeated and junk fields interleaved.
# So every field is identified by what it holds, never by where it sits.

RE_MONEY = re.compile(r"^£\s*[\d,]+\.\d{2}$")
RE_INT = re.compile(r"^\d[\d,]*$")
RE_ITEM = re.compile(r"/itm/(\d+)")

# What eBay actually means by the strip figures, per its own tooltips:
#   avg sold price  excludes postage and Buyer Protection fees, so it is the
#                   seller's line rather than what the buyer paid
#   avg postage     the average charged, and it EXCLUDES free postage listings.
#                   At 92% free postage it describes the 8% who charge, and
#                   says nothing about what postage costs the other 92%.
#   sell-through    percentage of similar items that sold. This is a listing
#                   hit rate, NOT sold divided by active listings, so it is a
#                   different metric from gates.str_min in the pipeline and the
#                   two must not be fed into each other.

# Cost lines from tenants.scoring.costs, for the headroom estimate below.
# The absolute margin gate. Below this the picking, packing and support time
# is not covered whatever the volume, so it is the line for listability.
GATE_ABS = 4.00

# Two routes to market, two floors, because they cost different things.
#
# Dropshipping costs a listing. A product doing three a month is worth listing
# and carries no capital, so the floor is presence rather than volume. This is
# what fills a 300 to 500 row shortlist she can work through.
#
# Stocking costs four to six weeks and a minimum order, so it needs volume that
# survives the lead time. Ten a month was the agreed floor and it stays.
MIN_LIST = 1
MIN_RECENT = 10

# proven and holding both compare a product against its own history. One window
# is not a history: every product is trivially present in every window and its
# hold ratio is its own volume over itself, so both pass by construction.
MIN_WINDOWS_FOR_STOCK = 3

# The terminal is for reading, the CSV is the artefact. Every candidate reaches
# the shortlist whatever this is set to.
LIST_SHOWN = 40

# Several sellers listing near-identical titles means a supplier SKU is in
# circulation, so it can be sourced. This is an annotation on a product that
# already sells, never a reason to consider one: a product with four sales and
# forty lookalikes is still a product with four sales.
MIN_SELLERS = 3

# Recent volume against the product's own average across every window. Momentum
# compares two windows and is noisy; this asks whether the product is holding up
# against its own history. Below 0.6 it is halving and should not be stocked.
MIN_HOLD = 0.6

# Royal Mail bands assume a small parcel. These words say the item is not one,
# so the headroom figure is optimistic and the real band must be checked before
# any margin claim. Bulk is the single biggest unmodelled cost in this data.
# The list was pet bedding vocabulary and matched nothing in mobility aids: a
# reacher grabber is 80cm long and a set of bed raisers is heavy, and both read
# as clean small parcels. Words are grouped by why they mean bulk.
BULKY = re.compile(
    r"\b(\d+\s?kg|roll|jumbo|xxl|extra large|x-large|xl\b|bulk|"
    r"sofa|orthopaedic|orthopedic|crate|kennel|cage|mattress|large\s+bed|"
    r"frame|stool|chair|step|table|walker|rollator|commode|trolley|bench|"
    r"platform|wheelchair|bed rail|over bed)\b", re.I)

EBAY_PCT, EBAY_FIXED = 0.128, 0.30
ADS_PCT = 0.06
PACKAGING = 0.40
# Royal Mail Tracked 48, April 2026 tariff. Medium parcel was missing and the
# category we are in now is mostly medium: a raised toilet seat frame is not a
# 45x35x16cm box whatever its weight.
BANDS = {"large_letter": 2.85, "small_parcel": 3.65, "medium_parcel": 5.55}
RE_WINDOW = re.compile(r"_(\d{4}-\d{2})\.csv$", re.I)

JUNK = ("preview", "[object", "Sell similar", "Item ID ")

# Screens from category-research.md, applied before anything is measured.
EXCLUSIONS = {
    # Powered goods need UKCA marking and the importer carries it. Anything
    # with a timer, a pump or a battery is powered whatever the title calls it.
    "electrical": re.compile(
        r"\b(electric|electrical|rechargeable|cordless|batter(?:y|ies)|"
        r"\bled\b|lamp|bulb|charger|usb|plug|mains|powered|heated|heater|"
        r"fountain|water pump|timer|automatic (?:feeder|dispenser|cat feeder|"
        r"pet feeder)|auto feeder|programmable)\b", re.I),

    # Applied to the product, not to a colour. "Cream stripe polycotton" is a
    # bed, so the words must sit next to something that makes them a cosmetic.
    "cosmetic": re.compile(
        r"\b(serum|shampoo|conditioner|lipstick|mascara|nail polish|perfume|"
        r"moisturis\w+|sunscreen|spf\s?\d+|(?:face|skin|body)\s+(?:cream|lotion))\b",
        re.I),

    # "Chew resistant" and "tough chew" describe a bed's durability, and
    # "winter warm" is not a food, so chew and feed only count as ingestible
    # when nothing next to them says otherwise.
    "ingestible": re.compile(
        r"\b(supplements?|vitamins?|tablets?|capsules?|kibble|pellets?|"
        r"dental\s+(?:stick|chew)s?|(?<!chew )treats?\b|dog rocks?|water rocks?|"
        r"(?:chew|feed)(?:s|ing)?\s+(?:stick|bone|bar|treat|snack|roll)|"
        r"(?:rawhide|pizzle|tripe|jerky|biscuits?))\b", re.I),

    # Fit risk on WORN goods only. A bed sold in various sizes is not a fit
    # gamble, and the earlier pattern was screening out the best products in
    # the best category because "various sizes" contains the word size.
    "sized": re.compile(
        r"\b(harness|collar|coat|jumper|jacket|hoodie|boots?|shoes?|socks?|"
        r"vest|bandana|muzzle|life\s?jacket|raincoat)\b", re.I),
}

# "Branded" covers four different situations and only two are disqualifying.
# Lumping them threw away the own-label candidates, which are the whole reason
# the custom store exists.

# Licensed character IP. Never, at any margin. This is what ends accounts.
LICENSED = re.compile(
    r"\b(disney|marvel|pixar|nintendo|pokemon|barbie|peppa|bluey|paw patrol|"
    r"harry potter|star wars|hello kitty|stitch|minecraft|premier league)\b", re.I)

# Third-party brands with no authorised supply route. VeRO exposure.
THIRD_PARTY = {
    "kong", "petsafe", "ancol", "rosewood", "trixie", "catit", "pawise",
    "bunty", "hownd", "sureflap", "mason cash", "zeus", "dekton", "goodyear",
    "bauer", "me & my", "dogit", "skylos", "maximum pet", "road refresher",
    "super design", "cat mate",
}

# Made to order per customer. Not a dropship product whatever the margin.
BESPOKE = re.compile(r"\b(personalised|personalized|custom name|bespoke|engraved)\b", re.I)

TRADEMARK = re.compile(r"[®™©]")


def money(value):
    try:
        return float(re.sub(r"[£,\s]", "", str(value)))
    except (TypeError, ValueError):
        return None


def whole(value):
    try:
        return int(re.sub(r"[,\s]", "", str(value)))
    except (TypeError, ValueError):
        return None


def classify_row(fields):
    """Pull one listing out of a row without relying on column order."""
    item_id = None
    values = []

    for field in fields:
        value = (field or "").strip()
        if not value:
            continue
        if value.startswith("http"):
            found = RE_ITEM.search(value)
            if found:
                item_id = item_id or found.group(1)
            continue
        if any(j in value for j in JUNK):
            continue
        values.append(value)

    if not item_id:
        return None

    monies = [money(v) for v in values if RE_MONEY.match(v)]
    ints = [whole(v) for v in values if RE_INT.match(v)]
    title = next((v for v in values
                  if len(v) > 12 and not RE_MONEY.match(v) and not RE_INT.match(v)
                  and "postage" not in v.lower()), None)

    # price, postage, revenue in that order; the largest integer is units sold.
    if len(monies) < 3 or not ints or not title:
        return None

    return {
        "item_id": item_id,
        "title": title,
        "price": monies[0],
        "postage": monies[1],
        "revenue": monies[-1],
        "sold": max(ints),
    }


# Only words that carry no product information are dropped. Material, form and
# feature words stay, or every stand station in the category collapses into one
# identity and the lookalike count becomes meaningless.
NOISE = {"the", "and", "for", "with", "set", "pack", "new", "uk", "pcs",
         "of", "in", "to", "pet", "dog", "cat", "puppy", "food", "water",
         "bowl", "bowls", "best", "quality", "premium", "free", "sale"}


def fingerprint(title):
    """Loose product identity from a title, for spotting the same SKU."""
    words = re.sub(r"[^a-z0-9\s]", " ", title.lower()).split()
    keep = [w for w in words if len(w) > 3 and w not in NOISE and not w.isdigit()]
    # Eight tokens rather than six, so variants stay distinguishable.
    return " ".join(sorted(set(keep))[:8])


def screen(title):
    hits = [name for name, pattern in EXCLUSIONS.items() if pattern.search(title)]
    lower = title.lower()
    if LICENSED.search(title):
        hits.append("licensed")
    match = next((b for b in THIRD_PARTY if b in lower), None)
    if match:
        hits.append(f"brand:{match}")
    elif TRADEMARK.search(title):
        hits.append("trademark")
    if BESPOKE.search(title):
        hits.append("bespoke")
    return hits


def is_bulky(title):
    return bool(BULKY.search(title))


def cost_lines(price, band="small_parcel"):
    """
    The individual costs behind headroom. Kept separate because who pays each
    one depends on how the product is fulfilled: on a dropship order the
    supplier posts it, so the postage line is not hers to pay. A single
    aggregate cannot be unpicked later.
    """
    if not price:
        return None
    return {
        "platform_fee": round(price * EBAY_PCT + EBAY_FIXED, 2),
        "ads": round(price * ADS_PCT, 2),
        "postage": BANDS[band],
        "packaging": PACKAGING,
    }


def headroom(price, band="small_parcel"):
    """
    What is left of the sold price once the seller has paid the platform, the
    ads, the postage and the packaging. Before goods cost. Postage is charged
    to the seller because 90%+ of sales in these categories are free postage.
    """
    lines = cost_lines(price, band)
    if not lines:
        return None
    return round(price - sum(lines.values()), 2)


def read_window(path):
    window = RE_WINDOW.search(os.path.basename(path))
    if not window:
        return None, []
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for raw in csv.reader(handle):
            if len(raw) < 6:
                continue
            row = classify_row(raw)
            if row:
                rows.append(row)
    return window.group(1), rows


def read_strips(paths):
    """Strip figures sit in a companion file because they are not in the rows."""
    folder = os.path.dirname(paths[0]) or "."
    term = re.sub(r"_\d{4}-\d{2}\.csv$", "", os.path.basename(paths[0]))
    candidate = os.path.join(folder, f"{term}_strips.csv")
    if not os.path.exists(candidate):
        return {}
    strips = {}
    with open(candidate, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("window") or "").strip()
            if key:
                strips[key] = {k: (v or "").strip() for k, v in row.items()}
    return strips


def classify_pattern(series, windows):
    """
    series: {window: units}. Absence means the product was not in the scraped
    top N for that window, which is not the same as zero sales. Stated in the
    output so the distinction survives.
    """
    present = [w for w in windows if series.get(w)]
    if not present:
        return "absent"

    first_half = windows[: len(windows) // 2]
    second_half = windows[len(windows) // 2:]
    early = sum(series.get(w, 0) for w in first_half)
    late = sum(series.get(w, 0) for w in second_half)

    if len(present) == len(windows):
        volumes = [series[w] for w in windows]
        # Selling in every window and never collapsing is the only thing that
        # earns a store page, since SEO takes longer to pay back than a season.
        if min(volumes) >= max(volumes) * 0.25:
            return "evergreen"
        return "erratic"

    if not early and late:
        return "new"
    if early and not late:
        return "gone"
    if late > early * 1.5:
        return "rising"
    if early > late * 1.5:
        return "fading"
    return "intermittent"


PATTERN_COLOUR = {
    "evergreen": GOOD,
    "rising": SAGE,
    "intermittent": WARN,
    "erratic": WARN,
    "new": CREAM,
    "fading": TERRA,
    "gone": BAD,
}


def main(argv):
    global _PACE, _LOG

    if len(argv) < 2:
        print(__doc__)
        return 1

    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]

    for flag in flags:
        if flag == "--slow":
            _PACE = 0.09
        elif flag.startswith("--slow="):
            _PACE = max(0.0, float(flag.split("=", 1)[1]))

    paths = []
    for arg in args:
        paths.extend(sorted(glob.glob(os.path.join(arg, "*.csv"))
                            if os.path.isdir(arg) else glob.glob(arg)))
    paths = [p for p in paths if RE_WINDOW.search(os.path.basename(p))]

    if not paths:
        print("No files matching {term}_{YYYY-MM}.csv matched.")
        return 1

    if "--record" in flags:
        os.makedirs("records", exist_ok=True)
        from datetime import datetime
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        _LOG = open(os.path.join("records", f"terapeak_{stamp}.txt"),
                    "w", encoding="utf-8")
        _LOG.write(f"analyse-terapeak.py\n{datetime.now():%Y-%m-%d %H:%M}\n"
                   f"files: {', '.join(os.path.basename(p) for p in paths)}\n")

    # --- load ---
    by_window = {}
    products = defaultdict(lambda: {"title": None, "series": {}, "prices": {}})

    for path in paths:
        window, rows = read_window(path)
        by_window[window] = rows
        for row in rows:
            entry = products[row["item_id"]]
            # Titles get edited, so keep the most recent rather than the first.
            entry["title"] = row["title"]
            entry["series"][window] = row["sold"]
            entry["prices"][window] = row["price"]

    windows = sorted(by_window)
    term = re.sub(r"_\d{4}-\d{2}\.csv$", "", os.path.basename(paths[0]))

    rule(f"{term.upper()}, {len(windows)} WINDOWS")
    for window in windows:
        rows = by_window[window]
        units = sum(r["sold"] for r in rows)
        revenue = sum(r["revenue"] for r in rows)
        wavg = revenue / units if units else 0
        print(f"  {CREAM(window)}  {len(rows):>4} listings  "
              f"{CREAM(f'{units:>6,}')} units  £{revenue:>9,.0f}  "
              f"{DIM(f'avg £{wavg:.2f}')}")

    # --- strip figures, if the companion file exists ---
    strips = read_strips(paths)
    if strips:
        rule("CATEGORY STRIP")
        print(DIM("  window     avg   charged   free   sold-rate    sellers"))
        for window in windows:
            s = strips.get(window)
            if not s:
                continue
            # A blank sell-through must not print as a zero. It reads as a term
            # where nothing sells rather than one nobody recorded.
            sold_rate = GOOD(f"{s.get('sell_through') or '-':>8}")
            print(f"  {CREAM(window)}  £{s.get('avg_price',''):>6}  "
                  f"£{s.get('avg_postage',''):>6}  {s.get('free_postage',''):>4}%  "
                  f"{sold_rate}%  "
                  f"{s.get('sellers',''):>8}")
        print(f"\n  {DIM('charged postage excludes free-postage listings, so at ' )}")
        print(f"  {DIM('90%+ free it describes a small minority and not the real cost.')}")
        print(f"  {DIM('sold-rate is eBay percentage of similar items that sold, which')}")
        print(f"  {DIM('is not the same metric as sell-through in the pipeline gates.')}")

        # Postage is absorbed into the price on almost every sale, so the
        # question is what is left of the average price once it is paid.
        rule("HEADROOM AT CATEGORY AVERAGE")
        print(DIM("  before goods cost, postage absorbed by the seller"))
        for window in windows:
            s_row = strips.get(window)
            if not s_row:
                continue
            price = money(s_row.get("avg_price"))
            if not price:
                continue
            for band, postage in BANDS.items():
                left = round(price - (price * EBAY_PCT + EBAY_FIXED)
                             - price * ADS_PCT - postage - PACKAGING, 2)
                tint = GOOD if left >= 4 else (WARN if left >= 2 else BAD)
                print(f"  {CREAM(window)}  £{price:>5.2f}  {band:<13} "
                      f"{tint(f'£{left:>5.2f} left')}")
    else:
        print(f"\n  {DIM('No ' + term + '_strips.csv found. Sold rate and seller')}")
        print(f"  {DIM('count are not in the row export, so they are missing here.')}")

    # --- where the sales actually sit by price ---
    # This is the category verdict. Volume tells you people are buying; the
    # band tells you whether a UK seller can be one of the sellers.
    rule("WHERE THE SALES SIT, BY PRICE BAND")
    print(DIM("  head = headroom before goods cost at the band midpoint, small parcel"))
    bands = [(0, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 15), (15, 20),
             (20, 30), (30, 10**6)]
    all_rows = [r for rows in by_window.values() for r in rows]
    grand_units = sum(r["sold"] for r in all_rows) or 1

    print(DIM("  band        " + "".join(f"{w[2:]:>9}" for w in windows)
              + "     total   share    head"))
    for low, high in bands:
        label = f"£{low}-{high}" if high < 10**6 else f"£{low}+"
        per_window = []
        for window in windows:
            per_window.append(sum(r["sold"] for r in by_window[window]
                                  if low <= r["price"] < high))
        total = sum(per_window)
        if not total:
            continue
        share = total / grand_units * 100
        mid = (low + high) / 2 if high < 10**6 else low * 1.3
        head = headroom(mid)
        tint = GOOD if head >= 4 else (WARN if head >= 2 else BAD)
        cells = "".join(f"{n:>9,}" for n in per_window)
        print(f"  {CREAM(f'{label:<10}')}{cells}  {total:>8,}  "
              f"{share:>5.1f}%  {tint(f'£{head:>6.2f}')}")

    viable_units = sum(r["sold"] for r in all_rows if (headroom(r["price"]) or 0) >= 4)
    print(f"\n  {BOLD('Units at prices that can clear the £4 gate:')} "
          f"{GOOD(f'{viable_units:,}')} of {grand_units:,} "
          f"({viable_units / grand_units * 100:.1f}%)")
    print(f"  {DIM('Everything below that line loses money before goods cost.')}")

    # --- pattern across windows ---
    patterns = defaultdict(list)
    for item_id, entry in products.items():
        pattern = classify_pattern(entry["series"], windows)
        entry["pattern"] = pattern
        entry["screens"] = screen(entry["title"])
        entry["total"] = sum(entry["series"].values())
        patterns[pattern].append(item_id)

    total_units = sum(e["total"] for e in products.values())

    rule("PATTERN ACROSS WINDOWS")
    order = ["evergreen", "rising", "intermittent", "erratic", "new", "fading", "gone"]
    for pattern in order:
        ids = patterns.get(pattern)
        if not ids:
            continue
        units = sum(products[i]["total"] for i in ids)
        share = units / total_units * 100 if total_units else 0
        tint = PATTERN_COLOUR.get(pattern, DIM)
        print(f"  {tint(f'{pattern:<13}')} {bar(share)} {CREAM(f'{share:>5.1f}%')}  "
              f"{len(ids):>4} products  {units:>6,} units")

    print(f"\n  {DIM('Absent from a window means outside the scraped top N,')}")
    print(f"  {DIM('which is not the same as zero sales.')}")

    # --- the shortlist ---
    rule("EVERGREEN, UNSCREENED, BY HEADROOM")
    print(DIM("  headroom is what is left before goods cost, small parcel band"))
    shortlist = []
    for item_id in patterns.get("evergreen", []):
        entry = products[item_id]
        if entry["screens"]:
            continue
        price = entry["prices"].get(windows[-1]) or list(entry["prices"].values())[-1]
        entry["price"] = price
        entry["headroom"] = headroom(price)
        shortlist.append(entry)
    shortlist.sort(key=lambda e: -(e["headroom"] or 0))

    if not shortlist:
        print(DIM("  Nothing sold in every window and cleared the screens."))
    print(DIM("   head   price   units  " + " ".join(f"{w[2:]:>6}" for w in windows) + "  title"))
    for entry in shortlist[:25]:
        series = " ".join(
            f"{entry['series'].get(w, 0):>6}" if entry["series"].get(w)
            else DIM(f"{chr(45):>6}")
            for w in windows
        )
        head = entry["headroom"]
        # The £4 absolute gate is the line. Below it the product cannot pay for
        # the picking, packing and support time whatever its volume.
        tint = GOOD if head >= 4 else (WARN if head >= 2 else BAD)
        print(f"  {tint(f'£{head:>5.2f}')}  £{entry[chr(112)+chr(114)+chr(105)+chr(99)+chr(101)]:>6.2f}  "
              f"{CREAM(f'{entry[chr(116)+chr(111)+chr(116)+chr(97)+chr(108)]:>5,}')}  "
              f"{series}  {entry['title'][:40]}")

    viable = [e for e in shortlist if (e["headroom"] or 0) >= 4]
    print(f"\n  {BOLD('Clearing the £4 gate:')} "
          f"{GOOD(f'{len(viable)} of {len(shortlist)}')} evergreen products")

    # --- what the screens removed from the evergreen set ---
    removed = [products[i] for i in patterns.get("evergreen", []) if products[i]["screens"]]
    if removed:
        rule("EVERGREEN BUT SCREENED OUT")
        for entry in sorted(removed, key=lambda e: -e["total"])[:12]:
            print(f"  {DIM(f'{entry[chr(116)+chr(111)+chr(116)+chr(97)+chr(108)]:>5,}')}  "
                  f"{TERRA('|'.join(entry['screens'])):<28}  {entry['title'][:44]}")

    # --- output ---
    # Output belongs next to the data it came from, not in the repo root.
    out_dir = os.environ.get("MERGED_DIR", "drops/merged")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{term}_merged.csv")
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["item_id", "title", "pattern", "screens",
                         "last_price", "headroom_small_parcel",
                         "headroom_large_letter", "total_units"]
                        + [f"units_{w}" for w in windows]
                        + [f"price_{w}" for w in windows]
                        + ["item_url"])
        for item_id, entry in sorted(products.items(), key=lambda kv: -kv[1]["total"]):
            last = entry["prices"].get(windows[-1]) or next(
                iter(reversed(list(entry["prices"].values()))), None)
            writer.writerow(
                [item_id, entry["title"], entry["pattern"],
                 "|".join(entry["screens"]), last or "",
                 headroom(last) if last else "",
                 headroom(last, "large_letter") if last else "",
                 entry["total"]]
                + [entry["series"].get(w, "") for w in windows]
                + [entry["prices"].get(w, "") for w in windows]
                + [f"https://www.ebay.co.uk/itm/{item_id}"]
            )

    # --- how many distinct sellers list the same product ---
    by_print = defaultdict(set)
    for item_id, entry in products.items():
        by_print[fingerprint(entry["title"])].add(item_id)
    for item_id, entry in products.items():
        entry["same_sku"] = len(by_print[fingerprint(entry["title"])])

    # --- candidates on any of three grounds, not persistence alone ---
    latest = windows[-1]
    previous = windows[-2] if len(windows) > 1 else None

    rule("LISTABLE")
    print(DIM(f"  head >= £{GATE_ABS:.2f} and selling in {latest}. "
              f"This is the dropship shortlist: she rules on what can be sourced."))

    candidates = []
    near_miss = []
    for item_id, entry in products.items():
        price = entry["prices"].get(latest) or list(entry["prices"].values())[-1]
        head = headroom(price)
        # Admission uses the large letter band, because the real band is not
        # known until the supplier gives dimensions. Missing a flat product is
        # worse than carrying one into vetting, so the optimistic bound admits
        # and the displayed figure stays the conservative one.
        head_flat = headroom(price, "large_letter")
        if not head or head_flat < GATE_ABS:
            continue
        if entry["screens"]:
            if entry["series"].get(latest, 0) >= MIN_RECENT:
                near_miss.append((entry, item_id, price, head))
            continue
        recent = entry["series"].get(latest, 0)
        prior = entry["series"].get(previous, 0) if previous else 0
        # Selling at all is the entry requirement for the dropship route. The
        # stock floor is applied further down, where it costs something.
        if recent < MIN_LIST:
            continue
        routes = ["selling"]
        if entry["pattern"] == "evergreen":
            routes.append("proven")
        if entry["same_sku"] >= MIN_SELLERS:
            routes.append("sourceable")
        entry.update(item_id=item_id, price=price, headroom=head,
                     flat_only=head < GATE_ABS,
                     recent=recent, routes=routes,
                     momentum=round(recent / prior, 1) if prior else None)
        candidates.append(entry)

    candidates.sort(key=lambda e: -(e["recent"] * (e["headroom"] or 0)))

    if not candidates:
        print(DIM("  Nothing cleared the gate on any route."))
    print(DIM("   head   price   now   mom  sku  routes                title"))
    for entry in candidates[:LIST_SHOWN]:
        mom = f"{entry['momentum']:>4.1f}" if entry["momentum"] else DIM("   -")
        tint = WARN if entry["flat_only"] else GOOD
        print(f"  {GOOD(f'£{entry[chr(104)+chr(101)+chr(97)+chr(100)+chr(114)+chr(111)+chr(111)+chr(109)]:>5.2f}')}  "
              f"£{entry['price']:>6.2f}  {tint(f'{entry[chr(114)+chr(101)+chr(99)+chr(101)+chr(110)+chr(116)]:>4}')}  "
              f"{mom}  {entry['same_sku']:>3}  {SAGE(f'{chr(43).join(entry[chr(114)+chr(111)+chr(117)+chr(116)+chr(101)+chr(115)]):<21}')} "
              f"{entry['title'][:38]}")

    if any(e["flat_only"] for e in candidates):
        print(f"\n  {WARN('amber head: clears the gate only if it ships large letter.')}")
        print(f"  {DIM('Under 25mm thick and under 750g. Check before sourcing.')}")

    # --- excluded by a screen but otherwise qualifying ---
    # Screens are word lists and they get things wrong in both directions, so
    # what they removed has to be visible rather than silently dropped.
    if near_miss:
        rule("SCREENED OUT BUT WOULD BE LISTABLE")
        print(DIM("  review these: the screen may be wrong"))
        for entry, item_id, price, head in sorted(
                near_miss, key=lambda x: -x[0]["series"].get(latest, 0))[:20]:
            print(f"  {DIM(f'£{head:>5.2f}')}  £{price:>6.2f}  "
                  f"{entry['series'].get(latest, 0):>4}  "
                  f"{TERRA(f'{chr(124).join(entry[chr(115)+chr(99)+chr(114)+chr(101)+chr(101)+chr(110)+chr(115)]):<22}')} "
                  f"{entry['title'][:38]}")

    # --- what to actually stock ---
    # The listable table answers "could this be sold". This answers "should this
    # be bought", which is a stricter question: it must have survived a year,
    # still be selling, and not be shrinking against its own history.
    rule("STOCK CANDIDATES")
    # On one window every product is trivially present in every window and its
    # hold ratio is its own volume over itself, so both tests pass by
    # construction and mean nothing. Printing a verdict here would assert
    # something that was never computed.
    if len(windows) < MIN_WINDOWS_FOR_STOCK:
        print(WARN(f"  Not computed. {len(windows)} window loaded, "
                   f"{MIN_WINDOWS_FOR_STOCK} needed."))
        print(DIM("  proven and holding both compare a product against its own"))
        print(DIM("  history. With one window there is no history to compare to."))
        stock, slipping = [], []
    else:
        print(DIM(f"  proven across all {len(windows)} windows, {MIN_RECENT}+ units "
                  f"in {latest}, holding at {MIN_HOLD:.0%}+ of own average"))

        stock = []
        slipping = []
        for entry in candidates:
            if entry["pattern"] != "evergreen":
                continue
            # The volume floor belongs here, not on admission. Ten a month is
            # what justifies a minimum order and a six week wait, and it says
            # nothing about whether a product is worth a dropship listing.
            if entry["recent"] < MIN_RECENT:
                continue
            volumes = [entry["series"].get(w, 0) for w in windows]
            mean = sum(volumes) / len(volumes)
            # Written whether it passes or not. A blank field cannot be argued
            # with, and the figure that excluded a product is the reason.
            entry["hold"] = round(entry["recent"] / mean, 2) if mean else 0
            entry["bulky"] = is_bulky(entry["title"])
            entry["window_mean"] = round(mean)
            if entry["hold"] < MIN_HOLD:
                slipping.append(entry)
                continue
            stock.append(entry)

        stock.sort(key=lambda e: -(e["recent"] * e["headroom"]))

        if not stock:
            print(DIM("  Nothing survived. Widen the windows or accept the listable set."))
        print(DIM("   head   price   now  hold   /mo   band   title"))
        for entry in stock:
            per_month = round(sum(entry["series"].values()) / len(windows))
            band = BAD("bulky ") if entry["bulky"] else GOOD("parcel")
            head_v, recent_v = entry["headroom"], entry["recent"]
            print(f"  {GOOD(f'£{head_v:>5.2f}')}  "
                  f"£{entry['price']:>6.2f}  {CREAM(f'{recent_v:>4}')}  "
                  f"{entry['hold']:>4.1f}  {per_month:>4}  {band}  {entry['title'][:40]}")

    if any(e["bulky"] for e in stock):
        print(f"\n  {WARN('bulky: headroom assumes a small parcel and is optimistic.')}")
        print(f"  {DIM('Get real dimensions from the supplier before trusting the margin.')}")

    # --- proven, still selling, and shrinking ---
    # These survived every window and cleared headroom, so they are not failures.
    # They are in decline against their own history, which is a finding worth
    # showing rather than a row worth dropping.
    if slipping:
        rule("PROVEN BUT SLIPPING")
        print(DIM(f"  below {MIN_HOLD:.0%} of their own average, so not stock candidates"))
        print(DIM("   head   price   now   avg  hold   title"))
        for entry in sorted(slipping, key=lambda e: -e["recent"]):
            print(f"  {DIM(f'£{entry[chr(104)+chr(101)+chr(97)+chr(100)+chr(114)+chr(111)+chr(111)+chr(109)]:>5.2f}')}  "
                  f"£{entry['price']:>6.2f}  {CREAM(f'{entry[chr(114)+chr(101)+chr(99)+chr(101)+chr(110)+chr(116)]:>4}')}  "
                  f"{entry['window_mean']:>4}  {WARN(f'{entry[chr(104)+chr(111)+chr(108)+chr(100)]:>4.2f}')}  "
                  f"{entry['title'][:40]}")

    # --- the running shortlist ---
    # Every search adds to one file rather than rebuilding it, because the
    # useful artefact is the accumulation across terms, not one category's run.
    short_path = os.path.join(out_dir, "shortlist.csv")
    columns = ["item_id", "term", "status", "title", "price", "headroom",
               "platform_fee", "ads", "postage", "packaging", "postage_band",
               "recent_units", "momentum", "hold", "bulky", "stock_candidate",
               "same_sku_sellers", "routes", "cluster",
               "total_units", "windows_present", "windows_total", "pattern",
               "item_url", "first_added", "last_seen", "dropped_reason",
               "dropped_on"]

    existing = {}
    if os.path.exists(short_path):
        with open(short_path, newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                existing[row["item_id"]] = row

    from datetime import date
    today = date.today().isoformat()
    added, refreshed = 0, 0

    for entry in candidates:
        item_id = entry["item_id"]
        row = {
            "item_id": item_id,
            "term": term,
            "title": entry["title"],
            "price": entry["price"],
            "headroom": entry["headroom"],
            **(cost_lines(entry["price"]) or {}),
            "postage_band": "small_parcel",
            "total_units": entry["total"],
            "recent_units": entry["recent"],
            "momentum": entry["momentum"] or "",
            "hold": entry.get("hold", ""),
            "bulky": "yes" if is_bulky(entry["title"]) else "",
            "stock_candidate": "yes" if entry in stock else "",
            "same_sku_sellers": entry["same_sku"],
            "routes": "+".join(entry["routes"]),
            # Assigned from the term that found the product, never derived from
            # the title. A title word list is what the brand screen is, and it
            # missed Helping Hand on a term where Helping Hand was the top row.
            "cluster": term,
            "windows_present": len(entry["series"]),
            "windows_total": len(windows),
            "pattern": entry["pattern"],
            "item_url": f"https://www.ebay.co.uk/itm/{item_id}",
            "first_added": existing.get(item_id, {}).get("first_added", today),
            "last_seen": today,
        }
        if item_id in existing:
            refreshed += 1
        else:
            added += 1
        row["status"] = "listable"
        existing[item_id] = row

    # A product that qualified before and does not now must say so. Otherwise
    # the file quietly becomes a list of things that were once true.
    qualifying = {e["item_id"] for e in candidates}
    dropped_out = []
    for item_id, row in existing.items():
        if row.get("term") != term or item_id in qualifying:
            continue
        entry = products.get(item_id)
        recent = entry["series"].get(latest, 0) if entry else 0
        reason = ("not scraped" if not entry
                  else f"{recent} in {latest}" if recent < MIN_LIST
                  else "headroom below gate")
        if row.get("status") != "dropped":
            dropped_out.append((row, reason))
        row["status"] = "dropped"
        row["dropped_reason"] = reason
        row["dropped_on"] = today

    if dropped_out:
        rule("DROPPED OUT SINCE LAST RUN")
        print(DIM("  qualified on an earlier run for this term, not any more"))
        for row, reason in dropped_out:
            last_seen = row.get("last_seen", "?")
            print(f"  {BAD(f'{reason:<18}')} {DIM(f'last seen {last_seen}')}  "
                  f"{row['title'][:44]}")

    with open(short_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        # Dropped rows sink to the bottom but are never deleted, because a
        # product that stopped selling is a finding worth keeping.
        for row in sorted(
                existing.values(),
                key=lambda r: (r.get("status") == "dropped",
                               -(float(r.get("recent_units") or 0)
                                 * float(r.get("headroom") or 0)))):
            writer.writerow(row)

    rule("OUTPUT")
    print(f"  {GOOD(out)}   {len(products)} products across {len(windows)} windows")
    live = sum(1 for r in existing.values() if r.get("status") != "dropped")
    print(f"  {GOOD(short_path)}   {live} listable, {len(existing) - live} dropped, "
          f"{added} new this run, {refreshed} refreshed")
    if _LOG:
        print(f"  {GOOD(_LOG.name)}   run recorded")
    print()
    if _LOG:
        _LOG.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
