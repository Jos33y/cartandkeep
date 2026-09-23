"""
The arithmetic behind every figure she reads.

These numbers decide whether a product is in a batch, so they are checked
against hand arithmetic rather than against themselves.
"""

import unittest

from terapeak.costs import BANDS, affordable_goods, cost_lines, headroom
from terapeak.rules import GATE_ABS


class TestCosts(unittest.TestCase):
    def test_cost_lines_are_itemised(self):
        """
        Kept separate because who pays each line depends on fulfilment. On a
        dropship order the supplier posts it, so the postage line is not hers,
        and a single aggregate cannot be unpicked afterwards.
        """
        lines = cost_lines(18.80)
        self.assertEqual(lines["platform_fee"], round(18.80 * 0.128 + 0.30, 2))
        self.assertEqual(lines["ads"], round(18.80 * 0.06, 2))
        self.assertEqual(lines["postage"], BANDS["small_parcel"])
        self.assertEqual(lines["packaging"], 0.40)

    def test_headroom_matches_hand_arithmetic(self):
        # 18.80 - (2.71 + 1.13 + 3.65 + 0.40)
        self.assertEqual(headroom(18.80, "small_parcel"), 10.91)

    def test_a_worse_band_never_raises_headroom(self):
        for price in (10.43, 12.49, 16.56, 27.92, 50.46):
            with self.subTest(price=price):
                self.assertGreater(headroom(price, "large_letter"),
                                   headroom(price, "small_parcel"))
                self.assertGreater(headroom(price, "small_parcel"),
                                   headroom(price, "medium_parcel"))

    def test_the_band_change_that_moved_the_half_steps(self):
        """
        The half step read £5.11 at small parcel and £3.21 at medium, which is
        the difference between being in a batch and not. It does not post for
        £3.65.
        """
        self.assertGreaterEqual(headroom(11.65, "small_parcel"), GATE_ABS)
        self.assertLess(headroom(11.65, "medium_parcel"), GATE_ABS)

    def test_affordable_goods_uses_the_binding_gate(self):
        """
        The two gates cross at GBP 16. Below it the absolute binds, above it the
        percentage does, and the function must take whichever leaves less rather
        than defaulting to either.
        """
        # 6.21 headroom, gates ask 4.00 and 3.25, so 4.00 binds
        self.assertEqual(affordable_goods(13.00), 2.21)
        # 15.95 headroom, gates ask 4.00 and 6.25, so 6.25 binds
        self.assertEqual(affordable_goods(25.00), 9.70)
        # at the crossing both gates ask 4.00 and the answer is the same either way
        self.assertEqual(affordable_goods(16.00), round(headroom(16.00) - 4.00, 2))

    def test_the_four_products_this_project_has_priced(self):
        """
        One of the four cleared. Measured landed costs, in the same order:
        12.18, 11.83, 11.01, 13.07. The verdict is the market's, not a route's,
        so the bands are the ones the titles actually set.
        """
        self.assertGreater(affordable_goods(43.21, "small_parcel"), 12.18)
        self.assertLess(affordable_goods(18.80, "medium_parcel"), 11.83)
        self.assertLess(affordable_goods(22.00, "medium_parcel"), 11.01)
        self.assertLess(affordable_goods(12.99, "small_parcel"), 13.07)

    def test_a_market_can_afford_less_than_nothing(self):
        """
        Below about GBP 7 the fixed costs exceed what both gates leave. It must
        return the negative rather than clamp, because a zero would read as a
        market that a free unit could serve.
        """
        self.assertLess(affordable_goods(6.00), 0)

    def test_a_worse_band_never_raises_what_the_goods_may_cost(self):
        for price in (10.43, 16.56, 27.92, 50.46):
            with self.subTest(price=price):
                self.assertGreater(affordable_goods(price, "small_parcel"),
                                   affordable_goods(price, "medium_parcel"))

    def test_no_price_gives_no_figure(self):
        """A null must never render as a real figure. Fifth appearance."""
        self.assertIsNone(affordable_goods(None))
        self.assertIsNone(headroom(None))
        self.assertIsNone(headroom(0))
        self.assertIsNone(cost_lines(None))


if __name__ == "__main__":
    unittest.main()
