# Cart & Keep — Design Direction

A working set of audit and direction documents for the storefront. One file per surface. Every file follows the same shape so you can jump into any of them cold.

Written August 2026. Reviewed against the live pages, `tokens.css` and `store-tokens.css`.

---

## How to read these

Each document has the same seven parts.

1. **Verdict** — what is on the page today and why it is not working. Blunt, specific, measured where measurement is possible.
2. **The job** — what this surface is actually for. Almost every design failure in the current build traces back to a page not knowing its job.
3. **Anatomy** — the structure, in order, with the reasoning. Not a component list.
4. **Craft** — imagery, iconography, texture, type. The layer that separates a theme from a shop.
5. **Motion** — what moves, why, and what breaks if it does not.
6. **Copy** — real lines, not placeholders. Patterns you can apply to a thousand products.
7. **Measure** — how you know it worked, and the study list for going further.

## What these documents are not

They are not a specification. They are not component contracts, class names, or props. Nothing here tells you how to build it.

They are a baseline and a standard. Where you see a better answer than the one written down, take it. The only thing that is not negotiable is the standard: nothing ships that is plain, inert, or confusing.

## The single idea underneath all of it

**Cart & Keep is a general store, and general stores are built from print.**

Not DTC minimalism. Not glassy 2020s SaaS. Not the current AI-gradient look, which is already dating. The reference class is the printed catalogue and the shop floor: Argos front sections, Monoprix packaging, Søstrene Grene shelf edges, Flying Tiger department colour, Muji signage, Screwfix trade density.

That gives us a material language that is rich without being trendy:

- Overprint and halftone rather than gradients
- Ruled lines and numerals rather than floating cards
- Price stamps and department stickers rather than pill badges
- Paper tone rather than white
- Drawn iconography with real weight rather than thin generic strokes

This is the answer to "flat colour looks lazy". The problem was never colour. It was colour with no material on top of it.

---

## The files

| | File | Covers |
|---|---|---|
| 01 | [Foundations](01-foundations.md) | Type scale, colour system, elevation, spacing, the audit of the existing tokens |
| 02 | [Craft & Material](02-craft-and-material.md) | Texture, overprint, halftone, print devices, the anti-plain doctrine |
| 03 | [Iconography & SVG](03-iconography-and-svg.md) | Icon family, custom marks, illustration, SVG technique |
| 04 | [Motion System](04-motion-system.md) | Tokens, curves, choreography, the six that pay for themselves |
| 05 | [Imagery Pipeline](05-imagery-pipeline.md) | Recanvassing, rejection rules, treatments, scaling to 1000 SKUs |
| 06 | [Homepage & Hero](06-homepage-and-hero.md) | The three directions, the shelf, seasonal rotation |
| 07 | [Navigation & Search](07-navigation-and-search.md) | Six groups, mega nav, search as the real product |
| 08 | [PLP](08-plp.md) | Department pages, facets, the card, density, 50 to 1000 products |
| 09 | [PDP](09-pdp.md) | Structured attributes, gallery, trust, cross-sell |
| 10 | [Quick View](10-quick-view.md) | The modal, and when not to use one |
| 11 | [Basket](11-basket.md) | Drawer, page, threshold mechanics, recovery |
| 12 | [Checkout](12-checkout.md) | Guest flow, forms, payment, failure |
| 13 | [Post-purchase](13-post-purchase.md) | Confirmation, tracking, returns, the retention surface nobody designs |
| 14 | [Help & Legal](14-help-and-legal.md) | Help centre, reference set, two templates not five |
| 15 | [States](15-states.md) | Empty, loading, error, offline, out of stock |
| 16 | [Voice & Content](16-voice-and-content.md) | Writing rules, product titles at scale, microcopy library |
| 17 | [Accessibility & Performance](17-accessibility-and-performance.md) | WCAG 2.2, Core Web Vitals, budgets |
| 18 | [Measurement](18-measurement.md) | Instrumentation, what to log, how to argue with data |
| 19 | [References](19-references.md) | Every source, tool and study list in one place |

---

## The standing audit

The condensed version, so nobody has to read all nineteen files to know what is wrong.

**Structural**
- Five pages share one template. Two of them are legal documents and three are not.
- No repeating grid device. Each page invents its own layout, so wide viewports get abandoned columns.
- Type scale has a 36px hole between 30 and 66, and seven steps crammed into a six-pixel band at the bottom. That is the mechanical reason every page reads flat.

**Merchandising**
- Prices are cost-plus-margin outputs. `£119.16`, `£82.09`, `£117.24`. No shop prices like that.
- Product titles are supplier keyword strings with pipes, missing spaces and American spellings.
- Product images are inconsistent in background, crop, scale and embedded text.
- Category chips are taxonomy strings, not language.

**Conversion**
- No facets, no working search, no pagination. At 50 products the PLP is a wall.
- One spec row on the PDP where there should be a structured attribute table.
- Three equal-weight primary buttons on Contact.
- Uniform "Only 5 left" on every product, which contradicts the shop's own anti-dark-pattern promise.

**Craft**
- No motion at all, despite `--dur` and `--dur-settle` being declared in the tokens.
- No iconography of any kind.
- No elevation scale, so every surface is a hairline border.
- Hero imagery is a supplier cutout enlarged past its resolution.

**Trust**
- Placeholder text still on live pages.
- Eyebrow says eight departments, footer names six.
- `--c-faint` fails WCAG AA at the sizes it is used at.

None of this is fatal. All of it is fixable without a rebuild.
