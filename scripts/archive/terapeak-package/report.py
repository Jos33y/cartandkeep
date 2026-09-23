"""
Everything that prints. Nothing here decides anything; it is handed a result
and shows it.

Values are computed into locals before formatting rather than nested inside
f-strings. The runtime this ships to is Python 3.10 and same-quote nesting only
became legal in 3.12, so the flat form is not a style preference.
"""

from .console import (say, rule, bar, SAGE, TERRA, CREAM, DIM, BOLD,
                      GOOD, WARN, BAD)
from .costs import (BANDS, EBAY_PCT, EBAY_FIXED, ADS_PCT, PACKAGING,
                    affordable_goods, headroom)
from .parse import money
from .rules import (GATE_ABS, MIN_HOLD, MIN_RECENT, MIN_WINDOWS_FOR_STOCK,
                    LIST_SHOWN, SCREENED_SHOWN, PATTERN_ORDER,
                    SOURCEABLE_FLOOR)
from .screens import band_needs_measuring, band_word

PATTERN_COLOUR = {
    "single window": DIM,
    "too few windows": DIM,
    "evergreen": GOOD,
    "rising": SAGE,
    "intermittent": WARN,
    "erratic": WARN,
    "new": CREAM,
    "fading": TERRA,
    "gone": BAD,
}

PRICE_BANDS = [(0, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 15),
               (15, 20), (20, 30), (30, 10 ** 6)]


def windows_summary(term, windows, by_window):
    rule(term.upper() + ", " + str(len(windows)) + " WINDOWS")
    say(DIM("  tail is the smallest unit count in the window. Unit totals are"))
    say(DIM("  only comparable between windows scraped to the same tail."))
    for window in windows:
        rows = by_window[window]
        units = sum(r["sold"] for r in rows)
        revenue = sum(r["revenue"] for r in rows)
        wavg = revenue / units if units else 0
        # The scrape tail, printed every run. Comparing units across windows
        # is only meaningful if each window was scraped to the same depth, and
        # that hypothesis has already had to be tested by hand once.
        tail = min((r["sold"] for r in rows), default=0)
        say("  " + CREAM(window)
            + "  " + format(len(rows), ">4") + " listings  "
            + CREAM(format(units, ">6,")) + " units  "
            + "\u00a3" + format(revenue, ">9,.0f") + "  "
            + DIM("avg \u00a3" + format(wavg, ".2f"))
            + DIM("  tail " + format(tail, ">2")))


def strip_table(term, windows, strips):
    if not strips:
        say("\n  " + DIM("No " + term + "_strips.csv found. Sold rate and seller"))
        say("  " + DIM("count are not in the row export, so they are missing here."))
        return

    rule("CATEGORY STRIP")
    say(DIM("  window     avg   charged   free   sold-rate    sellers"))
    for window in windows:
        s = strips.get(window)
        if not s:
            continue
        # A blank sell-through must not print as a zero. It reads as a term
        # where nothing sells rather than one nobody recorded.
        sold_rate = s.get("sell_through") or "-"
        say("  " + CREAM(window)
            + "  \u00a3" + format(s.get("avg_price", ""), ">6")
            + "  \u00a3" + format(s.get("avg_postage", ""), ">6")
            + "  " + format(s.get("free_postage", ""), ">4") + "%  "
            + GOOD(format(sold_rate, ">8")) + "%  "
            + format(s.get("sellers", ""), ">8"))

    say("\n  " + DIM("charged postage excludes free-postage listings, so at "))
    say("  " + DIM("90%+ free it describes a small minority and not the real cost."))
    say("  " + DIM("sold-rate is eBay percentage of similar items that sold, which"))
    say("  " + DIM("is not the same metric as sell-through in the pipeline gates."))

    # Postage is absorbed into the price on almost every sale, so the question
    # is what is left of the average price once it is paid.
    rule("HEADROOM AT CATEGORY AVERAGE")
    say(DIM("  before goods cost, postage absorbed by the seller"))
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
            say("  " + CREAM(window)
                + "  \u00a3" + format(price, ">5.2f")
                + "  " + format(band, "<13") + " "
                + tint("\u00a3" + format(left, ">5.2f") + " left"))


