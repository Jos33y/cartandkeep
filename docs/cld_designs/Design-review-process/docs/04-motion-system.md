# 04 — Motion System

---

## Verdict

There is no motion in the storefront. Nothing moves, nothing responds, nothing acknowledges an action.

The detail that matters: **`--dur: 120ms`, `--dur-settle: 260ms` and an easing curve are already declared in the tokens and nothing uses them.** The system specified its own timing and the shop ignored it. That is the cheapest available win in the entire project.

The second finding is that two durations and one curve is enough for *meaningful* motion and not enough for *expressive* motion. Expressive needs five more values, listed below.

---

## The job

Motion in a shop does four things. If a movement is not doing one of them, it should be deleted.

1. **Acknowledge.** The user did something and the interface responded before the network did.
2. **Preserve continuity.** The thing they were looking at is still the thing they are looking at, in a new place.
3. **Direct attention.** Something changed off the point of focus and they need to know.
4. **Express character.** The shop has a personality and movement is where it shows. This is the one that separates a competent build from an expensive one, and it is the one that is entirely missing.

---

## Tokens

### Existing

```
--dur          120ms    micro-interactions, hover, focus
--dur-settle   260ms    state changes, reveals
--ease         the declared curve
```

### To add

```
--dur-large    420ms    large surfaces: drawers, sheets, modals
--dur-page     520ms    view transitions between routes
--stagger       45ms    per-item delay in a sequence
--ease-spring  cubic-bezier(0.34, 1.4, 0.64, 1)    overshoot, for arrivals
--ease-exit    cubic-bezier(0.4, 0, 1, 1)          fast out, for dismissals
```

Five values. That is the whole difference between the current inert build and expressive motion.

### The rules

- **Entrances overshoot. Exits do not.** Things arriving have weight and settle. Things leaving get out of the way immediately. This asymmetry is most of what makes motion feel designed rather than applied.
- **Exits are always faster than entrances.** Roughly 60% of the entrance duration.
- **Nothing animates longer than 520ms.** Past that it stops reading as responsive.
- **Stagger caps at eight items.** Beyond eight, the last item arrives late enough to feel broken. Items nine onward share the eighth delay.
- **Transform and opacity only.** Never animate width, height, top, left, or box-shadow. Use scale, translate and a pre-composited shadow layer.
- **Every animation has a reduced-motion equivalent**, which is a 120ms opacity fade. Not "no animation": a fade. Removing motion entirely from an optimistic add-to-basket removes the feedback, which is worse for the user who needed the accommodation.

---

## The six that pay for themselves

Ranked by commercial value, not by how impressive they look.

### 1. Optimistic add to basket

The single highest-value piece of motion in any shop.

The count in the header changes **before** the request returns. A ghost of the product image lifts from the card, arcs to the basket mark, and scales down into it on `--ease-spring`. The basket mark pulses once. The free-delivery bar fills to its new value on `--dur-settle`.

If the request fails, the count reverts and a plain sentence explains why. Never a toast that disappears before it is read.

Why it matters: it removes all perceived latency from the most repeated action in the shop, and it is the moment where a shop either feels alive or feels like a form.

### 2. Free-delivery progress

The shop's only persuasion device, and the only one its own About page permits.

The bar fills to the new percentage on `--dur-settle` whenever the basket changes. When it crosses £40 it completes, the fill colour steps to sage, and the label changes to a plain sentence. No confetti.

Persistent on mobile, in the basket drawer and at checkout. It lifts basket value honestly, by telling the truth about arithmetic, rather than by pressure.

### 3. Product image continuity, grid to PDP

Native View Transitions API with `view-transition-name` on the product image. The image persists from the card into the PDP gallery rather than the page blinking.

Costs almost nothing, degrades to a normal navigation where unsupported, and will look correct in 2032 because it is a browser primitive rather than a trend.

### 4. Card hover

Currently nothing happens at all, which is the main reason the grid feels dead.

