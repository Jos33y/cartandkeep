# Cart & Keep store: channels, accounts and choosing products

**27 September 2026** · The Brick Dev Studios · internal

Two things in one place: what her own store (cartandkeep.com) needs before it can appear on Google, Bing and the AI shopping assistants, and how we choose which products go on it. Nothing here is registered or built yet.

---

## Part 1. Getting the store listed

### The product feed

A link on her site that lists every product in a fixed format, fetched by Google, Bing and others on a schedule:

```
https://cartandkeep.com/feeds/google.xml
```

One entry per product:

| Field | Example |
|---|---|
| id | CK-0142 |
| title | Easyfit Folding Bed Rail for Elderly Adults |
| description | the product page text |
| link | https://cartandkeep.com/products/easyfit-bed-rail |
| image_link | the product photo |
| price, availability | £34.99, in stock |
| brand, gtin (barcode), mpn (model number) | Easyfit, 5055…, EF-200 |
| condition, shipping | new, £3.49 |

We build it: a function reads the products table and rewrites the feed when a product, price or stock changes. The Google format also serves Microsoft and, reportedly, Perplexity. ChatGPT has its own format: a second export of the same data.

Microsoft rejects most branded products without a barcode (GTIN). Supplier feeds carry barcodes; shelf finds usually do not.

### Accounts to register

All free, all in her business's name, with the studio added as a manager.

| Account | What for | Needs |
|---|---|---|
| Google Merchant Center | free listings on Google Shopping; the best-sellers and price reports (Market Insights, switched on under "Manage programs") | a Google account; verify and claim cartandkeep.com with a DNS record in Cloudflare |
| Google Search Console | which searches find her pages, and how often | the same DNS step |
| Microsoft Merchant Center (through a free Microsoft Advertising account) | Bing Shopping and Copilot Shopping, live in the UK | a Microsoft account; verify the site |
| Bing Webmaster Tools | Bing's Search Console; IndexNow for faster indexing | can import from Google Search Console |
| ChatGPT merchants, chatgpt.com/merchants | a place in ChatGPT shopping; UK timing unclear | an application, then a waitlist |
| Google Ads, Microsoft Advertising (no spend needed) | keyword planners: UK monthly search volumes | an account |

Build on Google's **Merchant API**. The older Content API for Shopping starts failing from 1 September 2026.

### What the store must show before Google approves it

- Trading address and contact details
- Returns and refunds policy page
- Shipping costs and delivery times
- Terms, and a secure checkout

Already on the open list as "trading address and returns policy into Settings". Now urgent.

### Order of work

1. Store pages: address, contact, returns, shipping, terms.
2. Build the feed link.
3. Register Google Merchant Center and Search Console; submit the feed with the products already on the store; turn on free listings and Market Insights.
4. Register Microsoft Merchant Center and Bing Webmaster Tools; reuse the feed.
5. Apply at chatgpt.com/merchants.
6. Open Google Ads and Microsoft Advertising accounts for the keyword planners, with no spend.

Open question: does she have a Google account in the business's name?

---

## Part 2. Choosing products for the store

### Why the eBay gate is the wrong test here

The eBay gate asks whether a new seller can win on eBay's search page, so it refuses crowded markets and markets only big sellers move. On her own store she competes for Google and her own shoppers, not eBay's ranking. Crowding is proof of demand. The store needs its own test.

### The store test

Refuse, never score, as everywhere else. A product goes on the store only if every test passes:

| Test | Passes when |
|---|---|
| Demand | at least one signal below shows UK buyers want it |
| Source | a supplier can send it: ideally a feed with stock, barcode, photos and licensed text; otherwise stock she holds |
| Margin | profit at the market's median price after store costs (card fees about 2%, postage, packaging, returns allowance) |
| Content | a page can be written for it that is her own: no copied photos or text from the shop it was found in |
| Fit | it belongs in a section with a reason to exist ("After a hip replacement", "Pet Essentials", "Replacement filters and parts") |

Survivors are then ordered by the strength of their demand evidence, and listed in batches per section.

### Demand signals, and when each is available

**Available now, before anything is listed:**

1. **Our eBay data, read differently.** Every gate snapshot records how many units the whole sampled market sells a month. The crowded and big-seller-only markets the eBay gate refused are the strongest store candidates. Re-reading the snapshots under the store test costs no eBay calls.
2. **The shops' own best-seller order.** Shopify shops we already read (Lakeland, Hannworld, Maplin, Complete Care Shop, Essential Aids where it applies) list collections sorted by best-selling. Their rank is their own sales telling us what UK buyers buy.
3. **Keyword planners** (Google Ads, Microsoft Advertising, no spend): UK monthly searches for a product phrase. A product people search for by name is a product a page can rank for.
4. **Google Trends** (website, free): timing. When a product's searches rise and fall across the year, so the store lists winter lines in October, not December. The official Trends API is an application-only alpha.
5. **Her eBay traffic:** listings opened but not bought (359 in the last 90 days). Real interest, priced better on her store without eBay's fees.

**Available once the store feed is live (even with only today's products on it):**

6. **Google Merchant Center best sellers:** the best-selling products and brands on Google in the UK, by category, and whether she carries them. Matched against our shelves by brand, model number and barcode, this is the most direct "what to stock" list there is. Pulled weekly through the Merchant API.
7. **Price competitiveness report:** for products she lists, how her price sits against other merchants selling the same item.

**Available once products are listed:**

8. **Search Console:** which product pages are shown in Google, for which searches, and clicked. The pages that earn impressions stay; the ones that earn nothing after 60 to 90 days are replaced.
9. **Merchant Center and Bing performance:** clicks and sales from free listings, per product.

### The loop

1. Candidate pool: our shelves (about 290,000 products) and, as they open, supplier feeds.
2. Store test on the pool, using signals 1 to 5 now and 6 and 7 once the feed is live.
3. List survivors in batches of about 100 per section, each with its own page.
4. Measure with signals 8 and 9.
5. Keep what earns impressions and sales; replace what does not; feed what sells back into the eBay gate as a candidate to list there too.

### One pipeline, labelled Store

The store does not get a separate system. It uses the same shelves, scan, gate, import and review screen, labelled Store. Decided 27 September.

- `scan.js` and `gate.js` take `--for=store`: the same eBay data read under the store test (crowded and big-seller markets not refused; demand counted across the whole market; margin at the median price with store costs).
- Every card carries both answers, for example "Store: passes" and "eBay: crowded, only large sellers", so she can see whether a product suits one channel or both.
- Import with `--term=store --label="Store"`: cards gather in a Store tab beside Care & DIY and General.
- No restriction either way. A Store card can be listed on eBay; an eBay card can go on the store. The label says what it is mainly for, not what it is limited to.
- This week's gate snapshots are re-judged for the store at no cost, so the Store tab starts full before any new calls are spent.

### First build

The store mode in `scan.js` and `gate.js` (`--for=store`), both answers on the card, and a Store tab. Then re-judge this week's snapshots for the store and import them, with the shops' best-seller rank added. No eBay calls. Then keyword-planner volumes for the survivors, then the Merchant Center best-sellers match once the feed is live.
