# Design standard

**The Brick Dev Studios** · living document · started 19 September 2026

This is a floor, not a ceiling. Nothing here forbids a technique. It exists so
that the next screen starts from a considered position instead of from
defaults, and so that anyone can raise the standard by editing this file rather
than by arguing in a pull request.

Update it whenever something works. Delete anything that stops being true.

---

## The test

Would a screenshot of this screen, with no explanation, make somebody assume
the team behind it is expensive?

That is the whole bar. It is not subjective in the way people claim. Stripe,
Linear, Notion, Vercel, Resend and Cloudflare all pass it, and they share
almost no visual language. What they share is that every element on the screen
was decided by a person.

Two failure modes sit either side of it.

**Bland.** Hairline rules, one type size, one accent colour, no elevation, no
motion, numbers as prose. Reads as an internal tool, and the client concludes
their money bought a spreadsheet. This is where Cart & Keep's portal was in
September 2026: a page of borders, a terracotta button, and nothing that looked
clickable.

**Generated.** Purple-to-blue gradients, frosted glass over nothing, a glow on
every card, three emoji in a heading, everything at once. Reads as a template,
and the client concludes their money bought a prompt.

The distance between them is judgement, and judgement is a thing this document
can carry.

---

## What "no AI aesthetic" actually means

Nothing is banned. Glassmorphism is not banned. Gradients are not banned.
Glow, blur, noise, grain, 3D, illustration, dark panels, animated numbers —
none of it is banned.

What makes a screen read as generated is not the technique. It is technique
applied **everywhere, at the same strength, for no reason**.

A gradient is a cliché when it sits behind a whole page for decoration. A
gradient is craft when it marks the one figure on the screen that carries the
most weight, or when it gives a chart's fill a direction that means something.

Frosted glass is a cliché when every card has it. Frosted glass is craft on a
sticky header that has to sit over scrolling content, because that is the
problem it was invented to solve.

The rule is therefore:

> **Use the technique where it does a job. Do not use it where it does not.**

If you cannot say in one sentence what a visual effect is doing for the person
reading the screen, remove it. If you can, keep it, and do not apologise for
it.

One practical corollary: pick a small number of signature moves per product and
use them consistently. One product that owns *one* distinctive thing looks
designed. A product with eight distinctive things looks like a gallery of
someone else's work.

---

## Foundations

Build these before building screens. Everything below is tokens, and tokens are
what stop the fourth page from inventing its own version of the second page.

### Colour

A base palette is a foundation, not a limit. Adding colour that complements it
is not a violation of restraint; restraint means every colour is deliberate,
not that there are three of them.

Every product needs, at minimum:

- **A surface scale.** Four or five steps: the canvas, the card, the raised
  card, the sunken well, the border. Without this, elevation is impossible and
  everything lands on one plane.
- **An ink scale.** Three or four steps of text colour. Headline, body, quiet,
  faint. One text colour is why a page reads flat even when the copy is good.
- **Functional colour.** Positive, warning, negative, informational, each with
  a text tint and a background tint. This is what lets a status be *read*
  rather than parsed.
- **Data colour.** Four to six hues for charts and categories, distinguishable
  from each other and legible at 4px wide, and tested for the most common
  colour vision deficiencies.

Colour must carry information. If every figure on a page is the same colour,
none of them is important. The strongest single upgrade available to most dull
interfaces is: pick the three things on the screen that matter and let colour
say so.

### Elevation

A border alone is a list. A border plus a soft shadow on a lighter surface is
an interface.

Two levels is usually enough: resting and raised. A third for overlays. Shadows
should be soft, low-opacity, and tinted toward the palette's warm or cool base
rather than pure black, which reads as a bevel from 2009.

Dark interfaces elevate with surface lightness rather than shadow. Same
principle, different mechanism.

### Type

One scale, used unevenly. This is the point most dull interfaces miss.

Needed: a display size for the one figure that matters on a screen, a heading
size, a body size, a label size, and a micro size. The gaps between them should
be large enough to be obvious. Two sizes three pixels apart read as a mistake;
two sizes twice apart read as a decision.

A separate numeric treatment is worth having: tabular figures, so columns line
up, and usually a different family or weight so a number reads as data rather
than as a word.

### Space

Space is the cheapest luxury signal there is. Cramped is the single most
reliable way to look cheap.

A scale, used consistently, with meaningfully large steps at the top. Sections
need far more room between them than elements inside a section. If everything
is one gap apart, nothing is grouped.

### Motion

Motion is what separates software from a document.

- State changes animate. Hover, press, focus, open, close.
- Content that arrives animates in. Charts draw, numbers count, rows stagger by
  a few milliseconds.
- Nothing decorative loops forever.
- Everything respects `prefers-reduced-motion`.

