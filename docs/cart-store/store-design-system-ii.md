# Store Design System, Volume II

Brand, components, motion and commerce.

**Read `store-design-system.md` first.** That volume sets the direction: a
general store that is not embarrassed about it, breadth as the feature, the
shelf as the signature, guest checkout, no portal furniture. Nothing here
changes any of it.

This volume is what the approved mock actually specifies, written down so it
can be built twice the same way. The reference build is
`mock/store-home-mock.html`. Where this document and the mock disagree, the
mock is wrong and this is right, because the mock was drawn to be looked at
and this was written to be shipped.

---

## 1. The mark

A shopping basket with the ampersand inside it. The ampersand is not
decoration: it is the middle word of the name, sitting in the thing the shop
does. A tick would have been a generic confirmation glyph in a basket and it
said nothing.

**Construction.** 30 by 30 unit box. Basket body from a 20 unit rule at y 10.5
tapering to 16 units at the base, corners at 2 units. Handle is a semicircle of
radius 4.4 rising 2.3 units above the rim. Stroke 1.7 on the body, 1.9 on the
handle so it holds at small sizes. Ampersand centred on x 15, baseline y 22, set
in Archivo at 700.

**Colour.** Body in ink, handle in sage, ampersand in ink. Terracotta stays out
of the mark entirely, because terracotta means the buy action and a colour that
appears in the logo cannot also mean one specific thing on a page.

**Sizes and which version.**

```
16, 24        favicon and tab. Solid basket, ampersand knocked out
32 to 48      header, app icon. Outline basket
64 and up     outline basket, full detail
app tile      sage tile, radius 22 percent, mark knocked out in base
```

**Lockup.** Mark, then a gap of one basket width, then the wordmark in Archivo
at width 112, weight 640, tracking minus 0.025em. The ampersand inside the
wordmark is set in sage so the mark and the name rhyme.

**Clear space** on all four sides is the width of the basket. Never place the
mark on a photograph. Never recolour it. Never stretch the lockup.

**Before shipping**, the ampersand is converted from live text to a path. As
text it depends on Archivo having loaded, which means the logo flashes wrong on
a slow connection, and the logo is the one thing that must never do that.

---

## 2. Icons

A single hand-drawn stroke set, not a library. A library brings 900 icons in
somebody else's drawing style and the twelve we need would fight the mark.

```
grid          24 by 24
stroke        1.7, round cap, round join
fill          none, except a star at 12px which is solid
colour        currentColor, always
sizes         16 inline, 20 in controls, 24 decorative, no other value
```

The set: search, basket, heart, van, return arrow, padlock, shield with tick,
star, plus, chevron right, chevron down, close, menu, minus, filter, instagram,
tiktok, mail.

**Rules.** An icon never appears without a label unless it is in a control with
an `aria-label`. No icon in body copy. No icon on the delivery and returns
sentences on a product page, which is where icon rows go to make a shop look
like a template.

---

## 3. Payment marks

These are trademarks and they are the one part of the interface I do not draw.

**Download the real files.** Visa publishes the brand mark as SVG at
`brand.visa.com`, and standard assets need no login. Mastercard publishes SVG
at `mastercard.com/brandcenter/us/en/download-artwork.html`, and their terms
state the artwork may not be modified or redistributed except for the purposes
set out there. Stripe publishes its own marks in its brand assets pages.

**Rules that follow from those terms.** The files are served as static assets
from `public/payment/`, never inlined and never edited. No recolouring to fit
the palette, no monochrome versions, no proportion changes. Each sits in a 38
by 24 box on white with a 1px `--line` border and radius 5, which is a neutral
frame rather than an alteration.

**What appears where.**

```
footer strip    Visa, Mastercard, Amex, Apple Pay, Klarna
checkout        the same, plus Powered by Stripe beneath the pay button
product page    nothing. Payment marks near a price look like a warning
```

The mock uses text pills in place of these. That is scaffolding and it is the
first thing to replace.

---

## 4. Tokens added since volume I

```
--warm          #F4EFE5   shelf panel, image frame, hover fill
--ink-deep      #1E1C19   announcement bar, footer, tile overlay
--sage-deep     #5E7359   category tile wash, app tile
--sage-wash     #EEF2EC   focus ring, quiet flag
--gold          #B08430   a price reduction, nothing else
--terra-wash    #FAEEE9   
--line-mid      #D6CAB5   hover border
--faint         #857D70   metadata
--r             14px      cards, tiles, panels
--r-sm          9px       controls, buttons inside cards
```

Radius went up from the portal's 6px. A 14px corner reads retail, a 6px corner
reads software, and this surface is retail.

---

## 5. Components

Every one of these exists in the mock. Dimensions are what it uses.

**Announcement bar.** 38px, ink-deep, 12.5px text, three claims separated by
3px dots. Free delivery threshold first because it is the one that changes
basket size. Never a countdown, never a discount code.

**Header.** 70px, translucent base with a 12px backdrop blur, hairline appears
only after 10px of scroll. Logo, five department links, then search, saved and
basket at 42px circular targets. The basket carries a count pip in terracotta
at 17px. **No account link.**

**Hero.** Two columns at 1.02 to 0.98. Left: eyebrow, a four line statement at
`clamp(2.5rem, 5.4vw, 4.15rem)` with the last two lines in terracotta text, a
sentence, then the search field. Right: three overlapping product photographs
that shift on hover, and two floating tags.

