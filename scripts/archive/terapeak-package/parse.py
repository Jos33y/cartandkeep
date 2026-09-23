"""
Reading the scrape.

The scrape layout is not stable. Across the files seen so far there were 10 and
14 column variants, with the title repeated and junk fields interleaved, and
item URL and title swapping positions. So every field is identified by what it
holds, never by where it sits. That is not defensive coding, it is required.
"""

import csv
import math
import os
import re

RE_MONEY = re.compile(r"^\u00a3\s*[\d,]+\.\d{2}$")
RE_INT = re.compile(r"^\d[\d,]*$")
RE_ITEM = re.compile(r"/itm/(\d+)")
RE_WINDOW = re.compile(r"_(\d{4}-\d{2})\.csv$", re.I)

# Chrome the export carries alongside the listing. `eBay delivery` is a
# postage service name, thirteen characters long, and the title picker takes
# the first value over twelve, so on any row where it sits before the title it
# becomes the product. It reached the listable list at GBP 19.84 of headroom
# across all seven massage windows and would have gone into her batch as a
# product that does not exist.
#
# Matched case insensitively, because the export is not consistent about it.
JUNK = ("preview", "[object", "sell similar", "item id ",
        "ebay delivery", "ebay international", "royal mail", "click & collect",
        "click and collect", "collection in person", "expedited delivery",
        "standard delivery", "economy delivery", "courier")

# Only words that carry no product information are dropped. Material, form and
# feature words stay, or every stand station in the category collapses into one
# identity and the lookalike count becomes meaningless.
NOISE = {"the", "and", "for", "with", "set", "pack", "new", "uk", "pcs",
         "of", "in", "to", "pet", "dog", "cat", "puppy", "food", "water",
         "bowl", "bowls", "best", "quality", "premium", "free", "sale"}


def money(value):
    try:
        return float(re.sub(r"[\u00a3,\s]", "", str(value)))
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
        if any(j in value.lower() for j in JUNK):
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


def term_of(path):
    return re.sub(r"_\d{4}-\d{2}\.csv$", "", os.path.basename(path))


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
    candidate = os.path.join(folder, term_of(paths[0]) + "_strips.csv")
    if not os.path.exists(candidate):
        return {}
    strips = {}
    with open(candidate, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("window") or "").strip()
            if key:
                strips[key] = {k: (v or "").strip() for k, v in row.items()}
    return strips


# Words that describe rather than identify. `universal`, `adjustable` and
# `luxury` appear on both sides of every near-duplicate pair and carry no
# product information, so they are noise for identity purposes even though
# they are meaningful English.
IDENTITY_NOISE = NOISE | {
    "sets", "best", "quality", "premium", "luxury", "deluxe", "universal",
    "adjustable", "portable", "size", "sizes", "piece", "pieces", "inch",
    "cm", "mm", "pc",

    # Who it is for, not what it is. These matter more than they look.
    # Rarity weighting assumes a rare word is an informative one, and here a
    # rare word is one seller's phrasing: five listings of the same raised
    # toilet seat scored 0.44 to 0.86 against each other purely on whether
    # they said adult, mobility, disabled or elevated.
    "elderly", "disabled", "disability", "mobility", "senior", "seniors",
    "handicap", "handicapped", "infirm", "adult", "adults", "aid", "aids",
    "support", "safety", "care", "home", "indoor", "outdoor",
}

# Above this weighted share of shared words, two titles are the same product.
#
# Set by sweeping 0.55 to 0.70 across both real shortlists and reading recall
# and precision together, after the rarity weighting changed what the number
# means. 0.70 was tuned against unweighted overlap and is too strict now:
#
#     threshold   elderly products   bedding products   largest group
#     0.55                    122                268           21 / 34
#     0.62                    126                300           11 / 24
#     0.70                    136                330           11 / 35
#
# 0.62 groups more and has smaller worst-case groups than 0.70, which reads
# backwards until you remember leader clustering is not monotonic: a stricter
# threshold produces a different set of leaders, and one of them can attract
# more members than any leader at a looser setting.
#
# Precision holds throughout. The floral, gingham, pintuck and Egyptian cotton
# duvet sets stay separate at every threshold tested, which is the failure that
# matters: merging two products hides one from her completely, while failing to
# merge only shows the same product twice.
IDENTITY_THRESHOLD = 0.62