def price_band_table(windows, by_window):
    # This is the category verdict. Volume tells you people are buying; the
    # band tells you whether a UK seller can be one of the sellers.
    rule("WHERE THE SALES SIT, BY PRICE BAND")
    say(DIM("  afford = the most a unit can land at and still clear both gates,"))
    say(DIM("  at the band midpoint, small parcel. Freight included."))

    all_rows = [r for rows in by_window.values() for r in rows]
    grand_units = sum(r["sold"] for r in all_rows) or 1

    header = "".join(format(w[2:], ">9") for w in windows)
    say(DIM("  band        " + header + "     total   share  afford"))

    for low, high in PRICE_BANDS:
        label = ("\u00a3" + str(low) + "-" + str(high)) if high < 10 ** 6 else ("\u00a3" + str(low) + "+")
        per_window = []
        for window in windows:
            per_window.append(sum(r["sold"] for r in by_window[window]
                                  if low <= r["price"] < high))
        total = sum(per_window)
        if not total:
            continue
        share = total / grand_units * 100
        mid = (low + high) / 2 if high < 10 ** 6 else low * 1.3
        afford = affordable_goods(mid)
        tint = GOOD if afford >= SOURCEABLE_FLOOR else (WARN if afford >= 4 else BAD)
        cells = "".join(format(n, ">9,") for n in per_window)
        say("  " + CREAM(format(label, "<10")) + cells
            + "  " + format(total, ">8,") + "  "
            + format(share, ">5.1f") + "%  "
            + tint("\u00a3" + format(afford, ">6.2f")))

    viable_units = sum(r["sold"] for r in all_rows if (headroom(r["price"]) or 0) >= GATE_ABS)
    pct = viable_units / grand_units * 100
    say("\n  " + BOLD("Units at prices that can clear the \u00a34 gate:") + " "
        + GOOD(format(viable_units, ",")) + " of " + format(grand_units, ",")
        + " (" + format(pct, ".1f") + "%)")
    say("  " + DIM("Everything below that line loses money before goods cost."))

    # The gate answers whether a sale is worth making. This answers whether a
    # unit can be bought, which is the question the last four products failed
    # on. Every landed cost measured on this project has been GBP 11 to GBP 13.
    sourceable = sum(r["sold"] for r in all_rows
                     if (affordable_goods(r["price"]) or 0) >= SOURCEABLE_FLOOR)
    s_pct = sourceable / grand_units * 100
    say("  " + BOLD("Units that can afford a \u00a3" + format(SOURCEABLE_FLOOR, ".2f")
                    + " landed unit:") + " "
        + (GOOD if s_pct >= 10 else WARN)(format(sourceable, ","))
        + " of " + format(grand_units, ",")
        + " (" + format(s_pct, ".1f") + "%)")
    say("  " + DIM("Below that line the arithmetic works and no supplier does."))


def pattern_table(products, patterns):
    total_units = sum(e["total"] for e in products.values())

    rule("PATTERN ACROSS WINDOWS")
    for pattern in PATTERN_ORDER:
        ids = patterns.get(pattern)
        if not ids:
            continue
        units = sum(products[i]["total"] for i in ids)
        share = units / total_units * 100 if total_units else 0
        tint = PATTERN_COLOUR.get(pattern, DIM)
        say("  " + tint(format(pattern, "<13")) + " " + bar(share) + " "
            + CREAM(format(share, ">5.1f") + "%") + "  "
            + format(len(ids), ">4") + " products  "
            + format(units, ">6,") + " units")

    say("\n  " + DIM("Absent from a window means outside the scraped top N,"))
    say("  " + DIM("which is not the same as zero sales."))


def evergreen_table(shortlist, windows):
    if len(windows) < 3:
        rule("EVERGREEN, UNSCREENED, BY HEADROOM")
        say(WARN("  Not computed. " + str(len(windows)) + " window loaded, 3 needed."))
        say(DIM("  Evergreen means selling in every window without collapsing."))
        say(DIM("  On one window every product qualifies and the word means nothing."))
        return

    rule("EVERGREEN, UNSCREENED, BY HEADROOM")
    say(DIM("  headroom is what is left before goods cost, at the band the title implies"))

    if not shortlist:
        say(DIM("  Nothing sold in every window and cleared the screens."))

    series_header = " ".join(format(w[2:], ">6") for w in windows)
    say(DIM("   head   price   units  " + series_header + "  title"))

    for entry in shortlist[:25]:
        cells = []
        for w in windows:
            units = entry["series"].get(w)
            cells.append(format(units, ">6") if units else DIM(format("-", ">6")))
        head = entry["headroom"]
        # The GBP 4 absolute gate is the line. Below it the product cannot pay
        # for the picking, packing and support time whatever its volume.
        tint = GOOD if head >= 4 else (WARN if head >= 2 else BAD)
        say("  " + tint("\u00a3" + format(head, ">5.2f"))
            + "  \u00a3" + format(entry["price"], ">6.2f") + "  "
            + CREAM(format(entry["total"], ">5,")) + "  "
            + " ".join(cells) + "  " + entry["title"][:40])

    viable = [e for e in shortlist if (e["headroom"] or 0) >= GATE_ABS]
    say("\n  " + BOLD("Clearing the \u00a34 gate:") + " "
        + GOOD(str(len(viable)) + " of " + str(len(shortlist)))
        + " evergreen products")


