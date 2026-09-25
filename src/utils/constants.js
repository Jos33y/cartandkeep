export const STORE_ROUTES = {
  HOME: '/',
  CATEGORY: '/c/:slug',
  PRODUCT: '/p/:slug',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDER_CONFIRMATION: '/order/:reference',
  LEGAL: '/legal/:slug',
  // Help, not policy, so it sits outside /legal. /legal/faq redirects here.
  FAQ: '/faq',
  BLOG: '/blog',
  BLOG_POST: '/blog/:slug',
  SEARCH: '/search',
  SAVED: '/saved',
  // Home is a hero and shelves. This is the whole catalogue in one grid, and
  // it is where "Keep shopping" and "Everything in the shop" belong.
  SHOP: '/shop',
  // What the band on the home page has promised since the shop was built. It
  // went to a mail client, which is where a request goes to die.
  REQUEST: '/request',
  // Reached from the link on every marketing email. Runs on load rather than
  // asking somebody to confirm a decision they have already made.
  UNSUBSCRIBE: '/unsubscribe',
  // Reached only by the link in the dispatch email, and never linked to from
  // anywhere in the shop. That is what makes a rating on a product page a fact
  // rather than a decoration.
  REVIEW: '/review/:reference',
  // Order conversations live on the order page instead, so nobody holds two tokens.
  THREAD: '/thread/:id',
  // The function behind this refuses once a Stripe key exists.
  PAY_SIMULATOR: '/pay/simulate',
  RECEIPT: '/receipt/:reference',
  // For anyone who has lost the link in their confirmation email. The
  // reference alone is not enough to open an order, so this asks for the
  // email too.
  ORDER_LOOKUP: '/orders',
  ABOUT: '/about',
  CONTACT: '/contact',
};

export const PORTAL_ROUTES = {
  LOGIN: '/login',
  OVERVIEW: '/',
  // The shop's own front door. Overview stays where it is: this portal holds
  // two businesses and moving one of them's front door to make room for the
  // other is a change nobody asked for.
  SHOP: '/shop',
  REVIEWS: '/reviews',
  CUSTOMERS: '/customers',
  REQUESTS: '/requests',
  SUBSCRIBERS: '/subscribers',
  CATEGORIES: '/sections',
  CANDIDATES: '/candidates',
  APPROVED: '/approved',
  LISTINGS: '/listings',
  PRODUCTS: '/products',
  INTEREST: '/interest',
  FOUND: '/being-found',
  FINANCE: '/finance',
  ORDERS: '/orders',
  MESSAGES: '/messages',
  SLIP: '/orders/:reference/slip',
  NOTES: '/notes',
  ACTIVITY: '/activity',
  COVERAGE: '/coverage',
  METRICS: '/metrics',
  SETTINGS: '/settings',
  // Her own eBay account, which is a third surface: not the pipeline that feeds
  // it and not the shop we built. Traffic is the first of these; listings and
  // orders follow once they are read from eBay rather than entered by hand.
  EBAY_TRAFFIC: '/ebay/traffic',
  // eBay sends her here after she approves. Outside the guard, so it is not in
  // the nav either.
  EBAY_CALLBACK: '/ebay/callback',
};

// Dev serves all three hosts from one document, so portal links carry ?portal.
export function portalPath(path) {
  if (!import.meta.env.DEV) return path;
  return `${path}${path.includes('?') ? '&' : '?'}portal`;
}

