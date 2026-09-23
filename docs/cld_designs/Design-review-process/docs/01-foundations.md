# 01 — Foundations

Type, colour, elevation, space. The layer everything else inherits from.

---

## Verdict

The token file is better than the pages built on it. That is the headline, and it means the gap is execution rather than direction.

What is genuinely good in the existing system:

- Terracotta reserved so it only ever means "act". That is real discipline and most teams never manage it.
- Gold existing solely so a reduction never has to borrow the action colour.
- Archivo's width axis used as shopfront lettering, once per screen.
- Prices set in the display face with tabular figures rather than a monospace font. Monospace prices read as a database field. This is a considered call and it is the right one.

Three defects, in order of damage.

### 1. The type scale has a hole and a pile-up

Combining both files, the store has: 66, 30, 17, 15, 14, 13, 12, 11.5, 11.

Nothing between 30 and 66. Seven steps inside six pixels at the bottom.

The consequence is that no element can be *moderately* important. There is enormous and there is small. Section heads, PDP titles, card prices and PDP prices all compete for the same narrow band, and the differentiation that does exist lives where the eye cannot resolve it as hierarchy. This is why every page reads flat, and no amount of layout work fixes it.

### 2. No elevation scale

There is no shadow ramp. Every surface is a hairline border on cream, so a product grid reads as a spreadsheet, a modal reads as a box, and nothing has a sense of being nearer or further. Elevation is how a user knows what is a surface, what is floating, and what is temporary.

### 3. Redundant and failing neutrals

- `--c-sunk` (`#f4efe6`) and store `--c-warm` (`#f4efe5`) are one hex apart. One should go.
- `--c-control` and `--c-line-strong` hold the same value under two names.
- `--c-ink-soft` and `--c-ink-faint` sit eight points apart and do not read as separate steps.
- `--c-faint` (`#857d70`) measures **3.77:1** on the base. It fails WCAG AA anywhere below roughly 14px, which is precisely where it is used.

---

## The job

Foundations exist so that a decision is made once and never revisited. If a designer is choosing a font size, the scale has failed. If an engineer is picking a shadow, the ramp has failed.

Every foundation value should answer: *when would I use this, and what would I use instead?*

---

## Type

### The proposed scale

Nine steps, replacing eleven. Three new values in the range where hierarchy is actually read. The bottom four collapse into two.

| px | Role | Face | Notes |
|---|---|---|---|
| 68 | Hero | Archivo, width 118 | Once per page. Never twice. |
| 46 | Department | Archivo, width 112 | **New.** Category heroes, PLP banners, the number that was missing. |
| 30 | Section head | Archivo, width 108 | |
| 28 | PDP price | Archivo, width 100, tabular | **New.** Price is the pitch. It outranks the title. |
| 22 | Subsection | Archivo, width 100 | **New.** FAQ questions, card group titles, clause heads. |
| 19 | Card price / lead | Archivo tabular / Inter | Was 17. Must clearly outrank the 15px title. |
| 18 | Lead paragraph | Inter | |
| 15 | Body, product title | Inter | Merged from 15 and 14. |
| 12 | Leaf category, caption | Inter | Merged from 13, 12, 11.5. |
| 11 | Micro label | Inter, 600, tracked, uppercase | Eyebrows only. Never body. |

### Rules

- **Hero appears once.** A second 68px on a page means one of them is not the hero.
- **Price outranks title on every product surface.** 19 against 15 on a card, 28 against 22 on a PDP. In a general store the price is the proposition.
- **Never set body below 15px.** 12 and 11 are for labels and captions, and both need a weight or a colour to compensate.
- **Measure caps at 66 characters** for any paragraph. Long-form legal can push to 72.
- **Line height** 0.98 to 1.04 at hero sizes, 1.1 at section heads, 1.35 on titles, 1.6 to 1.7 on body.
- **`text-wrap: pretty`** on every paragraph. **`text-wrap: balance`** on every heading.

### The width axis

Archivo's variable width is the single most distinctive asset in the system and it is currently unused. Treat it as shopfront lettering.

- 118 for hero
- 112 for department names
- 108 for section heads
- 100 for everything else
- 88 for compressed labels in tight colour fields

One rule: **width is a size signal, not a decoration.** Wider means larger and more important. Never set a small label in wide Archivo to be interesting.

---

## Colour

### The problem colour has to solve

