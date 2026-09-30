import {
  PROFIT, breakEvenFor, cheapestCost, dropshipCosts, ebayCosts, floorFor, goodsToList, isPackCheck, keepAt as keepFor, listFor, marketAllows, positionOf, profitAt, storeCosts,
} from './pricing.js';

// Above this many variations the price is a blend.
export const BLENDED = 10;

// Mirrors maxFeedback in gate.js, for rows imported before entry carried its own.
const CEILING = 1000;

// Above this, the converting listing is usually a bigger pack than the shelf one.
export const PACK_RATIO = 3.5;

// A shop card this far over Google's lowest price is not one to list as it is: Over Google's price.
export const STORE_OVER = 0.10;

// Under this many sold a month across the sample, a proved card still waits in Sells slowly.
export const READY_MIN_SOLD = 5;

// A cost typed in to see what it would do. Never saved, never a supplier. Delivered to the buyer unless she says she posts it.
const tried = (v, posted) => (v != null && Number(v) > 0
  ? { cost: Number(v), from: 'At that cost', basis: 'try', confirmed: true, shelf: null, fulfilment: posted === 'you' ? 'stock' : 'dropship' }
  : null);

// Who posts the parcel, which decides whether her postage and packing are a cost. Only a supplier of hers, or a cost
// she is trying, can say the supplier posts; a shelf price leaves her posting it, as the stand-in.
const postedBy = (cost) => ((cost?.basis === 'supplier' || cost?.basis === 'try') && cost.fulfilment !== 'stock' ? 'supplier' : 'you');

const round = (v) => Math.round(v * 100) / 100;
const gbpText = (v) => `£${Number(v).toFixed(2)}`;
const fieldText = (comp) => (comp?.p25 != null && comp?.p75 != null ? `${gbpText(comp.p25)} to ${gbpText(comp.p75)} range ` : 'range ');

export function keepAt(price, margin, goods) {
  const r = margin?.rates;
  if (!r || price == null) return null;
  return round(price * (1 - r.fvf - r.ad)
    - r.fixed
    - Number(margin.postage ?? 0)
    - Number(margin.packaging ?? 0)
    - Number(margin.returns_allowance ?? 0)
    - Number(goods ?? 0));
}

// keepAt solved for price.
export function priceFor(left, margin, goods) {
  const r = margin?.rates;
  if (!r || goods == null || left == null) return null;
  const fixed = r.fixed
    + Number(margin.postage ?? 0)
    + Number(margin.packaging ?? 0)
    + Number(margin.returns_allowance ?? 0);
  return round((fixed + Number(goods) + left) / (1 - r.fvf - r.ad));
}

// Butcher's found a 24 tin case on eBay against a 6 tin shelf pack.
export function packOf(name) {
  const t = String(name ?? '').toLowerCase();
  const m = t.match(/(\d+)\s?x\s?\d/)
    || t.match(/\bx\s?(\d+)\b/)
    || t.match(/(\d+)\s?(?:pack|pk|tins|trays|pouches|washes|tabs|tablets)\b/);
  return m ? Number(m[1]) : null;
}

// Shop tags as the shelves name them, shown as the shop's own name.
const SHOP_NAMES = {
  bmstores: 'B&M', hb: 'Home Bargains', 'hb-seasonal': 'Home Bargains', 'hb-costed': 'Home Bargains', savers: 'Savers',
  poundland: 'Poundland', theworks: 'The Works', toolstation: 'Toolstation', wickes: 'Wickes', lakeland: 'Lakeland',
  completecareshop: 'Complete Care Shop', essentialaids: 'Essential Aids', hannworld: 'Hannworld', maplin: 'Maplin',
  qdstores: 'QD Stores', cpc: 'CPC', hartsofstur: 'Harts of Stur', studio: 'Studio', johnlewis: 'John Lewis',
  homediscount: 'Home Discount', monstershop: 'MonsterShop', lights4fun: 'Lights4fun',
  cityplumbing: 'City Plumbing', longacres: 'Longacres', petsathome: 'Pets at Home', halfords: 'Halfords',
  towsure: 'Towsure', vetshop: 'VetShop', petshop: 'Pet Shop', spares2you: 'Spares2you', swelluk: 'Swell UK',
  homescapes: 'Homescapes', minky: 'Minky', howetools: 'Howe Tools', abilitysuperstore: 'Ability Superstore',
  manageathome: 'Manage at Home', medisave: 'Medisave',
  // The Home Bargains scans label their cards "H & B".
  'H & B': 'Home Bargains',
};
// Every shop's name as she reads it, for catching a shop named in her own listing copy.
export const SHOP_NAME_LIST = [...new Set(Object.values(SHOP_NAMES))];

