#!/usr/bin/env python3
"""
Mines candidate search terms out of a broad Terapeak scrape.

Run this on the first broad load of a new category, before deciding which
narrow terms are worth a strip. It answers the question the eye cannot answer
on two thousand rows: which recurring phrases carry demand that survives the
screens and can clear the margin gate.

Usage:  python scripts/mine-terms.py drops/terapeak/beauty_2026-07.csv
        python scripts/mine-terms.py --top=60 --min-listings=6 drops/terapeak/beauty_*.csv
        python scripts/mine-terms.py --record --csv drops/terapeak/beauty_2026-07.csv

Flags:
  --top=N            phrase rows shown in the terminal, default 40
  --words=N          vocabulary rows shown in the terminal, default 40
  --min-listings=N   a phrase needs this many distinct item IDs, default 4
  --csv              also write drops/merged/{stem}_terms.csv
  --slow             pace the output for screen recording
  --record           write a timestamped log to records/
"""

import csv
import glob
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from terapeak.console import (say, rule, set_pace, open_record, close_record,  # noqa: E402
                              record_path, write_record, SAGE, CREAM, DIM,
                              BOLD, GOOD, WARN, BAD, TERRA)
from terapeak.parse import classify_row  # noqa: E402
from terapeak.terms import mine, stopped_words, vocabulary  # noqa: E402


def read_rows(path):
    """
    Deliberately does not require {term}_{YYYY-MM}.csv. A mining pass runs on
    whatever came off the browser, before the file has earned a term name.
    """
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for raw in csv.reader(handle):
            if len(raw) < 6:
                continue
            row = classify_row(raw)
            if row:
                rows.append(row)
    return rows


