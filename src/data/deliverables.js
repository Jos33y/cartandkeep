/*
 * What the signed scope commits to, and where each item stands.
 *
 * Deliberately separate from `statusItems.js`. That file tracks what has been
 * built. This one tracks what was promised. They overlap and they are not the
 * same list, and merging them would hide the gap between the two, which is the
 * only reason this page exists.
 *
 * Source of truth is Engagement Scope v1.3, 22 July 2026. Section numbers are
 * carried on each group so any line can be checked against the document.
 *
 * state:    done | active | queued | client
 * blocking: the thing an item waits on, so the page can count without a
 *           hardcoded number going stale the moment something ships.
 */

export const SCOPE_VERSION = '1.3';
export const SCOPE_DATE = '2026-07-22';
export const MONTH_ONE_DUE = '2026-08-22';

export const DELIVERABLE_GROUPS = [
  {
    key: 'month-one',
    label: 'Month one',
    section: 'Section 6',
    note: 'Due 22 August 2026.',
    items: [
      {
        label: 'Business email active',
        detail: 'support@cartandkeep.com with the sowande@ alias, on the custom domain',
        state: 'done',
        date: '2026-07-26',
      },
      {
        label: 'Operations portal live',
        detail:
          'portal.cartandkeep.com, in use for product research and decisions. The financial side fills once the first sales come through.',
        state: 'done',
        date: '2026-07-27',
      },
      {
        label: 'Custom store live',
        detail: 'cartandkeep.com, guest checkout ready. Everything below waits on this.',
        state: 'active',
      },
      { label: 'First batch of products listed on the store', state: 'queued', blocking: 'store' },
      { label: 'Multi-category structure ready from day one', state: 'queued', blocking: 'store' },
      { label: 'Blog module active, format ready for the first posts', state: 'queued', blocking: 'store' },
      { label: 'Legal pages live', detail: 'privacy, terms, refund, shipping', state: 'queued', blocking: 'store' },
      {
        label: 'TikTok Shop bio updated with cartandkeep.com',
        detail: 'Five minutes, once the domain resolves.',
        state: 'queued',
        blocking: 'store',
      },
      {
        label: 'Daily listing workload absorbed across TikTok Shop and the store',
        detail: 'eBay Store 2 activation is month two by the scope, once the base is proven.',
        state: 'queued',
        blocking: 'store',
      },
    ],
  },
  {
    key: 'seo',
    label: 'SEO foundation',
    section: 'Section 4',
    note: 'Seventeen items, all committed live before end of month one. Each is built into the store as it goes up rather than added afterwards.',
    items: [
      { label: 'Page titles across every page', state: 'queued', blocking: 'store' },
      { label: 'Meta descriptions across every page', state: 'queued', blocking: 'store' },
      { label: 'Clean SEO-friendly URL structure', state: 'queued', blocking: 'store' },
      { label: 'XML sitemap generated and submitted to Google', state: 'queued', blocking: 'store' },
      { label: 'Robots.txt configured', state: 'queued', blocking: 'store' },
      {
        label: 'Google Search Console verified and connected',
        detail: 'Domain verification in progress.',
        state: 'queued',
        blocking: 'store',
      },
      { label: 'Bing Webmaster Tools verified and connected', state: 'queued', blocking: 'store' },
      { label: 'Schema markup on products, articles and organisation', state: 'queued', blocking: 'store' },
      { label: 'LLMS.txt for AI model citations', state: 'queued', blocking: 'store' },
      { label: 'Image compression and optimisation across all assets', state: 'queued', blocking: 'store' },
      { label: 'Internal linking between products, categories and blog posts', state: 'queued', blocking: 'store' },
      { label: '301 redirects configured where relevant', state: 'queued', blocking: 'store' },
      { label: 'Basic keyword targeting on category pages', state: 'queued', blocking: 'store' },
      { label: 'Core Web Vitals passing', detail: 'LCP, INP, CLS', state: 'queued', blocking: 'store' },
      { label: 'Blog module ready in markdown format', state: 'queued', blocking: 'store' },
      { label: 'One SEO-optimised landing page live at launch', state: 'queued', blocking: 'store' },
      {
        label: 'SEO progress report',
        detail: 'First on 24 August, then the 22nd of each month, every cycle without exception.',
        state: 'queued',
        blocking: 'store',
      },
    ],
  },
  {
    key: 'early',
    label: 'Delivered early',
    section: 'Month two scope',
    note: 'The scope puts cross-channel product research and sourcing intelligence in month two, in both Section 2 and the month two roadmap. It is built and running now.',
    items: [
      {
        label: 'Cross-channel research pipeline live in the portal',
        detail:
          'Seven to nine months of sales history per category, with sell-through, competition depth and margin recorded per product.',
        state: 'done',
        date: '2026-08-13',
      },
      {
        label: 'Three product batches ready for review',
        detail: 'Mobility and daily living aids 50, bedding and duvet covers 41, massage and recovery 23.',
        state: 'done',
        date: '2026-08-16',
      },
      {
        label: 'Listing screening',
        detail:
          'Restricted, branded, medical device and cosmetic items are filtered out before anything reaches the shortlist.',
        state: 'done',
        date: '2026-08-14',
      },
      {
        label: 'Live competition check on every candidate',
        detail: 'How many sellers compete on the same product, and at what price.',
        state: 'done',
        date: '2026-08-16',
      },
      {
        label: 'Supplier sourcing',
        detail:
          'A UK trade supplier for mobility aids contacted, awaiting response. One factory confirmed on a percussion massager with a minimum order of one unit, pending compliance documents.',
        state: 'active',
      },
    ],
  },
  {
    key: 'with-you',
    label: 'With you',
    section: 'Section 6',
    items: [
      {
        label: 'Register your Stripe UK account',
        detail:
          'stripe.com/gb. Approval takes 24 to 48 hours on Stripe\u2019s side, and the store checkout cannot take card payments until it is verified and integrated.',
        state: 'client',
      },
      {
        label: 'Decisions on the shortlisted products',
        detail:
          'Approve, reject or defer in the portal. Sourcing starts on whatever is approved. Rejecting with a reason teaches the pipeline what to stop bringing you.',
        state: 'client',
      },
    ],
  },
];

const flat = DELIVERABLE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export const DELIVERABLES = flat;

// Only what the scope commits to for month one. Work delivered early is real
// and it is not a month one obligation, so counting it here would flatter the
// figure and the figure is the point.
const committed = DELIVERABLE_GROUPS.filter((g) => g.key === 'month-one' || g.key === 'seo').flatMap(
  (g) => g.items,
);

export function tally() {
  const count = (s) => committed.filter((i) => i.state === s).length;
  return {
    done: count('done'),
    active: count('active'),
    queued: count('queued'),
    blockedByStore: committed.filter((i) => i.blocking === 'store').length,
    client: flat.filter((i) => i.state === 'client').length,
    total: committed.length,
  };
}

export const groupsFor = (keys) => DELIVERABLE_GROUPS.filter((g) => keys.includes(g.key));

export function lastUpdated() {
  const dates = flat.map((i) => i.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
