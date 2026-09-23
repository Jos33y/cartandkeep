#!/usr/bin/env python3
"""
Reads scraped Zik competitor catalogue CSVs and answers three questions:
where the sales sit by price, which products are excluded before scoring,
and which phrases recur across titles weighted by units sold.

The terms it emits are observed, not invented. That is the whole point:
a keyword that appears in a catalogue with a 437% sell-through has evidence
behind it, and a keyword someone typed into a config file does not.

Usage:  python analyse-competitor.py drops/thinkprice-*.csv
        python analyse-competitor.py drops/                 (all csv in dir)
        python analyse-competitor.py --inspect drops/*.csv  (column layouts)
        python analyse-competitor.py --slow drops/*.csv     (paced, for screen capture)
        python analyse-competitor.py --slow=0.2 drops/*.csv (custom pace, seconds per line)
        python analyse-competitor.py --record drops/*.csv   (write a timestamped run log)
"""

import csv
import glob
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime

# Windows cmd needs VT processing switched on before ANSI does anything.
if os.name == "nt":
    os.system("")

_COLOUR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")

# Deliberately shadows the builtin. Every line of output in this file goes
# through print, so pacing it in one place beats threading a delay through
# forty call sites. Off by default, so piping and normal runs are unaffected.
_PACE = 0.0
_LOG = None
_write = print

_ANSI = re.compile(r"\033\[[\d;]*m")


def print(*args, **kwargs):
    _write(*args, **kwargs)
    sys.stdout.flush()
    # The record keeps the words and drops the colour codes, so the file stays
    # readable in a year when nobody remembers what the escape sequences were.
    if _LOG:
        _LOG.write(_ANSI.sub("", " ".join(str(a) for a in args)) + "\n")
    if _PACE:
        time.sleep(_PACE)


def _c(code):
    return (lambda t: f"\033[{code}m{t}\033[0m") if _COLOUR else (lambda t: str(t))


# 256-colour approximations of the studio palette.
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
    # A longer beat at a section break gives the eye somewhere to land.
    if _PACE:
        time.sleep(_PACE * 6)
    line = "\u2500" * max(4, 64 - len(title))
    print(f"\n{HEAD(title)} {DIM(line)}")


def bar(share, width=24):
    filled = int(round(share / 100 * width))
    return SAGE("\u2588" * filled) + DIM("\u2591" * (width - filled))

# The scrape carries CSS class names as headers. Position is the contract.
# The scrape has no stable layout. Across seven files there were 9, 11 and 13
# column variants, title and item URL swap places, and the number of
# sales/revenue pairs varies with how many window columns held a value. So
# fields are identified by what they contain, never by where they sit.

# Confirmed in the UI: 14, 21 and 30 day columns read identically even on
# recently uploaded listings, so these are cumulative totals since the listing
# went up, printed under three window labels. Velocity trend is not derivable
# from this source, and raw units cannot be compared across different upload
# dates. Rate per month is the honest comparison.
SALES_WINDOW = "lifetime, cumulative since upload"

RE_DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
RE_PRICE = re.compile(r"^£\s*[\d,]+\.\d{2}$")
RE_MONEY = re.compile(r"^£\s*[\d,]+(\.\d+)?$")
RE_INT = re.compile(r"^\d[\d,]*$")


def classify_row(fields):
    """Pull a product out of a row without relying on column order."""
    out = {"image": None, "item_url": None, "zik_url": None,
           "upload_date": None, "title": None,
           "price": None, "revenue": None, "sales": None, "seller_count": None}

    rest = []
    for field in fields:
        value = (field or "").strip()
        if not value:
            continue
        if value.startswith("http"):
            if "ebayimg" in value:
                out["image"] = out["image"] or value
            elif "zikanalytics" in value:
                out["zik_url"] = out["zik_url"] or value
            elif "/itm/" in value:
                out["item_url"] = out["item_url"] or value
            continue
        if RE_DATE.match(value):
            out["upload_date"] = out["upload_date"] or value
            continue
        rest.append(value)

    # Price is the only money field carrying pence. Revenue is rounded.
    price_at = next((i for i in range(len(rest) - 1, -1, -1)
                     if RE_PRICE.match(rest[i])), None)
    if price_at is None:
        return None
    out["price"] = money(rest[price_at])

    head, tail = rest[:price_at], rest[price_at + 1:]

    # Every window column repeats the same lifetime figure, so the largest is
    # the figure. Taking max also survives a partly blank row.
    sales = [whole(v) for v in head if RE_INT.match(v)]
    revenue = [money(v) for v in head if RE_MONEY.match(v)]
    out["sales"] = max([s for s in sales if s is not None], default=None)
    out["revenue"] = max([r for r in revenue if r is not None], default=None)

    # Competitors is the plain integer sitting after the price.
    comp = [whole(v) for v in tail if RE_INT.match(v)]
    out["seller_count"] = comp[0] if comp else None

    # Whatever is left that is not a number is the title.
    out["title"] = next(
        (v for v in rest
         if not RE_INT.match(v) and not RE_MONEY.match(v) and len(v) > 8),
        None,
    )
    return out if out["title"] and out["price"] else None


