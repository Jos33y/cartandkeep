#!/usr/bin/env python3
"""
Does eBay item ID hold as a product identity across a year?

The pattern block says 794 of 1196 products are new and 5 are evergreen. A
category does not replace two thirds of itself in twelve months, so either the
finding is real or the identity is wrong.

The suspicion: a seller who ends and relists gets a new item ID, so one product
appears as gone in one window and new in the next. If that is happening,
`proven` fails on products that never stopped selling, and the stock tier is an
undercount.

This reads the merged file and changes nothing. Usage:

    python scripts/check-identity.py drops/merged/elderly_merged.csv
"""

import csv
import re
import sys
from collections import defaultdict

# Words that carry no product identity. Removed before matching so "NEW Raised
# Toilet Seat 4 Inch UK Free P&P" and "Raised Toilet Seat 4inch" meet.
NOISE = re.compile(
    r"\b(new|uk|free|fast|ship|shipping|post|postage|p&p|sale|best|top|hot|"
    r"quality|premium|genuine|official|brand|pack|pcs|set|x\d+|\d+x|"
    r"for|the|and|with|by|in|on|of|to|a|an)\b", re.I)

def normalise(title):
    """Lowercase, strip punctuation and noise words, sort the rest.

    Word order varies between relistings more than word choice does, so the
    sorted set of remaining words is a steadier key than the string.

    Digits are split off words, because "4inch" and "4 Inch" are the same
    product written twice, and numbers are then kept rather than dropped by the
    length filter, because a 2 inch and a 4 inch seat are not the same product.
    """
    t = title.lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"(\d)([a-z])", r"\1 \2", t)
    t = re.sub(r"([a-z])(\d)", r"\1 \2", t)
    t = NOISE.sub(" ", t)
    words = sorted(set(w for w in t.split() if len(w) > 2 or w.isdigit()))
    return " ".join(words)

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")))
    if not rows:
        print("Empty file.")
        sys.exit(1)

    windows = sorted(
        k[6:] for k in rows[0] if re.fullmatch(r"units_\d{4}-\d{2}", k))
    print(f"{len(rows)} products, {len(windows)} windows: "
          f"{windows[0]} to {windows[-1]}\n")

    def present(r):
        return [w for w in windows if (r.get(f"units_{w}") or "").strip()
                not in ("", "0")]

    # Group by normalised title. A group holding several item ids that never
    # overlap in a window is the relisting signature.
    groups = defaultdict(list)
    for r in rows:
        groups[normalise(r["title"])].append(r)

    relisted = 0
    recovered = 0
    examples = []

    for key, members in groups.items():
        if len(members) < 2 or not key:
            continue

        spans = [set(present(m)) for m in members]

        # Overlapping means two listings genuinely sold side by side, which is
        # two sellers, not one relisting.
        overlap = any(
            spans[i] & spans[j]
            for i in range(len(spans)) for j in range(i + 1, len(spans)))
        if overlap:
            continue

        union = set().union(*spans)
        relisted += len(members)
        if len(union) == len(windows):
            recovered += 1
            if len(examples) < 12:
                examples.append((members, spans))

    total = len(rows)
    print(f"Products sharing a normalised title with no window overlap: "
          f"{relisted} of {total} ({relisted / total * 100:.0f}%)")
    print(f"Title groups that cover every window once merged: {recovered}")
    print("  Each of these is a product that sold in all "
          f"{len(windows)} windows and failed `proven` on identity alone.\n")

    for members, spans in examples:
        print(f"  {members[0]['title'][:58]}")
        for m, s in zip(members, spans):
            print(f"    {m['item_id']:>14}  {' '.join(sorted(s))}")
        print()

    if not relisted:
        print("No relisting signature found. The item ID holds and the")
        print("pattern block can be read as it stands.")

if __name__ == "__main__":
    main()
