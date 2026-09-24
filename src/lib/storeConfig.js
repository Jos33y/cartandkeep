import { loadTenant } from './tenant';

/*
 * Everything about a shop that is not its catalogue.
 *
 * The free delivery threshold was written out in five components and one edge
 * function, and the postage rate in four and one. Nothing checked they agreed,
 * so the basket and the payment could have shown different numbers, and the
 * only reason they never did is that nobody edited them.
 *
 * This reads a `store` object off the tenants row, which already carries
 * palette, fees, scoring and research the same way. The defaults below are
 * Cart & Keep's, and they exist so a shop keeps working while that column is
 * empty rather than so anything relies on them.
 *
 * The checkout function reads the same row. That is the point: a threshold
 * living in two codebases is a threshold that will eventually disagree with
 * itself in front of a customer.
 */

const DEFAULTS = {
  domain: 'cartandkeep.com',
  email: 'support@cartandkeep.com',
  referencePrefix: 'CK',

  /*
   * Who the customer is buying from, and the terms they buy under.
   *
   * Null rather than a placeholder string. The legal pages render a missing
   * value as a line that needs confirming, which is honest; a placeholder
   * renders as prose and goes live reading "TO CONFIRM" to a customer.
   */
  trader: {
    name: null,
    address: null,
    company: null,
    returnAddress: null,
    vat: null,
  },
  returns: {
    days: 30,
    statutoryDays: 14,
    // 'customer' or 'us'. Unset means the trader pays, which is what the
    // regulations decide when nothing was said before the sale.
    postagePaidBy: null,
  },
  privacy: {
    retentionYears: null,
  },
  delivery: {
    freeOver: 40,
    postage: 3.95,
    cutoffHour: 14,
    transitMin: 2,
    transitMax: 3,

    /*
     * Surcharges by delivery zone.
     *
     * Every one of these is zero, on purpose. A flat rate to the whole UK
     * loses money on every parcel to Shetland, because carriers surcharge
     * those postcodes heavily, and the fix is a number from her rate card
     * rather than a number I invented. Zero means today's behaviour is
     * unchanged and the mechanism is ready.
     *
     * `blocked` is not a pricing decision. The Channel Islands are outside
     * the UK customs and VAT territory, so an order there is an export with a
     * declaration attached, and accepting one she cannot fulfil is worse than
     * declining it at the form.
     */
    zones: {
      mainland: { surcharge: 0 },
      highlands: { surcharge: 0, extraDays: 2 },
      northern_ireland: { surcharge: 0, extraDays: 1 },
      isle_of_man: { surcharge: 0, extraDays: 2 },
      isles_of_scilly: { surcharge: 0, extraDays: 2 },
      channel_islands: { blocked: true },
    },
  },
  voice: {
    tagline: 'A small UK shop with a very large cupboard',
  },
  socials: {},
};

// Read once. loadTenant already caches the row, and a config that re-reads on
// every render is a config somebody will eventually put a query inside.
let config = DEFAULTS;
let loaded = false;

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    out[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(base[key] ?? {}, value)
      : value;
  }
  return out;
}

// The row stores free_over, cutoff_hour, transit_min and transit_max, the names the checkout charges by.
// The shop reads them under its own names, so both always see the same figures.
function fromStored(store) {
  const d = store?.delivery;
  if (!d || typeof d !== 'object') return store;
  const delivery = { ...d };
  const names = { free_over: 'freeOver', cutoff_hour: 'cutoffHour', transit_min: 'transitMin', transit_max: 'transitMax' };
  for (const [stored, used] of Object.entries(names)) {
    if (d[stored] !== undefined && d[stored] !== null) delivery[used] = Number(d[stored]);
    delete delivery[stored];
  }
  return { ...store, delivery };
}

export async function loadStoreConfig() {
  if (loaded) return config;
  try {
    const tenant = await loadTenant();
    config = deepMerge(DEFAULTS, fromStored(tenant?.store));
    // These two end up in structured data and in mailto links, so an empty
    // column would produce a shop that emails nobody.
    if (!config.email) config.email = DEFAULTS.email;
    if (!config.domain) config.domain = DEFAULTS.domain;
  } catch {
    // A shop that refuses to render because its config row is missing is worse
    // than one running on the defaults it was built with.
    config = DEFAULTS;
  }
  loaded = true;
  return config;
}

/*
 * Synchronous, because these are read inside render and the tenant has already
 * resolved by the time anything renders. Before that they return the defaults,
 * which is the right answer for one frame rather than a reason to put a
 * loading state on a delivery threshold.
 */
export const storeConfig = () => config;
export const supportEmail = () => config.email;
export const siteUrl = () => `https://${config.domain}`;
export const freeOver = () => config.delivery.freeOver;
export const postage = () => config.delivery.postage;
export const trader = () => config.trader ?? {};
export const returnsTerms = () => config.returns ?? {};
export const privacyTerms = () => config.privacy ?? {};

/*
 * Whether a basket clears the threshold, and what it costs if not.
 *
 * One function rather than the same three lines of arithmetic in the basket,
 * the checkout, the mini basket, the product terms and the delivery estimate.
 * They agreed by luck.
 */
export function deliveryFor(subtotal, zone = 'mainland') {
  const { freeOver: threshold, postage: rate, zones = {} } = config.delivery;
  const amount = Number(subtotal) || 0;
  const round = (n) => Math.round(n * 100) / 100;

  const rules = zones[zone] ?? {};
  if (rules.blocked) {
    return { blocked: true, free: false, cost: 0, surcharge: 0, threshold, toFree: 0, total: amount, zone };
  }

  const free = amount >= threshold;
  const surcharge = Number(rules.surcharge) || 0;

  /*
   * The threshold makes the base postage free. It does not make a zone
   * surcharge free, because the surcharge is what the carrier charges us to
   * reach that postcode and it does not go away above forty pounds.
   */
  const cost = round((free ? 0 : rate) + surcharge);

  return {
    blocked: false,
    free,
    cost,
    surcharge,
    threshold,
    toFree: free ? 0 : round(threshold - amount),
    total: round(amount + cost),
    extraDays: Number(rules.extraDays) || 0,
    zone,
  };
}
