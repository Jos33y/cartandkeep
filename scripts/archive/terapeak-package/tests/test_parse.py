"""
Reading a scrape, and deciding what counts as one product.

The grouping cases are the expensive lessons: five listings of one raised
toilet seat that three separate matchers failed to group, and a set of duvet
covers whose only difference is the design word, which two matchers fused.
"""

import unittest

from terapeak.parse import (classify_row, group_products, identity_tokens,
                            money, overlap, whole)
from terapeak.tests.corpus import load


def row(item_id, title, price, sold):
    """One scrape row in the awkward shape the export actually produces."""
    return ["preview", "https://www.ebay.co.uk/itm/" + item_id, title,
            "\u00a3" + format(price, ",.2f"), "\u00a30.00", str(sold),
            "\u00a3" + format(price * sold, ",.2f"), "-", title]


class TestParsing(unittest.TestCase):
    def test_money_and_whole(self):
        self.assertEqual(money("\u00a31,234.56"), 1234.56)
        self.assertEqual(whole("1,234"), 1234)
        self.assertIsNone(money("free postage"))
        self.assertIsNone(whole(""))

    def test_classify_row_reads_by_content(self):
        parsed = classify_row(row("196001", "Raised Toilet Seat with Lid", 18.80, 118))
        self.assertEqual(parsed["item_id"], "196001")
        self.assertEqual(parsed["price"], 18.80)
        self.assertEqual(parsed["sold"], 118)

    def test_column_order_does_not_matter(self):
        """
        The export has appeared with 10 and 14 columns, with the url and title
        in different positions. Identifying fields by content rather than
        position is required, not defensive.
        """
        a = row("196002", "Duvet Cover Set Reversible King", 14.28, 245)
        b = [a[0], a[2], a[1]] + a[3:]
        self.assertEqual(classify_row(a), classify_row(b))

    def test_row_without_an_item_id_is_rejected(self):
        self.assertIsNone(classify_row(["preview", "no url", "Title", "\u00a31.00",
                                        "\u00a30.00", "5", "\u00a35.00", "-"]))