Durations: fast for feedback under the finger, slower for things entering the
page. Easing should be asymmetric — quick out, gentle in — because that is what
physical objects do.

### Shape

One radius scale, applied consistently. Mixing sharp and round in one interface
without a rule is one of the fastest ways to look unconsidered.

---

## Primitives

Screens should be assembled from a small set of shared components, not from
fresh markup each time. Where this is skipped, every page reinvents its own row
and its own figure, and the product reads as several products.

The minimum set:

- **Card** — surface, elevation, padding, optional header and footer.
- **Stat** — a label, a figure at display size, an optional delta and note.
- **Chart** — line, area, bar, sparkline. First class, not an afterthought.
- **Table / list row** — with hover, selection, and a defined dense variant.
- **Status** — a pill or dot driven by functional colour.
- **Empty state** — illustration or diagram, a sentence, and an action.
- **Skeleton** — holds the exact shape of what is loading.
- **Button** — primary, secondary, quiet, destructive, each with hover, active,
  focus, disabled and loading.

Anything appearing on a third screen becomes a primitive.

---

## Screens

### Overview screens are the product

The first screen is what the client opens most and judges everything by. It
should answer, before any scrolling: what happened since last time, what needs
me, and what is the state of the thing I am paying for.

A page of numbers with no shape answers none of those. If an overview can be
replaced by a sentence, it is not an overview.

Anything that can be acted on must look like it can be acted on. A row that
does something on click and looks identical to a row that does not is a design
failure, not a discoverability one.

### Data screens

- Draw the shape before listing the rows. A trend over time, a distribution, a
  funnel — whichever the data actually is.
- Sort by what matters, not by what is largest. The biggest number is rarely
  the most urgent.
- Format every number. Thousands separators, currency symbols, sensible
  rounding. Raw integers are the tell of an unfinished screen.
- A row about a thing should show the thing. Photograph, avatar, icon. An
  identifier is not an identity.
- Show the ratio as well as the count. Two numbers with a percentage between
  them is a finding; two numbers is arithmetic left to the reader.

### Empty states

An empty screen is a first impression, and it is the one most often skipped.
Show what will be there, say what fills it, and give the action that does.
Never a bare sentence on a white page.

### Loading and failure

Skeletons that match the final layout. No layout jump when data lands.

Failures say what failed, in the words of whatever failed, and what to do next.
A status code shown to a client is an unfinished error state.

---

## Craft details that carry disproportionate weight

Small, cheap, and collectively the difference between paid software and an
internal tool.

- Focus rings that are designed rather than default.
- Hover feedback on everything interactive, within 150ms.
- Optical alignment over mathematical alignment where they disagree.
- Icons from one family, at one weight, optically sized to the text beside
  them.
- Real content in every mock. Lorem ipsum hides every spacing problem.
- The longest realistic string tested in every layout.
- Tabular figures in every column of numbers.
- Sensible, human empty and singular forms. "1 product", not "1 products".
- Dark mode considered from the start if it will ever exist, because retrofitting
  it means rewriting every colour decision.

---

## Accessibility is part of the standard

Not a compliance chore. Contrast, focus order, hit targets and reduced motion
are the same craft as everything above, and a product that fails them is not
finished regardless of how it looks.

- 4.5:1 for body text, 3:1 for large text and meaningful non-text.
- Never colour alone to carry meaning. Pair it with a shape, an icon or a word.
- 44px minimum touch targets.
- Keyboard reachable, in a sensible order, with visible focus.
- `prefers-reduced-motion` honoured everywhere.

---

## Process

1. **Foundations first.** Tokens, then primitives, then screens. Building
   screens first guarantees a redesign later.
2. **Design the hardest screen first.** The one with the most data. If the
   system survives that, the rest are easy.
3. **Screenshot test each screen when it is done.** Against the bar at the top
   of this file. Be honest.
4. **Steal deliberately.** Keep a reference folder. Name what specifically was
   taken — the elevation, the empty state, the way the number animates — not a
   general vibe.
5. **Revisit this file.** Whenever something works, write it down. Whenever a
   rule here stops a good idea, change the rule.

---

## What went wrong on Cart & Keep, for the record

Recorded because the pattern is more useful than the conclusion.

Every page was built reactively, under delivery pressure, one at a time. No
tokens beyond colour, no shared primitives, so each page invented its own rows
and figures. Colour carried no information. One type scale used evenly. Every
element at the same weight. No charts anywhere until the third week. Elevation
never used, so the entire interface sat on one plane separated by hairlines.
Numbers printed raw. Rows that opened things looked identical to rows that did
not.

The cause was not taste and not the palette. It was reading "restraint" as
"use less" rather than as "decide more", and never stopping to build a
foundation because there was always a next feature.

The client opened it daily and could not tell anything had been done.
