# Design System

The visual language for Cart & Keep, and for every client platform after it.
Read before touching any interface file.

Last revised 13 August 2026. Where a rule changed, the reason is recorded rather
than the rule quietly replaced.

---

## The thesis

**A trading terminal that went to finishing school.**

She sells accessories and daily living aids, which is warm and domestic. She
runs it with institutional rigour: sell-through, velocity, margin, sold counts.
The interface lives in the tension between those two things. Warm surfaces, hard
numbers.

She reads velocity graphs for a living and uses Zik fluently. She is not a
beginner and the interface must not treat her as one. Zik is a generic SaaS
dashboard, purple gradients and donut charts. Beating it is not more charts. It
is decisiveness: every screen answers what to do next, not here is some data.

**The single job of the portal:** on a Monday morning, between other work, on a
phone, let her decide approve, reject or defer on thirty to a hundred candidates
with enough evidence to trust each one.

---

## The standard

This document was a list of prohibitions for its first ten days, and it produced
work that was correct and lifeless. The prohibitions still hold. They are the
floor, not the work.

Four marks separate a screen worth opening from one that merely obeys.

**Hierarchy is severe.** On any screen one thing is the answer and everything
else is evidence for it. If three elements compete, the screen has no argument.
The test: cover the screen, uncover one element, and it should be the one that
decides what to do next.

**Scale contrast, not scale variety.** Two sizes far apart read as intent. Four
sizes close together read as indecision. The display face against a micro label
in the same eyeline is the move. Anything in the middle is where interfaces go
grey.

**Density is the ornament.** This is a professional tool and its beauty is in
how much true information sits in a small space, set well. A generous, airy
screen with six figures on it is a settings page. The reference is a broker's
blotter, not a marketing site.

**Every device is an argument.** A shape earns its place by making a comparison
the reader could not make from the numbers alone. If a chart can be replaced by
a two-line ledger without loss, it was decoration and the ledger is better.

---

## Composition

The part that was missing, and the reason the interface read as a stack.

**A screen is not a list of sections.** It opens on its conclusion, then
supports it. The expanded candidate row is the clearest case: it ran cost lines,
competition, sales history, supplier and notes at identical weight, in the order
they were built, with nothing telling the eye where to start.

The shape it should take:

```
  the answer          one line, display or figure weight, the thing to act on
  ────────────────    a rule, because a conclusion is separated from its basis
  the evidence        ledgers and shapes at caption weight, dense, scannable
  the working         costs, sources, notes, at the bottom, for when she asks
```

**Rules separate arguments, not paragraphs.** A hairline in this interface means
what is above and what is below are different kinds of claim. Using one between
every block is punctuation, and it flattens the page.

**Not every section deserves a heading.** A micro eyebrow is a real interruption
at this density. Give one to a section she navigates to. Everything else runs on.

**Asymmetry is allowed and usually right.** The ledger row is already asymmetric:
image left, prose middle, money hard right. That is why it reads. Do not
regularise it into equal columns for tidiness.

---

## Typography

**Numbers are the display face.** This is the defining decision.

The money, the counts and the dates are set in IBM Plex Mono. Geist recedes to
labels, prose and chrome. Most interfaces do the reverse. Here the data is the
content, so the data gets the voice.

| Role | Face | Use |
|---|---|---|
| Data, display | IBM Plex Mono | money, counts, dates, IDs |
| Interface | Geist Variable | labels, prose, buttons, navigation |

Two families, no more. A third would be an accessory to remove.

**Tabular figures everywhere numbers stack.** Columns of margins that jitter
between rows read as untrustworthy.

Scale is fixed and named. Never an arbitrary pixel value.

```
display   2.75rem   mono, -0.03em, 500     the one figure that decides
figure    1.5rem    mono, -0.02em, 500     money, key counts
lead      1.0625rem sans, -0.01em, 500     row titles, group headings
body      0.9375rem sans, 0, 400           prose
label     0.8125rem sans, 0, 500           field labels
caption   0.75rem   sans, 0.01em, 400      supporting
micro     0.6875rem sans, 0.08em, 600, uc  eyebrows, section markers
```

