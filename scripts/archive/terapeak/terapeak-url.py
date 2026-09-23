#!/usr/bin/env python3
"""
Builds Terapeak research URLs for a term across a set of monthly windows.

Terapeak takes its date range as epoch milliseconds, so a window typed by hand
is a number nobody can read back and nobody can check. Worse, the boundary is
local midnight and the United Kingdom is on BST for eight months of the year,
so October and March windows start under one offset and end under another. Get
that wrong and the window is shifted by an hour with nothing to warn you.

Usage:
  python scripts/terapeak-url.py massage --category=36449 --windows=2026-05,2026-06
  python scripts/terapeak-url.py massage --category=36449 --last=3 --pair
  python scripts/terapeak-url.py "duvet cover" --last=6

Flags:
  --category=N       eBay category id. Omit for a keyword only sweep.
  --windows=A,B,C    explicit windows as YYYY-MM
  --last=N           the last N complete months, most recent first
  --pair             also emit the same month one year earlier, for year on year
  --marketplace=X    default EBAY-UK
  --country=XX       buyer and seller country, default GB
  --tz=Zone          default Europe/London
  --limit=N          rows per page, default 50
  --slow             pace the output for screen recording
  --record           write a timestamped log to records/

Windows are printed in load order: the most recent first, because the recent
ones are what unlock evergreen and the stock verdict, and both need three
consecutive windows before they mean anything.
"""

import os
import sys
from datetime import datetime
from urllib.parse import quote

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    print("Needs Python 3.9 or later for zoneinfo.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from terapeak.console import (say, rule, set_pace, open_record, close_record,  # noqa: E402
                              record_path, write_record, SAGE, DIM, GOOD, WARN)

BASE = "https://www.ebay.co.uk/sh/research"

# Proven twice as an eBay artefact rather than a market event: elderly read
# 66.70% sell-through in July 2025 and 7.16% the next month, bedding read
# 81.96% and 43.66%, with prices and seller counts stable either side. Two
# unrelated categories, same month, same implausible spike.
#
# Refused rather than warned about, because a window loaded by accident ends up
# in a strips file and is trusted six weeks later by whoever reads it.
POISONED = {"2025-07"}


def parse_window(text):
    """YYYY-MM to a (year, month) pair, or None."""
    parts = text.strip().split("-")
    if len(parts) != 2:
        return None
    try:
        year, month = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not 1 <= month <= 12 or not 2000 <= year <= 2100:
        return None
    return year, month


def bounds(year, month, tz):
    """
    Local midnight on the first of the month, to local midnight on the first of
    the next. Computed in the zone rather than in UTC, so a window spanning a
    clock change keeps both of its real boundaries.
    """
    zone = ZoneInfo(tz)
    start = datetime(year, month, 1, tzinfo=zone)
    nxt = (year + 1, 1) if month == 12 else (year, month + 1)
    end = datetime(nxt[0], nxt[1], 1, tzinfo=zone)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000), start, end


def last_complete_months(count, tz):
    """
    Complete months only. The month in progress has a partial unit total that
    is not comparable with a full one, and it will read as a collapse.
    """
    now = datetime.now(ZoneInfo(tz))
    year, month = now.year, now.month
    out = []
    for _ in range(count):
        month -= 1
        if month == 0:
            year, month = year - 1, 12
        out.append((year, month))
    return out


def build(term, window, opts):
    year, month = window
    start_ms, end_ms, start, end = bounds(year, month, opts["tz"])

    params = [
        ("marketplace", opts["marketplace"]),
        ("keywords", term),
        ("dayRange", "CUSTOM"),
        ("endDate", str(end_ms)),
        ("startDate", str(start_ms)),
    ]
    if opts["category"]:
        params.append(("categoryId", opts["category"]))
    params += [
        ("conditionId", "1000"),
        ("format", "FIXED_PRICE"),
        ("buyerCountry", "BuyerLocation:::" + opts["country"]),
        ("sellerCountry", "SellerLocation:::" + opts["country"]),
        ("offset", "0"),
        ("limit", str(opts["limit"])),
        ("sorting", "-itemssold"),
        ("tabName", "SOLD"),
        ("tz", opts["tz"]),
    ]

    query = "&".join(k + "=" + quote(v, safe="") for k, v in params)
    return BASE + "?" + query, start, end