// Tags from the shelf scripts, and web addresses from the store pipeline ("lakeland.co.uk"), read as one name.
export const shopName = (tag) => {
  if (tag == null) return tag;
  const raw = String(tag).trim();
  if (SHOP_NAMES[raw]) return SHOP_NAMES[raw];
  const host = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  // A bare tag in lower case ("cityplumbing") is a machine's spelling, so it reads with a capital.
  if (!/\.[a-z]{2,}$/.test(host)) return /^[a-z0-9 ]+$/.test(raw) ? raw.replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
  const key = host.split('.')[0];
  return SHOP_NAMES[key] ?? key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// How the market figures were read, so a median from three selling listings says so.
function marketReadOf(comp) {
  if (!comp) return null;
  const listings = Array.isArray(comp.listings) ? comp.listings.filter((l) => Number(l.price) > 0) : [];
  return {
    basis: comp.price_basis ?? null,
    sellingSeen: comp.selling_seen ?? null,
    medianListed: comp.median_listed ?? null,
    sampled: listings.length || comp.sample || null,
    listings,
  };
}

// Where a card is for. A card through the eBay route (scanned, gated and imported with the eBay account) is for
// her shop as well as eBay, whatever the import wrote. A store card is for the channels the import recommended.
export function channelsOf(row) {
  const set = new Set(row?.recommended_channels ?? []);
  if (row?.margin?.channel === 'store') set.add('store');
  else { set.add('ebay'); set.add('store'); }
  return ['store', 'ebay'].filter((c) => set.has(c));
}

// A store card: her own price from the cheapest real cost (where it was seen, or a supplier she added).
function assessStore(row, tryCost = null, holdPrice = false, tryPosted = 'supplier') {
  const m = row.margin ?? {};
  const d = row.draft ?? {};
  const g = m.google ?? {};
  const from = m.cost_from ?? {};
  const returns = Number(m.returns_allowance ?? 0);
  const steps = Array.isArray(m.profit_rule) ? m.profit_rule : PROFIT.store;
  // The shop cost has passed the page check, so it counts as confirmed.
  const best = tried(tryCost, tryPosted) ?? cheapestCost({ seen: m.cost, seenFrom: shopName(from.shop) ?? 'Where it was seen', seenConfirmed: true, sources: row.sources ?? [] });
  const posted = postedBy(best);
  const cYou = storeCosts({ postage: m.postage, packaging: m.packaging, returns, cardPct: m.card?.pct, cardFixed: m.card?.fixed });
  const cDrop = dropshipCosts(cYou, { postage: m.postage, packaging: m.packaging });
  const c = posted === 'supplier' ? cDrop : cYou;
  const cost = best?.cost ?? null;
  const l = cost != null ? listFor(cost, g.min > 0 ? Number(g.min) : null, c, steps) : null;
  const price = (tryCost != null && !holdPrice ? null : d.price) ?? l?.price ?? m.list_at ?? null;
  const floor = l?.floor ?? m.floor ?? null;
  const lowest = g.min > 0 ? Number(g.min) : null;
  const target = profitAt(price, steps);
  const keep = keepFor(price, cost, c);
  const fees = price != null ? round(price * c.pct + Number(m.card?.fixed ?? 0)) : null;
  const shops = (m.shops ?? []).map(shopName);
  const position = positionOf(price, { lowest });
  const warnings = [
    cost == null && 'No price read where it was seen yet, so there is no list price.',
    shops.length === 1 && `Seen at one shop only, ${shops[0]}.`,
    keep != null && keep < 0 && 'Loses money at this price.',
    keep != null && keep >= 0 && floor != null && price < floor && `Under your floor of £${floor.toFixed(2)}, so it keeps less than your profit.`,
    m.postage_band?.basis === 'assumed' && 'No weight on file, so postage is costed as a small parcel (up to 2kg, 45 x 35 x 16cm). Check it fits before listing.',
  ].filter(Boolean);
  // The same card read as an eBay listing, once the gate has priced it for eBay. Its own price, never the shop's.
  const ebay = m.ebay ? assess({ ...row, margin: m.ebay, draft: { ...d, price: d.ebay_price ?? undefined } }) : null;
  return {
    store: true, m, d, g, price, keep, fees, shops, warnings, position,
    trying: tryCost != null && best?.basis === 'try',
    postedBy: posted,
    landsUnder: goodsToList(lowest, cDrop, steps),
    refLeaves: lowest != null ? marketAllows(lowest, cDrop) ?? 0 : null,
    refProfit: lowest != null ? profitAt(lowest, steps) : null,
    shopMarket: lowest,
    costConfirmed: best != null,
    cost,
    costFrom: best,
    floor,
    breakEven: breakEvenFor(cost, c),
    target,
    ebay,
    channels: channelsOf(row),
    returns,
    goods: cost,
    best: best ? { supplier: best.from, url: best.url ?? from.url ?? null, landed_unit_cost: best.cost } : null,
    l: null,
    modelled: true,
    // An assumed postage is shown, not a block: most shelves carry no weight, and she can see the size.
    ready: warnings.length === (m.postage_band?.basis === 'assumed' ? 1 : 0) && price != null && (d.images ?? []).length > 0,
    postage: posted === 'supplier' ? round(returns) : round(Number(m.postage ?? 0) + Number(m.packaging ?? 0) + returns),
    postageBand: m.postage_band ?? null,
    onEbay: (row.recommended_channels ?? []).includes('ebay'),
    entry: row.entry ?? null,
    // More than 10% over Google's lowest, the shop card waits in its own lane. The cost above the low itself means no
    // price reaches it, which is usually a bigger size or another variant on the shop page.
    lane: position && !position.inMarket && position.pct > STORE_OVER ? 'dear' : 'store',
    costOverLow: cost != null && lowest != null && cost > lowest,
    month: null,
    title: d.title ?? row.title,
    images: d.images ?? [],
    edited: Object.keys(d).length > 0,
  };
}

// tryCost: a cost typed in to see what it does, never saved; tryPosted says who posts it ('supplier' unless 'you').
// holdPrice keeps her own draft price while trying it.
export function assess(row, { tryCost = null, tryPosted = 'supplier', holdPrice = false } = {}) {
  if (row.margin?.channel === 'store') return assessStore(row, tryCost, holdPrice, tryPosted);
  const m = row.margin ?? {};
  const l = row.listing ?? null;
  const entry = row.entry ?? null;
  const d = row.draft ?? {};

  const shelf = m.shelf ?? null;
  // The shelf is a confirmed cost when it is the proving seller's product and pack. When the pack is simply not
  // known it is still her cost, marked unconfirmed, so the card prices from something real. Only a match known to
  // be another product or pack leaves it out.
  // Same pack by the gate's match, or by her checking it herself.
  const shelfIsCost = m.match?.level === 'same_product_same_pack' || (row.sources ?? []).some(isPackCheck);
  const shelfRuledOut = ['different_product', 'same_product_different_pack', 'different_barcode'].includes(m.match?.level);
  const cheapest = tried(tryCost, tryPosted) ?? cheapestCost({
    seen: shelfRuledOut ? null : shelf?.price ?? null,
    seenFrom: shopName(shelf?.shop) ?? 'the shelf',
    seenConfirmed: shelfIsCost,
    sources: row.sources ?? [],
  });
  const quoted = cheapest?.basis === 'supplier' ? (row.sources ?? []).find((s) => !isPackCheck(s) && Number(s.landed_unit_cost) === cheapest.cost) ?? null : null;
  const best = quoted ?? (cheapest ? { supplier: cheapest.from, landed_unit_cost: cheapest.cost, url: shelf?.url ?? null } : null);

  const goods = cheapest?.cost ?? null;
  const modelled = Boolean(m.rates);
  const posted = postedBy(cheapest);
  const cYou = ebayCosts(m);
  const cDrop = dropshipCosts(cYou, { postage: m.postage, packaging: m.packaging });
  const c = posted === 'supplier' ? cDrop : cYou;
  const steps = PROFIT.ebay;
  // The market price she is measured against: the small seller converting when trusted, else the median.
  const market = m.sale_price ?? row.avg_sold_price ?? null;
  // Forward from a real cost; with none, from the most the market price allows the goods to cost.
  const assumed = goods == null && modelled ? marketAllows(market, c) : null;
  const priced = !modelled ? null
    : goods != null ? listFor(goods, market, c, steps)
      : assumed != null ? (() => { const f = floorFor(assumed, c, steps); return f ? { ...f, price: f.floor } : null; })()
        : null;
  const price = (tryCost != null && !holdPrice ? null : d.price) ?? priced?.price ?? market;
  const costBasis = goods != null ? cheapest.basis : assumed != null ? 'market' : null;
  // keepAt treats a missing cost as zero, so the cost is always passed.
  const keep = modelled
    ? keepFor(price, goods ?? assumed, c)
    : (d.price == null ? m.net ?? null : null);

  const fees = modelled && price != null
    ? round(price * (m.rates.fvf + m.rates.ad) + m.rates.fixed)
    : (m.platform_fee ?? null);
  const postage = posted === 'supplier'
    ? round(m.returns_allowance ?? 0)
    : round((m.postage ?? 0) + (m.packaging ?? 0) + (m.returns_allowance ?? 0));

  const trusted = m.list_trusted === true;
  const target = modelled ? profitAt(price, steps) : m.target_profit ?? null;
  const shelfPack = packOf(l?.title);
  const marketPack = packOf(entry?.title);

  // Rate and price off the same listing, or no month at all.
  const perMonth = entry?.per_day != null ? Math.round(entry.per_day * 300) / 10 : null;
  const entryKeep = modelled && goods != null ? keepFor(entry?.price ?? null, goods, c) : null;
  const ref = entry?.price ?? price;
  const ratio = goods > 0 && ref != null ? Math.round((ref / goods) * 10) / 10 : null;
  // A shelf matched on brand and pack has already had its pack checked.
  const packCheck = ratio != null && ratio > PACK_RATIO && !(shelfIsCost && !quoted) && cheapest?.basis !== 'try';

  const entryLoses = Boolean(entry?.proved) && entryKeep != null && entryKeep <= 0;
  const ceiling = entry?.ceiling ?? CEILING;
  // Not proved can mean a small seller barely selling, or only big accounts selling. Different facts.
  const entryThin = Boolean(entry) && !entry.proved && entry.seller_feedback != null && entry.seller_feedback <= ceiling;
  // A rate from what may be a different pack is not this product's rate.
  const month = entry?.proved && perMonth != null && entryKeep > 0 && !packCheck
    ? round(entryKeep * perMonth)
    : null;

  const warnings = [
    shelfPack && marketPack && shelfPack !== marketPack
      && `Shelf pack holds ${shelfPack}, the listing this price came from holds ${marketPack}.`,
    !trusted && d.price == null && priced?.onMarket && market != null && price === round(market)
      && (entry?.proved
        ? `Priced at the median, ${gbpText(market)}. A small seller sells at ${gbpText(entry.price)}, outside the ${fieldText(row.competition)}this search found, so it is probably a different product. Open the listing to check.`
        : 'Priced at the median, which no small seller has been paid.'),
    l?.in_stock === 'no' && 'Out of stock at the shop.',
    row.variation_count >= BLENDED && `Sold in ${row.variation_count} variations, so the price is an average.`,
    row.bulky && 'Costed as a small parcel and this one is bulky.',
    packCheck && `Converting at ${ratio} times the shelf price. Check it is the same pack.`,
    keep != null && keep < 0 && 'Loses money at this price.',
    modelled && goods == null && assumed == null && market != null && 'The eBay price does not cover fees and postage, so no cost can pay here.',
  ].filter(Boolean);

  // Short of the profit is a fact about a real cost; a price built on the market's allowance keeps it by construction.
  const short = goods != null && keep != null && target != null && keep < target;
  // One reference for the price and the gap: the proving seller when the gate trusts that price, else the median.
  const median = row.competition?.median ?? m.market_median ?? null;
  const position = positionOf(price, trusted && entry?.proved
    ? { median, entry: entry.price }
    : { median: market ?? median });
  const costConfirmed = Boolean(cheapest?.confirmed);
  const sold = row.sold_30d ?? null;
  const lane = short ? 'short'
    : !position?.inMarket ? 'over'
      : !entry?.proved ? 'untested'
        : !trusted ? 'price'
          : entryLoses ? 'over'
            : packCheck || !costConfirmed ? 'pack'
              : sold == null || sold < READY_MIN_SOLD ? 'slow'
                : 'ready';

  return {
    channels: channelsOf(row),
    m, l, entry, d, best, goods, price, keep, fees, postage, modelled, trusted, warnings, position,
    costBasis, assumed, costFrom: cheapest, market,
    target, perMonth, entryKeep, entryLoses, entryThin, month, ratio, packCheck, shelfIsCost,
    match: m.match ?? null,
    ceiling,
    breakEven: breakEvenFor(goods ?? assumed, c),
    floor: priced?.floor ?? null,
    // Worth approving: a small seller converting, her price in the market, and a cost she has confirmed.
    lane,
    trying: cheapest?.basis === 'try',
    // The dearest goods that still list on the reference price with the full profit.
    postedBy: posted,
    // Read as a delivered cost from a supplier who posts it, the way "Found it cheaper" asks for one.
    landsUnder: modelled ? goodsToList(position?.ref ?? market, cDrop, steps) : null,
    // What the reference price leaves for delivered goods and profit after fees, and the profit it asks for.
    refLeaves: modelled && position ? marketAllows(position.ref, cDrop) ?? 0 : null,
    refProfit: position ? profitAt(position.ref, steps) : null,
    median,
    sold,
    marketRead: marketReadOf(row.competition),
    costConfirmed,
    ready: warnings.length === 0 && entry?.proved === true && keep != null && keep > 0,
    title: d.title ?? l?.title ?? row.title,
    images: d.images ?? l?.images ?? [],
    edited: Object.keys(d).length > 0,
  };
}
