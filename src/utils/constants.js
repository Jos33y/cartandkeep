export const STORE_ROUTES = {
  HOME: '/',
  CATEGORY: '/c/:slug',
  PRODUCT: '/p/:slug',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDER_CONFIRMATION: '/order/:reference',
  LEGAL: '/legal/:slug',
};

export const PORTAL_ROUTES = {
  LOGIN: '/login',
  OVERVIEW: '/',
  CANDIDATES: '/candidates',
  APPROVED: '/approved',
  LISTINGS: '/listings',
  FINANCE: '/finance',
  ORDERS: '/orders',
  NOTES: '/notes',
  ACTIVITY: '/activity',
  SETTINGS: '/settings',
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
      { route: PORTAL_ROUTES.LISTINGS, label: 'Listings', icon: 'IconTag' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    items: [
      { route: PORTAL_ROUTES.FINANCE, label: 'Finance', icon: 'IconChart' },
      { route: PORTAL_ROUTES.ORDERS, label: 'Orders', icon: 'IconBox' },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { route: PORTAL_ROUTES.NOTES, label: 'Notes', icon: 'IconNote' },
      { route: PORTAL_ROUTES.ACTIVITY, label: 'Activity', icon: 'IconClock' },
      { route: PORTAL_ROUTES.SETTINGS, label: 'Settings', icon: 'IconCog' },
    ],
  },
];

export const LEGAL_PAGES = ['terms', 'privacy', 'returns', 'delivery', 'cookies'];

export const CHANNELS = ['ebay', 'tiktok', 'store'];

// Mirrors the check constraint on decisions.reason. Drift fails the insert.
export const REJECTION_REASONS = [
  { value: 'too_much_competition', label: 'Too much competition' },
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'margin_thin', label: 'Margin too thin' },
  { value: 'previous_underperformer', label: 'Previous underperformer' },
  { value: 'other', label: 'Other' },
];
