// Hand-maintained until the pipeline writes here. Phase order is delivery order.
// state: done | active | queued. A done item needs a date or it cannot be logged.
// One short line per item: what she can now do or see. Detail only where the label needs it, never a paragraph.
// No count here that the portal also shows: it goes stale without anyone noticing.

export const STATUS_PHASES = [
  {
    key: 'foundations',
    label: 'Foundations',
    purpose: 'Your domain, email and secure setup.',
    items: [
      { label: 'Domain registered', detail: 'cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'Business email', detail: 'support@cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'DNS, SSL and database', state: 'done', date: '2026-07-26' },
      { label: 'Hosting set up', state: 'done', date: '2026-07-26' },
    ],
  },
  {
    key: 'portal',
    label: 'Operations portal',
    purpose: 'Where you review, decide and track every product.',
    items: [
      { label: 'Status page and portal sign in', state: 'done', date: '2026-07-27' },
      { label: 'Product review with one-key decisions', detail: 'approve, reject or save for later', state: 'done', date: '2026-09-22' },
      { label: 'Notes, suppliers and margin on every product', state: 'done', date: '2026-08-05' },
      { label: 'Decision history kept', state: 'done', date: '2026-08-05' },
      { label: 'Your decisions protected', detail: 'nothing automated can change them', state: 'done', date: '2026-09-24' },
      { label: 'Overview: what needs you, at a glance', state: 'done', date: '2026-10-07' },
      { label: 'Alerts in one place', detail: 'stock, price, seller and eBay problems, sorted by what to do', state: 'done', date: '2026-10-07' },
      { label: 'Faster portal', detail: 'Listings from 8 seconds to under a tenth of a second', state: 'done', date: '2026-10-07' },
    ],
  },
  {
    key: 'research',
    label: 'Product research',
    purpose: 'How products are found and checked before they reach you.',
    items: [
      { label: 'Research read from eBay’s live market', state: 'done', date: '2026-08-03' },
      { label: 'First product batch delivered', state: 'done', date: '2026-08-10' },
      { label: 'Competition check on every product', state: 'done', date: '2026-08-13' },
      { label: 'Your live eBay listings checked against real sales', state: 'done', date: '2026-08-31' },
      { label: 'Entry check', detail: 'can a seller your size sell it now', state: 'done', date: '2026-09-02' },
      { label: 'Maximum buying price on every product', state: 'done', date: '2026-09-16' },
      { label: 'Products found on nine UK shop shelves', state: 'done', date: '2026-09-24' },
      { label: 'UK sellers only, pack sizes checked', state: 'done', date: '2026-09-25' },
      { label: 'Products sorted into Google’s categories', state: 'done', date: '2026-10-02' },
      { label: 'Market read refreshed weekly', state: 'active' },
    ],
  },
  {
    key: 'keeper',
    label: 'Keeper',
    purpose: 'Your assistant that does the legwork and leaves the decisions to you.',
    items: [
      { label: 'Fills in every shop product', detail: 'titles, description, details, returns rule', state: 'done', date: '2026-09-26' },
      { label: 'Works while the portal is closed', state: 'done', date: '2026-09-26' },
      { label: 'Checks shop drafts in batches you size', state: 'done', date: '2026-10-03' },
      { label: 'Finds each product on Amazon to source it', state: 'done', date: '2026-10-04' },
      { label: 'Gets approved products ready to list', detail: 'title, description, photos, category, item details', state: 'done', date: '2026-10-05' },
      { label: 'Learns from your changes', state: 'done', date: '2026-10-05' },
      { label: 'Safeguards', detail: 'stops on the wrong product, blades, or two Amazon matches', state: 'done', date: '2026-10-06' },
      { label: 'Monthly spending limit', detail: 'pauses at the limit, never runs up a bill', state: 'done', date: '2026-10-07' },
      { label: 'Finds a cheaper supplier', state: 'queued' },
    ],
  },
  {
    key: 'ebay',
    label: 'Your eBay account',
    purpose: 'Listings, sales and changes, run from the portal.',
    items: [
      { label: 'eBay account connected', state: 'done', date: '2026-09-18' },
      { label: 'Listing performance', detail: 'shown, opened and bought, per listing', state: 'done', date: '2026-09-22' },
      { label: 'Change a live listing from the portal', state: 'done', date: '2026-09-22' },
      { label: 'List in bulk through a queue', detail: 'at your daily pace, within your monthly limit', state: 'done', date: '2026-09-30' },
      { label: 'First listing published from the portal', state: 'done', date: '2026-10-01' },
      { label: 'Change price on any listing', detail: 'shows the lowest price that keeps your profit', state: 'done', date: '2026-10-04' },
      { label: 'Supplier price and stock checked every morning', detail: 'an email when your cost changes', state: 'done', date: '2026-10-05' },
      { label: 'Restricted items blocked before listing', state: 'done', date: '2026-10-06' },
    ],
  },
  {
    key: 'store',
    label: 'Your shop',
    purpose: 'cartandkeep.com: shop, checkout, payments and legal pages.',
    items: [
      { label: 'Brand identity', state: 'done', date: '2026-08-17' },
      { label: 'Shop built', detail: 'front page, sections, product pages, search, basket', state: 'done', date: '2026-08-18' },
      { label: 'Checkout with card and Apple Pay', state: 'done', date: '2026-08-18' },
      { label: 'Card payments live', state: 'done', date: '2026-09-04' },
      { label: 'Custom store live', detail: 'tested end to end with a real paid order', state: 'done', date: '2026-10-03' },
      { label: 'Order tracking page and branded emails', state: 'done', date: '2026-09-28' },
      { label: 'Gifts, saved lists and a calmer checkout', state: 'done', date: '2026-09-27' },
      { label: 'Legal pages, written to UK law', state: 'done', date: '2026-09-25' },
      { label: 'Blog with five posts', state: 'done', date: '2026-09-29' },
      { label: 'Installable on a phone', state: 'done', date: '2026-08-18' },
      { label: 'Products you control from the portal', detail: 'add, price, photograph, stock, sizes', state: 'done', date: '2026-08-21' },
      { label: 'Nothing goes on sale incomplete', state: 'done', date: '2026-08-19' },
      { label: 'Your eBay listings brought onto the shop', state: 'done', date: '2026-09-27' },
      { label: 'Sections that sort themselves', state: 'done', date: '2026-10-03' },
      { label: 'Customer questions, requests and mailing list', state: 'done', date: '2026-08-25' },
      { label: 'SEO foundation', state: 'active' },
      { label: 'A private price for one customer', state: 'active' },
    ],
  },
  {
    key: 'shopfloor',
    label: 'Running the shop',
    purpose: 'Orders, dispatch, messages, reviews and customers.',
    items: [
      { label: 'Orders and dispatch in the portal', state: 'done', date: '2026-08-19' },
      { label: 'Order emails to customers and to you', state: 'done', date: '2026-08-20' },
      { label: 'Shop analytics', detail: 'what sells, searches, where visitors came from', state: 'done', date: '2026-08-20' },
      { label: 'Your dashboard', state: 'done', date: '2026-08-21' },
      { label: 'Verified reviews only', state: 'done', date: '2026-08-21' },
      { label: 'Customers list, fills itself', state: 'done', date: '2026-08-21' },
      { label: 'Messages in one inbox', state: 'done', date: '2026-08-25' },
      { label: 'Dispatch desk and packing slips', state: 'done', date: '2026-09-24' },
      { label: 'Low stock emails', state: 'done', date: '2026-08-21' },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    purpose: 'What you make, and what helps Google find you.',
    items: [
      { label: 'Profit per product, per channel', state: 'done', date: '2026-08-20' },
      { label: 'eBay and TikTok Shop sales in one place', state: 'done', date: '2026-09-22' },
      { label: 'Financial dashboard with real eBay fees', state: 'done', date: '2026-09-22' },
      { label: 'What stops Google listing each product', state: 'done', date: '2026-09-24' },
      { label: 'Monthly search report', detail: 'first one once Google has figures', state: 'active' },
      { label: 'Google Shopping free listings', state: 'active' },
    ],
  },
];

export const STATE_LABEL = { done: 'Complete', active: 'In progress', queued: 'Queued' };

// Shown beside a completed item whose method has since been replaced.
export const SUPERSEDED_LABEL = 'Since replaced';

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