**Skip a step.** Display next to micro. Figure next to caption. Placing lead
against body against caption in one block is the mush the scale exists to
prevent. If two elements sit within one step of each other, one of them is
probably unnecessary.

**Display size is spent, not used.** At most one per screen region, on the
figure that decides. It was the score on the row until images arrived, and two
display-weight elements beside a product photograph fought each other.

**A number without a word next to it is a number nobody can use.** Anything the
client has not seen before carries its name at micro size beside it:
`A MONTH BEFORE GOODS £1,287.38`, `HEADROOM £11.83`. The Metrics page explains
them once; the interface names them every time.

**Set text, do not place it.** Prose sits at a measure of 52 to 64 characters.
Micro labels take their tracking from the scale, never from a guess. A caption
under a figure aligns to the figure's optical edge, not its box.

---

## Colour

Her four are fixed. They come from the signed scope and are not ours to change.

```
base    #FAF6EF   warm off-white, page
ink     #2A2723   deep charcoal, text
brand   #7A9575   sage, structural accent
action  #C4674A   terracotta, brand mark only
```

Neither brand colour survives contact with a light page at full saturation, so
each has a derived variant at the same hue. Measured, not assumed.

```
action-strong  #BA5A3D   button backgrounds, 4.55:1 with white
action-text    #AD5438   terracotta as text, 4.75:1 on base
brand-strong   #6F896A   data fills, 3.57:1 on base, 3.36:1 on sunk
```

**Sage at full saturation is 2.87:1 as a filled shape and fails.** Every bar,
every chart point and every fill uses `brand-strong`. Plain `brand` is for
rules, washes and swatches where nothing depends on reading it.

**A track lighter than its fill cannot exist on a cream page.** Anything pale
enough to sit under sage measures around 1.2:1 against the page and is
invisible. Where the unfilled part of a shape carries meaning, draw the extent
as a hairline outline in `control` at 3.20:1 and fill inside it. Where it does
not, drop the track and give the shapes a shared baseline.

Every pairing in the interface clears WCAG AA. The verification is in the tokens
file, and it is run again whenever a colour is introduced, not asserted.

**Restraint rule.** Terracotta appears at most twice per screen.

**Terracotta means act, not warn.** It went on every group heading as an
outside-the-agreed-categories badge and appeared on every group in one view,
which teaches the eye to ignore it. It marks the primary action, and a finding
she can do something about today such as a product priced under its market. A
colour that fires on most rows carries no information, which is the same failure
as one that fires on none.

**Depth without shadows.** Hierarchy comes from hairline borders in warm
neutrals and one step of surface elevation. No drop shadows scattered across
cards, no gradients, no glass. Flat but layered.

**Hairlines have two weights and they mean different things.** `line` divides
items of the same kind. `line-mid` separates a conclusion from its basis. One
weight throughout is why a page of true things can still read as a stack.

---

## The signature: the verdict bar

The device this interface is remembered by, when there is something to draw.

Every scored candidate carries a horizontal bar divided into segments, one per
scoring component. Segment width is the component weight, fill is the component
value. Each segment is outlined so its extent reads, and filled from the left.

```
 units sold  headroom  holding   sellers  band
 ▐████▌      ▐███░▌    ▐█████▌   ▐████▌   ▐█░░▌
```

It earns its place three ways.

It shows **why** a score is what it is, at a glance, without a click. An 84 made
of strong margin and weak competition is a different proposition from an 84 made
of the reverse.

It shows **the basis**. A candidate scored on four components renders four
segments. One scored on seven renders seven. The honesty problem the scoring
model has in code becomes visible in the interface rather than buried.

It is **information, not decoration**, which is the test every structural device
has to pass.

**Order is ours, not the database's.** Postgres returns jsonb keys ordered by
key length, so left to right once meant nothing and a rename would have
rearranged it. The order is declared in the component: demand, then money, then
what stands in the way, with postage band last.

