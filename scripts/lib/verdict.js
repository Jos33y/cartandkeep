/*
 * The verdict. Each test refuses on its own; no score is blended.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

import { D, bandOf, unitsNeeded, priceFloor, maxGoodsCost } from './cost.js';

// ------------------------------------------------------------------- verdict

// Every rejection names itself. A gate that fails silently is a gate nobody
// can argue with or fix.
// Two kinds of failure, and they must not share a bin.
//
//   market   nobody can get in, or nothing is selling. The market said no and
//            there is nothing to reconsider
//   policy   it broke a threshold we chose. The market may be fine underneath,
//            so it is set aside with its evidence rather than dropped
//
// A rule we picked ourselves is not allowed to look like a fact about the world.
export function verdict(r, c = D) {
  // An old snapshot may carry entry proved under a looser feedback ceiling. Today's ceiling decides.
  if (r.entry?.proved && r.entry.sellerFeedback != null && r.entry.sellerFeedback > c.maxFeedback) {
    r = { ...r, entry: { ...r.entry, proved: false } };
  }
  const market = [];
  const policy = [];
  const notes = [];
  const codes = [];
  // Coverage groups on the code; the sentence is for people.
  const hard = { push: (code, text) => { codes.push(code); market.push(text); } };

  if (r.competitors === 0) hard.push('no_listings', 'nobody is listing this');

  // Crowding is not a wall, it is a price. In a market of sixty she is found
  // for nothing; in one of sixteen hundred the only route to page one is
  // promoted listings, and the cost model allows 3%. So this is not a judgement
  // that a busy market cannot be entered, it is the ad rate deciding where the
  // arithmetic stops holding.
  //
  // It costs real evidence. A 99 feedback seller taking 50 units in 20 days
  // sits in a market of 615 and is refused here. Raise --max-listings and
  // raise adRate together, or not at all.
  /*
   * Over the ceiling, but selling well enough to argue with.
   *
   * The ceiling counts listings and ignores whether any of them sell. Flexitol
   * heel balm came back at 273 listings moving 133 a month, one sale for every
   * two listings, with a 156 feedback seller taking 45 in 18 days. That was
   * refused while thinner markets at 150 listings and 20 sales a month passed.
   *
   * So a crowded market where a small seller is proved to be selling is set
   * aside with its figures rather than refused: she sees the crowding stated
   * and decides whether to pay for visibility there.
   *
   * Three bands. Up to 250 it passes on its own merits. Between 250 and 600,
   * entry proved sets it aside. Over 600 it fails however well it sells.
   *
   * A turnover ratio was tried first and dropped: it was a second test of a
   * question entry proved already answers, and it was set where almost nothing
   * cleared it. Persil capsules had a 4 feedback seller selling in a market of
   * 393 listings, which is the strongest evidence there is that crowding does
   * not prevent entry, and the ratio refused it at 0.05.
   */
  if (r.competitors > c.maxListings) {
    const busy = `${r.competitors} live listings, over the ${c.maxListings} ceiling. `
      + `Page one here costs more than the ${Math.round(c.adRate * 100)}% ad rate allows`;

    if (r.entry?.proved && r.competitors <= c.crowdedMaxListings) {
      policy.push(`${busy}. Set aside rather than refused: a ${r.entry.sellerFeedback} `
        + `feedback seller has sold ${r.entry.soldLifetime} in `
        + `${Math.round(r.entry.ageDays)} days here, so the crowding is a cost to weigh `
        + 'rather than a wall');
      codes.push('crowded_but_selling');
    } else {
      hard.push('crowded', busy);
    }
  }

  // Competitor count is deliberately not a veto. A live run found a 628
  // feedback seller taking 68 units in 13 days against 3,869 listings, so the
  // count does not decide whether a newcomer can get in. Recent entry does.
  if (r.entry?.proved) {
    notes.push(`entry proved, a ${Math.round(r.entry.ageDays)} day old listing from a `
      + `${r.entry.sellerFeedback} feedback seller has sold ${r.entry.soldLifetime}`);
  } else if (r.entry?.thin) {
    const line = `the smallest recent seller has sold ${r.entry.soldLifetime} in `
      + `${Math.round(r.entry.ageDays)} days, where ${unitsNeeded(r.entry.ageDays, c)} `
      + 'would be one a month. Somebody bought it, nobody is buying it';
    if (c.requireEntry) hard.push('entry_thin', line); else notes.push(line);
  } else if (r.entry?.early) {
    // One or two sales in a listing's first week: too new to prove anything, and too new to refuse on.
    // Treated like untested: worth a try in a thin market, not in a deep one.
    const line = `a ${Math.round(r.entry.ageDays)} day old listing from a ${r.entry.sellerFeedback} feedback seller `
      + `has sold ${r.entry.soldLifetime} already, too new to call`;
    if (c.requireEntry && r.competitors > c.untestedMaxListings) {
      hard.push('entry_untested', `${line}, so entry is untested here, against ${r.competitors} listings`);
    } else {
      notes.push(line);
    }
  } else if (r.entry?.sellerFeedback != null) {
    // Somebody recent is selling and they are too big for it to say anything
    // about a hundred feedback account. This is what filled a review queue with
    // markets she cannot rank on, so it now ends the candidate.
    const line = `the smallest recent seller selling here has ${r.entry.sellerFeedback} feedback, `
      + `over the ${c.maxFeedback} ceiling, so entry is not proved for a small seller`;
    if (c.requireEntry) hard.push('entry_large_only', line); else notes.push(line);
  } else if (!r.entry || r.entry.youngSeen === 0) {
    // Nobody came and we could not see are different facts. With no proof
    // either way, a thin market is still worth a try and a deep one is not.
    const line = `no listing under ${c.youngDays} days in the sample, so entry is untested here`;
    if (c.requireEntry && r.competitors > c.untestedMaxListings) {
      hard.push('entry_untested', `${line}, against ${r.competitors} listings`);
    } else {
      notes.push(line);
    }
  } else if (r.soldKnown > 0) {
    hard.push('young_not_selling', `${r.entry.youngSeen} recent listings in the sample and none of them are selling`);
  }

  if (r.soldKnown === 0) {
    notes.push('no sold figures came back, cannot judge demand yet');
  } else if (r.soldTotal === 0) {
    hard.push('nothing_sold', 'nothing has sold on any of the sampled listings');
  } else if (r.observedPerMonth != null && r.observedPerMonth < c.minMarketPerMonth) {
    // A market too small to be worth a listing slot. A hand puppet whose whole
    // sampled market moves nothing a month, and an MP3 player whose market
    // moves one, both reached a review screen and asked her to decide. There is
    // no product there at any price, and the gate had never asked the question.
    hard.push('market_small', `the whole sampled market moves about ${r.observedPerMonth} a month, `
      + `under ${c.minMarketPerMonth}. A listing slot and the sourcing time cost more than that returns`);
  }

  // Sourcing route is reported, never failed on. Getting this wrong in the
  // other direction is what filled her catalogue with Amazon private labels.
  const src = r.sourcing;
  if (src && src.route === 'branded') {
    notes.push(`branded market, ${Math.round((1 - src.openShare) * 100)}% of the sample carries a real brand`
      + `${src.top.length ? ` (${src.top.join(', ')})` : ''}. Buy the genuine article, do not look for it in China`);
  } else if (src && src.route === 'china') {
    notes.push(`open market, ${Math.round(src.openShare * 100)}% of the sample is unbranded or generic, so it is sourceable`);
  } else if (src && src.route === 'mixed') {
    notes.push(`mixed market, ${Math.round(src.openShare * 100)}% unbranded. Check whether the sellers moving units are the branded ones`);
  }

  // A market that clears below the cost base is a fact about the market, not a
  // threshold we chose, so it is fatal. Anything above it is reported and the
  // real supplier price decides, which is the whole point of not assuming a
  // goods cost.
  if (r.price?.median > c.bandTrustAbove && c.band === D.band) {
    hard.push('band_unsure', `at £${r.price.median.toFixed(2)} this is not a `
      + `${bandOf(c).label} parcel. Run it again with the band this product actually posts at`);
  }

  if (r.maxGoods != null) {
    if (r.maxGoods > c.goodsCeiling) {
      hard.push('goods_high', `the goods would cost up to £${r.maxGoods.toFixed(2)}, over the `
        + `£${c.goodsCeiling.toFixed(2)} a product is bought at today`);
    } else if (r.maxGoods > 0 && r.maxGoods < c.goodsFloor) {
      // A guess about stock, not a fact about the market: Poundland is full of £1 lines.
      notes.push(`the goods would have to cost under £${r.maxGoods.toFixed(2)}, cheap stock needed`);
    }
    if (r.maxGoods + c.minProfit <= 0) {
      hard.push('below_cost', `at the median of £${r.price.median.toFixed(2)} a sale loses money even with the goods free`);
    } else if (r.maxGoods <= 0) {
      const floor = priceFloor(c);
      // Short of our £2 target, not of the market. Set aside with the figure, never dropped.
      policy.push(`at the median of £${r.price.median.toFixed(2)} a sale keeps £${(r.maxGoods + c.minProfit).toFixed(2)} `
        + `before the goods, under the £${c.minProfit.toFixed(2)} target. `
        + `As ${bandOf(c).label} it needs about £${floor?.toFixed(2)} plus the goods to reach it`);
    } else {
      notes.push(`pay up to £${r.maxGoods.toFixed(2)} for the goods at £${r.price.median.toFixed(2)}, `
        + `${r.price.basis === 'selling'
          ? `the median of the ${r.price.sellingSeen} listings in the sample that are selling`
          : 'the median of the field, since too few in the sample have sold'}`
        + `, as ${bandOf(c).label}`);
    }
  }

  const outcome = market.length ? 'fail' : (policy.length ? 'review' : 'pass');

  return {
    outcome,
    pass: outcome === 'pass',
    unknown: r.soldKnown === 0 || !r.entry || r.entry.youngSeen === 0,
    market,
    policy,
    codes,
    reasons: [...market, ...policy, ...notes],
  };
}

// What a rejection is turning down. The best listing in the sample, its rate,
// and what that rate is worth at our own cost base. A set aside with no figure
// beside it is a decision nobody can make.
export function worthOf(r, c = D) {
  const best = (r.listings ?? [])
    .filter((l) => l.soldPerDay > 0 && l.priceGbp > 0 && l.rateTrusted !== false)
    .sort((a, b) => b.soldPerDay - a.soldPerDay)[0];
  if (!best) return null;
  const unit = maxGoodsCost(best.priceGbp, c);
  const perMonth = best.soldPerDay * 30;
  return {
    price: best.priceGbp,
    perMonth: Math.round(perMonth),
    unitProfit: unit,
    monthlyProfit: unit == null ? null : Math.round(perMonth * unit),
    ageDays: best.ageDays,
    sellerFeedback: best.sellerFeedback,
    title: best.title,
  };
}