A general store with eighteen departments and a thousand lines. Colour is wayfinding, not decoration. It answers "where am I" before a single word is read.

Eight distinct hues works. Twelve does not, because the gaps fall below what the eye separates, especially on a 4px rule.

### Six groups, three tones

Colour codes the **group**, never the individual department. Departments take a tone step inside their group. Six groups times three tones covers eighteen departments without inventing a single new colour, and past eighteen the group colour repeats while the name does the work. That is correct: colour tells you which part of the shop you are in, not which shelf.

| Group | Hue | Departments |
|---|---|---|
| House | 70 | Home, Furniture & DIY. Kitchen. Storage. Cleaning. |
| Body | 355 | Health & Beauty. Baby. Daily living aids. |
| Outdoors | 145 | Garden & Patio. Camping. Pest control. |
| Trade | 250 | Vehicle Parts. Business, Office & Industrial. Tools. |
| Leisure | 200 | Sporting Goods. Toys. Media. Stationery. |
| Pet | 300 | Pet Supplies. Aquatics. Wild bird. |

Three tones per hue, all at one chroma so they read as a family:

```
light   oklch(0.62 0.105 H)
mid     oklch(0.55 0.11  H)
deep    oklch(0.48 0.10  H)
wash    oklch(0.955 0.022 H)
```

### The rules that keep the accent working

1. **Group colour only ever appears as a filled field, a tab, a rule or a wash.** It never lands on a control.
2. **Terracotta stays out of the group set entirely.** It means act. Nothing else.
3. **Gold means reduced.** Nothing else.
4. **Any field carrying text below 16px uses the deep tone at 0.48, not the mid at 0.55.** This was measured: white small text on the mid tone lands between 3.0 and 4.0 to one and fails AA on every hue. On deep it clears. This rule is not optional.
5. **Maximum two group colours visible at once** outside the homepage shelf and the index.

### Neutrals to fix

```
--c-faint   #857d70  →  #6f6759   (3.77:1 → passes at 12px)
--c-soft    #736c5d  →  #5f584d
--c-sunk    remove, use --c-warm
--c-control remove, alias --c-line-strong
```

---

## Elevation

Currently absent. Five steps, all warm-tinted rather than neutral black, because a shadow on cream should not read as grey.

```
0   none                                       flat on base
1   0 1px 2px rgba(42,39,35,0.05)             cards at rest
2   0 2px 10px rgba(42,39,35,0.07)            cards on hover, chips
3   0 8px 28px rgba(42,39,35,0.12)            drawers, sticky bars
4   0 10px 40px rgba(42,39,35,0.13)           modals, quick view
5   0 20px 60px rgba(42,39,35,0.18)           nothing yet, reserved
```

Elevation changes only on interaction, and only by one step. A card at rest on 1 goes to 2 on hover. Nothing jumps from 1 to 4.

---

## Space

The existing spacing tokens are sound. The discipline that is missing is at the layout level.

- **One container width**, 1240, and content fills it. The About page leaving half a wide viewport empty is not a spacing bug, it is a layout that was never designed above 900px.
- **Section rhythm**: 112px between major sections on desktop, 72 on tablet, 56 on mobile.
- **No section ends with more than 80px of dead space before the footer.** Where a section is short, it gets a purpose. The "ask us to stock it" band exists for exactly this.
- **Grid**: 4 across desktop, 3 at tablet, 2 on phone. Never 1. A single column at 375 turns 78 products into an endless scroll.
- **Gap over margin.** Sibling groups use flex or grid with `gap`. This survives reordering and deletion in a way that per-element margins do not.

---

## Measure

- Every text colour and size pair passes WCAG AA. Run it as a check, not an opinion.
- No page has a viewport-width column with nothing in it.
- Type scale audit: sample twenty screens, list every distinct font size found. If there are more than nine, the scale is being ignored.

## Study

- Utopia (utopia.fyi) for fluid type and space scales that interpolate rather than step.
- Matthew Butterick, *Practical Typography*, on measure and scale.
- *Refactoring UI*, Wathan & Schoger, on hierarchy through weight and colour rather than size alone.
- OKLCH: oklch.com for the picker, and the Evil Martians write-ups for why perceptual lightness matters when you are building a colour family.
- WebAIM contrast checker, and the WCAG 2.2 understanding docs for 1.4.3 and 1.4.11.
- Shopify Polaris and GOV.UK Design System for how mature systems document a token's *purpose* rather than just its value.