def main(argv):
    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]

    if not args:
        say(__doc__)
        return 1

    term = args[0]
    opts = {
        "category": None,
        "marketplace": "EBAY-UK",
        "country": "GB",
        "tz": "Europe/London",
        "limit": 50,
    }
    windows = []
    pair = "--pair" in flags

    for flag in flags:
        if flag.startswith("--category="):
            opts["category"] = flag.split("=", 1)[1]
        elif flag.startswith("--marketplace="):
            opts["marketplace"] = flag.split("=", 1)[1]
        elif flag.startswith("--country="):
            opts["country"] = flag.split("=", 1)[1]
        elif flag.startswith("--tz="):
            opts["tz"] = flag.split("=", 1)[1]
        elif flag.startswith("--limit="):
            opts["limit"] = int(flag.split("=", 1)[1])
        elif flag.startswith("--windows="):
            for text in flag.split("=", 1)[1].split(","):
                parsed = parse_window(text)
                if parsed is None:
                    say(WARN("  " + text.strip() + " is not a YYYY-MM window."))
                    return 1
                windows.append(parsed)
        elif flag.startswith("--last="):
            windows.extend(last_complete_months(int(flag.split("=", 1)[1]), opts["tz"]))
        elif flag == "--slow":
            set_pace(0.09)
        elif flag.startswith("--slow="):
            set_pace(float(flag.split("=", 1)[1]))

    if not windows:
        say(WARN("  Need --windows=YYYY-MM,... or --last=N."))
        return 1

    if pair:
        windows += [(y - 1, m) for y, m in windows]

    # Newest first, deduplicated, because the recent windows are the ones that
    # unlock evergreen and the stock verdict.
    windows = sorted(set(windows), reverse=True)

    refused = [w for w in windows if f"{w[0]}-{w[1]:02d}" in POISONED]
    windows = [w for w in windows if f"{w[0]}-{w[1]:02d}" not in POISONED]

    if "--record" in flags:
        os.makedirs("records", exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        open_record(os.path.join("records", "urls_" + stamp + ".txt"))
        write_record("terapeak-url.py\n"
                     + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n"
                     + "term: " + term + "\n")

    rule(term.upper() + ", " + str(len(windows)) + " WINDOWS")
    say(DIM("  " + opts["marketplace"] + ", "
            + ("category " + opts["category"] if opts["category"] else "no category filter")
            + ", New, Fixed price, buyer and seller " + opts["country"] + "."))
    say(DIM("  Boundaries are local midnight in " + opts["tz"] + ", computed in the"))
    say(DIM("  zone, so a window spanning a clock change keeps both of its real ends."))
    say("")

    for window in windows:
        url, start, end = build(term, window, opts)
        label = f"{window[0]}-{window[1]:02d}"
        offset = start.strftime("%z")
        offset_end = end.strftime("%z")
        shift = "  " + WARN("crosses a clock change, " + offset + " to " + offset_end) \
            if offset != offset_end else ""

        say("  " + SAGE(label) + "   "
            + DIM(start.strftime("%d %b %Y") + " to " + end.strftime("%d %b %Y"))
            + shift)
        say("  " + url)
        say("")

    if refused:
        rule("REFUSED")
        for window in refused:
            say("  " + WARN(f"{window[0]}-{window[1]:02d}")
                + DIM("   proven twice as an eBay artefact, not a market event"))
        say(DIM("  Elderly read 66.70% sell-through that month and 7.16% the next."))
        say(DIM("  Bedding read 81.96% and 43.66%. Prices and seller counts flat either side."))
        say("")

    rule("NEXT")
    say(DIM("  Read the strip off the top of each page into"))
    say("  " + GOOD("drops/terapeak/" + term.replace(" ", "_") + "_strips.csv"))
    say(DIM("  then page through for the rows. Three consecutive windows before"))
    say(DIM("  evergreen or the stock verdict means anything."))

    if record_path():
        say("")
        say("  " + GOOD(record_path()) + "   run recorded")
    say("")
    close_record()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