// Single source of truth for sidebar and drawer. Review sits first: Monday is
// the one moment of the week this has to be right.
export const PORTAL_NAV_SECTIONS = [
  {
    key: 'review',
    label: 'Review',
    items: [
      { route: PORTAL_ROUTES.OVERVIEW, label: 'Overview', icon: 'IconGrid' },
      { route: PORTAL_ROUTES.CANDIDATES, label: 'Candidates', icon: 'IconLayers' },
      { route: PORTAL_ROUTES.APPROVED, label: 'Approved', icon: 'IconCheck' },
      { route: PORTAL_ROUTES.COVERAGE, label: 'Coverage', icon: 'IconMap' },
      { route: PORTAL_ROUTES.LISTINGS, label: 'Listings', icon: 'IconTag' },
    ],
  },
  /*
   * eBay sits between the two.
   *
   * Review is the pipeline deciding what to sell. Your shop is cartandkeep.com.
   * Her eBay account is neither: it is where the pipeline's output actually
   * goes, and where the only measurements of her own selling exist. Folding it
   * into Review would file her live account among things still being decided,
   * and folding it into Your shop would say eBay is ours, which it is not.
   */
  {
    key: 'ebay',
    label: 'eBay',
    items: [
      { route: PORTAL_ROUTES.EBAY_TRAFFIC, label: 'Traffic', icon: 'IconEye' },
    ],
  },
  /*
   * The shop is its own thing, and it was not.
   *
   * This portal now holds two businesses: the research pipeline that feeds her
   * eBay listings, and the shop we built her. Orders sat under Performance next
   * to Finance, which is where a report goes rather than where a parcel goes,
   * and putting Products under Review would have filed shop admin among
   * pipeline review. Two groups keeps them legible to somebody who did not
   * build it.
   */
  {
    key: 'shop',
    label: 'Your shop',
    items: [
      { route: PORTAL_ROUTES.SHOP, label: 'Dashboard', icon: 'IconGauge' },
      { route: PORTAL_ROUTES.PRODUCTS, label: 'Products', icon: 'IconShop' },
      { route: PORTAL_ROUTES.CATEGORIES, label: 'Sections', icon: 'IconShelves' },
      { route: PORTAL_ROUTES.ORDERS, label: 'Orders', icon: 'IconBox' },
      { route: PORTAL_ROUTES.MESSAGES, label: 'Messages', icon: 'IconSpeech', badge: 'awaiting' },
      { route: PORTAL_ROUTES.REVIEWS, label: 'Reviews', icon: 'IconStar' },
      { route: PORTAL_ROUTES.CUSTOMERS, label: 'Customers', icon: 'IconPeople' },
      { route: PORTAL_ROUTES.REQUESTS, label: 'Requests', icon: 'IconAsk' },
      { route: PORTAL_ROUTES.SUBSCRIBERS, label: 'Mailing list', icon: 'IconEnvelope' },
      { route: PORTAL_ROUTES.INTEREST, label: 'Interest', icon: 'IconEye' },
      { route: PORTAL_ROUTES.FOUND, label: 'Being found', icon: 'IconSearch' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    items: [
      { route: PORTAL_ROUTES.FINANCE, label: 'Finance', icon: 'IconChart' },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { route: PORTAL_ROUTES.NOTES, label: 'Notes', icon: 'IconNote' },
      { route: PORTAL_ROUTES.ACTIVITY, label: 'Activity', icon: 'IconClock' },
      { route: PORTAL_ROUTES.METRICS, label: 'Metrics', icon: 'IconPin' },
      { route: PORTAL_ROUTES.SETTINGS, label: 'Settings', icon: 'IconCog' },
    ],
  },
];

// Superseded by LEGAL_COLUMN in @data/legal, which is derived from the pages
// that actually exist. Kept until the portal and status app have been checked
// for uses of it, because deleting an export on the strength of one grep is
// how a build breaks somewhere nobody was looking.
export const LEGAL_PAGES = ['terms', 'privacy', 'returns', 'delivery', 'cookies'];

export const CHANNELS = ['ebay', 'tiktok', 'store'];

// Mirrors the check constraint on decisions.reason. Drift fails the insert.
// `margin_thin` is headroom being small, which is measured before goods cost.
// `not_profitable` is what is left after a real supplier price goes in. They
// are two different measurements and one code for both would lose the only
// feedback the research pipeline gets.
export const REJECTION_REASONS = [
  { value: 'not_sourceable', label: 'Cannot source it' },
  { value: 'not_profitable', label: 'Not profitable once sourced' },
  { value: 'too_much_competition', label: 'Too much competition' },
  { value: 'margin_thin', label: 'Margin too thin' },
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'previous_underperformer', label: 'Previous underperformer' },
  { value: 'other', label: 'Other' },
];

// Who carried the parcel. UK carriers, so this is locale rather than client
// specific and it sits here beside the rejection reasons rather than inside the
// row that renders it. It becomes tenant configuration on the day a client
// ships from somewhere else, not before.
//
// Free text is deliberately not offered. "Royal Mail", "royal mail" and "RM"
// in one column is a column nothing can ever be grouped by, and Other covers
// the courier nobody has heard of.
export const CARRIERS = [
  'Royal Mail',
  'Evri',
  'DPD',
  'Yodel',
  'Parcelforce',
  'InPost',
  'DHL',
  'UPS',
  'Other',
];
