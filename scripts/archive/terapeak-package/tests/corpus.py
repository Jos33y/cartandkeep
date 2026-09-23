"""
Loading the labelled corpus.

The corpus is CSV rather than Python so that adding a case is one line in a
file anyone can open, including in Excel. Every row came off a real Terapeak
scrape and every expectation was agreed when the output was read. Nothing here
is invented, which matters: a screen tested against titles I made up tells us
only that the regex does what the regex says.
"""

import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    path = os.path.join(HERE, "corpus", name)
    with open(path, newline="", encoding="utf-8-sig") as handle:
        return [dict(row) for row in csv.DictReader(handle)]
