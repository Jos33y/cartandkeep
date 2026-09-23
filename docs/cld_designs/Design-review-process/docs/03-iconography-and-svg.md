# 03 — Iconography & SVG

---

## Verdict

There are no icons anywhere in the storefront. Not one. Search fields have no magnifier, the basket has no mark, accordions have no chevron, the trust bar has no symbols, and delivery states are communicated entirely in prose.

This is the single most visible reason the pages read as unfinished. A shop without iconography looks like a document about a shop.

Two things must not happen in the fix.

1. **Do not hand-draw an icon set.** A bespoke set is 200 hours to do properly and it is where this kind of work most reliably starts looking cheap. Every inconsistency in optical weight, terminal, corner radius and grid alignment will be visible in a row of six.
2. **Do not use thin generic strokes.** 1px on a 24px grid disappears against Archivo at 620 weight and reads as a 2018 SaaS dashboard.

---

## The job

Icons do four jobs in a shop, and only four. Anything else is decoration and should be cut.

1. **Identify a control.** Search, basket, close, filter, sort, menu.
2. **Signal a state.** In stock, low stock, delivered, failed, secure.
3. **Compress a repeated fact.** Free delivery, 30-day returns, UK dispatch, no account needed.
4. **Mark a department.** The one place a shop earns custom drawing.

---

## The recommendation

**Phosphor Icons**, at Regular weight for controls and Fill for states.

Why Phosphor over the alternatives:

- Six weights in one family, so a control icon and a state icon can differ in weight rather than in shape. That is exactly the distinction this shop needs.
- Slightly rounded terminals that sit comfortably beside Archivo's humanist forms. Lucide is excellent but geometrically colder, and it fights the warm cream.
- Genuinely comprehensive commerce coverage.
- MIT licensed, actively maintained, available as SVG, font, React, Vue and web components.

**Lucide** is the correct second choice if the build already has it, or if the team prefers a tighter, more neutral line. Do not run both.

### Sizes

Three sizes, tied to the type scale.

| Size | Weight | Use |
|---|---|---|
| 16px | Regular | Inline with 15px body, chips, table rows |
| 20px | Regular | Controls, nav, form fields |
| 24px | Regular | Primary controls, basket, mobile tab bar |
| 32px | Fill | Trust bar, state markers, empty states |

Never scale an icon to a size not on this list. Never set an icon smaller than 16.

### Rules

- **Icons ride the text baseline**, they do not sit centred in a box beside it. Optical alignment beats mathematical alignment every time.
- **Currentcolor always.** An icon never carries its own colour. It inherits, so it obeys the group colour system automatically.
- **An icon never appears alone in a primary action.** "Add to basket" is a label with an icon, never an icon alone. Icon-only is acceptable for close, and for nothing else on a commerce surface.
- **Never two icons in one control.**
- **Aria-hidden on every decorative icon.** The label carries the meaning.

---

## Where the shop draws its own

Three sets are worth commissioning or drawing. Everything else comes from the family.

### 1. Department marks

Six group marks, one per colour family. Not literal product drawings. Simple geometric constructions in the group colour, at a single stroke weight, that work at 32px and at 400px.

These are the shop's most valuable custom asset. They appear on the homepage shelf, department banners, the mega nav, empty states, packing slips and email headers. Six drawings, used everywhere, forever.

Brief them as **shelf-edge symbols**: what would be silk-screened onto a wooden crate. Not app icons.

### 2. The wordmark and the ampersand

The sage ampersand in the current lockup measures 3.05:1 against cream. That is a real accessibility problem in the primary brand asset and it needs resolving before launch, not after. Either the sage darkens for the logo lockup specifically, or the ampersand takes ink colour and the sage moves elsewhere.

### 3. The delivery progress mark

The free-delivery threshold is the shop's only persuasion device and its most valuable piece of motion. It deserves a drawn mark rather than a generic progress bar: a filling vessel, a loading van, a stacking crate. Something with character that animates well and belongs to this shop only.

---

## SVG technique

The material language in [02 — Craft & Material](02-craft-and-material.md) is largely SVG. Some notes on doing it well.

**Halftone**: `<pattern>` with a circle at a coarse pitch, 6 to 10px, fill in group colour, opacity 0.10 to 0.18. Scale the pitch with viewport rather than the dot size, so it stays coarse on mobile.

**Overprint**: two `<rect>` or `<path>` fills with `mix-blend-mode: multiply`. Works in every current browser. Falls back to plain adjacent colour if blending is unsupported, which is a perfectly acceptable degradation.

**Registration offset**: a duplicate shape translated 2px, painted underneath, in the group colour. Cheaper than a shadow and department-coded.

**Line art**: `vector-effect: non-scaling-stroke` so a mark keeps its weight at every size. This is what stops a department mark going spindly at 400px.

**Optimisation**: run everything through SVGO. Strip the editor metadata, round the path precision to two decimals, remove hidden layers. A shop's icon payload should be under 12KB total.

**Delivery**: inline the six or eight icons that appear above the fold, sprite the rest. Do not load an icon font. Icon fonts break with the reader's font settings, fail silently, and are the reason so many sites show a box glyph in the basket.

**Animation**: `stroke-dasharray` and `stroke-dashoffset` for draw-on. `<animateTransform>` is not worth it, use CSS. Never animate `filter` on an icon, it is expensive and it looks cheap.

---

## The illustration question

At some point somebody will ask for illustration on empty states and the 404. The answer is yes, but with a constraint.

Illustration must come from the **same print language**: two colours maximum, both from the group family, overprint where they meet, no gradients, no characters, no mascots, no rounded-corner 3D blobs.

The correct reference is a 1970s catalogue spot illustration or a European transport pictogram. The wrong reference is any current SaaS illustration library.

If the budget does not stretch to commissioned illustration, use the department marks at large scale with a halftone field behind them. That is a legitimate answer, not a compromise.

---

## Measure

- Count distinct icon sources in the build. It should be exactly one, plus the shop's own marks.
- Count icon sizes in use. Should be four.
- Screen-reader pass: no icon announces itself. Every control announces its label.
- Render the six department marks at 16px and at 400px side by side. If any of them fails at either end, redraw it.

## Study

- Phosphor Icons (phosphoricons.com), Lucide (lucide.dev), Iconoir, Material Symbols. Read all four before committing.
- The Noun Project for breadth of reference when briefing custom marks, not for production assets.
- Otl Aicher's 1972 Munich Olympics pictograms. The reference for a system of marks that share a construction logic.
- AIGA / DOT transport pictograms, for the same reason at a simpler weight.
- SVGO documentation, and Jake Archibald's SVG writings for the mechanics.
- Emil Kowalski (emilkowal.ski) on animating small interface elements without them looking cheap.
- Sarah Drasner's work on SVG animation technique.
