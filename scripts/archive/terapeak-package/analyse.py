"""
The decisions. No file reading, no printing.

Kept apart from `report` so that what a product is judged on can be read in one
place, and so a threshold change can be tested without a terminal.
"""

from collections import defaultdict

from .costs import headroom
from .parse import group_products
from .rules import (GATE_ABS, MIN_LIST, MIN_RECENT, MIN_SELLERS, MIN_HOLD,
                    MIN_WINDOWS_FOR_STOCK, classify_pattern)
from .screens import screen, is_bulky, is_powered, postage_band, shape


def build_products(by_window):
    products = defaultdict(lambda: {"title": None, "series": {}, "prices": {}})
    for window, rows in by_window.items():
        for row in rows:
            entry = products[row["item_id"]]
            # Titles get edited, so keep the most recent rather than the first.
            entry["title"] = row["title"]
            entry["series"][window] = row["sold"]
            entry["prices"][window] = row["price"]
    return dict(products)


def annotate(products, windows):
    """Pattern, screens, totals and lookalike count, on every product."""
    patterns = defaultdict(list)
    for item_id, entry in products.items():
        entry["pattern"] = classify_pattern(entry["series"], windows)
        entry["screens"] = screen(entry["title"])
        entry["powered"] = is_powered(entry["title"])
        entry["bulky"] = is_bulky(entry["title"])
        entry["shape"] = shape(entry["title"])
        entry["band"] = postage_band(entry["title"])
        entry["total"] = sum(entry["series"].values())
        patterns[entry["pattern"]].append(item_id)

    # Product identity, computed once across every product in the run. The old
    # key was a truncated alphabetical word list, so the same seat under two
    # sellers' titles produced two keys and never grouped.
    keys = group_products(
        {i: e["title"] for i, e in products.items()},
        {i: e["total"] for i, e in products.items()},
    )
    sizes = defaultdict(int)
    for key in keys.values():
        sizes[key] += 1
    for item_id, entry in products.items():
        entry["product_key"] = keys[item_id]
        entry["same_sku"] = sizes[keys[item_id]]

    return dict(patterns)


def evergreen_shortlist(products, patterns, windows):
    shortlist = []
    for item_id in patterns.get("evergreen", []):
        entry = products[item_id]
        if entry["screens"]:
            continue
        price = entry["prices"].get(windows[-1]) or list(entry["prices"].values())[-1]
        entry["price"] = price
        entry["headroom"] = headroom(price, entry["band"])
        shortlist.append(entry)
    shortlist.sort(key=lambda e: -(e["headroom"] or 0))
    return shortlist


def find_candidates(products, windows):
    """
    Returns (candidates, near_miss).

    Powered goods are candidates. Being powered constrains where the product
    can be bought, not whether it can be sold, and the supply route is decided
    per product long after this runs. The flag travels with the row.

    near_miss uses the same volume floor as admission. It used to require ten
    units, which meant a screened product selling three a month disappeared
    without ever being shown, on a route whose whole floor is one.
    """
    latest = windows[-1]
    previous = windows[-2] if len(windows) > 1 else None

    candidates = []
    near_miss = []

    for item_id, entry in products.items():
        price = entry["prices"].get(latest) or list(entry["prices"].values())[-1]
        # Charged at the band the title says it posts at, not at a flat rate.
        head = headroom(price, entry["band"])
        # Admission allows exactly one band of optimism against what the title
        # implies, and no more. Missing a flat product is worse than carrying
        # one into vetting, but a super king duvet set is not a 25mm letter and
        # admitting it on that bound is a fiction. The displayed figure stays
        # the conservative one either way.
        bound = "large_letter" if entry["band"] == "small_parcel" else "small_parcel"
        entry["bound"] = bound
        head_flat = headroom(price, bound)
        if not head or head_flat < GATE_ABS:
            continue

        recent = entry["series"].get(latest, 0)

        if entry["screens"]:
            if recent >= MIN_LIST:
                near_miss.append((entry, item_id, price, head))
            continue

        # Selling at all is the entry requirement for the dropship route. The
        # stock floor is applied further down, where it costs something.
        if recent < MIN_LIST:
            continue

        prior = entry["series"].get(previous, 0) if previous else 0
        routes = ["selling"]
        # proven is a claim about history. It requires one.
        if len(windows) >= MIN_WINDOWS_FOR_STOCK and entry["pattern"] == "evergreen":
            routes.append("proven")
        if entry["same_sku"] >= MIN_SELLERS:
            routes.append("sourceable")

        entry.update(item_id=item_id, price=price, headroom=head,
                     flat_only=head < GATE_ABS, recent=recent, routes=routes,
                     momentum=round(recent / prior, 1) if prior else None)
        candidates.append(entry)

    candidates.sort(key=lambda e: -(e["recent"] * (e["headroom"] or 0)))
    return candidates, near_miss


def find_stock(candidates, windows):
    """
    Returns (stock, slipping, computed).

    On fewer than three windows every product is trivially present in every
    window and its hold ratio is its own volume over itself, so both tests pass
    by construction. Printing a verdict there would assert something that was
    never computed, so nothing is returned and the caller says so.
    """
    if len(windows) < MIN_WINDOWS_FOR_STOCK:
        return [], [], False

    latest = windows[-1]
    stock = []
    slipping = []

    for entry in candidates:
        if entry["pattern"] != "evergreen":
            continue
        # The volume floor belongs here, not on admission. Ten a month is what
        # justifies a minimum order and a six week wait, and it says nothing
        # about whether a product is worth a dropship listing.
        if entry["recent"] < MIN_RECENT:
            continue
        volumes = [entry["series"].get(w, 0) for w in windows]
        mean = sum(volumes) / len(volumes)
        # Written whether it passes or not. A blank field cannot be argued
        # with, and the figure that excluded a product is the reason.
        entry["hold"] = round(entry["recent"] / mean, 2) if mean else 0
        entry["window_mean"] = round(mean)
        if entry["hold"] < MIN_HOLD:
            slipping.append(entry)
            continue
        stock.append(entry)

    stock.sort(key=lambda e: -(e["recent"] * e["headroom"]))
    return stock, slipping, True
