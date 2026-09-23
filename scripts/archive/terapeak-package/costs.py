"""
What a sale costs before goods. Every figure here is dated and comes from a
tariff or a fee schedule, never from an estimate.
"""

from .rules import GATE_ABS, GATE_PCT

EBAY_PCT = 0.128
EBAY_FIXED = 0.30
ADS_PCT = 0.06
PACKAGING = 0.40

# Royal Mail Tracked 48, April 2026 tariff. Medium parcel was missing for a
# while and the category we are in now is mostly medium: a raised toilet seat
# frame is not a 45x35x16cm box whatever its weight.
BANDS = {"large_letter": 2.85, "small_parcel": 3.65, "medium_parcel": 5.55}


def cost_lines(price, band="small_parcel"):
    """
    The individual costs behind headroom. Kept separate because who pays each
    one depends on how the product is fulfilled: on a dropship order the
    supplier posts it, so the postage line is not hers to pay. A single
    aggregate cannot be unpicked later.
    """
    if not price:
        return None
    return {
        "platform_fee": round(price * EBAY_PCT + EBAY_FIXED, 2),
        "ads": round(price * ADS_PCT, 2),
        "postage": BANDS[band],
        "packaging": PACKAGING,
    }


def headroom(price, band="small_parcel"):
    """
    What is left of the sold price once the seller has paid the platform, the
    ads, the postage and the packaging. Before goods cost. Postage is charged
    to the seller because 90%+ of sales in these categories are free postage.
    """
    lines = cost_lines(price, band)
    if not lines:
        return None
    return round(price - sum(lines.values()), 2)


def affordable_goods(price, band="small_parcel"):
    """
    The most a unit can land at and still clear both gates. Headroom answers
    what is left before goods; this answers what the goods are allowed to cost,
    which is the number a supplier is actually asked about.

    Both gates apply, so the binding one is whichever leaves less: the absolute
    below GBP 16 and the percentage above it. Returns None with no price and can
    return a negative, which means the market cannot pay for a free unit and no
    supply route saves it.

    Returns provision is not in this figure. It is a per-category rate held in
    rate_cards and applied on the margin side, so treat this as the ceiling
    rather than the target.
    """
    head = headroom(price, band)
    if head is None:
        return None
    return round(min(head - GATE_ABS, head - price * GATE_PCT), 2)
