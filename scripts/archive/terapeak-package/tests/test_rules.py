"""
Thresholds and the pattern classifier.

The refusals matter more than the verdicts here. Three separate times this
project printed a verdict on one window that every product passed by
construction, and each time it reached the portal before anyone noticed.
"""

import unittest

from terapeak.rules import MIN_WINDOWS_FOR_STOCK, classify_pattern


class TestPattern(unittest.TestCase):
    def test_one_window_refuses_rather_than_asserting(self):
        """
        On a single window every product is present in every window and its own
        minimum equals its own maximum, so evergreen passes for everything and
        means nothing.
        """
        self.assertEqual(classify_pattern({"2026-07": 100}, ["2026-07"]), "single window")

    def test_two_windows_still_refuse(self):
        windows = ["2026-06", "2026-07"]
        self.assertEqual(classify_pattern({"2026-06": 50, "2026-07": 60}, windows),
                         "too few windows")

    def test_three_windows_are_enough_to_judge(self):
        windows = ["2026-05", "2026-06", "2026-07"]
        self.assertEqual(classify_pattern({w: 100 for w in windows}, windows), "evergreen")
        self.assertEqual(MIN_WINDOWS_FOR_STOCK, 3)

    def test_evergreen_requires_not_collapsing(self):
        windows = ["2026-05", "2026-06", "2026-07"]
        steady = {"2026-05": 100, "2026-06": 90, "2026-07": 80}
        collapsed = {"2026-05": 100, "2026-06": 90, "2026-07": 5}
        self.assertEqual(classify_pattern(steady, windows), "evergreen")
        self.assertEqual(classify_pattern(collapsed, windows), "erratic")

    def test_absent_early_is_new_and_absent_late_is_gone(self):
        windows = ["2026-05", "2026-06", "2026-07"]
        self.assertEqual(classify_pattern({"2026-07": 40}, windows), "new")
        self.assertEqual(classify_pattern({"2026-05": 40}, windows), "gone")

    def test_no_sales_anywhere_is_absent(self):
        self.assertEqual(classify_pattern({}, ["2026-05", "2026-06", "2026-07"]), "absent")


if __name__ == "__main__":
    unittest.main()
