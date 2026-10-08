/*
 * The cost model: what a sale leaves, and what the goods can cost.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

// ------------------------------------------------------------------ defaults

export const D = {
  marketplace: 'EBAY_GB',
  sample: 10,          // listings deep to price and read sold counts from
  searchLimit: 200,    // eBay caps item_summary at 200
  maxFeedback: 1000,   // above this a sale is real but it is not proof she can enter
  requireEntry: true,  // no proof a small seller can get in, no pass. --entry=any turns it off
  untestedMaxListings: 60, // with no proof either way, only a thin market is worth a try
  minSellingPrices: 3, // fewer than this and the median falls back to the whole field
  youngDays: 90,       // a listing newer than this is a recent entrant
  maxListings: 250,        // above this, page one costs more than the 3% ad rate
  // Over the ceiling, up to here, a proved entry is set aside rather than
  // refused. Beyond it nothing is: a market of two thousand listings can turn
  // beautifully and still be one she will never be found in.
  crowdedMaxListings: 600,
  minEntrySold: 2,     // at a month or older. Under a month, one will do
  minEntryPerMonth: 1, // and the target is one to two sales a month per listing
  minMarketPerMonth: 10, // under this the shelf space costs more than it returns
  minProfit: 2.00,     // per unit, the target. --profit overrides
  // The window the goods have to land in. Under the floor there is nothing to
  // buy in this country; over the ceiling is stock she is not buying yet.
  goodsFloor: 3.00,    // --min-goods. Under this the fee stack takes the sale.
                       // What the goods actually cost is judged per product
                       // against the £2 target, not by a floor on the ceiling.
  goodsCeiling: 40.00, // --max-goods
  // Above this price the default band is a guess rather than a cost. A lounge
  // chair costed as an Evri parcel is where a £558 buying ceiling came from.
  bandTrustAbove: 80.00,
  minAgeDays: 7,       // a rate from a listing younger than this is noise
  // Royal Mail small parcel (8 October 2026): she posts by Royal Mail on labels bought through eBay, £2.99 a parcel
  // on average over her UK labels. An Evri band asked for (--band=evri5) is costed as the Royal Mail parcel of its size (asRoyalMail).
  band: 'rm-small',
  // The scan judges new fixed price listings, so the gate has to judge the same
  // market or the two disagree on how crowded it is. --condition=any turns it off.
  // UK-located sellers only: a US seller's backpack at $37 once "proved" a UK market for patient slings.
  filter: 'conditions:{NEW},buyingOptions:{FIXED_PRICE},itemLocationCountry:GB',
  // A private seller on eBay UK (8 October 2026): no selling fee and no per-order fee; the buyer pays eBay's
  // Buyer Protection fee on top of her price. The ad rate stays as the cost of promoting, which is what she would
  // pay on a promoted sale. Selling as a business again: fvfPct 0.128, fvfFixed 0.30.
  account: 'private',
  fvfPct: 0,
  fvfFixed: 0,
  adRate: 0.03,
  returnRate: 0.05,
  returnCost: 6.00,
};

// Postage is a product attribute and the single biggest lever on whether a
// cheap product can work. A flat figure applied to everything is where the £25
// floor came from, and costing everything at Royal Mail was the next error:
// Evri takes 5kg and a 120x60x60 box for less than Royal Mail's 2kg parcel.
export const BANDS = {
  // Royal Mail, the way she posts. The small parcel is her own average from eBay's labels; the medium ones are
  // Royal Mail's online Tracked 48 prices. Same keys and figures as EBAY_BANDS in src/lib/pricing.js.
  'rm-small': { postage: 2.99, packaging: 0.30, label: 'Royal Mail small parcel, to 2kg' },
  'rm-medium-10': { postage: 7.35, packaging: 0.50, label: 'Royal Mail medium parcel, to 10kg' },
  'rm-medium-20': { postage: 11.85, packaging: 0.60, label: 'Royal Mail medium parcel, to 20kg' },
  // Kept for old rows and runs that name them; costed as Royal Mail through asRoyalMail.
  letter100: { postage: 1.52, packaging: 0.15, label: 'large letter to 100g' },
  letter250: { postage: 1.81, packaging: 0.15, label: 'large letter to 250g' },
  letter500: { postage: 2.30, packaging: 0.20, label: 'large letter to 500g' },
  evri5: { postage: 2.62, packaging: 0.40, label: 'Evri to 5kg, 120x60x60' },
  evri10: { postage: 5.87, packaging: 0.50, label: 'Evri 5 to 10kg' },
  evri15: { postage: 9.01, packaging: 0.60, label: 'Evri 10 to 15kg' },
  parcel: { postage: 4.25, packaging: 0.40, label: 'Royal Mail small parcel to 2kg' },
  rmMedium: { postage: 6.95, packaging: 0.50, label: 'Royal Mail medium to 2kg' },
};

export function unitsNeeded(ageDays, c = D) {
  if (ageDays == null) return c.minEntrySold;
  if (ageDays < 30) return 1;
  return Math.max(c.minEntrySold, Math.ceil((ageDays / 30) * c.minEntryPerMonth));
}

export function stats(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const at = (q) => xs[Math.min(xs.length - 1, Math.floor(xs.length * q))];
  return { n: xs.length, min: xs[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: xs[xs.length - 1] };
}

// A band from before Royal Mail, as the Royal Mail parcel of the same size. Large letters are Royal Mail already.
export const AS_ROYAL_MAIL = {
  evri5: 'rm-small', parcel: 'rm-small', evri10: 'rm-medium-10', rmMedium: 'rm-medium-10', evri15: 'rm-medium-20',
};
export const bandKeyOf = (c = D) => {
  const k = AS_ROYAL_MAIL[c.band] ?? c.band;
  return BANDS[k] ? k : 'rm-small';
};

export function bandOf(c = D) {
  return BANDS[bandKeyOf(c)];
}

// What is left of the selling price before goods cost. Same definition the
// portal uses on the Terapeak rows, so the two routes produce a comparable
// figure: fees, ads, postage and packaging only. Returns sit outside it.
export function headroomAt(price, c = D) {
  if (!Number.isFinite(price) || price <= 0) return null;
  const b = bandOf(c);
  const fvf = price * c.fvfPct + c.fvfFixed;
  return Math.round((price - (fvf + price * c.adRate + b.postage + b.packaging)) * 100) / 100;
}

// The only number worth acting on standing in front of a shelf. The old model
// assumed goods cost 40% of the selling price and then demanded a profit on
// top, which produced a £19.50 floor nobody had measured and refused eleven
// candidates on its own. Nothing is assumed here: this is reported, and the
// real supplier price decides.
export function maxGoodsCost(price, c = D) {
  const h = headroomAt(price, c);
  if (h == null) return null;
  // Returns are a cost of every order, not an event that happens to some of them.
  return Math.round((h - c.returnRate * c.returnCost - c.minProfit) * 100) / 100;
}

// The settled rule is that below about £25 the fixed costs eat the margin, and
// that is right. The £25 was a proxy for one postage band. This is the same
// rule computed rather than remembered, so a large letter product is not
// rejected by a small parcel's costs.
export function priceFloor(c = D) {
  const b = bandOf(c);
  const share = 1 - c.fvfPct - c.adRate;
  const fixed = c.minProfit + c.fvfFixed + b.postage + b.packaging + c.returnRate * c.returnCost;
  return Math.round((fixed / share) * 100) / 100;
}
