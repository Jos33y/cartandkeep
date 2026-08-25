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
export const LAST_REVIEWED = '2026-08-25';
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
          'portal.cartandkeep.com, in use since 27 July for research, decisions, products, orders and settings.',
        state: 'done',
        date: '2026-07-27',
      },
      {
        // The scope's wording for this line is the portal live "with the
        // financial dashboard tracking revenue, platform fees, expenses, and
        // net profit per product per channel". The portal has been live since
        // July and the dashboard is not built, so this was reading as complete
        // against a line it does not meet. Separated out rather than left
        // folded into the item above.
        label: 'Financial dashboard in the portal',
        detail:
          'Revenue, platform fees, promoted listings, postage, packaging, returns provision and cost of goods, per product and per channel. Built. It fills as sales come in, and your eBay and TikTok Shop sales come in from their own reports so the figures cover all three.',
        state: 'active',
      },
      {
        label: 'Custom store live',
        detail:
          'cartandkeep.com, guest checkout ready. The full path has been tested end to end: an order placed, paid, confirmed by email, stock taken off and a receipt issued. Everything below waits on this.',
        state: 'active',
      },
      {
        label: 'First batch of products listed on the store',
        detail: '78 products loaded with photographs, brands, specifications and categories. Held as drafts until they are approved.',
        state: 'active',
      },
      {
        label: 'Multi-category structure ready from day one',
        detail: 'Eight departments, plus a price band. Category pages, sub-sections and sorting are built.',
        state: 'active',
      },
      {
        label: 'Blog module active, format ready for the first posts',
        detail: 'Markdown files, an index and a post page. First piece written, a buying guide on what a house runs out of.',
        state: 'active',
      },
      {
        label: 'Legal pages live',
        detail: 'Six pages: delivery, returns and refunds, terms of sale, privacy, cookies, frequently asked. Twelve points still need your confirmation, marked on each page.',
        state: 'active',
      },
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
      { label: 'Page titles across every page', state: 'active' },
      { label: 'Meta descriptions across every page', state: 'active' },
      { label: 'Clean SEO-friendly URL structure', detail: '/c/department and /p/product, no query strings.', state: 'done', date: '2026-08-18' },
      {
        label: 'XML sitemap generated and submitted to Google',
        detail: 'Generated from the live catalogue, so it lists what a visitor can actually see. Submission waits on the domain.',
        state: 'active',
      },
      { label: 'Robots.txt configured', state: 'done', date: '2026-08-18' },
      {
        label: 'Google Search Console verified and connected',
        detail: 'Domain verification in progress.',
        state: 'queued',
        blocking: 'store',
      },
      { label: 'Bing Webmaster Tools verified and connected', state: 'queued', blocking: 'store' },
      {
        label: 'Schema markup on products, articles and organisation',
        detail: 'Organisation, website, shop, product, breadcrumb and article. No invented ratings: those wait for real reviews.',
        state: 'active',
      },
      { label: 'LLMS.txt for AI model citations', state: 'done', date: '2026-08-18' },
      { label: 'Image compression and optimisation across all assets', detail: 'Sized, lazy loaded and served at two densities. Source photographs are supplier resolution.', state: 'active' },
      {
        label: 'Internal linking between products, categories and blog posts',
        detail: 'Products, departments, the blog and every legal page all reach each other. Nothing in the shop is more than two taps from anything else.',
        state: 'active',
      },
      { label: '301 redirects configured where relevant', state: 'queued', blocking: 'store' },
      {
        label: 'Basic keyword targeting on category pages',
        detail: 'Each department carries a title and description built from its name, its count and its price floor.',
        state: 'active',
      },
      { label: 'Core Web Vitals passing', detail: 'LCP, INP, CLS', state: 'queued', blocking: 'store' },
      {
        label: 'Blog module ready in markdown format',
        detail: 'A post is a markdown file dropped in a folder. No editor to learn and nothing to update by hand.',
        state: 'active',
      },
      {
        label: 'One SEO-optimised landing page live at launch',
        detail: 'The About page. Written for the words somebody types when they are checking whether a shop is real.',
        state: 'active',
      },
      {
        label: 'SEO progress report',
        detail:
          'First on 24 August, then the 22nd of each month, every cycle without exception. It lives in the portal under Being found and is kept month by month, so you can see the line from nothing to the first clicks rather than a document that lands and is filed.',
        state: 'active',
      },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    section: 'Section 5',
    note:
      'Phase one, committed from month one. Everything that measures behaviour is built and fills the hour the shop is public. Everything that measures money waits on the first sales, and the profit lines wait on knowing what each product costs you.',
    items: [
      {
        label: 'Custom analytics portal live',
        detail: 'portal.cartandkeep.com, rather than a third party watching your customers.',
        state: 'done',
        date: '2026-07-27',
      },
      {
        label: 'Top products',
        detail: 'What gets looked at, saved, put in a basket and bought, per product.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Conversion rate',
        detail:
          'Views to basket and views to sale, per product. Shown as nothing rather than as zero until enough people have looked to mean anything.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Customer behaviour',
        detail: 'What people search for, what they find nothing for, and what they look at and leave.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Cart abandonment',
        detail:
          'Per product, which is the useful half: what went into a basket and came back out again. Basket level abandonment follows the first checkouts.',
        state: 'active',
      },
      { label: 'Sales', detail: 'Follows the first order.', state: 'queued', blocking: 'store' },
      { label: 'Revenue', detail: 'Follows the first order.', state: 'queued', blocking: 'store' },
      {
        label: 'Traffic sources',
        detail:
          'Google, TikTok, a link somebody shared, email, or typing the address in, with how many of each went on to put something in a basket and buy.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Returning against new customers',
        detail:
          'By email address on the order, since the shop stores nothing on anybody\u2019s device. Both counts are on the Customers screen, with everything each person has bought behind their row. The figures stay at zero until the first orders.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Revenue by channel',
        detail:
          'Your shop, eBay and TikTok Shop in the same figures. The other two come in from the reports both platforms already give you, so this does not wait on the shop selling anything.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Cost tracking',
        detail:
          'What each product cost you landed, what postage costs you, packaging per parcel, a returns provision and promoted listings. Platform fees come off the real figure where the export gives one and off the rate where it does not.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Margin per product per channel',
        detail:
          'The same product side by side on all three. On a pan set at £117 that is £46 on your own shop against £28 on eBay, after every fee, postage, packaging and what it cost you.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Net profit per product per channel',
        detail:
          'Per month, per product, per channel. Shown over the products with a cost recorded, and it says how many that covers rather than quietly leaving the rest out.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Category level profit and loss',
        detail: 'The same figures grouped by department. Not built.',
        state: 'queued',
      },
      {
        label: 'Alerts when a product or category goes negative margin',
        detail:
          'Follows cost tracking, since there is nothing to compare a price against without it. The machinery that sends a scheduled alert is built and running: low stock uses it already.',
        state: 'queued',
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
        label: 'Google Shopping feed for free listings',
        detail:
          'Your products offered to Google Shopping at no cost, which is the nearest thing to a marketplace without the marketplace fee. Built. It carries nothing until products have descriptions, because Google will not list one without.',
        state: 'active',
      },
      {
        label: 'Running the shop yourself, from the portal',
        detail:
          'Add a product, photograph it, price it, count stock, describe it, put it on sale or take it off. Not named anywhere in the scope, and the shop cannot be handed over without it.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Orders and dispatch in the portal',
        detail:
          'See an order the moment it lands, what to pack, where it goes, and mark it gone with a tracking number.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Your shop settings, yours to change',
        detail:
          'Trading details, delivery rates, postcode surcharges and the wording on the front page, without waiting on us.',
        state: 'done',
        date: '2026-08-19',
      },
      {
        label: 'Sizes and options on a product',
        detail:
          'One product in several sizes, colours or pack sizes, each with its own price and its own count, and a shopper picks one before the basket will take it. Not in the scope, and the alternative was three separate listings of the same thing.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Product descriptions drafted for you',
        detail:
          'Reads the photograph as well as the record, writes a description and a shorter title, and tells you where the supplier data disagrees with itself. It has already caught a sticker pack listed as foam and a load rating given two different ways on a bed rail. Nothing is published until you have read it.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Reviews, from people who actually bought it',
        detail:
          'There is no way to write one except from the link in your dispatch email, asked for a week after the parcel goes out, and nothing appears on the shop until you have read it. That is what lets the rating on a product page be a fact rather than a decoration.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Your own dashboard',
        detail:
          'What needs you, in the order it matters, with what has been taken today beside it. Every line goes straight to the screen that clears it.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Your own words for every department',
        detail:
          'The sections came from the eBay categories your products were listed under, so they read like a marketplace rather than a shop. Rename any of them, reorder them, or take one off the menu. The products do not move and Google still sees the original, so nothing you have already been indexed for breaks.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Ask us to stock it',
        detail:
          'The offer on your home page used to open an email. It is a page now, so a request arrives with what they want, what they pay for it now and where they buy it, and anything asked for more than once is grouped with an average of what people say they pay. That is demand you did not have to research.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Customers',
        detail:
          'Everybody who has bought something, what they spent, what they ordered and whether anything of theirs is still waiting to go out. Searchable by name, postcode or order reference, which is what you need when somebody writes in. Nobody to add: it fills itself.',
        state: 'done',
        date: '2026-08-21',
      },
      {
        label: 'Mailing list, and taking things off sale',
        detail:
          'A box in the footer with a working unsubscribe, and the list exportable to a spreadsheet whenever you want it. Plus archiving: a product comes off the shop and out of your lists without touching the orders that already have it on them.',
        state: 'done',
        date: '2026-08-21',
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
    note:
      'This list has grown, and that is the shop being finished rather than a list of chores. Every one of these is something only you can decide or only you can see, and each has a screen in the portal waiting for it.',
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
      {
        label: 'Your trading name and address',
        detail:
          'Under Settings. The law requires both on every order confirmation, so until they are in, each one goes out short. Two boxes.',
        state: 'client',
      },
      {
        // Eleven was the sealed count. Sixteen more are things that cannot come
        // back at all, and the portal reports twenty five waiting. A number she
        // can check against her own screen and find wrong is worse than none.
        label: 'Confirm the returns rule on twenty five products',
        detail:
          'Under Products. Bath sets, pads, food and anything that comes sealed cannot carry the same return as a saucepan, and the wording is a contract term, so it is yours to agree rather than ours to write. There is a suggestion on each one with the reason for it.',
        state: 'client',
      },
      {
        label: 'Read the label on eight chemicals',
        detail:
          'Under Products. Carpet cleaner, Jeyes Fluid, drain unblocker, weed killer, wasp killer, super glue and the rest. An online offer for a classified mixture has to carry its hazard wording, and only the bottle knows what that is.',
        state: 'client',
      },
      {
        label: 'Product descriptions',
        detail:
          'Under Products. Empty on all 78. It is the only thing on a product page that argues for the purchase, Google will not list a product without one, and a description written from a supplier feed title is the feed title with more words.',
        state: 'client',
      },
      {
        label: 'Your carrier rate card',
        detail:
          'Under Settings. Four postcode surcharges, all currently zero, which means the shop absorbs whatever the carrier charges extra to reach the Highlands and the islands.',
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
const committed = DELIVERABLE_GROUPS
  .filter((g) => g.key === 'month-one' || g.key === 'seo' || g.key === 'analytics')
  .flatMap((g) => g.items);

export function tally() {
  const count = (s) => committed.filter((i) => i.state === s).length;
  return {
    done: count('done'),
    active: count('active'),
    queued: count('queued'),
    // Only what is genuinely untouched and waiting. Anything built and
    // awaiting launch is `active` and counting it here would keep the number
    // high while the work was finishing, which is the opposite of the point.
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
