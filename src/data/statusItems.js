// Hand-maintained until the pipeline writes here. Phase order is delivery order.
// state: done | active | queued. A done item needs a date or it cannot be logged.
// superseded: delivered, and since replaced by a different method.
// No count here that the portal also shows: it goes stale without anyone noticing.

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
      { label: 'Candidate review rebuilt around one decision', detail: 'what a sale keeps, what a month keeps, how big the market is and who is selling it, on one line per product, with the keyboard for approving, rejecting and saving for later', state: 'done', date: '2026-09-22' },
      { label: 'What was checked, and why the rest stopped', detail: 'under Coverage. Everything searched, drawn from the first search to what is live on eBay, so a short list can be read as rigour rather than as nothing found.', state: 'done', date: '2026-09-22' },
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
      { label: 'Seller Hub research access', detail: 'Terapeak, research areas only. Now read from eBay\u2019s live listings instead, so the figures come through the connection to your account rather than a separate tool.', state: 'done', superseded: true, date: '2026-08-03' },
      { label: 'Research pipeline data sources', state: 'done', date: '2026-08-03' },
      { label: 'What every figure means', detail: 'in the portal, under Metrics', state: 'done', date: '2026-08-05' },
      { label: 'Research coverage published', detail: 'every keyword searched and what it found', state: 'done', date: '2026-08-05' },
      { label: 'First review session', state: 'done', date: '2026-07-30' },
      { label: 'First candidate batch delivered', state: 'done', date: '2026-08-10' },
      { label: 'Twelve months of sales history per product', detail: 'seven monthly windows, direction and season. Replaced by a live read: every listing in the sample carries its own sales and its own age, so a rate is available the first time a product is checked.', state: 'done', superseded: true, date: '2026-08-12' },
      { label: 'Second candidate batch delivered', detail: 'three categories, all later retired when the entry check replaced the scoring model',
        state: 'done', superseded: true, date: '2026-08-16' },
      { label: 'Live competition check', detail: 'how many sellers compete, and at what price', state: 'done', date: '2026-08-13' },
      { label: 'Your live eBay listings read against real sales', detail: 'all 282 of them, each one checked against eBay\u2019s own sold figures rather than an estimate', state: 'done', date: '2026-08-31' },
      { label: 'Entry check on every candidate', detail: 'what it sells for, how many are competing, and whether a seller your size is making sales on it right now. A large market that is closed to a newcomer is refused rather than scored.', state: 'done', date: '2026-09-02' },
      { label: 'A maximum buying price on every candidate', detail: 'what the goods can cost and still leave the target profit, worked from the real fees and the postage that product needs rather than one flat figure for everything', state: 'done', date: '2026-09-16' },
      { label: 'Products found on a shop shelf, priced against what is selling', detail: 'a shelf price from a real shop attached to every candidate, so the figure on the card is profit rather than headroom', state: 'done', date: '2026-09-16' },
      { label: 'Every search recorded, with the reason it went no further', detail: 'not only what passed. Each one carries what stopped it: too many listings to rank on, nothing selling, a market too small, or a shelf price the market cannot carry', state: 'done', date: '2026-09-22' },
      { label: 'A minimum of £2 a sale before anything reaches you', detail: 'measured at your listing price and at the price a small seller is being paid. Anything under it is held back rather than sent to you to work out for yourself.', state: 'done', date: '2026-09-22' },
      { label: 'Pack sizes checked against the shelf', detail: 'where a listing sells far above the shelf price it is usually a bigger pack, and the product is held for checking rather than compared against the wrong thing', state: 'done', date: '2026-09-22' },
      { label: 'The market read refreshed on the products waiting on you', detail: 'evidence goes stale: on a re-check of 22 products, 15 had no listing left in common with the sample taken a week earlier. Run weekly from here.', state: 'active' },
    ],
  },
  {
    key: 'ebay',
    label: 'Your eBay account',
    items: [
      { label: 'eBay account connected to the portal', detail: 'granted by you and revocable by you, so listings, sales and traffic can be read and written without anyone sharing a password', state: 'done', date: '2026-09-18' },
      { label: 'Listing to eBay from the portal', detail: 'the photographs, title, description and price you approved go up as a listing, with the category eBay itself chooses from the title', state: 'done', date: '2026-09-22' },
      { label: 'First product listed from the research', detail: 'Cesar Country Stew, found on a shelf, checked against what is selling, written and listed', state: 'done', date: '2026-09-22' },
      { label: 'Changing a live listing from the portal', detail: 'shows what is on eBay now beside what would replace it, then revises the listing in place so it keeps its sales and its watchers', state: 'done', date: '2026-09-22' },
      { label: 'What eBay does with every listing', detail: 'how often each was shown, how many opened it and how many bought, across all 407 of them, so a listing nobody sees can be told apart from one people see and pass over', state: 'done', date: '2026-09-22' },
      { label: 'What each listing is leaving on the table', detail: 'for anything opened and not bought, what it would have taken at the rate your selling listings manage', state: 'done', date: '2026-09-22' },
    ],
  },
  {
    key: 'store',
    label: 'Custom store',
    items: [
      { label: 'Brand identity and app icons', detail: 'the basket and ampersand mark, at every size a phone and a browser ask for', state: 'done', date: '2026-08-17' },
      { label: 'Storefront built', detail: 'shop front, departments, product pages, search, basket', state: 'done', date: '2026-08-18' },
      { label: 'Product detail from the eBay catalogue', detail: 'brand, specifications and photographs pulled onto the products loaded at the time', state: 'done', date: '2026-08-18' },
      { label: 'Checkout integrated', detail: 'card and Apple Pay through Stripe, guest only, no account to make', state: 'done', date: '2026-08-18' },
      { label: 'Card payments connected', detail: 'your payment account is verified and connected to the shop, so the checkout takes real cards and Apple Pay', state: 'done', date: '2026-09-04' },
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
      { label: 'What each product costs you', detail: 'what you paid landed, and what postage costs you to send it. Everything you make is worked out from these two.', state: 'done', date: '2026-08-20' },
      { label: 'Sizes and options', detail: 'one product in several sizes, colours or pack sizes, each with its own price and its own count. A shopper picks one before the basket will take it.', state: 'done', date: '2026-08-21' },
      { label: 'Product descriptions drafted for you', detail: 'reads the photograph as well as the record, writes a description and a shorter title, and tells you where the supplier data contradicts itself. Nothing is published until you have read it.', state: 'done', date: '2026-08-21' },
      { label: 'A product cannot go live carrying a contradiction', detail: 'where the record disagrees with the photograph, the product is held until you have read why', state: 'done', date: '2026-08-21' },
      { label: 'Your own words for every department', detail: 'the sections came from eBay, so they read like a marketplace. Rename any of them, reorder them, or take one off the menu. Nothing else moves and Google still sees the original.', state: 'done', date: '2026-08-21' },
      { label: 'Ask us to stock it', detail: 'a page rather than an email, so a request arrives with what they want, what they pay for it now and where they buy it. Anything asked for twice is grouped so you can see it.', state: 'done', date: '2026-08-21' },
      { label: 'Mailing list', detail: 'a box in the footer, an unsubscribe link that works without signing in to anything, and the list exportable to a spreadsheet whenever you want it', state: 'done', date: '2026-08-21' },
      { label: 'Custom store live', due: 'Once the first products are approved and on sale', detail: 'cartandkeep.com. The shop is built and tested end to end, including a full order taken, paid and confirmed, and it takes card payments now. Your trading details are in. What is left is the products going on sale.', state: 'active' },
      { label: 'Questions before buying', detail: 'a box on every product. Somebody asks, you get an email, and they get a link back to the answer. No account for them and no chat window sitting on the shop pretending somebody is always there.', state: 'done', date: '2026-08-25' },
      { label: 'Questions about a whole basket', detail: 'they send the lot as one question, and you see exactly what they were looking at, priced as it was at the moment they asked', state: 'done', date: '2026-08-25' },
      { label: 'Questions about an order', detail: 'on the order page they already have, so nothing new to keep and no reference to type out', state: 'done', date: '2026-08-25' },
      { label: 'A receipt they can keep', detail: 'prints properly, and stays right as the order moves. It says paid, dispatched or refunded as it happens, so they can check it later rather than writing to ask.', state: 'done', date: '2026-08-25' },
      { label: 'A price you can give one person', detail: 'quote for what is in their basket, inside the conversation, good until a date you choose and usable once. It is not a sale price and it is never shown to anybody else.', state: 'active' },
      { label: 'Products approved and on sale', detail: 'four on sale, the ones your eBay listings have actually sold. The rest were cleared out rather than left sitting as drafts nobody had read.', state: 'active' },
    ],
  },
  {
    key: 'shopfloor',
    label: 'Running the shop',
    items: [
      { label: 'Orders visible in the portal', detail: 'what was bought, where it goes, and the address ready to copy onto a label', state: 'done', date: '2026-08-19' },
      { label: 'Dispatch and tracking from the portal', detail: 'mark a parcel gone, record who took it and the tracking number', state: 'done', date: '2026-08-19' },
      { label: 'Order emails', detail: 'a confirmation to the customer, an alert to you, and a second to them when it ships. You can see on each order exactly what they were sent, and send one again if it did not arrive.', state: 'done', date: '2026-08-20' },
      { label: 'What sells and what does not', detail: 'what gets looked at, saved, put in a basket and taken back out, per product', state: 'done', date: '2026-08-19' },
      { label: 'What people searched for and did not find', detail: 'every one is either something to stock or a word the shop does not use for something it already sells', state: 'done', date: '2026-08-19' },
      { label: 'Where people came from', detail: 'Google, TikTok, a link somebody shared, or typing the address in, with how many of each went on to buy', state: 'done', date: '2026-08-20' },
      { label: 'Your own dashboard', detail: 'what needs you, in the order it matters, with what has been taken today beside it. Every line goes straight to the screen that clears it.', state: 'done', date: '2026-08-21' },
      { label: 'Reviews', detail: 'only from people who actually bought the thing, asked for a week after the parcel goes out, and nothing appears on the shop until you have read it', state: 'done', date: '2026-08-21' },
      { label: 'Customers', detail: 'everybody who has bought something, what they spent, what they ordered and whether anything of theirs is still waiting to go out. Nobody to add: it fills itself.', state: 'done', date: '2026-08-21' },
      { label: 'Taking a product out of the shop', detail: 'archive it and it comes off the shop and out of your lists. Old orders are untouched, and anyone holding a link still sees a page rather than a dead end.', state: 'done', date: '2026-08-21' },
      { label: 'Messages', detail: 'every conversation in one place, the ones waiting on you first, with a count in the menu from wherever you are. You answer there rather than by email, so the whole thread stays together.', state: 'done', date: '2026-08-25' },
      { label: 'Packing slip', detail: 'print one from any order. The address, what is in the parcel and how many, and no prices, so nothing in the box tells a person what a gift cost.', state: 'done', date: '2026-08-25' },
      { label: 'How quickly you reply', detail: 'measured from your actual answers rather than typed into a box. It stays in the portal until there are enough of them to mean anything.', state: 'done', date: '2026-08-25' },
      { label: 'Told when something is nearly out', detail: 'an email when anything you have put a count against drops to three or fewer, once per item until it is restocked', state: 'done', date: '2026-08-21' },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    items: [
      { label: 'Monthly search report', detail: 'clicks, how often Google showed the shop, and what changed, kept month by month so the line is visible', state: 'active' },
      { label: 'Google Shopping feed', detail: 'free listings. Built and waiting on product descriptions, which Google requires before it will list anything.', state: 'active' },
      { label: 'What you make on every channel', detail: 'the same product side by side on your shop, eBay and TikTok Shop, after every fee, postage, packaging and what it cost you', state: 'done', date: '2026-08-20' },
      { label: 'Your eBay and TikTok Shop sales in one place', detail: 'eBay comes straight from your account with the fees it actually charged, and TikTok Shop from its own report, so every figure covers all three channels rather than only the shop', state: 'done', date: '2026-09-22' },
      { label: 'A cost on anything that has sold', detail: 'what you paid for it and what postage costs you, typed once on the finance screen and applied to every sale of it, past and future. Until it is there the screen says what it does not know rather than showing a profit it cannot work out.', state: 'done', date: '2026-09-22' },
      // Built, and it has nothing to show until something sells. Complete
      // would be a screen of zeros calling itself finished.
      { label: 'Financial dashboard live', detail: 'revenue, fees, promoted listings, postage, packaging, returns and cost of goods, per product and per channel. It fills as sales come in.', state: 'active' },
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