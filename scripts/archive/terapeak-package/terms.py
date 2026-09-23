"""
Candidate terms, mined from a broad scrape.

`research-process.md` says a term is a hypothesis and its own results are what
confirm or replace it, and that the loop is: run a broad term, read the titles
that are actually selling, take the recurring phrases as the next terms. That
loop has been done by eye. On 2,255 rows it cannot be.

What this counts, and why each column exists:

    listings     distinct eBay item IDs carrying the phrase. Breadth. One
                 seller with forty listings is not a market.
    units        units sold across those listings in the window. Demand.
    clean        units on rows that no screen removed. On a broad beauty
                 sweep most of the volume is cosmetics, so raw units are
                 misleading and this column is the honest one.
    gate         clean units on rows whose price can clear the GBP 4 gate at
                 large letter. This is the number `elderly` won on: 38% of
                 its volume cleared, against 0 to 13% for seven narrow terms.

Ranked on `gate`, because a phrase with volume that cannot clear the gate is a
market she cannot profitably enter, whatever its size.
"""

import re
from collections import defaultdict

from .costs import headroom
from .rules import GATE_ABS
from .screens import screen, shape

# Words that carry no product information, so a phrase built around one is not
# a search term. Material, form and feature words stay: `sponge`, `brush` and
# `applicator` are the answer, not noise.
STOP = {
    "the", "and", "for", "with", "of", "in", "to", "on", "or", "by", "from",
    "uk", "new", "free", "sale", "best", "premium", "quality", "top", "hot",
    "pcs", "pc", "pack", "packs", "piece", "pieces", "x", "size", "sizes",
    "colour", "color", "colours", "colors", "black", "white", "pink", "blue",
    "red", "green", "gold", "silver", "clear", "large", "small", "mini",
    "professional", "pro", "salon", "home", "women", "womens", "men", "mens",
    "girls", "ladies", "lady", "gift", "gifts", "set", "sets", "kit", "kits",
    "us", "eu", "ml", "cm", "mm", "inch", "pack of", "official", "genuine",
}

RE_WORD = re.compile(r"[a-z][a-z0-9'-]*")


def tokens(title):
    words = RE_WORD.findall(title.lower())
    return [w for w in words if len(w) > 2 and w not in STOP]


def phrases(title, sizes=(2, 3)):
    """
    Contiguous n-grams over the tokens that survive the stop list.

    Contiguity is taken over the ORIGINAL word order, so `sponge blender`
    counts only when those words actually sit together. A bag of words would
    invent phrases nobody searches.
    """
    # A stop word breaks the run rather than being skipped over, or
    # `brush for face` would produce the phrase `brush face`, which nobody
    # searches for.
    words = RE_WORD.findall(title.lower())
    out = set()
    run = []
    for word in words:
        if len(word) > 2 and word not in STOP:
            run.append(word)
        else:
            out.update(_grams(run, sizes))
            run = []
    out.update(_grams(run, sizes))
    return out


def _grams(run, sizes):
    found = []
    for size in sizes:
        for i in range(len(run) - size + 1):
            gram = run[i:i + size]
            if any(g.isdigit() for g in gram):
                continue
            found.append(" ".join(gram))
    return found