def screened_evergreen(removed):
    if not removed:
        return
    rule("EVERGREEN BUT SCREENED OUT")
    for entry in sorted(removed, key=lambda e: -e["total"])[:12]:
        say("  " + DIM(format(entry["total"], ">5,")) + "  "
            + TERRA(format("|".join(entry["screens"]), "<28")) + "  "
            + entry["title"][:44])


def listable_table(candidates, latest):
    rule("LISTABLE")
    say(DIM("  head >= \u00a3" + format(GATE_ABS, ".2f") + " and selling in " + latest + ". "
            + "This is the dropship shortlist: she rules on what can be sourced."))

    if not candidates:
        say(DIM("  Nothing cleared the gate on any route."))

    say(DIM("   head   price   now   mom  sku  pwr  shape  band  routes                title"))
    for entry in candidates[:LIST_SHOWN]:
        mom = format(entry["momentum"], ">4.1f") if entry["momentum"] else DIM("   -")
        tint = WARN if entry["flat_only"] else GOOD
        power = WARN(" uk ") if entry["powered"] else "    "
        shape_cell = entry["shape"] or "-"
        band_cell = "med" if entry["band"] == "medium_parcel" else "sml"
        routes = "+".join(entry["routes"])
        say("  " + GOOD("\u00a3" + format(entry["headroom"], ">5.2f"))
            + "  \u00a3" + format(entry["price"], ">6.2f") + "  "
            + tint(format(entry["recent"], ">4")) + "  "
            + mom + "  " + format(entry["same_sku"], ">3") + " "
            + power + " " + format(shape_cell, "<5") + "  "
            + (WARN(band_cell) if entry["band"] == "medium_parcel" else DIM(band_cell)) + "   "
            + SAGE(format(routes, "<21")) + " "
            + entry["title"][:38])

    amber = [e for e in candidates if e["flat_only"]]
    if amber:
        say("\n  " + WARN("amber head: below the gate at the band its title implies."))
        letter = sum(1 for e in amber if e["bound"] == "large_letter")
        if letter:
            say("  " + DIM(str(letter) + " clear only as a large letter, under 25mm and 750g."))
        parcel = len(amber) - letter
        if parcel:
            say("  " + DIM(str(parcel) + " clear only if they post small parcel, "
                           + "45 x 35 x 16cm and 2kg."))
        say("  " + DIM("Check the real pack size before sourcing any of them."))

    measure = [e for e in candidates if band_needs_measuring(e["title"])]
    if measure:
        say("\n  " + WARN("band set by a word that does two jobs. Measure these."))
        say("  " + DIM("A bed pillow is a medium parcel and a massage pillow is not,"))
        say("  " + DIM("and the title cannot tell them apart. The band stays"))
        say("  " + DIM("conservative until a real pack size says otherwise."))
        for entry in sorted(measure, key=lambda e: -(e["recent"] * (e["headroom"] or 0)))[:6]:
            gain = headroom(entry["price"], "small_parcel") - entry["headroom"]
            say("  " + DIM("\u00a3" + format(entry["headroom"], ">5.2f"))
                + WARN(" +\u00a3" + format(gain, ".2f") + " if small") + "  "
                + DIM(format(band_word(entry["title"]), "<14")) + " "
                + entry["title"][:38])
        if len(measure) > 6:
            say("  " + DIM(str(len(measure) - 6) + " more in the shortlist, "
                           + "column band_measure."))

    powered = [e for e in candidates if e["powered"]]
    if powered:
        say("\n  " + WARN("uk: powered, so it needs a UK supplier who is the importer."))
        say("  " + DIM("Dropshipped from China she becomes the importer and the UK"))
        say("  " + DIM("responsible person. " + str(len(powered)) + " of "
                       + str(len(candidates)) + " rows."))