**Search.** A pill, 430px maximum, 44px tall, terracotta submit. Focus lifts a
4px sage-wash ring. Four suggestion chips beneath it.

This is the most important control on the site. Keyword matching converts at
about 1.8 per cent and search that understands intent converts at about 8.4
per cent, and on a catalogue where nobody can guess what is stocked, the
difference is the business.

**Trust strip.** Four columns, warm ground, rules top and bottom. Icon at 21px
in sage-deep, a claim at 13.5px, a qualifier at 12.5px. Delivery, returns,
guest checkout, Stripe. Every claim is checkable.

**Category tile.** 5 by 3.4, radius 14, photograph at 62 per cent opacity over
sage-deep with a dark gradient from the foot. Name in Archivo at width 108, the
count beneath in tabular figures. Hover scales the photograph to 1.07 and lifts
opacity to 0.72.

**Shelf.** 212px fixed panel, then the rail. Panel is warm with a hairline,
carries the name at 23px, the count and cheapest price, and a link with a sage
underline. The rail is `scroll-snap-type: x mandatory` with cards at a fixed
205px. Scrollbar hidden, momentum native.

**Product card.** Square photograph, `object-fit: cover`, no padding, no float.
Leaf category at 11.5px, name clamped to two lines at 14px, an optional star
line, price in Archivo at 17px tabular. Hover lifts the card 3px, scales the
photograph to 1.045, fades in a save button and an add to basket bar. A flag
sits top left: sage for New in, gold for a reduction.

**Add to basket.** Terracotta, 38px, appears on hover on desktop and is always
visible on touch. On click the label becomes Added, the header pip increments,
and it reverts after 1.1 seconds. Optimistic: the count moves before the server
answers and rolls back if it fails.

**Promise band.** Sage-deep, radius 14, two columns. A statement, a sentence,
and an email field. One email a week at most, stated.

**Footer.** Ink-deep. Four columns at 1.5, 1, 1, 1. Mark and a sentence and
three social links; then Shop, Help, About. A bottom rule carries the year, the
support address and the payment marks. Six or seven links per column, which is
enough to be useful and short enough to scan.

---

## 6. Motion

```
header hairline      opacity, 200ms
tile hover           image scale 1.07, 500ms, ease
card hover           lift 3px + image 1.045, 220ms and 500ms
add to basket        fade and rise 6px, 200ms
collage hover        three figures shift 3 to 6px on different axes, 450ms
rail                 native momentum, snap to card start
page change          View Transitions API, 180ms
count pip            scale 1.25 then back, 260ms, on increment
```

`--ease` is `cubic-bezier(.22,.61,.36,1)` throughout. One curve.

`prefers-reduced-motion` removes every one of them, not shortens them. The mock
does this in a single rule and so should the build.

No skeleton shimmer. A tile that is loading is the warm colour with nothing in
it.

---

## 7. Images

Her photographs come off eBay at 300px JPEG, which is the largest single
quality problem on the store and it is not a design problem.

```
request      s-l500 minimum, s-l1600 for a product page gallery
serve        AVIF then WebP then JPEG, srcset at 1x and 2x
size         square, cover, centre
lazy         everything below the first shelf
placeholder  --warm, no shimmer, no blur-up
alt          empty on a card, because the title beside it is the label
```

A product page needs images she owns rather than a supplier's 300px feed shot.
That is a conversation with her, not a build task.

---

## 8. The funnel

The six things that separate stores converting at 5 to 8 per cent from the 2.3
per cent average, and where each one lives here.

```
search that understands intent   hero, header, and a command palette later
persistent basket                header pip, survives a reload
social proof under the buy       product page, beneath the button, not above
mobile checkout in two taps      sticky buy bar, then one page
honest stock signals             In stock, Last few. Never a fake counter
returns as risk reversal         trust strip, product page, footer
```

The 2026 baseline everything is measured against: primary actions reachable
one-handed, compressed images, under two seconds to interactive.

**Never.** Countdown timers. Fake stock counts. Arrival popups. Exit intent
overlays. Recently viewed by 43 people. Chat bubbles. Trust badge clusters. An
account wall. All of them convert once and cost the second visit, and she is
selling to a diaspora community where the second visit is the whole business.

---

## 9. Build order

Each step leaves the store working.

```
1  tokens, Archivo, the mark, the icon set
2  header, footer, announcement bar          the shell, on every page
3  product card and grid                     the unit everything reuses
4  category tile, shelf                      the signature
5  home                                      hero, trust, tiles, shelves
6  category page                             breadcrumb, title, grid
7  product page                              gallery, sticky buy, delivery
8  basket, guest checkout, confirmation      Stripe, no account
9  search                                    last, because it needs stock in it
```

Steps 1 to 5 are what she sees this week. Steps 6 to 8 are what makes it a shop
rather than a catalogue. Step 9 is what makes it convert.

---

## 10. What volume I said that still stands

Repeated because they are the ones most likely to be lost in a rebuild.

Breadth is the feature. The shelf is the signature. Prices are not mono.
Terracotta means one thing. Guest checkout, no account anywhere in the buying
path. Empty states are invitations. Errors say what happened and what to do and
never apologise. And no portal furniture: no verdict bars, no ledger rows, no
micro-caps eyebrows, no sunk chip rails.
