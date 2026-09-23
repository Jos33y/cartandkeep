"""
Every screen, against real titles, in both directions.

Both directions is the point. A screen that fires on everything carries no
information, which is the same failure as one that fires on nothing, and the
first bulky rewrite this project shipped matched 50 of 50 rows.
"""

import unittest

from terapeak.screens import (band_needs_measuring, band_word, screen,
                              is_powered, shape, postage_band)
from terapeak.tests.corpus import load


class TestScreens(unittest.TestCase):
    def setUp(self):
        self.rows = load("titles.csv")

    def test_corpus_is_not_empty(self):
        self.assertGreater(len(self.rows), 40)

    def test_screens(self):
        for row in self.rows:
            expected = [s for s in row["screens"].split("|") if s]
            with self.subTest(title=row["title"][:52]):
                self.assertEqual(sorted(screen(row["title"])), sorted(expected),
                                 msg=row["note"] or "")

    def test_powered(self):
        for row in self.rows:
            with self.subTest(title=row["title"][:52]):
                self.assertEqual(is_powered(row["title"]), row["powered"] == "yes",
                                 msg=row["note"] or "")

    def test_shape(self):
        for row in self.rows:
            with self.subTest(title=row["title"][:52]):
                self.assertEqual(shape(row["title"]), row["shape"],
                                 msg=row["note"] or "")

    def test_postage_band(self):
        for row in self.rows:
            with self.subTest(title=row["title"][:52]):
                self.assertEqual(postage_band(row["title"]), row["band"],
                                 msg=row["note"] or "")

    def test_screens_fire_on_a_minority(self):
        """
        A screen removing most of a corpus is broken whatever its regex says.
        The corpus is deliberately weighted towards awkward cases, so even here
        clean titles should outnumber screened ones.
        """
        screened = sum(1 for r in self.rows if screen(r["title"]))
        self.assertLess(screened, len(self.rows) * 0.6)

    def test_no_screen_is_dead(self):
        """Every screen name in the corpus must actually be produced."""
        expected = {s for r in self.rows for s in r["screens"].split("|") if s}
        produced = {s for r in self.rows for s in screen(r["title"])}
        self.assertEqual(expected - produced, set())


if __name__ == "__main__":
    unittest.main()


class TestBandBasis(unittest.TestCase):
    """
    The band is a defensible default, not a measurement, and these record which
    it is. Written after `Neck & Shoulder Massager ... Electric Pillow` was
    costed at medium parcel on the word pillow, losing GBP 1.90 of headroom on
    a moulded device that is nothing like a bed pillow.
    """

    def test_ambiguous_word_alone_is_flagged(self):
        self.assertTrue(band_needs_measuring(
            "Neck & Shoulder Massager Heated Deep Tissue Electric Pillow"))
        self.assertEqual(band_word(
            "Neck & Shoulder Massager Heated Deep Tissue Electric Pillow"), "pillow")

    def test_one_certain_word_settles_it(self):
        title = "Super King Duvet Cover Set 15 Tog Filled Pillow"
        self.assertTrue(band_needs_measuring(title) is False)

    def test_small_parcel_is_never_a_measuring_job(self):
        self.assertFalse(band_needs_measuring(
            "Deep Tissue Massage Gun Percussion Cordless 6 Heads"))
        self.assertEqual(band_word("Deep Tissue Massage Gun Percussion Cordless"), "")

    def test_mobility_furniture_is_not_ambiguous(self):
        """
        The first list was mobility vocabulary and flagged 67 of 196 elderly
        rows. A toilet frame and a shower chair are furniture, not devices.
        """
        for title in ("Universal Raised Toilet Seat Frame Stainless Steel",
                      "Rotating Shower Chair Bath Seat Stool Elderly Disabled",
                      "HALF STEP ANTI SLIP ELDERLY DISABILITY DOOR WALKING STOOL",
                      "Electric Riser Recliner Chair Lift Rise Recline"):
            with self.subTest(title=title[:52]):
                self.assertFalse(band_needs_measuring(title))

    def test_the_same_word_on_a_device_still_is(self):
        for title in ("Massage Cushion Full Back Car Home Chair Seat",
                      "Electric Neck Massager Pillow Cervical Traction"):
            with self.subTest(title=title[:52]):
                self.assertTrue(band_needs_measuring(title))

    def test_band_word_reports_every_reason_in_order(self):
        self.assertEqual(
            band_word("HALF STEP ANTI SLIP ELDERLY DISABILITY DOOR WALKING STOOL"),
            "step|stool")

    def test_the_corpus_agrees_with_the_band_it_declares(self):
        for row in load("titles.csv"):
            with self.subTest(title=row["title"][:52]):
                if band_needs_measuring(row["title"]):
                    self.assertEqual(row["band"], "medium_parcel")