**Hover labels do not exist on a phone, and the phone is the primary case.** The
expanded row carries a legend with the same figures. A device-only affordance is
not an affordance.

The bar dims to 0.45 once decided. Below that the outline turns to mush.

**No components, no bar.** A batch built from a single window has no trend, no
sell-through and no competition read, so the score is null and the bar has
nothing to draw. It disappears rather than rendering an empty track, and the row
shows what the product is worth in a month in its place. A signature device that
appears empty is worse than one that appears sometimes.

---

## Layout

**A ledger, not a card grid.**

Cards waste vertical space and make forty candidates feel like forty pages. Rows
are dense, scannable and comparable, which is what a review session needs.

Rows expand in place. No navigation, no modal, no lost scroll position. The
evidence and the actions appear beneath the row that was tapped.

```
 [img]  Raised Toilet Seat with Lid 4"                    £10.91
        118 sold in July · 4 sellers · evergreen         headroom
                                                    out of £18.80

 A MONTH BEFORE GOODS £1,287.38   696 others, you are cheaper
 118 sold at £10.91                        [Later][Reject][Approve]
```

**Image hard left as the identifier.** Title in the middle, money hard right in
mono with the price it came out of beneath it. A number and the number it was
derived from, rather than a figure floating alone.

**One control line beneath.** The figure that decides at the left with its
arithmetic under it, the market read in the middle, the actions at the right.
The bar and the actions were separate full-width rows until 3 August, each
carrying about a third of a row of content, with a dead band between them.

**One gutter.** The image sets it. The control line, the expanded detail and any
warning all start where the title starts. Nothing is positioned independently.

**Rows respond.** Hover and open both lift the row to the raised surface, and a
caret at the right rotates when it opens. A row that can be acted on should not
look like a printed list.

**Group by cluster, rank within a group.** A cluster is the product type, which
travels across marketplaces where an eBay category does not. Ranking compares
like with like: 118 units on a toilet seat and 118 on a bed rail mean different
things. Each group takes a heading with its own count, and groups are ordered by
what the cluster is worth rather than by how many rows it holds.

**Sort by what the row is worth, not by tier.** A stock verdict is a fact about
how a product can be bought, not a claim that it is the better product. Putting
a £100 row above a £1,287 row because one carries a badge answers the page's
only question wrongly.

**Mobile is the primary case.** She reviews from a phone during her working day.
Everything is designed at 375px first and allowed to breathe upward. Every
control is at least 44px. A decided row drops its tap targets, because it is a
record rather than a working row.

Spacing derives from a 4px base. Container maximum is 1180px, because a ledger
past that width loses the eye between the title and the money.

**Spacing is optical, not uniform.** Related things sit tight, unrelated things
sit apart, and the gap does the work a rule would otherwise have to do. A page
where every gap is the same value is a page with no grouping.

---

## Images

Product images are evidence, not decoration, and they are the fastest way she
identifies a product. They earn a place in the ledger for that reason and no
other.

Contained, never cropped, on white so a cut-out product photograph does not sit
on cream. 72px in the ledger, 88px on a pack, always with a placeholder of the
same size when there is none, so the grid does not shift.

**Every image opens.** A View overlay on hover and focus, and a lightbox at full
size with the product name and one line saying it is the seller's own
photograph and cannot be reused. That line belongs there because that is the
moment she is looking closely enough to consider it.

---

## Charts

Only where a shape is the point, and the bar for that is higher than it looks.

**The test.** Write the same content as a two-line ledger. If nothing is lost,
the ledger wins. A chart earns its place only when the comparison it makes is
spatial: a trajectory, a distribution, a position within a field.

Two exist.

**Units per window**, in the expanded row. Sage columns on a shared baseline
with mono figures above. Windows are not contiguous, so the gap is drawn with
the number of skipped months on it. Evenly spaced columns would read as a steady
decline over five months when it is two blocks a year apart. It survives the
test because a trajectory is a shape.

