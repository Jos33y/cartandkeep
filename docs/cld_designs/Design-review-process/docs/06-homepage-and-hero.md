# 06 — Homepage & Hero

---

## Verdict

The homepage hero is the worst thing on the site, and it is worth being precise about why.

It is a bento of supplier cutouts at four different scales, on white, with a flat green panel filling the slot that had no image available. It communicates one thing above everything else: this shop has no photography and no budget.

Below it, the merchandising is visibly automated. Prices read `£119.16`, `£117.24`, `£82.34`, `£82.09`. The "popular" chips are taxonomy strings like "Bath & Body Mixed Items & Gift Sets", which is a database field, not something a person types. Every product carries an identical "Only 5 left" in amber.

The one genuinely good structural idea on the page is "Every department, one scroll". It is underused. The green ask-us-to-stock band is the only moment of life on a very long page and it is underweighted.

---

## The job

A general store homepage has one job and it is not to sell a product. It is to answer, in under three seconds:

**What kind of shop is this, and where is the thing I came for?**

Not "what is on offer". Not "what is new". Argos never opened on a hero product and neither should this. A general store homepage is a directory with personality.

The secondary job is to make the catalogue feel bigger than it is. Seventy-eight products is small. Six departments with clear counts, price ranges and colour identity feels like a shop. A grid of six items feels like a market stall.

---

## Anatomy

In order down the page.

### 1. Announcement bar

One line, one fact. Free delivery over £40. Not a carousel of three rotating messages. Dark ink, cream text, full bleed.

### 2. Header

Wordmark, six group links, search, basket. Sticky on scroll with the group links collapsing to a menu control below 900px. The basket mark carries the count and the count animates.

### 3. Hero

Three directions were built and tested. The recommendation is to use two of them, in different places.

**The Colour Shelf** for the homepage. Six colour fields standing side by side like a shelf wall, group name in wide Archivo, count and price-from underneath. Panels widen on hover to reveal their departments. Built entirely from flat colour, so it costs nothing to render and dates slowly.

This is the loudest and most alive of the three. It also has the highest risk: it needs the rest of the shop to hold the same energy, or it reads as one great screen followed by a different website. That risk is managed by the material language in [02](02-craft-and-material.md), which is what stops the colour fields being *plain* colour fields. Overprint at the panel edges, halftone behind the type, department marks at scale, catalogue numerals.

**The Index** for the department pages and the all-departments page. The whole shop laid out as a numbered index with counts and price-from, no imagery at all. It is the only direction that gets *better* as the catalogue grows to a thousand, and the only one that is honest about having 78 lines today.

**The Price Board** is the third and most distinctive. Price at 34px, image demoted to a 54px square, the hero as a board of what is in the shop today. Hold it until prices are rounded, then use it as a recurring band further down the homepage rather than as the hero itself.

### 4. Trust bar

Four facts, iconography from the family at 32px Fill weight. 30 days to change your mind. No account, ever. Stripe takes the payment. A person answers.

These are the shop's genuine differentiators and they are currently buried on the About page. They belong here, above the first product.

### 5. Department bands

One band per group, in group colour, each showing four products and a link through. Not one enormous grid of everything.

The bands are where the page gets its rhythm. Alternate the treatment: full-bleed colour field, then products on cream, then a wash band, then cream again. Maximum two group colours visible at once.

### 6. The ask band

"Tell us what is missing and we will price it up." Currently the best copy on the site and visually the quietest thing on the page.

Give it a full-bleed band, the sage, and real scale. For a shop with 78 lines heading to 1000, a request mechanism is not a footer link. It is a product.

### 7. Editorial band

One piece of writing, once. Who runs this, why it exists, what it will not do. Links through to About.

This is where the shop's strongest asset, the writing, earns its place on the highest-traffic page.

---

## Craft

The specific answer to "flat colour looks lazy".

- **Overprint at every panel edge.** Where two group colours meet, they multiply. Real third colours, not gradients.
- **Halftone behind hero type**, coarse pitch, group colour.
- **Department marks at large scale**, quarter-bled off the panel edge.
- **Catalogue numerals** in monospace, hung at the top-left of each panel. 01 through 06. It is the single cheapest device that makes a page read as authored.
- **The width axis doing work.** Group names at 88% in the narrow panels and 104% in the widened one, so the type itself responds to the panel.

---

## Motion

The homepage is where expressive motion is most defensible, because the user has not yet formed an intent and there is nothing to interrupt.

- **Panels rise in sequence on load**, 45ms stagger, `--ease-spring`. Width axis expands from 88 to 104 as each lands.
- **Hover widens a panel** to reveal its departments, `--dur-settle`, siblings compress.
- **Tap expands the panel to fill** and carries its colour into the department page. The transition and the wayfinding are the same gesture.
- **The trust bar marks draw on** with `stroke-dashoffset`, once, on first scroll into view.
- **Department bands cross-fade their group colour** as they enter, so the page changes temperature as you scroll.

Under reduced motion all of the above becomes a 120ms fade and nothing else.

---

## Copy

The current homepage copy is doing better than the design. Keep the voice, fix the specifics.

**Hero.** "Pick a cupboard." Six words or fewer. It should sound like a shop, not a brand.

**Subhead.** "Pans, pet beds, floor lamps, drain unblocker. If it belongs in a house it is probably in here somewhere." Concrete nouns, deliberately unglamorous, slightly funny. This is the register.

**Never write** "Discover our curated collection", "Elevate your everyday", "Shop the edit", or any construction where the verb is doing brand work rather than telling somebody what happens when they click.

**Department panels.** Group name, count, price-from. Three facts, no adjectives.

**The eyebrow currently claims eight departments and the footer names six.** Fix the data, not the copy.

---

## Mobile

Most of the orders will come from here, so it is not a reduction of the desktop page.

- Six colour panels in a 2 × 3 grid, each over 118px tall. Large, imprecise, thumb-friendly targets.
- Search directly under the hero headline, not in the header.
- Department bands scroll horizontally with a visible edge, not a carousel with dots.
- The trust bar becomes a two-line stack, not a horizontal scroll.
- The delivery threshold bar is persistent at the bottom once the basket is non-empty.

---

## Measure

- Scroll depth. If under 40% of sessions reach the second department band, the hero is not inviting a scroll.
- Click distribution across the six panels. A panel nobody clicks is a naming problem, not a design problem.
- Search usage from the homepage. High usage means the directory is failing. Some usage is healthy.
- Time to first department page. This is the real homepage metric. A general store homepage that keeps people on it is failing.

## Study

- Argos catalogue front sections, Internet Archive. Numbered index navigation with counts, done to a level no website matches.
- Flying Tiger and Søstrene Grene store layouts, for department colour at scale.
- Monoprix for range coherence.
- John Lewis and Selfridges for department bands with editorial rhythm, though both lean more premium than this shop should.
- Screwfix homepage for the opposite pole: pure density, zero personality, extremely effective. Worth understanding why it works before rejecting it.
- Baymard on homepage and category navigation research.
