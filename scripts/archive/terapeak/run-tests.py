#!/usr/bin/env python3
"""
Runs the analysis test suite.

    python scripts/run-tests.py
    python scripts/run-tests.py -v

Stdlib unittest, no dependency to install, runs on the 3.10 runtime this
project actually ships to. Add a case by adding a line to
scripts/terapeak/tests/corpus/titles.csv, not by writing code.
"""

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover(os.path.join(HERE, "terapeak", "tests"), top_level_dir=HERE)
    verbosity = 2 if "-v" in sys.argv else 1
    result = unittest.TextTestRunner(verbosity=verbosity).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
