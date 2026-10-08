/*
 * What the signed scope commits to, and where each item stands.
 *
 * Deliberately separate from `statusItems.js`. That file tracks what has been
 * built. This one tracks what was promised. They overlap and they are not the
 * same list, and merging them would hide the gap between the two, which is the
 * only reason this page exists.
 *
 * Source of truth is Engagement Scope v2.1, 23 July 2026. Section numbers are
 * carried on each group so any line can be checked against the document.
 *
 * state:    done | active | queued | client
 * screen:   the portal route a client item is done on, for the button beside it
 * why:      one plain line on why a committed item is not delivered yet
 * superseded: delivered, and the method behind it has since been replaced.
 *
 * One short line per item. Detail shows as a tooltip and under Waiting on you, never a paragraph.
 */

export const SCOPE_VERSION = '2.1';
export const SCOPE_DATE = '2026-07-23';
export const LAST_REVIEWED = '2026-10-08';
export const MONTH_ONE_DUE = '2026-08-22';

export const DELIVERABLE_GROUPS = [
  {
    key: 'month-one',
    label: 'Month one',
    section: 'Section 6',
    note: 'Due 22 August 2026.',
    items: [
      { label: 'Business email active', detail: 'support@cartandkeep.com, with the sowande@ alias.', state: 'done', date: '2026-07-26' },
      { label: 'Operations portal live', detail: 'portal.cartandkeep.com, in use since 27 July.', state: 'done', date: '2026-07-27' },
      { label: 'Financial dashboard in the portal', detail: 'Revenue, fees and costs per product and channel, with your real eBay sales.', state: 'done', date: '2026-09-22' },
      { label: 'Custom store live', detail: 'cartandkeep.com takes card payments, tested with a real paid order.', state: 'done', date: '2026-10-03' },
      { label: 'First batch of products listed on the store', detail: 'Your selling eBay products first, the rest brought over in one step.', state: 'done' },
      { label: 'Multi-category structure ready from day one', detail: 'Sections from Google’s categories, each with its own address.', state: 'done', date: '2026-09-27' },
      { label: 'Blog module active, format ready for the first posts', detail: 'Five posts up, room for thirty.', state: 'done', date: '2026-08-18' },
      { label: 'Legal pages live', detail: 'Six pages, written to UK consumer law.', state: 'done', date: '2026-08-18' },
      { label: 'TikTok Shop bio updated with cartandkeep.com', why: 'Five minutes in TikTok Shop.', detail: 'Five minutes in TikTok Shop.', state: 'queued' },
      { label: 'Daily listing workload absorbed across TikTok Shop and the store',
        why: 'eBay and the shop run from the portal daily. TikTok Shop is not connected yet.',
        detail: 'eBay and the shop run from the portal daily. TikTok Shop is not connected yet.', state: 'active' },
    ],
  },
  {
    key: 'seo',
    label: 'SEO foundation',
    section: 'Section 4',
    note: 'Seventeen items, committed live by the end of month one.',
    items: [
      { label: 'Page titles across every page', state: 'done' },
      { label: 'Meta descriptions across every page', state: 'done' },
      { label: 'Clean SEO-friendly URL structure', detail: '/c/section and /p/product.', state: 'done', date: '2026-08-18' },
      { label: 'XML sitemap generated and submitted to Google', state: 'done', date: '2026-09-29' },
      { label: 'Robots.txt configured', state: 'done', date: '2026-08-18' },
      { label: 'Google Search Console verified and connected', why: 'Verified, sitemap in. Waiting on Google’s first figures.', detail: 'Verified, sitemap in. Waiting on Google’s first figures.', state: 'active' },
      { label: 'Bing Webmaster Tools verified and connected', why: 'Not started.', state: 'queued' },
      { label: 'Schema markup on products, articles and organisation', state: 'done' },
      { label: 'LLMS.txt for AI model citations', state: 'done', date: '2026-08-18' },
      { label: 'Image compression and optimisation across all assets', state: 'done' },
      { label: 'Internal linking between products, categories and blog posts', state: 'done' },
      { label: '301 redirects configured where relevant', detail: 'A renamed section keeps its old address working.', state: 'done', date: '2026-09-27' },
      { label: 'Basic keyword targeting on category pages', state: 'done' },
      { label: 'Core Web Vitals passing', why: 'Not started.', detail: 'LCP, INP, CLS', state: 'queued' },
      { label: 'Blog module ready in markdown format', state: 'done', date: '2026-08-18' },
      { label: 'One SEO-optimised landing page live at launch', detail: 'The About page.', state: 'done' },
      { label: 'SEO progress report', why: 'First one once Google has figures.', detail: 'Monthly, under Being found.', state: 'active' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    section: 'Section 5',
    note: 'Phase one, committed from month one.',
    items: [
      { label: 'Custom analytics portal live', state: 'done', date: '2026-07-27' },
      { label: 'Top products', detail: 'Looked at, saved, put in a basket and bought.', state: 'done', date: '2026-08-19' },
      { label: 'Conversion rate', state: 'done', date: '2026-08-19' },
      { label: 'Customer behaviour', detail: 'Searches, searches with no result, and what is left behind.', state: 'done', date: '2026-08-19' },
      { label: 'Cart abandonment', state: 'done', date: '2026-09-24' },
      { label: 'Sales', state: 'done', date: '2026-09-22' },
      { label: 'Revenue', state: 'done', date: '2026-09-22' },
      { label: 'Traffic sources', state: 'done', date: '2026-08-20' },
      { label: 'Returning against new customers', state: 'done', date: '2026-08-21' },
      { label: 'Revenue by channel', detail: 'Your shop, eBay and TikTok Shop together.', state: 'done', date: '2026-08-20' },
      { label: 'Cost tracking', state: 'done', date: '2026-08-20' },
      { label: 'Margin per product per channel', state: 'done', date: '2026-08-20' },
      { label: 'Net profit per product per channel', state: 'done', date: '2026-08-20' },
      { label: 'Category level profit and loss', why: 'Not built.', state: 'queued' },
      { label: 'Alerts when a product or category goes negative margin',
        why: 'A cost rise on a live listing is alerted and emailed. A below-zero margin alert is next.',
        detail: 'A cost rise on a live listing is alerted and emailed. A below-zero margin alert is next.', state: 'active' },
    ],
  },
  {
    key: 'early',
    label: 'Delivered early',
    section: 'Month two scope',
    note: 'Month two work, built and running now.',
    items: [
      { label: 'Cross-channel research pipeline live in the portal', state: 'done', date: '2026-09-16' },
      { label: 'Listing screening', detail: 'Restricted and prohibited items filtered out.', state: 'done', date: '2026-09-02' },
      { label: 'Live competition check on every candidate', state: 'done', date: '2026-09-02' },
      { label: 'Supplier sourcing', detail: 'Keeper finds each approved product on Amazon UK and checks it is the same.', state: 'done', date: '2026-10-04' },
      { label: 'Listing to eBay from the portal', detail: 'One at a time or in bulk, at your daily pace.', state: 'done', date: '2026-10-01' },
      { label: 'Keeper gets products ready to list', detail: 'Title, description, photos, category and item details.', state: 'done', date: '2026-10-05' },
      { label: 'Change price on any listing', state: 'done', date: '2026-10-04' },
      { label: 'Supplier price and stock checked every morning', detail: 'With an email when your cost changes.', state: 'done', date: '2026-10-05' },
      { label: 'Alerts in one place', state: 'done', date: '2026-10-07' },
      { label: 'Google Shopping feed for free listings', detail: 'Built. Submitted once products carry their Google categories.', state: 'active' },
      { label: 'Running the shop yourself, from the portal', state: 'done', date: '2026-08-19' },
      { label: 'Orders and dispatch in the portal', state: 'done', date: '2026-08-19' },
      { label: 'Your shop settings, yours to change', state: 'done', date: '2026-08-19' },
      { label: 'Sizes and options on a product', state: 'done', date: '2026-08-21' },
      { label: 'Keeper, filling in every product for you', state: 'done', date: '2026-09-26' },
      { label: 'Your eBay listings on your shop in one step', state: 'done', date: '2026-09-27' },
      { label: 'Reviews, from people who actually bought it', state: 'done', date: '2026-08-21' },
      { label: 'Your own dashboard', state: 'done', date: '2026-08-21' },
      { label: 'Ask us to stock it', state: 'done', date: '2026-08-21' },
      { label: 'Customers', state: 'done', date: '2026-08-21' },
      { label: 'Mailing list, and taking things off sale', state: 'done', date: '2026-08-21' },
    ],
  },
  {
    key: 'with-you',
    label: 'With you',
    section: 'Section 6',
    note: 'Only you can decide these. Each has a screen in the portal.',
    items: [
      { label: 'Register your Stripe UK account', detail: 'Verified and connected.', state: 'done', date: '2026-09-04' },
      { label: 'Review the legal pages', detail: 'A Word pack with the few decisions only you can make. Mark it up and we apply it.', state: 'client' },
      { label: 'Your trading name and address', detail: 'In Settings, on every confirmation.', state: 'done', date: '2026-09-22' },
      { label: 'Confirm the returns rule on what is in the shop', detail: 'Every product carries a confirmed rule.', state: 'done', date: '2026-09-22' },
      { label: 'Delivery, returns and the words on your shop', detail: 'Set by you in Settings.', screen: '/settings', state: 'done' },
      { label: 'Your carrier rate card', detail: 'No surcharge for the Highlands, islands or Northern Ireland.', screen: '/settings', state: 'done' },
    ],
  },
];

const flat = DELIVERABLE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export const DELIVERABLES = flat;

// Only what the scope commits to for month one. Work delivered early is real
// and it is not a month one obligation, so counting it here would flatter the
// figure and the figure is the point.
const COMMITTED = ['month-one', 'seo', 'analytics'];

const committed = DELIVERABLE_GROUPS
  .filter((g) => COMMITTED.includes(g.key))
  .flatMap((g) => g.items);

// The same list tally() counts, so a figure on the status page and the rows under it can never disagree.
export const committedItems = () => DELIVERABLE_GROUPS
  .filter((g) => COMMITTED.includes(g.key))
  .flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export function tally() {
  const count = (s) => committed.filter((i) => i.state === s).length;
  return {
    done: count('done'),
    active: count('active'),
    queued: count('queued'),
    client: flat.filter((i) => i.state === 'client').length,
    total: committed.length,
  };
}

export const groupsFor = (keys) => DELIVERABLE_GROUPS.filter((g) => keys.includes(g.key));

export function lastUpdated() {
  const dates = flat.map((i) => i.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
