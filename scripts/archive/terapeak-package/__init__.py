"""
Terapeak analysis, split out of a single 916 line script.

    console    colour, pacing, the record log
    parse      reading the scrape, which has no stable column layout
    screens    what cannot be listed, what needs a UK importer, shape and bulk
    costs      fees, postage bands, headroom
    rules      every threshold, and the pattern classifier
    analyse    the decisions
    report     everything that prints
    shortlist  the merged CSV and the accumulating shortlist
    run        command line and orchestration

Entry point is scripts/analyse-terapeak.py, which stays where it was so no
command anyone has written down changes.
"""