On hover: 2px lift, elevation steps 1 to 2, the group-colour registration offset slides in behind, quick view fades up. All on `--dur`, 120ms. The registration device from [02](02-craft-and-material.md) doing double duty as a hover state and a department signal.

On touch, none of this exists. Do not fake hover on mobile.

### 5. Skeletons, not pop-in

Filter, sort and pagination redraw the grid in place at identical card dimensions. Nothing jumps, nothing reflows, the scroll position holds.

Skeletons are printed blocks in the group wash, not shimmering grey bars. The shimmer gradient is a 2020 trope and it contradicts the print language.

When the results arrive, they cross-fade over `--dur-settle` with a `--stagger` cascade capped at eight.

### 6. Search as you type

Results narrow live, on the PLP and in the help centre. Debounce at 150ms, animate the count, FLIP the surviving items into their new positions rather than re-rendering the list.

At 1000 products this stops being a nicety and becomes the shop.

---

## Choreography

Individual animations are the easy part. Sequencing is where it either feels authored or feels like a pile of transitions.

**One thing moves at a time.** When the basket drawer opens, the drawer moves. The page behind it dims but does not scale, blur or slide.

**Movement follows the eye, not the layout.** An item added to the basket travels toward the basket mark, not up and to the right on a fixed path. The user's attention is already going there.

**Stagger in reading order.** Left to right, top to bottom. Never centre-out, never random.

**Page entrances stagger by section, not by element.** Header, then hero, then grid. Three cues, 45ms apart. Staggering forty product cards individually is the most common way expressive motion becomes irritating.

**Interruption always wins.** If the user acts mid-animation, the animation abandons its current state and serves the new intent immediately. Never queue, never block input.

---

## What not to animate

- Anything at checkout beyond field focus, validation and the pay button state. Motion at the point of payment reads as instability.
- Price. A price that counts up is charming on a homepage board, exactly once, on first paint. Never on a PDP, never in the basket, never at checkout.
- Scroll position. No scroll hijacking, no smooth-scroll libraries that fight the OS, no parallax on product imagery.
- Anything on a timer. If it moves without the user doing something, it needs a very good reason. There is one: the delivery bar, and only in response to a basket change.
- Text on entrance, letter by letter. It delays reading and it has been a cliché since 2021.

---

## Implementation notes

- **CSS first.** Hover, focus, expand, fade, skeleton. No library required.
- **View Transitions API** for route changes. MDN and the Chrome developer docs are the reference.
- **Motion** (the library formerly published as Framer Motion) for shared-element work, spring physics and orchestration where CSS runs out.
- **FLIP** for list reordering. Well documented and cheap.
- **Rive** rather than Lottie if the delivery mark gets commissioned. Smaller, interactive, state-machine driven.
- **Do not add a smooth-scroll library.** Lenis is good work but it fights native scrolling on mobile and it will cost more in feel than it gains.
- Respect `prefers-reduced-motion` at the token level, not per component, so it cannot be forgotten.

---

## Measure

- Interaction to next paint under 200ms on the add-to-basket action.
- No layout shift caused by any animation. CLS contribution of zero.
- Frame timing: nothing below 60fps on a mid-range Android. Test on a real device, not on a throttled desktop.
- Qualitative: hand the phone to someone, ask them to add three things to the basket. If they look at the header to confirm it worked, the acknowledgement has failed.

## Study

- Emil Kowalski, emilkowal.ski, *Animations on the Web*. The best current writing on interface motion, and specifically on why easing asymmetry matters.
- Rauno Freiberg, rauno.me, for interaction detail at a level almost nobody reaches.
- The Chrome team's View Transitions documentation and samples.
- Material Design motion guidelines, for choreography principles. Ignore the visual style, take the sequencing thinking.
- Val Head, *Designing Interface Animation*, for the vocabulary to argue about this in a review.
- easings.net and cubic-bezier.com for curve intuition.
- Apple Human Interface Guidelines on motion, particularly the reduced-motion guidance, which is more thoughtful than the WCAG minimum.
