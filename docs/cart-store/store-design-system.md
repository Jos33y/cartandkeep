# Store Design System

The visual language for the Cart & Keep storefront.

**This is not `design-system.md`.** That document governs the portal, which is a
review instrument for one professional. This one governs a shop. Where the two
conflict, the portal document does not apply here, and it conflicts on nearly
everything: motion, density, restraint, and what numbers are for.

Read before touching any file under `src/pages/store` or
`src/components/ui/store`.

---

## The thesis

**A general store that is not embarrassed about it.**

The catalogue is pans, floor lamps, dog beds, drain unblocker, basketballs,
water filters and a dartboard light. Seventy eight products across eight
categories and it will keep widening. Designing it as a boutique is a lie that
collapses the first time someone scrolls to the Jeyes Fluid.

The reference is not Apple, which sells nine products, and it is not a
single-brand boutique. It is a well-run general store: a place whose range is
the reason to come back, that knows exactly where everything is, and that makes
a bottle of white vinegar look deliberate rather than dumped.

**The single job of the store:** a buyer arriving cold on a phone should
understand the breadth in three seconds, find their section in one tap, and
reach checkout without an account.

Breadth is the feature. Every structural decision below exists to merchandise
range rather than to apologise for it.

---

## What the portal document got right for the wrong surface

Carried over, unchanged:

- Her four colours, which come from the signed scope
- WCAG AA on every pairing, measured
- Mobile designed first at 375px, every control at least 44px
- `prefers-reduced-motion` removes motion entirely
- Plain verbs, sentence case, no filler, actions keeping their name

Reversed, deliberately:

| Portal | Store | Why |
|---|---|---|
| Ledger rows, no cards | Cards and shelves | A buyer browses, she audits |
| Numbers are the display face | Numbers recede | A mono price reads as data, not as a thing you want |
| Motion in one place only | Motion throughout, disciplined | Stillness reads as broken on a shop |
| Take one thing off before shipping | Add the one thing that makes it want to be touched | Restraint on a shop is austerity |
| Terracotta at most twice per screen | Terracotta is the buy action, wherever it appears | It is the conversion colour |
| Depth without shadows | Depth with elevation and shadow | Product tiles have to lift |

---

## Typography

**Three roles, and the display face is the personality.**

```
display   Archivo Variable, width axis 112, weight 600, tracking -0.02em
interface Geist Variable
data      IBM Plex Mono, demoted
```

Archivo at an extended width is the choice, and the reasoning matters because
the obvious alternative is the trap. A high contrast serif on a cream ground
with a terracotta accent is the single most recognisable machine-generated
look of the last two years, and her palette is already cream and terracotta. So
the display face goes the other way: an extended grotesk, which reads as
shopfront lettering, awning type, market signage. It suits a general store and
it is nothing like a boutique serif.

The width axis is the one memorable typographic move. Headings sit wide,
everything else sits normal. Used once per screen, at the top, and never inside
a card.

**Prices are not mono here.** This is the sharpest reversal from the portal. In
the portal the data is the content and mono is correct. In a shop a monospaced
price reads as a database field. Prices are set in Archivo at normal width with
tabular figures, so a column of them still aligns.

Mono survives in exactly two places: product counts beside a category name, and
the order reference on a confirmation. Both are identifiers rather than
merchandising.

```
hero       clamp(2.5rem, 7vw, 4.5rem)  display, wide, 600, -0.03em
section    clamp(1.5rem, 3vw, 2rem)    display, wide, 600, -0.02em
title      1.0625rem                   interface, 500, -0.01em
price      1.125rem                    display, normal width, 600, tnum
body       0.9375rem                   interface, 400, 1.6
label      0.8125rem                   interface, 500
caption    0.75rem                     interface, 400
count      0.75rem                     data, 500, tnum
```

Product titles are supplier feed titles and run past eighty characters. Two
lines, then clipped. Not three: three lines of feed text is a paragraph and it
buries the price.

---

## Colour

Her four are fixed and come from the signed scope.

