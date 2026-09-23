# 02 — Craft & Material

The layer that separates a theme from a shop. This is the answer to "flat colour looks lazy".

---

## Verdict

The current build has two ingredients: warm cream and one accent. No texture, no illustration, no iconography, no photography worth the name, no depth. Two ingredients is not restraint, it is an unfinished pantry.

But the fix is not gradients, glass, glow or 3D. Those are the 2024 to 2026 house style and they will look dated inside eighteen months. A shop that wants to look expensive in 2032 needs material that was already timeless in 1975.

---

## The thesis

**Print, not screen.**

Cart & Keep is a general store. General stores have a visual history and it is entirely a print history: catalogues, shelf-edge labels, packaging, price stamps, department signage, mail-order indexes. That history is rich, colourful, dense and loud, and none of it looks like a 2026 web trend.

Steal the *production techniques*, not the layouts.

| Web trope to avoid | Print device to use instead |
|---|---|
| Linear gradient background | Riso-style two-colour overprint |
| Soft blurred glow | Halftone dot field |
| Glassmorphic panel | Tinted paper stock with a printed rule |
| Pill badge with icon | Rubber-stamp price mark |
| Drop shadow card float | Registered offset, a 2px colour shift behind the card |
| Skeleton shimmer | Printed placeholder block in the group wash |
| Hero photograph | Department colour field with catalogue numerals |

---

## The devices

Six recurring material devices. Every screen should use at least one and no screen should use more than three.

### 1. Overprint

Two group colours meeting at a shared edge with multiply blending, so the overlap produces a genuine third colour rather than a gradient. Used on department transitions, the homepage shelf, and section dividers.

Why it works: it is unmistakably a printing artefact, so it reads as craft rather than effect. It costs nothing to render. It is impossible to date because it predates the web.

### 2. Halftone

A dot field, coarse rather than fine, in group colour at low opacity. Used as a background field behind hero type, inside empty image frames, and on the department banner.

Coarse is important. A fine halftone reads as noise texture. A coarse one, dots visible at arm's length, reads as newsprint and catalogue.

### 3. Rules and numerals

Hairline and 2px rules, with monospace numerals hung in the margin. The index hero, the terms clauses, the PLP facet counts and the spec table all use this. It is the cheapest way to make a page feel authored rather than generated, and it scales to any content length.

### 4. The stamp

Price, reduction and stock signals set as a stamp: solid block, tight padding, slight optical rotation of half a degree at most, tabular figures. Not a pill. Not a badge with a dot.

One stamp per card, maximum. The stamp is the loudest thing on a card and it should be the price.

### 5. Paper tone

Nothing sits on pure white. The base is cream, the sunk surface is warmer, and product image frames use the group wash rather than white. This single change makes inconsistent supplier cutouts read as deliberate rather than as leftovers.

### 6. Registration

A 2px offset of group colour behind a card or panel, like a mis-registered print run. Used sparingly, on hover and on the featured item in a row. It gives depth without a shadow and it is department-coloured, so it does wayfinding at the same time.

---

## Where each device belongs

| Surface | Devices |
|---|---|
| Homepage hero | Overprint, halftone, numerals |
| Department banner | Halftone, numerals |
| Product card | Paper tone, stamp, registration on hover |
| PLP facets | Rules, numerals |
| PDP gallery | Paper tone, registration |
| PDP spec table | Rules, numerals |
| Basket | Rules, stamp |
| Checkout | Rules only. Checkout is the one place to go quiet. |
| Help centre | Rules, numerals |
| Legal | Rules, numerals |
| Empty states | Halftone, illustration |

Checkout deserves its own note. Every device above is a source of visual noise, and noise at checkout costs money. The material language earns attention on the way in and gets out of the way at the point of payment.

---

## Photography

The material language buys time, but it does not replace photography forever. At 200 SKUs the group colour fields carry the shop. At 1000 they will not.

The order of investment:

1. **Recanvassing every supplier image** so the grid settles. Automated, on import. See [05 — Imagery Pipeline](05-imagery-pipeline.md).
2. **Twenty flat-lay group shots**, one per department, shot on the cream, top-down, natural light. These fill category heroes, editorial bands and email headers. Twenty photographs is a single day of shooting and it changes the entire perceived tier of the shop.
3. **Hero product photography for the top fifty SKUs** by revenue, once the data says which fifty.

Never brief "lifestyle photography" for a general store. Nobody has a lifestyle that includes drain unblocker. Brief **specimen photography**: the object, well lit, on paper, at a consistent scale. That is what Muji, Argos and Screwfix all do, and it is honest about what is being sold.

---

## What is banned

Naming these explicitly so nobody has to litigate them later.

- Aggressive gradient backgrounds, particularly purple to blue.
- Glassmorphism, frosted panels, backdrop blur used decoratively.
- Neon glow, coloured drop shadows, outer glow on text.
- 3D product renders that are not the actual product.
- Emoji anywhere in the interface.
- Rounded container with a left border accent stripe.
- Thin generic stroke icons at 1px on a 24px grid.
- Stock photography of smiling people holding boxes.
- Confetti, celebration animations, anything that infantilises a purchase.
- Countdown timers, fake scarcity, invented was-prices. These are also a promise the About page has already made.

---

## Measure

The honest test for this layer is a squint test and a screenshot test.

- **Squint**: blur the screen. Can you still tell which department you are in, and where the price is? If not, the material is decorative rather than functional.
- **Screenshot**: put the page beside a Shopify Dawn build of the same content. If a reasonable person cannot tell which one cost more, the craft layer has not landed.
- **Date test**: would this screen look wrong in a 2019 portfolio, or a 2031 one? Trend-driven work fails both ends. Print-derived work fails neither.

## Study

- Søstrene Grene and Flying Tiger, in store rather than online. Both use department colour and printed shelf language better than any website does.
- Argos catalogue front sections, archived at the Internet Archive. The index pages are a masterclass in dense navigation without imagery.
- Monoprix own-brand packaging, for colour discipline across an enormous product range.
- Muji signage systems, for restraint that is still warm.
- Screwfix and Toolstation for the UK trade PLP: extremely dense, extremely fast, extremely effective. Ugly, but they convert, and there is a lot to learn from why.
- Risograph printing references. Search "riso overprint" for the colour behaviour, particularly how two spot colours make a third.
- Anthony Burrill and Hatch Show Print for poster-weight typography with no imagery at all.
- *Grid Systems in Graphic Design*, Müller-Brockmann, for the underlying discipline.
