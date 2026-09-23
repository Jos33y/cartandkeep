"""
Terminal output. One module owns colour, pacing and the record log so the rest
of the package prints without knowing whether a screen recording is running.

The old file shadowed the builtin `print`, which worked while everything lived
in one module and breaks the moment there are several. `say` is the same thing
with a name that survives the split.
"""

import os
import re
import sys
import time

if os.name == "nt":
    os.system("")

_ANSI = re.compile(r"\033\[[\d;]*m")
_COLOUR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")

_pace = 0.0
_log = None


def set_pace(seconds):
    """Pace the output for screen recording. 0 is full speed."""
    global _pace
    _pace = max(0.0, float(seconds))


def open_record(path):
    global _log
    _log = open(path, "w", encoding="utf-8")
    return _log


def record_path():
    return _log.name if _log else None


def write_record(text):
    if _log:
        _log.write(text)


def close_record():
    global _log
    if _log:
        _log.close()
        _log = None


def say(*args):
    line = " ".join(str(a) for a in args)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()
    if _log:
        _log.write(_ANSI.sub("", line) + "\n")
    if _pace:
        time.sleep(_pace)


def _c(code):
    return (lambda t: "\033[" + code + "m" + str(t) + "\033[0m") if _COLOUR else (lambda t: str(t))


SAGE = _c("38;5;108")
TERRA = _c("38;5;173")
CREAM = _c("38;5;230")
DIM = _c("38;5;244")
BOLD = _c("1")
HEAD = _c("1;38;5;230")
GOOD = _c("38;5;114")
WARN = _c("38;5;179")
BAD = _c("38;5;167")


def rule(title):
    if _pace:
        time.sleep(_pace * 6)
    say("\n" + HEAD(title) + " " + DIM("\u2500" * max(4, 66 - len(title))))


def bar(share, width=20):
    filled = int(round(min(share, 100) / 100 * width))
    return SAGE("\u2588" * filled) + DIM("\u2591" * (width - filled))