def screened_out_table(near_miss, latest):
    # Screens are word lists and they get things wrong in both directions, so
    # what they removed has to be visible rather than silently dropped.
    if not near_miss:
        return
    rule("SCREENED OUT BUT WOULD BE LISTABLE")
    say(DIM("  review these: the screen may be wrong"))
    ordered = sorted(near_miss, key=lambda x: -x[0]["series"].get(latest, 0))
    for entry, item_id, price, head in ordered[:SCREENED_SHOWN]:
        say("  " + DIM("\u00a3" + format(head, ">5.2f"))
            + "  \u00a3" + format(price, ">6.2f") + "  "
            + format(entry["series"].get(latest, 0), ">4") + "  "
            + TERRA(format("|".join(entry["screens"]), "<22")) + " "
            + entry["title"][:38])


def stock_table(stock, windows, computed):
    # The listable table answers "could this be sold". This answers "should
    # this be bought", which is a stricter question.
    rule("STOCK CANDIDATES")
    if not computed:
        say(WARN("  Not computed. " + str(len(windows)) + " window loaded, "
                 + str(MIN_WINDOWS_FOR_STOCK) + " needed."))
        say(DIM("  proven and holding both compare a product against its own"))
        say(DIM("  history. With one window there is no history to compare to."))
        return

    say(DIM("  proven across all " + str(len(windows)) + " windows, "
            + str(MIN_RECENT) + "+ units in the latest, holding at "
            + format(MIN_HOLD, ".0%") + "+ of own average"))

    if not stock:
        say(DIM("  Nothing survived. Widen the windows or accept the listable set."))

    say(DIM("   head   price   now  hold   /mo   band   title"))
    for entry in stock:
        per_month = round(sum(entry["series"].values()) / len(windows))
        band = BAD("bulky ") if entry["bulky"] else GOOD("parcel")
        say("  " + GOOD("\u00a3" + format(entry["headroom"], ">5.2f"))
            + "  \u00a3" + format(entry["price"], ">6.2f") + "  "
            + CREAM(format(entry["recent"], ">4")) + "  "
            + format(entry["hold"], ">4.1f") + "  "
            + format(per_month, ">4") + "  " + band + "  "
            + entry["title"][:40])

    if any(e["bulky"] for e in stock):
        say("\n  " + WARN("bulky: headroom assumes a small parcel and is optimistic."))
        say("  " + DIM("Get real dimensions from the supplier before trusting the margin."))


def slipping_table(slipping):
    # These survived every window and cleared headroom, so they are not
    # failures. They are in decline against their own history, which is a
    # finding worth showing rather than a row worth dropping.
    if not slipping:
        return
    rule("PROVEN BUT SLIPPING")
    say(DIM("  below " + format(MIN_HOLD, ".0%") + " of their own average, so not stock candidates"))
    say(DIM("   head   price   now   avg  hold   title"))
    for entry in sorted(slipping, key=lambda e: -e["recent"]):
        say("  " + DIM("\u00a3" + format(entry["headroom"], ">5.2f"))
            + "  \u00a3" + format(entry["price"], ">6.2f") + "  "
            + CREAM(format(entry["recent"], ">4")) + "  "
            + format(entry["window_mean"], ">4") + "  "
            + WARN(format(entry["hold"], ">4.2f")) + "  "
            + entry["title"][:40])


def dropped_table(dropped_out):
    if not dropped_out:
        return
    rule("DROPPED OUT SINCE LAST RUN")
    say(DIM("  qualified on an earlier run for this term, not any more"))
    for row, reason in dropped_out:
        last_seen = row.get("last_seen", "?")
        say("  " + BAD(format(reason, "<18")) + " "
            + DIM("last seen " + last_seen) + "  "
            + row["title"][:44])


def output_summary(merged_path, short_path, products, windows,
                   existing, added, refreshed, record_name):
    rule("OUTPUT")
    say("  " + GOOD(merged_path) + "   " + str(len(products))
        + " products across " + str(len(windows)) + " windows")
    live = sum(1 for r in existing.values() if r.get("status") != "dropped")
    say("  " + GOOD(short_path) + "   " + str(live) + " listable, "
        + str(len(existing) - live) + " dropped, "
        + str(added) + " new this run, " + str(refreshed) + " refreshed")
    if record_name:
        say("  " + GOOD(record_name) + "   run recorded")
    say("")
