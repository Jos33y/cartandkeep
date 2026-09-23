# 19 — References

Every source referenced across the set, in one place, with a note on what each is actually for.

---

## Research

The evidence base. Most assertions in these documents rest on one of these.

**Baymard Institute** — baymard.com
The most rigorous ecommerce usability research available. 100,000+ hours of testing across checkout, PLP, PDP, search and post-purchase. Their public articles are excellent and the subscription is worth it for a commerce project. If a claim in this document set sounds confident, it is usually because Baymard tested it.

**Nielsen Norman Group** — nngroup.com
Broader interaction research. Particularly good on navigation, forms, error messages and the frequently misquoted five-user finding.

**GOV.UK Service Manual and Design System** — design-system.service.gov.uk
The best public design guidance in existence, free, and specifically excellent on forms, error handling, accessibility and plain-language content. UK-relevant, which matters here.

---

## Design systems worth reading

Not to copy. To see how mature systems document *purpose* rather than value.

- **Shopify Polaris** — polaris.shopify.com. Commerce-specific, well documented.
- **Material Design 3** — m3.material.io. Ignore the visual style, take the motion and choreography thinking.
- **Apple Human Interface Guidelines** — Particularly on writing, and on reduced motion, where the guidance is more thoughtful than the WCAG minimum.
- **Atlassian Design System**, **IBM Carbon** — Both good on token documentation.

---

## Open storefronts and code

Legitimate to read, learn from and build on.

- **Shopify Dawn** — github.com/Shopify/dawn. The reference theme. Read the PLP and PDP templates.
- **Hydrogen demo store** — Shopify's React storefront.
- **Vercel Commerce** — github.com/vercel/commerce
- **Saleor storefront**, **Medusa storefront** — Both open, both well structured.
- **Radix UI** — radix-ui.com. Unstyled accessible primitives. Use for dialogue, popover and select rather than hand-rolling.
- **Base UI** — The successor project from the same lineage.

---

## Motion

- **Emil Kowalski, *Animations on the Web*** — emilkowal.ski. The best current writing on interface motion, and specifically on why easing asymmetry matters.
- **Rauno Freiberg** — rauno.me. Interaction detail at a level almost nobody reaches.
- **Motion** — motion.dev. The library formerly published as Framer Motion.
- **GSAP** — gsap.com. For anything Motion cannot do.
- **Rive** — rive.app. Better than Lottie for interactive marks. Smaller, state-machine driven.
- **View Transitions API** — MDN and the Chrome developer docs.
- **easings.net** and **cubic-bezier.com** — Curve intuition.
- **Val Head, *Designing Interface Animation*** — The vocabulary to argue about motion in a review.

---

## Typography and colour

- **Utopia** — utopia.fyi. Fluid type and space scales that interpolate rather than step.
- **Matthew Butterick, *Practical Typography*** — practicaltypography.com. Measure, scale, and why most web typography is wrong.
- **OKLCH picker** — oklch.com
- **Evil Martians on OKLCH** — Why perceptual lightness matters when building a colour family.
- **Refactoring UI**, Wathan & Schoger — Hierarchy through weight and colour rather than size alone.
- **Müller-Brockmann, *Grid Systems in Graphic Design*** — The underlying discipline.

---

## Icons

- **Phosphor** — phosphoricons.com. The recommendation. Six weights, MIT, comprehensive commerce coverage.
- **Lucide** — lucide.dev. The correct second choice.
- **Iconoir**, **Material Symbols** — Worth reading before committing.
- **Otl Aicher, Munich 1972 pictograms** — The reference for a system of marks sharing a construction logic.
- **AIGA / DOT transport pictograms** — Same lesson, simpler weight.
- **SVGO** — Optimisation.

---

## Imagery

- **Cloudinary**, **imgix** — Recanvassing, format negotiation, responsive delivery.
- **remove.bg**, **Photoroom**, **rembg** — Background removal.
- **web.dev on responsive images** — `srcset`, `sizes`, modern formats.
- **Baymard on product images** — Image count, zoom, scale reference.

---

## Search

- **Algolia** — algolia.com. Documentation on typo tolerance and synonyms is excellent regardless of whether you use it.
- **Typesense** — typesense.org. Self-hostable, considerably cheaper at this scale.
- **Baymard on ecommerce search** — Autocomplete, synonym handling, zero-result recovery.

---

## Payments and forms

- **Stripe Elements and Payment Request API** — stripe.com/docs
- **Ideal Postcodes**, **Loqate** — UK address lookup.
- **GOV.UK form patterns** — The best documented accessible form guidance available.

---

## Accessibility

- **WCAG 2.2 Understanding documents** — w3.org. Denser than the guidelines and considerably more useful.
- **WebAIM contrast checker** and the annual **WebAIM Million** report.
- **Adrian Roselli** — adrianroselli.com. Tables, dialogues, focus management. Rigorous and frequently corrective.
- **Heydon Pickering, *Inclusive Components*** — inclusive-components.design
- **WAI-ARIA Authoring Practices** — Dialogue, combobox, disclosure patterns.
- **axe DevTools**, **Lighthouse** — Automated, catches roughly 30%.

---

## Performance

- **web.dev on Core Web Vitals** — Particularly the INP migration.
- **Plausible**, **Fathom**, **Umami** — First-party analytics without the performance tax.

---

## Content

- **GOV.UK content design guidance and A to Z of style** — The best public writing standard in existence.
- **Kissane & Kim, *Nicely Said*** — Voice and tone for interfaces.
- **Erika Hall, *Conversational Design*** — Why plainness beats personality.
- **Schema.org** — `Product`, `Offer`, `FAQPage`, `BreadcrumbList`. Structured data is free search visibility.
- **Google Merchant Center product data specification** — A good checklist of attributes worth extracting.

---

## Shops worth studying

For structure and interaction. **Not to copy.** A clone of a famous shop is instantly recognisable as a clone, and that is exactly what makes work look cheap.

**General store and catalogue**
- **Argos** catalogue front sections, Internet Archive. Numbered index navigation with counts, done to a level no website has matched.
- **Flying Tiger**, **Søstrene Grene** — In store rather than online. Department colour at scale.
- **Monoprix** own-brand packaging. Colour discipline across an enormous range.
- **Muji** — Signage systems and specimen photography as a house style.

**Trade and density**
- **Screwfix**, **Toolstation** — Genuinely excellent trade PLPs. Dense, fast, honest, filterable. Ugly, and they convert extremely well. Understand why before rejecting the lesson.
- **Decathlon** — Facet design across a very broad catalogue.
- **IKEA** — Dimension and scale communication.

**Interaction quality**
- **Zalando** — Filter interaction, particularly the mobile sheet.
- **ASOS** — Desktop grid preservation.

**Marketplace structure**
- **eBay item specifics**, **Amazon product tables** — Both ugly, both extremely well researched, both driven entirely by structured data. Study the information architecture.

---

## Legal, UK

- **Consumer Rights Act 2015**
- **Consumer Contracts Regulations 2013**
- **Equality Act 2010** and **EN 301 549** — Accessibility obligation.
- **UK GDPR** and the ICO guidance on cookies and consent.

---

## A closing note on inspiration

Everything above is a source of *technique*, *structure* and *evidence*.

None of it is a source of appearance. The moment this shop looks like a named reference, it has lost the thing that makes it worth what it costs. The references exist so the work can be better than them, not so it can resemble them.

The material language in [02 — Craft & Material](02-craft-and-material.md) is the part that has to be Cart & Keep's own, and it is the part that no reference list can supply.