def main(argv):
    if len(argv) < 2:
        say(__doc__)
        return 1

    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]

    top = 40
    words_shown = 40
    min_listings = 4
    write_csv = "--csv" in flags
    for flag in flags:
        if flag.startswith("--top="):
            top = int(flag.split("=", 1)[1])
        elif flag.startswith("--words="):
            words_shown = int(flag.split("=", 1)[1])
        elif flag.startswith("--min-listings="):
            min_listings = int(flag.split("=", 1)[1])
        elif flag == "--slow":
            set_pace(0.09)
        elif flag.startswith("--slow="):
            set_pace(float(flag.split("=", 1)[1]))

    paths = []
    for arg in args:
        if os.path.isdir(arg):
            paths.extend(sorted(glob.glob(os.path.join(arg, "*.csv"))))
        else:
            paths.extend(sorted(glob.glob(arg)))
    paths = [p for p in paths if not p.endswith("_strips.csv")]

    if not paths:
        say("No CSV matched.")
        return 1

    if "--record" in flags:
        os.makedirs("records", exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        open_record(os.path.join("records", "terms_" + stamp + ".txt"))
        write_record("mine-terms.py\n"
                     + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n"
                     + "files: " + ", ".join(os.path.basename(p) for p in paths) + "\n")

    rows = []
    for path in paths:
        rows.extend(read_rows(path))

    stem = os.path.splitext(os.path.basename(paths[0]))[0]
    unique = len({r["item_id"] for r in rows})

    rule("SOURCE")
    say("  " + CREAM(str(len(rows))) + " rows parsed, "
        + CREAM(str(unique)) + " distinct products, across "
        + str(len(paths)) + " file(s)")
    if len(rows) != unique:
        say("  " + DIM("duplicates counted once. A product listed twice is one product."))

    # Words before phrases. On a category nobody has swept, the vocabulary is
    # the map and everything after it is judgement.
    words = vocabulary(rows)
    rule("VOCABULARY")
    say(DIM("  every word in the scrape, nothing removed. " + str(len(words)) + " in total."))
    say(DIM("  stop and screen are shown as columns, not applied as filters."))
    say("")
    say(DIM("   units   gate  lists   med £  stop  screen        word"))
    for entry in words[:words_shown]:
        share = entry["gate"] / entry["units"] if entry["units"] else 0
        tint = GOOD if share >= 0.30 else (WARN if share >= 0.10 else BAD)
        say("  " + CREAM(format(entry["units"], ">6,"))
            + "  " + tint(format(entry["gate"], ">5,"))
            + "  " + format(entry["listings"], ">5")
            + "  " + format(entry["median_price"], ">6.2f")
            + "  " + (WARN(" stop") if entry["stopped"] else "     ")
            + "  " + format(entry["top_screen"] or "", "<12")
            + "  " + entry["word"])
    if len(words) > words_shown:
        say("")
        say("  " + DIM(str(len(words) - words_shown) + " more. Use --words=N or --csv for the full list."))

    results = mine(rows, min_listings=min_listings)

    rule("CANDIDATE TERMS")
    say(DIM("  gate  = units on unscreened rows that can clear the \u00a34 gate"))
    say(DIM("  clean = units on rows no screen removed"))
    say(DIM("  ranked on gate, because volume that cannot clear it is not a market"))
    say("")
    say(DIM("   gate   clean   units  lists   med \u00a3  share  shape  phrase"))

    for entry in results[:top]:
        share = entry["gate_share"] * 100
        tint = GOOD if share >= 30 else (WARN if share >= 10 else BAD)
        say("  " + GOOD(format(entry["gate"], ">5,"))
            + "  " + format(entry["clean"], ">6,")
            + "  " + format(entry["units"], ">6,")
            + "  " + format(entry["listings"], ">5")
            + "  " + format(entry["median_price"], ">6.2f")
            + "  " + tint(format(share, ">5.1f") + "%")
            + "  " + format(entry["shape"] or "-", "<5")
            + "  " + entry["phrase"])

    survivors = [e for e in results if e["gate_share"] >= 0.30 and e["gate"] > 0]
    say("")
    say("  " + BOLD("Phrases clearing 30% of their volume through the gate:")
        + " " + GOOD(str(len(survivors))) + " of " + str(len(results)))
    say("  " + DIM("elderly cleared 38% and was the only term of eight that worked."))

    # What the screens took out is a finding, not a rounding error. On a broad
    # beauty sweep it is most of the category.
    screened = [e for e in results[:top * 2] if e["top_screen"]]
    if screened:
        rule("PHRASES MOSTLY REMOVED BY A SCREEN")
        say(DIM("  these are markets she cannot list in, whatever their volume"))
        for entry in sorted(screened, key=lambda e: -e["units"])[:12]:
            lost = entry["units"] - entry["clean"]
            say("  " + DIM(format(lost, ">6,")) + " units  "
                + TERRA(format(entry["top_screen"], "<12")) + "  "
                + entry["phrase"])

    # Everything a filter removes has to be visible. The stop list is a filter.
    rule("WORDS DROPPED BEFORE PHRASING")
    say(DIM("  these never reach a phrase. If a product-defining word is here,"))
    say(DIM("  take it out of STOP in terapeak/terms.py and run again."))
    say("")
    say(DIM("   units  lists  word"))
    for entry in stopped_words(rows)[:15]:
        say("  " + format(entry["units"], ">6,")
            + "  " + format(entry["listings"], ">5")
            + "  " + WARN(entry["word"]))

    if write_csv:
        out_dir = os.environ.get("MERGED_DIR", "drops/merged")
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, stem + "_terms.csv")
        with open(out, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=[
                "phrase", "listings", "units", "clean", "gate", "gate_share",
                "median_price", "shape", "top_screen", "variants"])
            writer.writeheader()
            for entry in results:
                writer.writerow(entry)
        words_out = os.path.join(out_dir, stem + "_words.csv")
        with open(words_out, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=[
                "word", "listings", "units", "clean", "gate",
                "median_price", "stopped", "top_screen"])
            writer.writeheader()
            for entry in words:
                writer.writerow(entry)

        rule("OUTPUT")
        say("  " + GOOD(words_out) + "   " + str(len(words)) + " words")
        say("  " + GOOD(out) + "   " + str(len(results)) + " phrases")

    if record_path():
        say("  " + GOOD(record_path()) + "   run recorded")
    say("")
    close_record()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