NOISE = {
    "the", "and", "for", "with", "set", "kit", "pack", "new", "uk", "pcs", "pc",
    "of", "a", "in", "to", "free", "hot", "sale", "quality", "premium", "style",
    "professional", "portable", "mini", "large", "small", "size", "colour",
    "color", "best", "top", "super", "soft", "multi", "use", "used", "x",
    "heavy", "duty", "high", "low", "big", "long", "short", "full", "all",
    "one", "two", "double", "single", "home", "garden", "outdoor", "indoor",
}

# Screens from category-research.md. These drop before anything is measured.
EXCLUSIONS = {
    "electrical": re.compile(
        r"\b(electric|electrical|rechargeable|cordless|battery|batteries|led|lamp|"
        r"bulb|charger|usb|plug|mains|powered|inflator|compressor|dash ?cam|"
        r"heater|blanket|kettle|toaster|fan|humidifier|shaver|trimmer|camera)\b",
        re.I),
    "cosmetic": re.compile(
        r"\b(serum|cream|lotion|shampoo|lipstick|mascara|nail polish|perfume|"
        r"moisturis|skincare|cleanser|toner|spf|sunscreen)\b", re.I),
    "ingestible": re.compile(
        r"\b(supplement|vitamin|tablet|capsule|protein|collagen|creatine|gummies|"
        r"cbd|food|treats|feed|pellets|fertiliser|fertilizer|plant food)\b", re.I),
    "sized": re.compile(
        r"\b(shirt|trouser|jean|dress|shoe|boot|sock|glove|jacket|coat|legging|"
        r"bra|underwear|hoodie|jumper|sizes?\s*[smlx]|uk\s?\d{1,2})\b", re.I),
}

# Grows as brands are met. A false positive costs one candidate.
KNOWN_BRANDS = {
    "goodyear", "bauer", "ryanair", "easyjet", "fender", "energizer",
    "milwaukee", "stihl", "bahco", "rustins", "iconsign", "ninja", "outsunny",
}

TRADEMARK = re.compile(r"[®™©]")


def money(value):
    if value is None:
        return None
    cleaned = re.sub(r"[£$,\s]", "", str(value))
    try:
        return float(cleaned)
    except ValueError:
        return None


def whole(value):
    cleaned = re.sub(r"[,\s]", "", str(value or ""))
    try:
        return int(cleaned)
    except ValueError:
        return None


def read_rows(paths):
    rows = []
    for path in paths:
        with open(path, newline="", encoding="utf-8-sig") as handle:
            for raw in csv.reader(handle):
                if len(raw) < 6:
                    continue
                row = classify_row(raw)
                if not row:
                    continue
                row["source_file"] = os.path.basename(path)
                months = months_listed(row["upload_date"])
                row["months_listed"] = round(months, 1) if months else None
                row["per_month"] = (
                    round(row["sales"] / months, 1)
                    if months and row["sales"] else None
                )
                rows.append(row)
    return rows


def months_listed(upload_date, today=None):
    # Zik prints dd/mm/yyyy. A listing up for a week gets a floor of one month
    # so a brand new product does not divide out to an absurd rate.
    try:
        started = datetime.strptime(upload_date.strip(), "%d/%m/%Y")
    except (ValueError, AttributeError):
        return None
    days = ((today or datetime.now()) - started).days
    return max(days / 30.44, 1.0)


def dedupe(rows):
    # The same item can appear across page scrapes. Item URL is the identity.
    seen = {}
    for row in rows:
        key = row["item_url"] or row["title"]
        if key not in seen or (row["sales"] or 0) > (seen[key]["sales_30d"] or 0):
            seen[key] = row
    return list(seen.values())


def competitors(value):
    # Few competitors is the opening, many is a knife fight. The colour is the
    # whole reason this column is worth reading before the sales column.
    if value is None:
        return DIM("   -")
    if value <= 5:
        return GOOD(f"{value:>4}")
    if value <= 50:
        return WARN(f"{value:>4}")
    return BAD(f"{value:>4}")