**Headroom against units**, on the Overview. One point per candidate, so the
week has a shape before any row is read. Decided points go hollow, and the chart
empties as she works through Monday. The £4 floor is a dashed rule, so the gate
that governs the whole list is visible rather than described.

**One chart was built and removed, and the removal is the lesson.** The live
market read went through four forms: a position line, a labelled scale, four
bars, then two bars on a shared axis. Every one failed, and the faults recur.

*One encoding per chart.* The market range was drawn as a segment between
quartiles and the product as a bar from zero. Length reads as more, so the
cheaper product became the longest shape on the row. A position cannot be
compared against a length.

*Outliers set the scale and destroy it.* One listing at £89 against a market
living between £14 and £30 pushed every product into the left fifth, and every
row looked identical. Scale to the middle half, and state the extremes as text.

*One axis means one track.* Two rows on two separate lines do not read as a
shared scale however they are labelled.

*The space decides.* Two hundred pixels between the money and the buttons is not
a chart. It is a sentence.

It is now a ledger matching the cost breakdown eight lines above it, and it
reads. **A second visual language in the same panel makes both harder to read.**

Three rules for the charts that remain.

**Axes use the width.** A ladder of 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10.
Powers of ten rounded a maximum of 101 up to 200 and left half the plot empty.

**No native tooltips.** A `title` element arrives half a second late in a system
font. A readout line above the plot fills on hover and on keyboard focus, and
the points are focusable.

**Charts are never the answer on their own.** Every one sits next to the figure
it illustrates.

---

## Motion

One orchestrated moment, not scattered effects.

The decision is the moment. When a row is decided it settles, the verdict bar
dims, and the progress indicator advances. That sequence is the only place
motion is allowed to be noticeable.

Everything else is 120ms, ease-out, and invisible: a row lifting under the
pointer, a caret turning, a View overlay fading in. No load animations, no
staggered reveals, no bar fills on mount. `prefers-reduced-motion` removes all
of it.

---

## Copy

Plain verbs, sentence case, no filler. Name things by what she controls.

Actions keep their name through the whole flow. A button that says Later
produces a state that says Saved for later, and the same word appears in the
filter and in the activity log.

Empty states are invitations, not apologies. Errors say what happened and what
to do, never sorry. A failed write says so on the row it failed on.

Numbers are never dressed up. £13.20 is £13.20, not "great margin".

**Section labels are two or three words.** `The competition`, not `Who else is
selling this`. A sentence used as a heading reads as an afterthought beside the
two-word labels around it.

**Plain modern English, and nothing archaic.** `Dearest of them` went into an
interface and had to be pulled. If a word would sound odd said aloud to her, it
is the wrong word.

**Say what a figure does not include.** Headroom reads "before goods", a goods
line reads "not quoted", a bulky product says its postage is optimistic, and a
listing with two hundred variations says its price is a blend. A figure that
flatters without saying so is the failure this whole system exists to avoid, and
the interface is the last place it can be caught.

**Show the arithmetic under a large figure.** `£1,287.38` beside an Approve
button will be read as profit. `118 sold at £10.91` underneath it removes the
ambiguity for the cost of one line, and she can check it in her head.

**Say nothing rather than say zero.** A score with no components renders
nothing, not a zero. A market that could not be read says so, not `0 listings`.
A null presented as a figure is the fault this project has repeated more than
any other, and the interface is where the client sees it.

---

## What this is not

No gradients. No glassmorphism. No drop shadows on cards. No emoji. No
decorative icons. No progress rings. No donut charts, which are Zik's signature
and read as generic besides. No skeleton shimmer. No demo data, which was
removed on 3 August: an honestly empty page beats a fixture briefly mistaken for
real.

Chanel's rule applies at every review. Before shipping a screen, take one thing
off it.

**And the rule that governs the rest of them.** Restraint is not absence.
Following only the prohibitions produces something correct and lifeless. Every
screen here is one somebody opens on a Monday for the rest of the year, and it
has to be worth opening.
