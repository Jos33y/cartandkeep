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
 *           The line stays because the work happened and was handed over.
 */

export const SCOPE_VERSION = '2.1';
export const SCOPE_DATE = '2026-07-23';
export const LAST_REVIEWED = '2026-09-27';
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
          'Revenue, platform fees, promoted listings, postage, packaging, returns provision and cost of goods, per product and per channel. Built, and now carrying your real eBay sales with the fees eBay actually charged. TikTok Shop comes in from its own report.',
        state: 'done',
        date: '2026-09-22',
      },
      {
        label: 'Custom store live',
        detail:
          'cartandkeep.com is live, with guest checkout taking card payments. The full path has been tested end to end: an order placed, paid, confirmed by email, stock taken off and a receipt issued.',
        state: 'done',
      },
      {
        label: 'First batch of products listed on the store',
        detail: 'The seeded batch was cleared out on 22 September rather than left as drafts nobody had read. What is in the shop now are the products your eBay listings have actually sold, and more of your eBay listings come over from the Traffic screen in one step, filled in and waiting for you.',
        state: 'done',
      },
      {
        label: 'Multi-category structure ready from day one',
        detail: 'Sections of your own, suggested by Keeper from everything you sell and yours to change, each with its own address, plus a price band. Category pages and sorting are built, and a section appears on the shop once it holds three live products.',
        state: 'done',
        date: '2026-09-27',
      },
      {
        label: 'Blog module active, format ready for the first posts',
        detail: 'Markdown files, an index and a post page. First piece written, a buying guide on what a house runs out of.',
        state: 'done', date: '2026-08-18',
      },
      {
        label: 'Legal pages live',
        detail: 'Six pages: terms of sale, privacy, returns and refunds, delivery, cookies, and how reviews work. Rewritten on 25 September with the law each clause answers to. The decisions that are yours are in the review pack rather than on the live pages, and the pages are final once you have marked it up.',
        state: 'done',
        date: '2026-08-18',
      },
      {
        label: 'TikTok Shop bio updated with cartandkeep.com',
        why: 'Not done yet. Five minutes in TikTok Shop, now the domain is live.',
        detail: 'Five minutes, once the domain resolves.',
        state: 'queued',
      },
      {
        label: 'Daily listing workload absorbed across TikTok Shop and the store',
        why: 'Starts in month two, by the scope.',
        detail: 'eBay Store 2 activation is month two by the scope, once the base is proven.',
        state: 'queued',
      },
    ],
  },
  {
    key: 'seo',
    label: 'SEO foundation',
    section: 'Section 4',
    note: 'Seventeen items, all committed live before end of month one. Each is built into the store as it goes up rather than added afterwards.',
    items: [
      { label: 'Page titles across every page', state: 'done' },
      { label: 'Meta descriptions across every page', state: 'done' },
      { label: 'Clean SEO-friendly URL structure', detail: '/c/department and /p/product, no query strings.', state: 'done', date: '2026-08-18' },
      {
        label: 'XML sitemap generated and submitted to Google',
        why: 'Built. Waits on Google Search Console.',
        detail: 'Generated from the live catalogue, so it lists what a visitor can actually see. Submission waits on the domain.',
        state: 'active',
      },
      { label: 'Robots.txt configured', state: 'done', date: '2026-08-18' },
      {
        label: 'Google Search Console verified and connected',
        why: 'Domain verification in progress.',
        detail: 'Domain verification in progress.',
        state: 'queued',
      },
      { label: 'Bing Webmaster Tools verified and connected',
        why: 'Not started.', state: 'queued' },
      {
        label: 'Schema markup on products, articles and organisation',
        detail: 'Organisation, website, shop, product, breadcrumb and article. No invented ratings: those wait for real reviews.',
        state: 'done',
      },
      { label: 'LLMS.txt for AI model citations', state: 'done', date: '2026-08-18' },
      { label: 'Image compression and optimisation across all assets', detail: 'Sized, lazy loaded and served at two densities. Source photographs are supplier resolution.', state: 'done' },
      {
        label: 'Internal linking between products, categories and blog posts',
        detail: 'Products, departments, the blog and every legal page all reach each other. Nothing in the shop is more than two taps from anything else.',
        state: 'done',
      },
      {
        label: '301 redirects configured where relevant',
        why: 'Old addresses forward inside the shop. The server-level version is not set up yet.',
        detail: 'A section that is renamed or removed keeps its old address, and anyone arriving there is taken to where its products went.',
        state: 'active',
      },
      {
        label: 'Basic keyword targeting on category pages',
        detail: 'Each department carries a title and description built from its name, its count and its price floor.',
        state: 'done',
      },
      { label: 'Core Web Vitals passing',
        why: 'Not started.', detail: 'LCP, INP, CLS', state: 'queued' },
      {
        label: 'Blog module ready in markdown format',
        detail: 'A post is a markdown file dropped in a folder. No editor to learn and nothing to update by hand.',
        state: 'done', date: '2026-08-18',
      },
      {
        label: 'One SEO-optimised landing page live at launch',
        detail: 'The About page. Written for the words somebody types when they are checking whether a shop is real.',
        state: 'done',
      },
      {
        label: 'SEO progress report',
        why: 'Waits on Google Search Console.',
        detail:
          'Monthly, kept under Being found month by month, so you can see the line from nothing to the first clicks rather than a document that lands and is filed. It cannot start until Google Search Console is verified and connected, which is still being set up, so no report has gone out yet. Until then Being found shows what stops Google listing each product.',
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
        state: 'done', date: '2026-09-24',
      },
      { label: 'Sales', detail: 'Your eBay sales are in, with what each one took and what eBay charged for it. The shop\u2019s own follow its first order.', state: 'done', date: '2026-09-22' },
      { label: 'Revenue', detail: 'By month and by channel, from your eBay account today and from the shop as it sells.', state: 'done', date: '2026-09-22' },
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
          'Your shop, eBay and TikTok Shop in the same figures. eBay comes straight from your account, TikTok Shop from its own report, so this does not wait on the shop selling anything.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Cost tracking',
        detail:
          'What each product cost you landed, what postage costs you, packaging per parcel, a returns provision and promoted listings. eBay fees come off what eBay actually charged, and a cost can be put on anything that has sold, whether or not it is in your shop.',
        state: 'done',
        date: '2026-08-20',
      },
      {
        label: 'Margin per product per channel',
        detail:
          'The same product side by side on all three, after every fee, postage, packaging and what it cost you. On Cesar Country Stew, bought at £4.99 and listed at £22, eBay leaves about £10 a sale, and your own shop leaves more because there is no eBay fee on it.',
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
        why: 'Not built.',
        detail: 'The same figures grouped by department. Not built.',
        state: 'queued',
      },
      {
        label: 'Alerts when a product or category goes negative margin',
        why: 'Follows cost tracking.',
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
          'Every candidate is read against eBay\u2019s live market: listings from UK sellers taken one at a time for price, sales, age and seller size, with the market\u2019s monthly volume and its price range recorded per product.',
        state: 'done',
        date: '2026-09-16',
      },
      {
        label: 'Three product batches ready for review',
        detail:
          'Mobility and daily living aids, bedding and duvet covers, massage and recovery. All three were retired when the entry check replaced the scoring model, and batches found on a shop shelf took their place.',
        state: 'done',
        superseded: true,
        date: '2026-08-16',
      },
      {
        label: 'Listing screening',
        detail:
          'Restricted and prohibited categories are filtered out before anything reaches the shortlist. Branded products are not: what sells on your account is branded, so a brand is treated as a buying route rather than a reason to refuse.',
        state: 'done',
        date: '2026-09-02',
      },
      {
        label: 'Live competition check on every candidate',
        detail:
          'How many sellers compete on the same search, at what price, and whether any of them is small enough for their sales to prove a new account can get in.',
        state: 'done',
        date: '2026-09-02',
      },
      {
        label: 'Google Shopping feed for free listings',
        detail:
          'Your products offered to Google Shopping at no cost, which is the nearest thing to a marketplace without the marketplace fee. Built. Google will not list a product without a description, and Keeper now writes one for each product as it arrives, so it fills as products go live.',
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
          'Reads the photograph as well as the record, writes a description and a shorter title, and tells you where the supplier data disagrees with itself. Now part of Keeper filling in the whole product.',
        state: 'done',
        superseded: true,
        date: '2026-08-21',
      },
      {
        label: 'Keeper, filling in every product for you',
        detail:
          'Titles to choose from, a description, the details, the brand, the section and the returns rule, all filled in before you open it. Only real decisions reach you, as one tap each, and the work carries on while the portal is closed. Nothing is published until you save it.',
        state: 'done',
        date: '2026-09-26',
      },
      {
        label: 'Your eBay listings on your shop in one step',
        detail:
          'The Traffic screen shows which of your listings are on the shop. Bring over one or all of them, and each arrives with its photographs, details and sizes, filled in and waiting for you.',
        state: 'done',
        date: '2026-09-27',
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
          'The sections came from the eBay categories your products were listed under, so they read like a marketplace rather than a shop. Replaced by sections that are yours alone, suggested by Keeper, with every old address still working.',
        state: 'done',
        superseded: true,
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
          'Sourcing runs inside the UK, so stock arrives in days rather than weeks and there is no import paperwork on you. Candidates now come off a real shop shelf with the price on them, so the card shows what is left after everything rather than a ceiling. Every candidate carries the most the goods can cost and still make the target, and suppliers are checked against that number rather than the other way round.',
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
          'Done. The account is verified and connected to the shop, so the checkout takes card and Apple Pay.',
        state: 'done',
        date: '2026-09-04',
      },
      {
        label: 'Review the legal pages',
        detail:
          'A review pack in Word: every clause as a customer reads it, the law it answers to, and the decisions only you can make, numbered. Mark it up and every change is carried into the shop exactly as you word it.',
        state: 'client',
      },
      {
        label: 'Your own name as the legal name',
        detail:
          'Under Settings, Who is selling. As a sole trader the law requires your own name beside Cart & Keep on every receipt and legal page. The field currently holds a company name with no company number, and the screen now says so.',
        screen: '/settings', state: 'client',
      },
      {
        label: 'Your trading name and address',
        detail:
          'Done. Both are in Settings and now appear on every order confirmation, as the law requires.',
        state: 'done',
        date: '2026-09-22',
      },
      {
        // The counts here were against the 78 seeded products, and 74 of those
        // were cleared out on 22 September. No number is quoted now, because
        // one she can check on her own screen and find wrong is worse than
        // none, and the portal shows the real count beside each product.
        label: 'Confirm the returns rule on what is in the shop',
        detail:
          'Done. Every product in the shop carries a confirmed returns rule. Anything sealed, edible or hygiene related cannot take the same return as a saucepan, so a new product is held off sale until its rule is agreed, and each one arrives with a suggestion and the reason for it.',
        state: 'done',
        date: '2026-09-22',
      },
      {
        label: 'Delivery, returns and the words on your shop',
        detail: 'Done. Your delivery offer, your returns rule and the lines at the top of the shop, all set by you in Settings.',
        screen: '/settings', state: 'done',
      },
      {
        label: 'Your carrier rate card',
        detail:
          'Done. You chose not to charge extra for the Highlands, the islands and Northern Ireland, so the shop covers what the carrier adds to reach them.',
        screen: '/settings', state: 'done',
      },
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