def identity_tokens(title):
    """
    The words that say what a product is.

    The three character floor matters: the previous version dropped every word
    shorter than four letters, so `lid`, `bar`, `mat`, `pad` and `tog` were
    invisible to product identity. A raised toilet seat with a lid and one
    without are different products and read as identical.
    """
    words = re.findall(r"[a-z0-9]+", title.lower())
    return {w for w in words
            if len(w) >= 3 and w not in IDENTITY_NOISE and not w.isdigit()}


def overlap(a, b, weight=None):
    """
    Shared words over total words, with rarer words counting for more.

    Plain Jaccard failed on bedding. Every title carries duvet, cover, quilt,
    bedding, single, double and king, so two listings agreed on seven words
    before either said anything, and the one word that was the actual product,
    floral or gingham or pintuck, could not move the score. 47 different
    designs scored as one.

    Weighting by rarity fixes it without a special case: a word on every
    listing carries almost nothing, and a word on four listings carries a lot.
    """
    if not a or not b:
        return 0.0
    if weight is None:
        return len(a & b) / len(a | b)
    shared = sum(weight.get(w, 1.0) for w in a & b)
    total = sum(weight.get(w, 1.0) for w in a | b)
    return shared / total if total else 0.0


def rarity(token_sets):
    """
    Inverse document frequency across the run. A word on 90% of titles is
    boilerplate for this category; the same word elsewhere may be the product.
    So it is computed per run rather than kept in a list.
    """
    n = len(token_sets) or 1
    counts = {}
    for toks in token_sets:
        for w in toks:
            counts[w] = counts.get(w, 0) + 1
    return {w: math.log(1 + n / c) for w, c in counts.items()}


def fingerprint(title):
    """
    A stable text key for one title. Kept for callers that want a cheap key,
    but product identity is `group_products`, which compares whole token sets.

    Sorting and truncating meant the eight surviving tokens depended on which
    incidental words a seller happened to use, so the same product under two
    titles produced two keys.
    """
    return " ".join(sorted(identity_tokens(title)))


def group_products(items, weights=None):
    """
    items: {item_id: title}. Returns {item_id: product_key}.

    Leader clustering, not transitive closure. Every title is compared against
    group leaders only, never against ordinary members.

    That distinction is the whole design. Union-find chains: A resembles B, B
    resembles C, and on a category where every title reads "Duvet Quilt Cover
    Set Single Double King" it fused 206 listings into one product and would
    have hidden 205 of them. Comparing to a leader cannot chain, because a
    listing that does not resemble the leader starts a group of its own.

    weights: optional {item_id: number}. Leaders are taken in weight order so
    the strongest listing represents the group, and ties fall to the item id so
    the result is the same on every run.
    """
    order = sorted(items, key=lambda i: (-(weights or {}).get(i, 0), i))
    toks = {i: identity_tokens(items[i]) for i in items}
    weight = rarity(list(toks.values()))

    leaders = []
    key_of = {}
    # Leaders are indexed by word so a title is only measured against leaders
    # it could plausibly match, rather than against all of them.
    by_word = {}

    for i in order:
        candidates = {}
        for w in toks[i]:
            for leader in by_word.get(w, ()):
                candidates[leader] = candidates.get(leader, 0) + 1

        best, best_score = None, 0.0
        for leader, shared in candidates.items():
            if shared < 2:
                continue
            score = overlap(toks[i], toks[leader], weight)
            if score > best_score:
                best, best_score = leader, score

        if best is not None and best_score >= IDENTITY_THRESHOLD:
            key_of[i] = best
            continue

        leaders.append(i)
        key_of[i] = i
        for w in toks[i]:
            by_word.setdefault(w, []).append(i)

    return key_of
