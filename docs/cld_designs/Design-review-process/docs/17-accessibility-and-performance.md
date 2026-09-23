# 17 — Accessibility & Performance

---

## Verdict

Three measured accessibility failures, all inherited from the token layer rather than introduced by any page.

### 1. `--c-faint` fails AA

`#857d70` measures **3.77:1** against the cream base. It fails WCAG AA anywhere below roughly 14px, which is precisely and exclusively where the token is used: captions, leaf categories, metadata, counts.

`store-tokens.css` claims its colours were measured. This one was not, or the measurement was taken at a size the token is never used at.

**Fix**: darken to approximately `#6f6759`.

### 2. Mid-tone colour fields fail with small white text

White text below 16px on `oklch(0.55 0.11 H)` lands between **3.0 and 4.0 to one** on every hue in the family. It fails AA on all six.

**Fix**, and it is now a system rule: any colour field carrying text below 16px uses the **deep tone at 0.48**, not the mid tone at 0.55. On deep it clears.

### 3. The logo ampersand fails

The sage ampersand in the wordmark measures **3.05:1**. That is the primary brand asset, and it is worth resolving before launch rather than after.

### Beyond contrast

- No visible focus states anywhere in the build
- Icons absent, so no icon labelling problems yet, and an opportunity to get it right from the start
- No skip link
- The unstyled browser select on the PLP is, ironically, the most accessible control on the page
- Modal focus management untested

---

## The standard

**WCAG 2.2 Level AA.** Not as a compliance exercise. As a design constraint that makes the work better, and because for a UK retailer it is also a legal exposure under the Equality Act 2010.

### Contrast

| Content | Minimum |
|---|---|
| Body text | 4.5:1 |
| Text 18px+ or 14px+ bold | 3:1 |
| Controls and boundaries | 3:1 |
| Icons carrying meaning | 3:1 |

**Never colour alone.** Roughly 8% of men have some colour vision deficiency. Every state that uses colour also uses a shape, a label or a weight. The group colour system is wayfinding *support*, never the sole carrier of information.

### Keyboard

- Every interactive element reachable in a logical order
- **Visible focus on everything.** A 2px ink outline with a 2px offset. Print language, not a browser default glow
- Focus trapped in modals and drawers, returned to the trigger on close
- Escape closes every overlay
- Skip link to main content as the first focusable element
- No keyboard trap anywhere, including in third-party payment fields

### Targets

- **44 × 44px minimum** on touch. WCAG 2.2 criterion 2.5.8 requires 24, and 44 is the honest number.
- Quantity steppers are the most commonly mis-tapped control in mobile commerce. Give them real separation.

### Screen readers

- Landmarks: header, nav, main, footer
- One h1 per page, no skipped heading levels
- Every image has alt text generated from the **written** title, never the supplier string
- Decorative images and icons `aria-hidden`
- Live regions for the basket count and the delivery threshold, so a change is announced
- Form labels bound properly, errors associated with `aria-describedby`
- Modal dialogues use the WAI-ARIA dialog pattern. Do not hand-roll this.

### Motion

`prefers-reduced-motion` handled at the token level, not per component, so it cannot be forgotten. The reduced state is a 120ms fade, not the absence of feedback. Removing the add-to-basket acknowledgement entirely is worse for the person who needed the accommodation.

### Forms

New in WCAG 2.2 and directly relevant to checkout:
- **3.3.7 Redundant Entry**: do not ask for the same information twice
- **3.3.8 Accessible Authentication**: no cognitive test to complete a purchase. The no-account policy handles this by default.

---

## Performance

A general store lives on mobile and a meaningful share of that is on mid-range Android over patchy 4G. Performance is a design constraint, not an engineering afterthought.

### Budgets

| Metric | Target | Notes |
|---|---|---|
| LCP | under 2.0s | Almost always the hero or first product image |
| INP | under 200ms | Add to basket is the action that matters |
| CLS | under 0.05 | Skeletons and reserved heights do this |
| JS, first load | under 150KB gzipped | |
| Fonts | under 100KB | Two families, variable, subset |
| Icons | under 12KB | Inline above the fold, sprite the rest |
| Images, per PLP page | under 600KB | 24 cards at 400px WebP |

### The specifics that matter here

**Fonts.** Archivo variable and Inter variable. Subset to Latin. `font-display: swap` with a metric-matched fallback so the swap does not shift layout. Preload only the two weights above the fold.

**Images.** This is where a shop wins or loses. AVIF with WebP fallback, correct `srcset` and `sizes`, explicit width and height on every image, lazy loading below the fold, eager on the LCP element. All of it depends on the pipeline in [05](05-imagery-pipeline.md).

**The card grid** is the performance-critical component because it renders 24 times. Every kilobyte in it multiplies.

**No layout shift from any animation.** Transform and opacity only.

**Third parties.** Every script is a tax. Analytics, chat widgets, review platforms, consent banners. A consent banner alone frequently costs more than the entire storefront JavaScript. Audit before adding, not after.

**Service worker** for the offline state and for caching previously viewed products. Cheap and it makes the shop feel considerably faster on a return visit.

---

## Testing

Not optional and not a launch-week activity.

- **Automated**: axe or Lighthouse in CI. Catches roughly 30% of issues, which is worth having and is not sufficient.
- **Keyboard**: every flow, unplugged mouse, once per release.
- **Screen reader**: VoiceOver on iOS and NVDA on Windows. The two that matter.
- **Real device**: a mid-range Android on throttled 4G. Not a throttled desktop, which lies about CPU.
- **Zoom**: 200% and 400%. Reflow, no horizontal scroll.
- **Contrast**: automated across every token pair and size combination, run as a check rather than an opinion.

---

## Measure

- Core Web Vitals from field data, not lab data. Real users on real devices.
- Lighthouse accessibility score above 95, understanding that 100 proves very little.
- Zero automated accessibility violations in CI.
- Conversion rate split by device and connection speed. Slow-connection conversion is the clearest evidence of whether performance work paid.

## Study

- WCAG 2.2 Understanding documents. Denser than the guidelines and considerably more useful.
- GOV.UK Service Manual on accessibility. The most practical public guidance in existence.
- web.dev on Core Web Vitals, particularly the INP migration from FID.
- WebAIM contrast checker, and their annual Million report on the state of the web.
- Adrian Roselli's writing on tables, dialogues and focus management. Rigorous and frequently corrective.
- Inclusive Components, Heydon Pickering.
- The Equality Act 2010 and EN 301 549, for the UK legal position.
