"""
Command line and orchestration. Reads, analyses, reports, writes.
"""

import glob
import os
from datetime import datetime

from . import analyse, report
from .console import say, set_pace, open_record, close_record, record_path, write_record
from .parse import RE_WINDOW, read_window, read_strips, term_of
from .shortlist import write_merged, update_shortlist

USAGE = """
Reads Terapeak sold-listing scrapes across several windows and works out which
products keep selling, which only sell in season, and which are fading.

Identity comes from the eBay item ID in the listing URL, which is stable across
windows. That is what turns four separate scrapes into a history rather than
four unrelated lists.

Files must be named  {term}_{YYYY-MM}.csv  so the window is read from the name:

    drops/terapeak/elderly_2026-06.csv
    drops/terapeak/elderly_2026-07.csv

Strip figures live in {term}_strips.csv, because sell-through and seller count
appear nowhere in the row export and are half the answer:

    window,avg_price,price_min,price_max,avg_postage,free_postage,sell_through,sellers
    2025-08,9.56,0.99,207.67,3.02,94,9.15,1239

Usage:  python scripts/analyse-terapeak.py drops/terapeak/elderly_*.csv
        python scripts/analyse-terapeak.py --slow --record drops/terapeak/elderly_*.csv
"""


def collect_paths(args):
    paths = []
    for arg in args:
        if os.path.isdir(arg):
            paths.extend(sorted(glob.glob(os.path.join(arg, "*.csv"))))
        else:
            paths.extend(sorted(glob.glob(arg)))
    return [p for p in paths if RE_WINDOW.search(os.path.basename(p))]


def main(argv):
    if len(argv) < 2:
        say(USAGE)
        return 1

    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]

    for flag in flags:
        if flag == "--slow":
            set_pace(0.09)
        elif flag.startswith("--slow="):
            set_pace(float(flag.split("=", 1)[1]))

    paths = collect_paths(args)
    if not paths:
        say("No files matching {term}_{YYYY-MM}.csv matched.")
        return 1

    if "--record" in flags:
        os.makedirs("records", exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        open_record(os.path.join("records", "terapeak_" + stamp + ".txt"))
        write_record("analyse-terapeak.py\n"
                     + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n"
                     + "files: " + ", ".join(os.path.basename(p) for p in paths) + "\n")

    by_window = {}
    for path in paths:
        window, rows = read_window(path)
        by_window[window] = rows

    windows = sorted(by_window)
    term = term_of(paths[0])
    latest = windows[-1]

    products = analyse.build_products(by_window)
    patterns = analyse.annotate(products, windows)

    report.windows_summary(term, windows, by_window)
    report.strip_table(term, windows, read_strips(paths))
    report.price_band_table(windows, by_window)
    report.pattern_table(products, patterns)

    evergreen = analyse.evergreen_shortlist(products, patterns, windows)
    report.evergreen_table(evergreen, windows)
    report.screened_evergreen(
        [products[i] for i in patterns.get("evergreen", []) if products[i]["screens"]])

    candidates, near_miss = analyse.find_candidates(products, windows)
    report.listable_table(candidates, latest)
    report.screened_out_table(near_miss, latest)

    stock, slipping, computed = analyse.find_stock(candidates, windows)
    report.stock_table(stock, windows, computed)
    report.slipping_table(slipping)

    # Output belongs next to the data it came from, not in the repo root.
    out_dir = os.environ.get("MERGED_DIR", "drops/merged")
    merged_path = write_merged(out_dir, term, products, windows)
    short_path, existing, added, refreshed, dropped_out = update_shortlist(
        out_dir, term, candidates, stock, products, windows, latest)

    report.dropped_table(dropped_out)
    report.output_summary(merged_path, short_path, products, windows,
                          existing, added, refreshed, record_path())
    close_record()
    return 0
