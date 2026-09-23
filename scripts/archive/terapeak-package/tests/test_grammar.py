"""
The runtime this ships to is Python 3.10.4. This container is 3.12.

Nested same-quote f-strings became legal in 3.12 under PEP 701. Two of them
shipped in one session, parsed here and crashed there, and the second was only
reachable on a rerun so it surfaced days later.
"""

import ast
import os
import pathlib
import re
import unittest

TARGET = (3, 10)
ROOT = pathlib.Path(__file__).resolve().parents[2]

F_DOUBLE = re.compile(r'f"([^"]*)"')
F_SINGLE = re.compile(r"f'([^']*)'")


def sources():
    for path in sorted(ROOT.rglob("*.py")):
        if ".bak" in path.name or "archive" in path.parts:
            continue
        yield path


class TestGrammar(unittest.TestCase):
    def test_every_file_parses_on_the_target_runtime(self):
        for path in sources():
            with self.subTest(path=str(path.relative_to(ROOT))):
                try:
                    ast.parse(path.read_text(encoding="utf-8"),
                              filename=str(path), feature_version=TARGET)
                except SyntaxError as err:
                    self.fail("line " + str(err.lineno) + ": " + str(err.msg))

    def test_no_f_string_contains_its_own_quote(self):
        for path in sources():
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for pattern, quote in ((F_DOUBLE, '"'), (F_SINGLE, "'")):
                    for found in pattern.finditer(line):
                        with self.subTest(path=path.name, line=number):
                            self.assertNotIn(quote, found.group(1))

    def test_no_em_or_en_dashes(self):
        """House rule, and grep before shipping is not a thing that happens."""
        for path in sources():
            text = path.read_text(encoding="utf-8")
            with self.subTest(path=path.name):
                self.assertNotIn("\u2014", text)
                self.assertNotIn("\u2013", text)


if __name__ == "__main__":
    unittest.main()
