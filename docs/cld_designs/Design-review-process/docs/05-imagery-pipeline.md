# 05 — Imagery Pipeline

---

## Verdict

Product imagery is the largest single drag on the perceived quality of the shop, and no layout work fixes it.

What is on the page today:

- A pink screwdriver cutout on white
- A nappy-bag collage with Chinese marketplace text baked into the pixels
- A Mr Muscle bottle repeated four times with a GUARANTEED starburst
- A cat's face on purple packaging
- A category hero built from a drill bit enlarged roughly 800% and darkened to a grey-green murk

Different backgrounds, different crops, wildly different product-to-frame ratios, marketing text burnt in on about half. Stacked in a grid it reads as a dropship site, because it is dropship imagery.

Two corrections to an earlier reading of this. **Colour variety is not the problem.** Pink, green, blue and black across a grid is good and a general store should look like that. **And this is not a design problem.** It is a pipeline problem wearing a design problem's clothes, which is why it has to be solved once, in code, at import.

---

## The job

At 78 SKUs a human could fix these by hand. At 200 they will not. At 1000 it is not a conversation.

The pipeline has to guarantee four things without anyone looking at an image:

1. Every product sits in the same frame, at the same scale, on the same background.
2. No image carries embedded marketing text.
3. Every image is sharp at every size the shop renders it at.
4. Anything that cannot be fixed automatically is quarantined rather than published.

---

## The rules

### Canvas

- **Square, 1:1**, always. A mixed-ratio grid cannot be rescued by CSS.
- **2000 × 2000 master**, served at 1200, 800, 600, 400 and 200.
- **Background**: transparent PNG or WebP master. The *frame* colour is applied at render time from the department group wash, never baked into the file. This is what lets the same asset sit on cream in the grid, on wash in the card and on white in an email.

### Scale

- **The product occupies 82% of the frame's shorter dimension.** One number, applied to everything.
- This is the rule that makes a screwdriver and a saucepan look like they belong to the same shop. It is more important than any other item in this document.
- Exception: multipacks and sets get 88%, because they read smaller.

### Rejection

An image is quarantined, not published, if it:

- Contains any text, logo, starburst, badge or price
- Is a collage of more than one shot
- Is below 1000px on its shorter side
- Has a watermark
- Cannot be background-removed with confidence above the model's threshold
- Contains a person, a hand or a face, unless the product is worn

Quarantined items go to a review queue. A product with no acceptable image is published with a **department-marked placeholder**, not with a bad image. A clean placeholder is worth more than a bad photograph, because a placeholder reads as "not photographed yet" and a bad photograph reads as "this shop is careless".

---

## The process

```
supplier feed
     ↓
fetch highest-resolution variant available
     ↓
text / logo / watermark detection        → fail → quarantine
     ↓
background removal
     ↓
confidence check                          → fail → quarantine
     ↓
trim to content bounds
     ↓
recanvas to 1:1 at 82% inset
     ↓
resolution check                          → fail → quarantine
     ↓
generate responsive sizes, WebP + AVIF
     ↓
publish
```

Tools that do this well: Cloudinary and imgix both handle recanvassing, format negotiation and responsive delivery. Background removal via remove.bg, Photoroom or a self-hosted rembg. Text detection via any OCR pass, Tesseract is sufficient for a yes-or-no answer.

The whole pipeline is a few hundred lines and a small monthly bill. It is the highest return on investment in the entire project.

---

## Treatments

Once every image is on the same canvas, treatments become possible. These are what turn a corrected catalogue into a designed one.

**Group wash frame.** The image frame takes the department group wash rather than white. Cutouts on white then sit inside a warm coloured frame and read as deliberate.

**Registration offset.** On hover, a 2px offset of the group colour behind the frame. Depth without a shadow, and department coding at the same time.

**Halftone field.** Behind the product, at a coarse pitch, in group colour at low opacity. Fills the negative space around an awkwardly proportioned object without cropping it.

**Duotone for editorial.** Where a lifestyle or group shot is used in a homepage band, run it as a two-colour duotone in the group hues. This unifies photography of wildly different origins and it is unmistakably a print technique rather than a filter.

**Scale reference.** For anything where size is the question, and in a general store that is most things, a printed dimension rule along one edge. Argos does this, IKEA does this, and it removes the single most common pre-purchase doubt.

---

## The hero problem

The PLP category hero is currently a supplier cutout enlarged past its resolution. It has to go, and it cannot be replaced with photography that does not exist.

Three viable replacements, none of which need a camera:

1. **Colour field with catalogue numerals.** Department group colour, deep tone, department name in wide Archivo at 46px, product count and price range set large. Halftone field behind. This is built and shown in the Foundations file.
2. **Typographic shopfront panel.** The department name at hero scale using the width axis, overprinted with the group colour, no imagery at all.
3. **Specimen grid.** Nine recanvassed product cutouts from that department, arranged on a strict grid on the group wash. Only possible *after* the pipeline is running, and it is the best of the three once it is.

---

## Scaling to 1000

**Content operations matter more than design here.** Some notes for the build.

- Images are fetched and processed **on import**, not on request. A first visitor should never pay for a background removal.
- Every product has an image status: `published`, `placeholder`, `quarantined`. Surface the counts on the admin dashboard. Somebody should be able to see "43 products awaiting image review" without running a query.
- Re-process on supplier update, but keep the previous asset until the new one passes. Never let a feed update replace a good image with a bad one.
- Store the master. Every treatment derives from it. Never destructively edit.
- Alt text is generated from the *written* product title, not the supplier string. See [16 — Voice & Content](16-voice-and-content.md).

---

## Measure

- Percentage of catalogue with a published image, tracked weekly. Target above 95% before any paid traffic.
- Quarantine queue depth. If it grows week on week, the rejection thresholds are wrong or the supplier is wrong.
- Largest Contentful Paint on PLP and PDP. Images are almost always the LCP element in a shop.
- Visual: screenshot a full 24-product grid. If any product's visual weight is obviously different from its neighbours, the 82% rule is not being applied.

## Study

- Baymard Institute on product image requirements. Their research on image count, zoom and scale reference is the most rigorous available and it is worth the subscription for this alone.
- Cloudinary and imgix documentation on automatic content-aware cropping and format negotiation.
- IKEA and Argos for scale reference conventions.
- Muji for specimen photography as a house style.
- web.dev on responsive images, `srcset`, `sizes` and modern format delivery.
- Screwfix for the honest truth that a fast, consistent, unglamorous image grid outperforms a beautiful inconsistent one.