def vocabulary(rows):
    """
    Every word in the scrape, with the demand attached to it. Nothing dropped.

    This is the first thing to read on a new category. A phrase table already
    assumes the interesting units are pairs, and a screen already assumes the
    vocabulary is known. Neither is true on a category nobody has swept, so
    the raw word list comes first and the judgement comes after.

    `stopped` and `screen` are reported as columns rather than applied as
    filters, so a word that is currently being suppressed is visible next to
    the volume it carries.
    """
    seen = {}
    for row in rows:
        seen.setdefault(row["item_id"], row)

    counts = defaultdict(lambda: {
        "listings": 0, "units": 0, "clean": 0, "gate": 0,
        "prices": [], "screens": defaultdict(int),
    })

    for row in seen.values():
        title = row["title"]
        screens = screen(title)
        head_flat = headroom(row["price"], "large_letter")
        clears = head_flat is not None and head_flat >= GATE_ABS

        for word in set(RE_WORD.findall(title.lower())):
            if len(word) < 2 or word.isdigit():
                continue
            entry = counts[word]
            entry["listings"] += 1
            entry["units"] += row["sold"]
            entry["prices"].append(row["price"])
            if screens:
                for name in screens:
                    entry["screens"][name] += 1
                continue
            entry["clean"] += row["sold"]
            if clears:
                entry["gate"] += row["sold"]

    out = []
    for word, entry in counts.items():
        prices = sorted(entry["prices"])
        top_screen = max(entry["screens"].items(), key=lambda kv: kv[1])[0] \
            if entry["screens"] else ""
        out.append({
            "word": word,
            "listings": entry["listings"],
            "units": entry["units"],
            "clean": entry["clean"],
            "gate": entry["gate"],
            "median_price": prices[len(prices) // 2],
            "stopped": "yes" if word in STOP else "",
            "top_screen": top_screen,
        })

    out.sort(key=lambda e: -e["units"])
    return out


def stopped_words(rows):
    """
    What the stop list removed, and how much demand it was attached to.

    A stop word never reaches a phrase, so a wrong entry here buries a term
    without leaving a trace. `research-process.md` already requires that what a
    screen removes is printed rather than dropped, and the stop list is a
    screen. This is how it gets audited against real titles instead of trusted.
    """
    seen = {}
    for row in rows:
        seen.setdefault(row["item_id"], row)

    counts = defaultdict(lambda: {"units": 0, "listings": 0})
    for row in seen.values():
        for word in set(RE_WORD.findall(row["title"].lower())):
            if word in STOP:
                counts[word]["units"] += row["sold"]
                counts[word]["listings"] += 1

    out = [{"word": w, "units": v["units"], "listings": v["listings"]}
           for w, v in counts.items()]
    out.sort(key=lambda e: -e["units"])
    return out


def mine(rows, min_listings=4):
    """
    rows: the parsed listings from one window.

    Returns a list of dicts, one per phrase, ranked by gate units.
    """
    seen = {}
    for row in rows:
        # One row per item ID. A product appearing twice in a scrape is one
        # product, and counting it twice inflates every phrase it carries.
        seen.setdefault(row["item_id"], row)

    stats = defaultdict(lambda: {
        "listings": set(), "units": 0, "clean": 0, "gate": 0,
        "prices": [], "shapes": defaultdict(int), "screens": defaultdict(int),
    })

    for item_id, row in seen.items():
        title = row["title"]
        screens = screen(title)
        head_flat = headroom(row["price"], "large_letter")
        clears = head_flat is not None and head_flat >= GATE_ABS
        form = shape(title)

        for phrase in phrases(title):
            entry = stats[phrase]
            entry["listings"].add(item_id)
            entry["units"] += row["sold"]
            entry["prices"].append(row["price"])
            if form:
                entry["shapes"][form] += 1
            if screens:
                for name in screens:
                    entry["screens"][name] += 1
                continue
            entry["clean"] += row["sold"]
            if clears:
                entry["gate"] += row["sold"]

    # One title produces every n-gram inside it, so `foundation liquid full
    # coverage matte long lasting` returns twelve phrases describing one
    # product. Phrases covering the identical set of listings are the same
    # finding stated twelve ways, so keep the shortest, which is also the one
    # closest to what a buyer actually types.
    by_coverage = defaultdict(list)
    for phrase, entry in stats.items():
        if len(entry["listings"]) < min_listings:
            continue
        by_coverage[frozenset(entry["listings"])].append(phrase)

    kept = {}
    for phrases_here in by_coverage.values():
        best = sorted(phrases_here, key=lambda p: (len(p.split()), len(p), p))[0]
        kept[best] = len(phrases_here) - 1

    out = []
    for phrase, entry in stats.items():
        count = len(entry["listings"])
        if count < min_listings or phrase not in kept:
            continue
        prices = sorted(entry["prices"])
        median = prices[len(prices) // 2]
        top_screen = max(entry["screens"].items(), key=lambda kv: kv[1])[0] \
            if entry["screens"] else ""
        top_shape = max(entry["shapes"].items(), key=lambda kv: kv[1])[0] \
            if entry["shapes"] else ""
        out.append({
            "phrase": phrase,
            "listings": count,
            "units": entry["units"],
            "clean": entry["clean"],
            "gate": entry["gate"],
            "median_price": median,
            "gate_share": entry["gate"] / entry["units"] if entry["units"] else 0,
            "shape": top_shape,
            "top_screen": top_screen,
            "variants": kept[phrase],
        })

    out.sort(key=lambda e: (-e["gate"], -e["units"]))
    return out