```
base    #FAF6EF   warm off-white, page
ink     #2A2723   deep charcoal, text
brand   #7A9575   sage
action  #C4674A   terracotta
```

The portal derives two variants for contrast. The store needs more, because it
has surfaces the portal does not: tiles that lift, a section that recedes, a
sale flag, an out of stock state.

```
surface        #FFFFFF   product tile
surface-warm   #F7F2E9   shelf background, one step down from base
ink-deep       #1E1C19   footer, category tile overlays
sage-deep      #5E7359   category tile wash, 4.6:1 with white
sage-wash      #EEF2EC   quiet section fill
action-strong  #BA5A3D   buy button, 4.55:1 with white
action-text    #AD5438   terracotta as text on base
gold           #B08430   a sale flag, and nothing else
```

`gold` is the one addition outside her hue family. It exists so a price
reduction does not have to borrow terracotta, which is the buy action and must
mean one thing everywhere.

**Terracotta rule, changed from the portal.** It is not rationed by count. It
means one thing: the action that moves a buyer forward. Add to basket, checkout,
place order. It can appear on every card in a grid, because on every card it
means the same thing. It never appears as decoration, a border, or a heading.

---

## The signature: the shelf

The one thing this store is remembered by.

A shelf is a horizontal row for one category. The category name sits in a fixed
panel on the left, set in the wide display face, and the products scroll past it
horizontally while the panel stays put. On a phone it is a thumb swipe. On a
desktop it scrolls with a drag or the arrows.

```
+--------------+ +--------+ +--------+ +--------+ +------
|              | |        | |        | |        | |
|  HOME &      | | [img]  | | [img]  | | [img]  | | [img
|  FURNITURE   | |        | |        | |        | |
|              | | Pan set| | Lamp   | | Boxes  | | Vine
|  24 items    | | £117.24| | £48.01 | | £47.50 | | £20.
|  See all >   | |        | |        | |        | |
+--------------+ +--------+ +--------+ +--------+ +------
```

It earns its place three ways.

It **merchandises breadth instead of hiding it.** Eight shelves on one page is
the whole shop in one scroll, and a buyer who came for a lamp discovers there
are dog beds. A flat grid of seventy eight products discovers nothing.

It **survives any catalogue shape.** Eight categories or twenty, four products
or forty. Nothing in the layout assumes a number, which matters because this
catalogue changes shape every time she adds stock.

It **holds the category name still while the goods move**, which is the whole
idea of a shop floor and is also the reason the panel does not scroll away.

The home page is shelves. A category page is a grid, because at that point the
buyer has chosen and wants everything at once.

---

## Layout

**Home**

```
header, transparent over the hero, solid on scroll
hero            one line of wide display type and one product photograph
category strip  eight tiles, image behind, name over, scrolls horizontally
shelf           one per category, in catalogue order
shelf
...
footer
```

The hero is one sentence and one photograph, not a carousel. Carousels are the
generic answer and nobody swipes them.

**Category page**

```
header, solid
breadcrumb      Shop / Home, Furniture & DIY
title           wide display, product count in mono beside it
grid            2 up at 375, 3 at 620, 4 at 960
```

**Product page**

```
gallery         square, swipeable on mobile, thumbnails on desktop
title           interface face, not display
price           display face, normal width
buy             terracotta, full width on mobile, sticky at the bottom on scroll
delivery        plain sentence, no icon
description
related         one shelf, same category
```

The sticky buy bar on mobile is not optional. It is the single largest
conversion lever on a product page and it costs nothing.

Container maximum 1240px. Spacing from a 4px base. Radius `--r-lg` on tiles,
`--r-md` on controls.

---

## Product tiles

Fixing what is wrong with the current ones, item by item.

**The image fills the tile.** Edge to edge, `object-fit: cover`, square. No
padding, no floating on white. Her images come from dozens of sellers and
`contain` with padding makes them look like a scraped feed, which is exactly
what a buyer must not think.

**No dead space.** The current card pins the price to the bottom with
`margin-top: auto`, so a two word title leaves a third of the tile empty. The
body is content height. A shorter title makes a shorter card, and the grid
aligns to the top rather than stretching.

