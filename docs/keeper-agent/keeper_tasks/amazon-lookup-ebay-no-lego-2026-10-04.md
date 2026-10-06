# Amazon lookup: eBay cards only, no LEGO

4 October 2026. Follows keeper-task-02-amazon-sourcing.md (how the lookup works).

Joseey: 34 cards live on eBay from Cart & Keep, 11 of them LEGO. More eBay cards are wanted; no more LEGO: "since we have 11 listed".
- **What the button looks up:** undecided candidates with a barcode, not looked up before, as now, but only **eBay cards** and never **LEGO**.
  - An eBay card is anything but a store card, or a store card the import also recommended for eBay. That is `candidate_for_ebay`, the same test as `channelsOf` in assess.js and the card's eBay mark.
  - LEGO is LEGO, DUPLO, or a set sold as LEGO-compatible: `candidate_is_lego`, the word anywhere in the card's title, search words, shop page title or brand, eBay listing title or shelf title. "Legoland" is not caught.
- **The count** on Candidates and in the office says "N eBay cards have a barcode… LEGO is left out", from the same pool, so the number and the run agree.
- **Ticked cards** are looked up as she picked them, LEGO or not.
- **The 11 live LEGO listings** are left as they are.
- Tested on Postgres twice: the pool keeps an eBay card and a store card recommended for eBay, and leaves out a LEGO set, a LEGO-compatible set and a shop-only card.
- Deploy: run 0142, then the portal. No functions.
