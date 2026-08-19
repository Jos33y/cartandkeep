// Hand-maintained until the pipeline writes here. Phase order is delivery order.
// state: done | active | queued. A done item needs a date or it cannot be logged.

export const STATUS_PHASES = [
  {
    key: 'foundations',
    label: 'Foundations',
    items: [
      { label: 'Domains registered', detail: 'cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'Business email active', detail: 'support@cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'DNS and SSL configured', state: 'done', date: '2026-07-26' },
      { label: 'Database provisioned', state: 'done', date: '2026-07-26' },
    ],
  },
  {
    key: 'portal',
    label: 'Operations portal',
    items: [
      { label: 'Status page live', state: 'done', date: '2026-07-26' },
      { label: 'Portal sign in', state: 'done', date: '2026-07-27' },
      { label: 'Candidate review interface', state: 'done', date: '2026-08-03' },
      { label: 'Product images and eBay categories', state: 'done', date: '2026-08-03' },
      { label: 'Notes on any product', state: 'done', date: '2026-08-05' },
      { label: 'Supplier costs and margin', detail: 'add a supplier, see what is left', state: 'done', date: '2026-08-05' },
      { label: 'Products grouped by type', detail: 'reviewed a shelf at a time rather than one long list', state: 'done', date: '2026-08-12' },
      { label: 'Decision history', detail: 'every approval and change kept on record', state: 'done', date: '2026-08-05' },
    ],
  },
  {
    key: 'research',
    label: 'Research pipeline',
    items: [
      { label: 'Seller Hub research access', detail: 'Terapeak, research areas only', state: 'done', date: '2026-08-03' },
      { label: 'Research pipeline data sources', state: 'done', date: '2026-08-03' },
      { label: 'What every figure means', detail: 'in the portal, under Metrics', state: 'done', date: '2026-08-05' },
      { label: 'Research coverage published', detail: 'every keyword searched and what it found', state: 'done', date: '2026-08-05' },
      { label: 'First review session', state: 'done', date: '2026-07-30' },
      { label: 'First candidate batch delivered', state: 'done', date: '2026-08-10' },
      { label: 'Twelve months of sales history per product', detail: 'seven monthly windows, direction and season', state: 'done', date: '2026-08-12' },
      { label: 'Second candidate batch delivered', detail: '114 products across three categories',
        state: 'done', date: '2026-08-16' },
      { label: 'Live competition check', detail: 'how many sellers compete, and at what price', state: 'done', date: '2026-08-13' },
    ],
  },
  {
    key: 'store',
    label: 'Custom store',
    items: [
      { label: 'Brand identity and app icons', detail: 'the basket and ampersand mark, at every size a phone and a browser ask for', state: 'done', date: '2026-08-17' },
      { label: 'Storefront built', detail: 'shop front, departments, product pages, search, basket', state: 'done', date: '2026-08-18' },
      { label: 'Product detail from the eBay catalogue', detail: 'brand, specifications and photographs pulled onto 78 products', state: 'done', date: '2026-08-18' },
      { label: 'Checkout integrated', detail: 'card and Apple Pay through Stripe, guest only, no account to make', state: 'done', date: '2026-08-18' },
      { label: 'Order confirmation and tracking pages', state: 'done', date: '2026-08-18' },
      { label: 'Legal pages published', detail: 'delivery, returns, terms, privacy, cookies, frequently asked', state: 'done', date: '2026-08-18' },
      { label: 'Blog live, first piece written', state: 'done', date: '2026-08-18' },
      { label: 'Installable on a phone', detail: 'add to home screen, works offline once opened', state: 'done', date: '2026-08-18' },
      { label: 'SEO foundation shipped', detail: 'titles, descriptions, structured data, sitemap and robots', state: 'active' },
      { label: 'Products you control from the portal', detail: 'add one, price it, photograph it, describe it, put it on sale or take it off', state: 'done', date: '2026-08-19' },
      { label: 'Your own photographs', detail: 'upload from your phone, resized on the way up, choose which one leads', state: 'done', date: '2026-08-19' },
      { label: 'Stock counting', detail: 'leave it empty for anything you can reorder, or put a number in and it counts down as orders are paid', state: 'done', date: '2026-08-19' },
      { label: 'A check before anything goes public', detail: 'nothing goes on sale missing a photograph, a price, a returns rule or the hazard details a chemical needs', state: 'done', date: '2026-08-19' },
      { label: 'Shop settings you control', detail: 'your trading details, delivery rates, postcode surcharges and the wording on the front page', state: 'done', date: '2026-08-19' },
      { label: 'Custom store live', due: 'By 22 August', detail: 'cartandkeep.com. The shop is built; this is the domain pointing at it and the products going live.', state: 'active' },
      { label: 'Products approved and on sale', detail: '78 loaded and held as drafts until you have seen them', state: 'queued' },
    ],
  },
  {
    key: 'shopfloor',
    label: 'Running the shop',
    items: [
      { label: 'Orders visible in the portal', detail: 'what was bought, where it goes, and the address ready to copy onto a label', state: 'done', date: '2026-08-19' },
      { label: 'Dispatch and tracking from the portal', detail: 'mark a parcel gone, record who took it and the tracking number', state: 'done', date: '2026-08-19' },
      // Written and waiting on the sending service being switched on, so it is
      // in progress rather than complete. Nothing has been sent to anybody yet
      // and the page should not say otherwise.
      { label: 'Order emails', detail: 'a confirmation to the customer, an alert to you, and a second to them when it ships. You can see on each order exactly what they were sent.', state: 'active' },
      { label: 'What sells and what does not', detail: 'what gets looked at, saved, put in a basket and taken back out, per product', state: 'done', date: '2026-08-19' },
      { label: 'What people searched for and did not find', detail: 'every one is either something to stock or a word the shop does not use for something it already sells', state: 'done', date: '2026-08-19' },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    items: [
      { label: 'Monthly search report', detail: 'clicks, how often Google showed the shop, and what changed, kept month by month so the line is visible', state: 'active' },
      { label: 'Google Shopping feed', detail: 'free listings. Built and waiting on product descriptions, which Google requires before it will list anything.', state: 'active' },
      { label: 'Financial dashboard live', state: 'queued' },
    ],
  },
];

export const STATE_LABEL = { done: 'Complete', active: 'In progress', queued: 'Queued' };

const withPhase = STATUS_PHASES.flatMap((p) => p.items.map((i) => ({ ...i, phase: p.label })));

export const STATUS_ITEMS = withPhase;

export const activeItems = () => withPhase.filter((i) => i.state === 'active');

export const upcomingPhases = () =>
  STATUS_PHASES.map((p) => ({ ...p, items: p.items.filter((i) => i.state === 'queued') })).filter(
    (p) => p.items.length > 0,
  );

// The first unfinished thing with a date on it. This is the only forward
// commitment on the page, so it comes from the data rather than being written.
export const nextDated = () => withPhase.find((i) => i.state !== 'done' && i.due) ?? null;

// Completed work leaves the plan and becomes a log, newest first, grouped by
// month. This is what stops the page growing without bound at the top.
export function completedByMonth() {
  const done = withPhase.filter((i) => i.state === 'done' && i.date).sort((a, b) => b.date.localeCompare(a.date));
  const groups = [];
  for (const item of done) {
    const key = item.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function lastUpdated() {
  const dates = withPhase.map((i) => i.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}