def screen(title):
    hits = [name for name, pattern in EXCLUSIONS.items() if pattern.search(title)]
    lower = title.lower()
    brand = next((b for b in KNOWN_BRANDS if b in lower), None)
    if brand or TRADEMARK.search(title):
        hits.append("branded")
    return hits


def tokenise(title):
    words = re.sub(r"[^a-z0-9\s]", " ", title.lower()).split()
    return [w for w in words if len(w) > 2 and not w.isdigit() and w not in NOISE]


def phrases(tokens, n):
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def inspect(paths):
    # Some scrapes came back with the title column holding a link href, which
    # means the column layout is not identical across files. Before trusting
    # any of it, look at what each file actually starts with.
    for path in paths:
        with open(path, newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.reader(handle))
        if not rows:
            print(f"{TERRA(os.path.basename(path))}  empty")
            continue
        widths = Counter(len(r) for r in rows)
        first = rows[1] if len(rows) > 1 else rows[0]
        print(f"\n{HEAD(os.path.basename(path))}  "
              f"{DIM(f'{len(rows)} lines, column counts {dict(widths)}')}")
        for i, field in enumerate(first):
            name = COLUMNS[i] if i < len(COLUMNS) else f"extra_{i}"
            print(f"  {DIM(f'{i}')} {SAGE(f'{name:<14}')} {field[:64]}")
    print()


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1

    global _PACE

    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]
    inspecting = "--inspect" in flags

    recording = "--record" in flags

    for flag in flags:
        if flag == "--record":
            continue
        if flag == "--slow":
            _PACE = 0.09
        elif flag.startswith("--slow="):
            try:
                _PACE = max(0.0, float(flag.split("=", 1)[1]))
            except ValueError:
                print(f"{BAD('Bad --slow value.')} Use --slow or --slow=0.2")
                return 1

    paths = []
    for arg in args:
        if os.path.isdir(arg):
            paths.extend(sorted(glob.glob(os.path.join(arg, "*.csv"))))
        else:
            paths.extend(sorted(glob.glob(arg)))

    if not paths:
        print("No CSV files matched.")
        return 1

    if recording:
        global _LOG
        os.makedirs("records", exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        record_path = os.path.join("records", f"competitor-analysis_{stamp}.txt")
        _LOG = open(record_path, "w", encoding="utf-8")
        _LOG.write(f"analyse-competitor.py\n{datetime.now():%Y-%m-%d %H:%M} "
                   f"WAT\nfiles: {', '.join(os.path.basename(p) for p in paths)}\n")

    if inspecting:
        inspect(paths)
        return 0

    rows = dedupe(read_rows(paths))
    if not rows:
        print("No usable rows.")
        return 1

    total_units = sum(r["sales"] or 0 for r in rows)
    total_revenue = sum(r["revenue"] or 0 for r in rows)

    rule("CATALOGUE")
    print(f"  {CREAM(len(paths))} files   "
          f"{CREAM(f'{len(rows):,}')} distinct products after dedupe")
    print(f"  {CREAM(f'{total_units:,}')} units   "
          f"{CREAM(f'£{total_revenue:,.0f}')}   "
          f"{DIM('lifetime, not monthly')}")
    layouts = Counter(r["layout"] for r in rows if r.get("layout"))
    if len(layouts) > 1:
        print(f"  {WARN(f'{len(layouts)} different column layouts across these files.')}")

    # --- price distribution, the floor question ---
    rule("PRICE BANDS, BY UNITS")
    bands = [(0, 5), (5, 10), (10, 14), (14, 20), (20, 30), (30, 10**6)]
    for low, high in bands:
        in_band = [r for r in rows if low <= r["price"] < high]
        units = sum(r["sales"] or 0 for r in in_band)
        revenue = sum(r["revenue"] or 0 for r in in_band)
        share = units / total_units * 100 if total_units else 0
        label = f"£{low}-{high}" if high < 10**6 else f"£{low}+"
        tint = SAGE if high <= 14 else DIM
        print(f"  {tint(f'{label:<8}')} {bar(share)} {CREAM(f'{share:>5.1f}%')}  "
              f"{len(in_band):>4} products  {units:>7,} units  "
              f"{DIM(f'£{revenue:>10,.0f}')}")

    below = sum(r["sales"] or 0 for r in rows if r["price"] < 14)
    if total_units:
        print(f"\n  {BOLD('Below £14:')} "
              f"{TERRA(f'{below / total_units * 100:.1f}%')} of units")

    # --- what the exclusions would remove ---
    excluded = defaultdict(lambda: {"products": 0, "units": 0, "revenue": 0.0})
    clean = []
    for row in rows:
        hits = screen(row["title"])
        if hits:
            for hit in hits:
                excluded[hit]["products"] += 1
                excluded[hit]["units"] += row["sales"] or 0
                excluded[hit]["revenue"] += row["revenue"] or 0
        else:
            clean.append(row)

    rule("SCREENED OUT")
    print(DIM("  a product can fail more than one screen"))
    for name, stat in sorted(excluded.items(), key=lambda kv: -kv[1]["units"]):
        share = stat["units"] / total_units * 100 if total_units else 0
        rev = f"£{stat['revenue']:>10,.0f}"
        print(f"  {TERRA(f'{name:<12}')} {bar(share)} {CREAM(f'{share:>5.1f}%')}  "
              f"{stat['products']:>4} products  {stat['units']:>7,} units  "
              f"{DIM(rev)}")

    clean_units = sum(r["sales"] or 0 for r in clean)
    share = clean_units / total_units * 100 if total_units else 0
    print(f"\n  {BOLD('Surviving')}  {GOOD(f'{len(clean)} products')}  "
          f"{GOOD(f'{clean_units:,} units')}  {GOOD(f'{share:.1f}%')}")

    # --- terms, weighted by units rather than by how often a word appears ---
    for n, label, floor in ((2, "Two-word phrases", 2), (3, "Three-word phrases", 2)):
        weighted = Counter()
        seen_in = defaultdict(set)
        for row in clean:
            tokens = tokenise(row["title"])
            for phrase in set(phrases(tokens, n)):
                weighted[phrase] += row["sales"] or 0
                seen_in[phrase].add(row["item_url"])
        top = [(p, u) for p, u in weighted.most_common(40)
               if len(seen_in[p]) >= floor][:15]
        rule(f"{label.upper()}, {floor}+ PRODUCTS, BY UNITS")
        for phrase, units in top:
            print(f"  {CREAM(f'{units:>7,}')}  "
                  f"{DIM(f'{len(seen_in[phrase]):>2} products')}  {SAGE(phrase)}")

    # --- the shortlist: clean, cheap, moving ---
    rule("CLEAN, UNDER £15, BY UNITS")
    candidates = sorted(
        [r for r in clean if r["price"] < 15],
        key=lambda r: -(r["sales"] or 0),
    )[:25]
    for row in candidates:
        print(f"  {CREAM(f'{row[chr(115)+chr(97)+chr(108)+chr(101)+chr(115)]:>5,}')}"
              f"  £{row['price']:>6.2f}  {competitors(row['seller_count'])} comp  "
              f"{row['title'][:58]}")

    rule("CLEAN, UNDER £15, BY UNITS PER MONTH LISTED")
    by_rate = sorted(
        [r for r in clean if r["per_month"]],
        key=lambda r: -r["per_month"],
    )
    for row in [r for r in by_rate if r["price"] < 15][:25]:
        print(f"  {CREAM(f'{row[chr(112)+chr(101)+chr(114)+chr(95)+chr(109)+chr(111)+chr(110)+chr(116)+chr(104)]:>6.1f}')}/mo"
              f"  £{row['price']:>6.2f}  {competitors(row['seller_count'])} comp  "
              f"{DIM(f'{row[chr(109)+chr(111)+chr(110)+chr(116)+chr(104)+chr(115)+chr(95)+chr(108)+chr(105)+chr(115)+chr(116)+chr(101)+chr(100)]:>5.1f}mo')}  "
              f"{row['title'][:52]}")

    print(f"\n  {DIM('Sales are ' + SALES_WINDOW + ', so raw units favour old listings.')}")
    print(f"  {DIM('The per month column is the comparable one.')}")

    # Output belongs next to the data it came from, not in the repo root.
    out_dir = os.environ.get("MERGED_DIR", "drops/merged")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "competitor-merged.csv")
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["title", "price", "sales", "per_month", "months_listed",
                        "revenue", "seller_count", "screens", "upload_date",
                        "item_url", "image", "source_file"],
            extrasaction="ignore",
        )
        writer.writeheader()
        for row in sorted(rows, key=lambda r: -(r["sales"] or 0)):
            out_row = dict(row)
            # Excluded rows stay in the file with their reason, so the screen
            # can be argued with rather than silently deleting the evidence.
            out_row["screens"] = "|".join(screen(row["title"]))
            writer.writerow(out_row)
    rule("OUTPUT")
    print(f"  {GOOD(out)}   {len(rows)} products, {len(clean)} unscreened")
    if _LOG:
        print(f"  {GOOD(_LOG.name)}   run recorded")
    print()
    if _LOG:
        _LOG.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
