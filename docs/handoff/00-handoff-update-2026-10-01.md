# Update to the handoff of 1 October

Everything below happened after `00-handoff-2026-10-01.md` was written. Where they differ, this wins.

## SHAVINGFUN is live on eBay

- Item 318942398301: https://www.ebay.co.uk/itm/318942398301
- The first listing published from the portal. The counter reads 1 of 300 this month.
- `ck-publish-photos-2026-10-01` is deployed: the barcode fix, photos that go in by themselves, and the large view. Items 1 and 2 in the handoff's open list are done.
- Not checked yet: whether eBay refused the barcode first time. The card's `ebay` record holds `barcode_dropped` if it did.

## Send to Cart & Keep now reads any shop (deployed)

Zip `ck-send-any-shop-2026-10-01`, 3 files: `src/lib/sendToCart.js`, `src/pages/portal/ApprovedPage.jsx` and `supabase/functions/photo-check/index.ts`. Deployed.

**Amazon, read by Amazon's own markup:**
- **Photos:** the gallery of the colour chosen, at full size. The array is cut out by counting brackets, because its entries hold brackets of their own. Other colours, videos and sponsored products are left out.
- **Facts:** title, brand, the colour or size chosen, the bullets, and the details tables and bullets, with Amazon's hidden characters cleaned out. The description too.
- **Dropped:** "Make sure this fits", plus the reviews, rank, ASIN and date rows.
- **The address sent** is the plain `/dp/` product link.
- **When it counts as Amazon:** an Amazon address, or Amazon's page markup on any address.

**Any other shop, read as a person sees it:**
- **Photos:** from the shop's product data and AliExpress's gallery data, then every large photo on the page at its biggest size (srcset, zoom and lazy-load addresses). A gallery's thumbnails count even when small.
- **Left out:** header, footer, menus, and strips for related products, recommendations, reviews, logos, badges and payments. These are matched as whole words, so a "preview" gallery is kept.
- **Full-size addresses:** AliExpress, Shopify and WordPress thumbnails are turned into the full-size photo.
- **Facts:** specifications from tables, definition lists and two-part label and value rows (AliExpress's layout included), the description, and the barcode from the shop's product data.

**Other changes:**
- On the portal or her own shop, it says "Open your supplier's product page first" and sends nothing.
- `photo-check` now looks at up to 12 photos from a sent page (`SENT_PHOTOS`), up from 8.
- The wording on the card says it works on any shop. Do not name a browser's bar.

**Bookmark rules:**
- The bookmark is one line. Block comments only, and no percent signs: a javascript: address reads a percent sign as an escape.
- It keeps the portal address it was dragged from. One dragged from localhost sends to localhost.
- After any change to the button, she deletes the old bookmark and drags it again from the live portal.

**Tested on** pages built to copy Amazon, AliExpress, a Shopify shop and the portal, both from the source and minified. **Not yet tried on a real Amazon or AliExpress page.** Joseph is to try it on the SHAVINGFUN Amazon page and compare the photos with Amazon's gallery.

## How Joseph deploys

- Edge functions go out with the Supabase CLI from his machine: `supabase functions deploy <name>` from `C:\Users\josep\WebstormProjects\cartandkeep`.
- His CLI is v2.72.7, while v2.119.0 is out. Updating is optional.
