"""
Every threshold in the analysis, in one file, because these are the numbers
that get argued about and they should not have to be hunted for.

Nothing here reads a file or prints anything.
"""

# The absolute margin gate. Below this the picking, packing and support time is
# not covered whatever the volume, so it is the line for listability.
GATE_ABS = 4.00

# The percentage margin gate. It has lived as a default inside gates.js and
# nowhere on this side, so the shortlist has been screening on the absolute gate
# alone. The two cross at GBP 16: below that the absolute gate binds, above it
# the percentage gate does, and above GBP 16 the percentage gate is the stricter
# of the two by a widening amount.
GATE_PCT = 0.25

# The most a unit may land at before a market is worth sweeping at all. Not a
# gate and nothing is dropped on it: it is the reading line on the price band
# table, so a term can be judged on whether it can be supplied rather than only
# on whether it sells.
#
# Deliberately below every landed cost this project has measured. The four are
# GBP 12.18, GBP 11.01, GBP 11.83 and GBP 13.07, all on per unit routes from
# China with freight inside them. A UK trade account or a container lowers what
# a unit lands at and this number should be lowered with it, per route, once one
# is proven. It is not evidence about the products.
SOURCEABLE_FLOOR = 8.00

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

# Several sellers listing near-identical titles means a supplier SKU is in
# circulation, so it can be sourced. This is an annotation on a product that
# already sells, never a reason to consider one: a product with four sales and
# forty lookalikes is still a product with four sales.
MIN_SELLERS = 3

# Recent volume against the product's own average across every window. Momentum
# compares two windows and is noisy; this asks whether the product is holding up
# against its own history. Below 0.6 it is halving and should not be stocked.
MIN_HOLD = 0.6

# The terminal is for reading, the CSV is the artefact. Every candidate reaches
# the shortlist whatever this is set to.
LIST_SHOWN = 40
SCREENED_SHOWN = 20


def classify_pattern(series, windows):
    """
    series: {window: units}. Absence means the product was not in the scraped
    top N for that window, which is not the same as zero sales. Stated in the
    output so the distinction survives.
    """
    present = [w for w in windows if series.get(w)]
    if not present:
        return "absent"

    # Under three windows every product is present in every window and its
    # own minimum equals its own maximum, so `evergreen` passes by
    # construction and means nothing. Same fault as the stock verdict on one
    # window, in a different place.
    if len(windows) < MIN_WINDOWS_FOR_STOCK:
        return "single window" if len(windows) == 1 else "too few windows"

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


PATTERN_ORDER = ["evergreen", "rising", "intermittent", "erratic",
                 "new", "fading", "gone", "too few windows", "single window"]
