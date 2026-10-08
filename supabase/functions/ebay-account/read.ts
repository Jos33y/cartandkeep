// What ebay-account reads from eBay, and how it is summed (ebay-account/index.ts serves it). Kept apart so the tests
// can load it without starting the function.
//
//   account    the Identity API: INDIVIDUAL (a private seller) or BUSINESS, and the user name. Nothing else is kept.
//   campaigns  the Marketing API: her campaigns, and each promoted listing with its ad rate.
//   fees       the Finances API: what eBay charged her over the last 90 days, by the kind of charge.

import { EBAY } from '../_shared/ebay/listing.ts';
import { APIZ, get, readFees } from '../_shared/ebay/finances.ts';

export { sumFees } from '../_shared/ebay/finances.ts';

type Json = Record<string, any>;
export type Fetch = typeof fetch;


// ------------------------------------------------------------------ account

export async function readAccount(f: Fetch, access: string) {
  const u = await get(f, `${APIZ}/commerce/identity/v1/user/`, access);
  const type = String(u.accountType ?? '').toUpperCase();
  return {
    ebay_type: type === 'INDIVIDUAL' || type === 'BUSINESS' ? type : null,
    username: typeof u.username === 'string' ? u.username : null,
  };
}

// ---------------------------------------------------------------- campaigns

export type Campaign = {
  id: string; name: string; status: string; model: string; rate: number | null; dynamic: boolean; auto: boolean; ads: number;
};
export type Ad = { listing_id: string; campaign_id: string; campaign_name: string; rate: number; status: string | null };

// eBay gives the rate as a percentage string ("8.0"); kept as a fraction, as the cards' rates are.
export const rateOf = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 1000 : null;
};

export function campaignOf(c: Json): Campaign {
  const fund = c.fundingStrategy ?? {};
  return {
    id: String(c.campaignId),
    name: String(c.campaignName ?? 'Campaign'),
    status: String(c.campaignStatus ?? 'UNKNOWN'),
    // COST_PER_SALE is the ad rate on a sale; COST_PER_CLICK is paid per click and has no rate.
    model: String(fund.fundingModel ?? 'COST_PER_SALE'),
    rate: rateOf(fund.bidPercentage),
    dynamic: fund.adRateStrategy === 'DYNAMIC',
    // A rule-based campaign takes new listings that match on its own.
    auto: c.campaignCriterion?.autoSelectFutureInventory === true,
    ads: 0,
  };
}

// Charged on a sale today: a running campaign paid by the sale.
export const live = (c: Campaign) => c.status === 'RUNNING' && c.model === 'COST_PER_SALE';

export async function readCampaigns(f: Fetch, access: string): Promise<Campaign[]> {
  const out: Campaign[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const body = await get(f, `${EBAY}/sell/marketing/v1/ad_campaign?limit=100&offset=${offset}`, access);
    const page = (body.campaigns ?? []) as Json[];
    out.push(...page.map(campaignOf));
    if (!body.next || page.length < 100) break;
  }
  return out.filter((c) => c.status !== 'ENDED' && c.status !== 'DELETED');
}

// A listing's own rate, else the campaign's. Only an ad that is on today costs anything.
export function adsOf(c: Campaign, ads: Json[]): Ad[] {
  return ads
    .filter((a) => a.listingId && (a.adStatus == null || a.adStatus === 'ACTIVE'))
    .map((a) => ({
      listing_id: String(a.listingId),
      campaign_id: c.id,
      campaign_name: c.name,
      rate: rateOf(a.bidPercentage) ?? c.rate ?? 0,
      status: a.adStatus ?? null,
    }))
    .filter((a) => a.rate > 0);
}

export async function readAds(f: Fetch, access: string, c: Campaign): Promise<Ad[]> {
  const out: Ad[] = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const body = await get(f, `${EBAY}/sell/marketing/v1/ad_campaign/${encodeURIComponent(c.id)}/ad?limit=500&offset=${offset}`, access);
    const page = (body.ads ?? []) as Json[];
    out.push(...adsOf(c, page));
    if (!body.next || page.length < 500) break;
  }
  return out;
}

// The rate a listing not promoted yet is costed at: the middle of her promoted listings' rates, else of her running
// campaigns', else none.
export function typicalAd(ads: Ad[], campaigns: Campaign[]): number | null {
  const mid = (xs: number[]) => {
    const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
    if (!s.length) return null;
    const i = Math.floor(s.length / 2);
    return s.length % 2 ? s[i] : Math.round(((s[i - 1] + s[i]) / 2) * 1000) / 1000;
  };
  return mid(ads.map((a) => a.rate)) ?? mid(campaigns.filter(live).map((c) => c.rate ?? 0));
}

// ------------------------------------------------------------------ the read

export type Read = { read: Json; ads: Ad[] | null; errors: string[] };

const why = (part: string, e: unknown) => `${part}: ${e instanceof Error ? e.message : String(e)}`;

// Every part on its own: one eBay refusal keeps the other two, and says which failed.
export async function readAll(f: Fetch, access: string): Promise<Read> {
  const read: Json = {};
  const errors: string[] = [];
  let ads: Ad[] | null = null;

  const [account, campaigns, fees] = await Promise.allSettled([
    readAccount(f, access),
    (async () => {
      const list = await readCampaigns(f, access);
      const found: Ad[] = [];
      for (const c of list.filter(live)) {
        const got = await readAds(f, access, c);
        c.ads = got.length;
        found.push(...got);
      }
      return { list, found };
    })(),
    readFees(f, access),
  ]);

  if (account.status === 'fulfilled') Object.assign(read, account.value);
  else errors.push(why('Account type', account.reason));

  if (campaigns.status === 'fulfilled') {
    read.campaigns = campaigns.value.list;
    read.typical_ad = typicalAd(campaigns.value.found, campaigns.value.list);
    ads = campaigns.value.found;
  } else errors.push(why('Campaigns', campaigns.reason));

  if (fees.status === 'fulfilled') read.fees = fees.value;
  else errors.push(why('Fees', fees.reason));

  if (errors.length) read.error = errors.join(' | ');
  return { read, ads, errors };
}
