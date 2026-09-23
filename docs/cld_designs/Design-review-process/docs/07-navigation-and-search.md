# 07 — Navigation & Search

---

## Verdict

The navigation is already failing at eight departments. The chip rail clips "Garden & Patio" with no scroll affordance, and there is no visual hierarchy between a department and a leaf category.

Search does not meaningfully exist.

At 78 products that is survivable. At 200 it is a problem. At 1000, **search is the product**, and everything else on this page is secondary. This is the single largest gap between the current build and a shop that can carry the catalogue it is planning.

---

## The job

Navigation answers "where is the thing I came for" for someone who knows the category. Search answers it for someone who knows the object. In a general store, most people know the object.

That is the important asymmetry. Nobody browsing a general store thinks "I will look through Business, Office & Industrial". They think "drain unblocker" and they type it.

---

## Structure

### Six groups, not twelve departments

Twelve flat items in a nav bar is unusable and eighteen is absurd. The grouping from [01 — Foundations](01-foundations.md) does structural work here, not just colour work.

```
House      Body      Outdoors      Trade      Leisure      Pet
```

Six is navigable, memorable, and fits on one line at 1240 and on a mobile menu without scrolling. Each group opens to two to four departments, each department to its leaf categories.

Three levels, and no more. Group → department → leaf. If a fourth level is needed, the taxonomy is wrong.

### The mega panel

On desktop, a group opens a full-width panel, not a dropdown list.

Contents, in order:
- Departments in the group, each with a count
- The four best-selling leaf categories across the group
- A department mark at large scale in the group colour
- One promoted item: a new arrival or a request prompt

The panel takes the group wash as its background so the colour system does the orientation before any text is read.

Open on hover with a 120ms intent delay. Close on mouse-out with a 300ms grace. Never a click-to-open on desktop, and never a nav that traps the pointer.

### Mobile

A sheet, not a hamburger drawer. Six group rows in group colour, each expanding in place. The back-stack is a genuine navigation stack, so the OS back gesture works.

Bottom tab bar with four items: Shop, Search, Basket, Help. Every target 44px minimum. The basket carries a live count.

---

## Search

### The bar

- Present in the header on every page, not behind an icon that opens a field. At 1000 products, hiding search is a mistake.
- Placeholder states the corpus: "Search 78 products". The number is real and it updates. It tells the user what they are searching before they type.
- Focus with `/` on desktop.
- 44px minimum on mobile.

### Suggestions, as you type

The panel opens on first keystroke and shows four zones in this order:

1. **Products**, three to five, each with a recanvassed thumbnail, written title and price. The thumbnail is essential. Text-only suggestions are a wasted opportunity to sell.
2. **Categories** that match, with counts.
3. **Answers** from the help centre. Someone typing "delivery" wants an answer, not a product. This single behaviour deflects a meaningful share of support email.
4. **Recent searches**, stored locally, no account.

Debounced at 150ms. Results animate in with a stagger capped at eight. The panel never covers the field.

### The engine

Substring matching is not enough. What is required:

- **Typo tolerance.** "screwdrivor", "hoover", "sellotape". A general store's search terms are brand names, misspellings and generic nouns in roughly equal measure.
- **Synonyms.** Hoover means vacuum. Sellotape means tape. Bin bags means refuse sacks. Nappy means diaper. This list is written by hand, from real search logs, and it is one of the highest-value content assets in the shop.
- **Attribute search.** "5 litre sprayer", "size 5 ball". Attributes come from the feed and should be searchable.
- **Zero-result handling.** Never a dead end. Show the nearest matches, the department index, and a prominent "ask us to stock it" form pre-filled with the query. A zero-result search is the most valuable signal the shop generates, because it is a customer telling you exactly what to buy next.

Algolia and Typesense both do all of this out of the box. Typesense is self-hostable and considerably cheaper at this scale. Postgres full-text search with `pg_trgm` is a legitimate starting point at 200 SKUs and will not survive 1000 with typo tolerance.

---

## Craft

- Search suggestions carry the **group colour** of each result as a left rule, so the panel teaches the taxonomy while it answers the query.
- Zero-result state uses a **department mark at scale** with a halftone field, not a sad-face illustration.
- The search field on focus takes a **2px ink border**, not a glow. Print, not screen.
- Category counts in **monospace numerals**, right-aligned. Consistent with the index and the spec table.

---

## Motion

- Panel opens on `--dur-settle` with the field border thickening on `--dur`.
- Results FLIP into position as the query narrows rather than re-rendering. This is the detail that makes search feel instant even when it is not.
- The count animates. "78 products" to "4 answers" should be a transition, not a swap.
- Mega panel drops on `--dur-settle` with a 45ms stagger across its columns.
- Mobile sheet slides on `--dur-large` with `--ease-spring`, dismisses on `--ease-exit` at 60% of the duration.

---

## Copy

**Placeholder**: "Search 78 products". Not "Search...". Not "What are you looking for?"

**Zero results**: "Nothing matches *sellotape*. Try tape, or tell us to stock it." Name the query back. Offer the nearest real thing. Offer the request.

**Group names**: one word each. House, Body, Outdoors, Trade, Leisure, Pet. One word is memorable, plain, and fits every breakpoint.

**Department names** stay long and literal, because they match how suppliers and customers both describe them. "Business, Office & Industrial" is ugly and it is what people search.

**Never** "Explore", "Discover", "Browse our range".

---

## Measure

- **Search usage rate.** In a general store above 30% of sessions using search is normal and healthy.
- **Zero-result rate.** Above 15% means the synonym list is thin. Review the log weekly, it is a shopping list for both the buyer and the copywriter.
- **Search-to-purchase conversion versus browse-to-purchase.** Search users typically convert at two to three times browse users. If they do not, the results are wrong.
- **Nav panel click distribution.** A group nobody opens is a naming problem.
- **Mobile menu depth.** If people are going three levels deep regularly, the search is failing.

## Study

- Baymard Institute on ecommerce search. Their research on autocomplete, synonym handling and zero-result recovery is the most thorough available.
- Algolia and Typesense documentation, particularly on typo tolerance and synonym configuration.
- Nielsen Norman Group on mega menus and hover intent.
- Amazon and eBay search suggestion panels. Both are ugly and both are extremely well researched. Study the information order, not the styling.
- Screwfix search, for how a trade catalogue handles part numbers and generic nouns in the same field.
- GOV.UK on navigation labelling. The plainest naming discipline anywhere.
