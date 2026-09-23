/*
 * One query, measured: search, sample, read, and judge.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

import { D, stats, bandOf, headroomAt, maxGoodsCost } from './cost.js';
import { search, getItem } from './ebay.js';
import { readSeller, readBrand, routeOf, readSold, readAge } from './listing.js';

// -------------------------------------------------------------------- one query

export async function assess({ access, marketplace, q, cfg, probe }) {
  const body = await search({ access, marketplace, q, limit: cfg.searchLimit, categoryIds: cfg.categoryIds, filter: cfg.filter });
  const items = body.itemSummaries ?? [];

  if (probe) {
    console.log('\n--- raw itemSummary[0] ---');
    console.log(JSON.stringify(items[0] ?? null, null, 2).slice(0, 2400));
  }

  const competitors = Number(body.total ?? items.length) || 0;
  if (!items.length) {
    return {
      q, competitors, feedback: null, price: null, soldTotal: null, soldKnown: 0,
      observedPerMonth: null, sampled: 0, profit: null,
      sourcing: { route: 'unknown', known: 0, openShare: null, top: [] },
      entry: { proved: false, youngSeen: 0 }, listings: [],
    };
  }

  const sellers = items.slice(0, 20).map(readSeller);
  const feedback = stats(sellers.map((s) => s.feedback));
  const price = stats(items.map((i) => Number(i.price?.value)));

  const top = items.slice(0, cfg.sample);
  const listings = [];
  let soldTotal = 0;
  let soldKnown = 0;

  for (const it of top) {
    const detail = await getItem({ access, marketplace, itemId: it.itemId });
    if (probe && listings.length === 0) {
      console.log('\n--- raw estimatedAvailabilities ---');
      console.log(JSON.stringify(detail?.estimatedAvailabilities ?? detail?.error ?? null, null, 2).slice(0, 1200));
    }
    const sold = readSold(detail);
    if (sold != null) { soldTotal += sold; soldKnown += 1; }
    const s = readSeller(it);
    const ageDays = readAge(it);
    listings.push({
      itemId: it.itemId,
      title: it.title ?? null,
      brand: readBrand(detail),
      priceGbp: Number(it.price?.value) || null,
      // Already on the wire from both calls and thrown away until now. Without
      // it sourcing means walking into a shop holding a text string.
      imageUrl: it.image?.imageUrl ?? detail?.image?.imageUrl ?? null,
      seller: s.username,
      sellerFeedback: s.feedback,
      accountType: it.seller?.sellerAccountType ?? null,
      ageDays: ageDays == null ? null : Math.round(ageDays),
      soldLifetime: sold,
      // Lifetime sold over the listing's own age is a rate on the first run,
      // which is what the weekly delta was going to be waited on for. But a
      // listing two days old with four sales reads as four a day, which is
      // noise, so a rate is only trusted once the listing has some age.
      soldPerDay: sold != null && ageDays ? Math.round((sold / ageDays) * 100) / 100 : null,
      rateTrusted: ageDays != null && ageDays >= cfg.minAgeDays,
    });
  }

  // The entry test. A young listing that is actually selling, from a seller
  // small enough that the sale says something about entry rather than about
  // standing she does not have.
  //
  // Size is not part of finding the listing, only of judging it. Filtering it
  // out here threw away the useful fact that a 3,302 feedback seller is taking
  // 27 units in 46 days, which is not proof of entry but is worth reading.
  const young = listings.filter((l) => l.ageDays != null && l.ageDays <= cfg.youngDays
    && l.sellerFeedback != null);
  // Smallest first, not fastest. The question is whether a seller her size can
  // get in, and the fastest young seller in a sample is routinely the largest
  // of them. Rate breaks a tie.
  //
  // Selling means a rate, not a sale. A listing showing one unit in eighty days
  // was being reported as entry proved: it is one person who bought a thing
  // once, and at 0.4 a month it is under the one to two a month this whole
  // catalogue is being built to hit. Two units and a real monthly rate before
  // anything is divided.
  const selling = young.filter((l) => l.rateTrusted
    && l.soldLifetime >= unitsNeeded(l.ageDays, cfg)
    && (l.soldPerDay ?? 0) * 30 >= cfg.minEntryPerMonth)
    .sort((a, b) => a.sellerFeedback - b.sellerFeedback || b.soldPerDay - a.soldPerDay);
  const smallest = selling[0] ?? null;

  // Somebody small and recent has sold, just not enough of it to be a rate.
  // Kept separately so the verdict can say which of the two it is looking at.
  const thin = young.filter((l) => l.soldLifetime > 0 && !selling.includes(l))
    .sort((a, b) => a.sellerFeedback - b.sellerFeedback)[0] ?? null;

  const observedPerMonth = listings.reduce((n, l) => n + (l.rateTrusted ? (l.soldPerDay ?? 0) : 0), 0) * 30;

  // The median of what is selling, not of what is listed. Half a page of
  // listings that have never sold sets a price nobody has been paid, and that
  // price is what every cost figure is then worked out from.
  const soldPrices = listings.filter((l) => (l.soldLifetime ?? 0) > 0 && l.priceGbp > 0).map((l) => l.priceGbp);
  const soldStats = soldPrices.length >= cfg.minSellingPrices ? stats(soldPrices) : null;
  const priced = price
    ? {
      ...price,
      median: soldStats?.median ?? price.median,
      listedMedian: price.median,
      sellingSeen: soldPrices.length,
      basis: soldStats ? 'selling' : 'listed',
    }
    : null;

  return {
    q,
    competitors,
    feedback,
    sourcing: routeOf(listings),
    entry: {
      proved: Boolean(smallest) && smallest.sellerFeedback <= cfg.maxFeedback,
      youngSeen: young.length,
      thin: !smallest && Boolean(thin),
      ...(smallest ?? thin ?? {}),
    },
    price: priced,
    soldTotal: soldKnown ? soldTotal : null,
    soldKnown,
    observedPerMonth: soldKnown ? Math.round(observedPerMonth) : null,
    sampled: top.length,
    // The entry listing first, because that is the one being pointed at, then
    // any listing carrying a picture. Tying the image to entry proof left four
    // rows on the board with an empty square, and an empty square on a sourcing
    // card is the whole problem this was built to solve.
    imageUrl: smallest?.imageUrl ?? listings.find((l) => l.imageUrl)?.imageUrl ?? null,
    band: cfg.band,
    headroom: priced ? headroomAt(priced.median, cfg) : null,
    maxGoods: priced ? maxGoodsCost(priced.median, cfg) : null,
    listings,
  };
}
