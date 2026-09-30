/*
 * The Google best sellers route in words. Reason codes are stored; how the portal says them lives here and nowhere
 * else. Each stage stops products for one kind of reason: our own filters, what the shops stock, what the page
 * check found, or our limits at import.
 */

export const KINDS = {
  ours: 'Our own limits',
  market: 'What the shops stock',
  check: 'What the page check found',
};

// In the order a product passes them. "drop" is the stage whose stops peel off before this one.
export const STAGES = [
  { key: 'ranked', label: 'Ranked on Google', tip: 'Every product Google ranked as a best seller in this category, across the months exported.' },
  { key: 'worth', label: 'Worth a look', drop: 'google', tip: 'Left after our own filters: no shop brands, only shelf products, and priced £8 to £60.' },
  { key: 'stocked', label: 'Stocked by a UK shop', drop: 'shelf', tip: 'A UK shop on file sells the same product, in the same pack.' },
  { key: 'checked', label: 'Page checked', drop: 'page', tip: 'The shop page was opened and it is the same product.' },
  { key: 'sent', label: 'Sent to you', drop: 'import', tip: 'Imported as a card in your queue.' },
];

export const DROPS = {
  google: { label: 'Our filters', kind: 'ours', title: 'Before any shop was looked at' },
  shelf: { label: 'No UK shop match', kind: 'market', title: 'Looking for a UK shop' },
  page: { label: 'Page not confirmed', kind: 'check', title: "Checking the shop's page" },
  import: { label: 'Held back at import', kind: 'ours', title: 'At import' },
};

// An import stop with no code is its own reason.
export const HELD = 'held';
export const reasonKey = (row) => (row.stage === 'import' && !row.reason ? HELD : row.reason);

export const REASONS = {
  own_label: { stage: 'google', label: "A shop's own brand: only that shop sells it",
    tip: 'Own brands such as a supermarket or DIY chain label are sold by that shop alone, so there is nowhere else to source them.' },
  not_shelf: { stage: 'google', label: 'Not a shelf product: plants, furniture, made to measure',
    tip: 'Things that do not sit on a shop shelf in a box cannot be bought, stored and posted like the rest.' },
  restricted: { stage: 'google', label: 'A restricted product',
    tip: 'Something the marketplaces or UK rules limit, so it is left out before any shop is looked at.' },
  cant_post: { stage: 'google', label: 'Royal Mail will not carry it',
    tip: 'Compressed gas, flammable liquids, corrosives, aerosols that are not toiletries, or fireworks. It cannot go out as a normal parcel.' },
  outside_price: { stage: 'google', label: 'Outside the £8 to £60 range',
    tip: 'Under £8 a sale keeps too little after postage. Over £60 a unit ties up too much money before it has sold.' },
  not_seen: { stage: 'shelf', label: 'No UK shop on file stocks it',
    tip: 'Google ranks it, but none of the shops collected so far sells it. The brands below show which shop to collect next.' },
  part_only: { stage: 'shelf', label: 'Only a part or refill of it was seen',
    tip: 'A shop sells a spare part or refill, not the product itself.' },
  bigger_pack: { stage: 'shelf', label: 'Only a bigger pack was seen',
    tip: 'A shop sells it, but only in a larger pack than the best seller, so the price does not compare.' },
  page_wrong: { stage: 'page', label: "The shop's page is another product",
    tip: 'The page that matched on name turned out to be something else.' },
  page_unsure: { stage: 'page', label: 'Could not be sure it is the same product',
    tip: 'Close, but size, model or pack could not be confirmed from the page.' },
  page_gone: { stage: 'page', label: "The shop's page has gone",
    tip: 'The page no longer exists, so there is no shelf price to cost it from.' },
  shop_blocked: { stage: 'page', label: 'The shop blocked the check',
    tip: 'The shop refused the page request. It is checked again on the next run.' },
  page_unread: { stage: 'page', label: 'Page not read yet',
    tip: 'Waiting for the page check. It moves on the next run.' },
  big_brand: { stage: 'import', label: 'A big brand the large shops fight over',
    tip: 'The large shops discount these hard, so a small shop cannot match the price.' },
  no_price: { stage: 'import', label: "No price on the shop's page",
    tip: 'The page is right but shows no price, so it cannot be costed.' },
  bigger_pack_page: { stage: 'import', label: 'The page sells a bigger pack',
    tip: 'The page is the product, but in a larger pack than the best seller.' },
  over_20kg: { stage: 'import', label: 'Over 20kg to post',
    tip: 'Too heavy for a standard parcel, so the postage would be a guess.' },
  duplicate: { stage: 'import', label: 'Already in your queue under another card',
    tip: 'The same product reached you by another route, so it was kept once.' },
  [HELD]: { stage: 'import', label: 'Confirmed, not imported',
    tip: 'The page matched and it was held back at import without a named reason. That is a gap on our side.' },
};

export const kindOf = (key) => DROPS[REASONS[key]?.stage]?.kind ?? 'ours';

// The seasons in the order a year runs, for the chips.
export const SEASONS = ['All year', 'Winter', 'Christmas', 'Halloween', 'Summer'];

// The funnel from the summary rows: stage values, stops by stage and by reason, and the trend on Sent.
export function funnelOf(summary, season) {
  const rows = season ? summary.filter((r) => (r.season ?? 'All year') === season) : summary;
  const byStage = { google: 0, shelf: 0, page: 0, import: 0, sent: 0 };
  const byReason = {};
  let twice = 0;
  for (const r of rows) {
    byStage[r.stage] = (byStage[r.stage] ?? 0) + r.products;
    if (r.stage === 'sent') twice += r.ranked_more_than_once ?? 0;
    else {
      const k = reasonKey(r);
      byReason[k] = (byReason[k] ?? 0) + r.products;
    }
  }
  const ranked = Object.values(byStage).reduce((s, v) => s + v, 0);
  const values = {
    ranked,
    worth: ranked - byStage.google,
    stocked: ranked - byStage.google - byStage.shelf,
    checked: ranked - byStage.google - byStage.shelf - byStage.page,
    sent: byStage.sent,
  };
  return { values, drops: byStage, byReason, twice };
}

export function seasonsOf(summary) {
  const m = new Map();
  for (const r of summary) {
    const s = r.season ?? 'All year';
    m.set(s, (m.get(s) ?? 0) + r.products);
  }
  return [...m.entries()]
    .sort((a, b) => (SEASONS.indexOf(a[0]) + 1 || 99) - (SEASONS.indexOf(b[0]) + 1 || 99))
    .map(([key, count]) => ({ key, count }));
}
