#!/usr/bin/env python3
"""
Entry point. The work lives in scripts/terapeak/, so this file stays short
enough to read in one screen.

Usage:  python scripts/analyse-terapeak.py drops/terapeak/elderly_*.csv
        python scripts/analyse-terapeak.py --slow --record drops/terapeak/elderly_*.csv
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from terapeak.run import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(sys.argv))