**No shouting eyebrow.** All caps micro tracking is a data label. The leaf
category sits below the title in caption size, sentence case, quiet.

**One line of price.** No struck through comparison unless there is a real one,
and when there is, it is gold.

**Hover lifts the tile and scales the image inside its frame**, 1.03 over
240ms. That is the entire hover state. No overlay, no quick view, no button
appearing.

```
+------------------------+
|                        |
|        [image]         |   square, cover, no padding
|                        |
+------------------------+
| 5 Piece Non Stick      |   title, two lines max
| Saucepan Set           |
| Pan sets               |   leaf, caption, quiet
| £117.24                |   display face, tabular
+------------------------+
```

---

## Motion

The portal allows one orchestrated moment. The store is the opposite: motion is
continuous, small, and never blocks anything.

```
tile hover        image scale 1.03, tile lift 2px, 240ms, ease-out
shelf scroll      native momentum, snap to tile start
grid entry        6 tiles fade and rise 8px, 40ms apart, once, on first paint
page change       View Transitions API, 180ms cross fade
add to basket     button label changes to Added, count in the header ticks up
sticky buy bar    slides up when the main button leaves the viewport
header            transparent over the hero, solid with a hairline after 80px
```

Two rules. Nothing animates on a repeat visit that already animated on the
first, so the grid entry runs once per session. And every one of these is
removed entirely by `prefers-reduced-motion`, not shortened.

No skeleton shimmer. A tile that is loading is the sunk colour with nothing in
it, which is honest and quiet. Shimmer is the tell of a page that has nothing
to say while it waits.

If a spring feels better than an ease on the sticky bar, use a motion library
for that one thing rather than the whole store. Do not add a dependency to
animate a fade.

---

## Checkout

**Guest by default and there is no account anywhere in the path.** No sign in
link in the header, no create an account step, no password. Email and delivery
address, then pay.

```
basket    line items, quantity, subtotal, one terracotta button
checkout  one page, three blocks: contact, delivery, payment
           no step indicator, no back and forward, nothing collapsed
confirm   order reference in mono, what happens next in plain sentences
```

An account can exist later for order history. It cannot exist between a buyer
and a payment.

Card details never touch the page. Stripe holds the payment, and Stripe is her
storefront rail. Flutterwave is the studio's rail for the retainer and the two
have been confused once already.

---

## Copy

Plain verbs, sentence case, no filler. Same as the portal, different register:
the portal talks to an operator and the store talks to a stranger.

Never describe a product in words the supplier feed wrote. Feed titles are for
matching, not for reading, so the product page carries her sentence above the
feed text.

Delivery and returns are stated on the product page in a sentence, not behind
an accordion and not as an icon row.

An empty basket is an invitation with a way out of it, never a sad face.

Errors say what happened and what to do. A declined card says the card was
declined and offers another, and does not apologise.

---

## What this is not

No carousels. No quick view modals. No countdown timers, stock scarcity
counters or recently viewed by 43 people. No newsletter popup on arrival. No
chat bubble. No trust badge cluster in the footer. No stock photography of
people. No skeleton shimmer. No accordion hiding delivery information. No
account wall.

And the specific one this document exists to prevent: **no portal furniture.**
No verdict bars, no ledger rows, no mono prices, no sunk chip rails, no
micro-caps eyebrows. Those are instruments for reading data and this surface is
for wanting things.

---

## Fixing what is already built

The current store files were built against the portal document. Every one of
them needs the treatment above.

```
ProductCard          image cover, no dead space, quiet leaf, hover lift
CategoryNav          becomes the category tile strip, not a chip rail
ProductGrid          align to top, tighter gutters, entry animation
HomePage             hero plus shelves, not one flat grid
CategoryPage         breadcrumb, wide title, grid
StoreHeader          transparent over hero, basket count, no account link
tokens               new colours above, Archivo added, width axis wired
```

`ProductGrid` and the grouping logic survive. The rest is a rebuild rather than
a revision, and it is faster to accept that than to patch a spreadsheet into a
shop.