class TestIdentity(unittest.TestCase):
    def test_three_letter_product_words_survive(self):
        """
        `lid` decides whether two raised toilet seats are the same product.
        The first matcher dropped every word under four characters.
        """
        for word in ("lid", "bar", "mat", "pad", "tog"):
            with self.subTest(word=word):
                self.assertIn(word, identity_tokens("Duvet " + word + " Cover Set"))

    def test_descriptive_words_are_not_identity(self):
        toks = identity_tokens("Luxury Universal Adjustable Premium Duvet Cover")
        self.assertEqual(toks, {"duvet", "cover"})

    def test_overlap_is_symmetric(self):
        a, b = identity_tokens("Raised Toilet Seat Lid"), identity_tokens("Toilet Seat Riser Lid")
        self.assertEqual(overlap(a, b), overlap(b, a))

    def _pairs(self):
        rows = load("products.csv")
        items = {str(i): r["title"] for i, r in enumerate(rows)}
        expected = {str(i): r["product"] for i, r in enumerate(rows)}
        keys = group_products(items)
        for i in items:
            for j in items:
                if i < j:
                    yield (items[i], items[j],
                           expected[i] == expected[j], keys[i] == keys[j])

    def test_never_merges_two_different_products(self):
        """
        Precision, and it is absolute. Merging two products drops one out of
        her batch entirely, so this must not fail for any reason. Failing to
        merge only shows her the same product twice.
        """
        for a, b, same_expected, same_actual in self._pairs():
            if not same_expected:
                with self.subTest(a=a[:40], b=b[:40]):
                    self.assertFalse(same_actual)

    def test_recall_against_the_corpus(self):
        """
        Recall, measured rather than assumed, so a change that improves it
        fails this test and says so.

        The current miss is a synonym. `Raised Elevated Toilet Seat Aid With
        Lid` and `Raised Toilet Seat with Lid ... Riser` are one product, and
        the matcher sees `elevated` against `riser` as two different words.
        Scoring 0.563 against a 0.62 threshold. Fixing it needs a synonym map,
        which is a mechanism this project does not have and should not gain
        without a way to validate it.
        """
        pairs = [(a, b, exp, act) for a, b, exp, act in self._pairs() if exp]
        caught = sum(1 for *_, act in pairs if act)
        recall = caught / len(pairs)
        missed = [(a, b) for a, b, _, act in pairs if not act]
        self.assertGreaterEqual(
            recall, 0.70,
            "recall fell to " + format(recall, ".2f") + ", missing: "
            + "; ".join(a[:32] + " / " + b[:32] for a, b in missed))

    def test_grouping_cannot_chain(self):
        """
        Union-find fused 206 bedding listings into one product because A
        resembled B and B resembled C. Leader clustering compares against
        leaders only, so a chain cannot form.
        """
        items = {
            "1": "Duvet Cover Set Single Double King Reversible",
            "2": "Duvet Cover Set Single Double King Reversible Floral Print",
            "3": "Floral Print Bedding Pillowcase Pair Cotton",
        }
        keys = group_products(items)
        self.assertNotEqual(keys["1"], keys["3"])

    def test_grouping_depends_on_the_population(self):
        """
        A documented property, not a defect, and worth a test because it is
        surprising.

        Rarity is measured across whatever is in the run. Given only toilet
        seats, the words `toilet` and `seat` appear everywhere, weigh nothing,
        and the products they identify come apart. The same titles inside a
        mixed population group correctly.

        The practical consequence: never judge grouping from a small
        single-category sample, and expect a 40 row term to group differently
        from a 2,000 row one.
        """
        narrow = {
            "1": "Raised Toilet Seat with Lid 4 inch Riser Elderly Disabled Adult",
            "2": "Raised Toilet Seat with Lid 4 inch Riser Elderly Disabled Mobility",
        }
        wide = dict(narrow)
        for i, title in enumerate(load("titles.csv")):
            wide["bg" + str(i)] = title["title"]

        alone = group_products(narrow)
        among = group_products(wide)
        self.assertEqual(len({alone["1"], alone["2"]}), 1)
        self.assertEqual(len({among["1"], among["2"]}), 1)

    def test_grouping_is_deterministic(self):
        rows = load("products.csv")
        items = {str(i): r["title"] for i, r in enumerate(rows)}
        weights = {str(i): len(rows) - i for i in range(len(rows))}
        self.assertEqual(group_products(items, weights), group_products(items, weights))


if __name__ == "__main__":
    unittest.main()


class TestJunkFields(unittest.TestCase):
    """
    `eBay delivery` is a postage service name and it became a product. Thirteen
    characters, and the title picker takes the first value over twelve, so on
    any row where the service sits before the title it wins. It carried GBP
    19.84 of headroom through all seven massage windows.
    """

    def row(self, *fields):
        return classify_row(list(fields))

    def test_postage_service_is_not_a_title(self):
        parsed = self.row(
            "https://www.ebay.co.uk/itm/123456789012",
            "eBay delivery",
            "Deep Tissue Massage Gun Percussion Muscle Massager Cordless",
            "£27.25", "£0.00", "£1,662.25", "61")
        self.assertIsNotNone(parsed)
        self.assertTrue(parsed["title"].startswith("Deep Tissue Massage Gun"))

    def test_a_row_that_is_only_chrome_is_rejected(self):
        self.assertIsNone(self.row(
            "https://www.ebay.co.uk/itm/123456789012",
            "eBay delivery", "£27.25", "£0.00", "£1,662.25", "61"))

    def test_case_does_not_matter(self):
        parsed = self.row(
            "https://www.ebay.co.uk/itm/123456789012",
            "EBAY DELIVERY",
            "Neck Shoulder Massager with Heat Simulated Human Hand Kneading",
            "£20.18", "£0.00", "£383.42", "19")
        self.assertTrue(parsed["title"].startswith("Neck Shoulder"))
