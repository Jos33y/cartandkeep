// The eBay account read (0150, ebay-account). Run with
//   deno test supabase/functions/ebay-account/read_test.ts

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
import { adsOf, campaignOf, rateOf, readAll, sumFees, typicalAd } from './read.ts';

type Json = Record<string, any>;

// eBay, answering by the start of the path.
function fakeEbay(routes: Record<string, Json | number>) {
  const seen: string[] = [];
  const f = (async (url: string | URL) => {
    const u = String(url);
    seen.push(u);
    const key = Object.keys(routes).find((k) => u.includes(k));
    const v = key ? routes[key] : 404;
    if (typeof v === 'number') return new Response(JSON.stringify({ errors: [{ message: `refused ${v}` }] }), { status: v });
    return new Response(JSON.stringify(v), { status: 200 });
  }) as typeof fetch;
  return { f, seen };
}

Deno.test('rateOf keeps a percentage as a fraction', () => {
  assertEquals(rateOf('8.0'), 0.08);
  assertEquals(rateOf(10), 0.1);
  assertEquals(rateOf('7.5'), 0.075);
  assertEquals(rateOf(null), null);
  assertEquals(rateOf('abc'), null);
  assertEquals(rateOf(120), null);
});

Deno.test('a campaign reads its rate, model and rules', () => {
  const c = campaignOf({
    campaignId: '15', campaignName: 'All stock', campaignStatus: 'RUNNING',
    fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: '9.0', adRateStrategy: 'FIXED' },
    campaignCriterion: { autoSelectFutureInventory: true },
  });
  assertEquals([c.id, c.rate, c.model, c.dynamic, c.auto], ['15', 0.09, 'COST_PER_SALE', false, true]);
});

Deno.test('ads take their own rate, else the campaign rate, and only live ones count', () => {
  const c = campaignOf({ campaignId: '1', campaignName: 'A', campaignStatus: 'RUNNING', fundingStrategy: { bidPercentage: '8.0' } });
  const ads = adsOf(c, [
    { listingId: '111', bidPercentage: '10.0', adStatus: 'ACTIVE' },
    { listingId: '222', adStatus: 'ACTIVE' },
    { listingId: '333', bidPercentage: '9.0', adStatus: 'PAUSED' },
    { listingId: '444', bidPercentage: '0' },
  ]);
  assertEquals(ads.map((a) => [a.listing_id, a.rate]), [['111', 0.1], ['222', 0.08]]);
});

Deno.test('the usual rate is the middle of her promoted listings, else her campaigns', () => {
  const ad = (rate: number) => ({ listing_id: 'x', campaign_id: '1', campaign_name: 'A', rate, status: 'ACTIVE' });
  assertEquals(typicalAd([ad(0.08), ad(0.1), ad(0.09)], []), 0.09);
  assertEquals(typicalAd([ad(0.08), ad(0.1)], []), 0.09);
  const camps = [campaignOf({ campaignId: '1', campaignStatus: 'RUNNING', fundingStrategy: { bidPercentage: '7.0' } }),
    campaignOf({ campaignId: '2', campaignStatus: 'PAUSED', fundingStrategy: { bidPercentage: '20.0' } })];
  assertEquals(typicalAd([], camps), 0.07);
  assertEquals(typicalAd([], []), null);
});

Deno.test('fees sum by kind: sale lines, ad charges, credits, labels; payouts ignored', () => {
  const t = [
    { transactionType: 'SALE', bookingEntry: 'CREDIT', amount: { value: '10.79' }, totalFeeBasisAmount: { value: '11.99' }, totalFeeAmount: { value: '1.20' },
      orderLineItems: [{ marketplaceFees: [{ feeType: 'AD_FEE', amount: { value: '1.20' } }] }] },
    { transactionType: 'SALE', bookingEntry: 'CREDIT', amount: { value: '52.76' }, totalFeeBasisAmount: { value: '57.15' }, totalFeeAmount: { value: '4.39' } },
    { transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', amount: { value: '3.00' } },
    { transactionType: 'CREDIT', bookingEntry: 'CREDIT', feeType: 'AD_FEE', amount: { value: '1.00' } },
    { transactionType: 'SHIPPING_LABEL', bookingEntry: 'DEBIT', amount: { value: '2.62' } },
    { transactionType: 'PAYOUT', bookingEntry: 'DEBIT', amount: { value: '500' } },
    { transactionType: 'REFUND', bookingEntry: 'DEBIT', amount: { value: '11.99' },
      orderLineItems: [{ marketplaceFees: [{ feeType: 'AD_FEE', amount: { value: '1.20' } }] }] },
  ];
  const s = sumFees(t, 'a', 'b', 90);
  assertEquals(s.sales, 2);
  assertEquals(s.sold, 69.14);
  assertEquals(s.charged, { AD_FEE: 2, SELLING_FEES: 4.39, SHIPPING_LABEL: 2.62 });
  assertEquals(s.total, 9.01);
});

Deno.test('readAll reads all three, promoted listings from running campaigns only', async () => {
  const { f, seen } = fakeEbay({
    '/commerce/identity/v1/user/': { accountType: 'INDIVIDUAL', username: 'cartandkeep', individualAccount: { email: 'never-kept@x' } },
    '/ad_campaign/1/ad': { ads: [{ listingId: '111', bidPercentage: '8.0', adStatus: 'ACTIVE' }, { listingId: '222', bidPercentage: '10.0', adStatus: 'ACTIVE' }] },
    '/ad_campaign?': { campaigns: [
      { campaignId: '1', campaignName: 'Everything', campaignStatus: 'RUNNING', fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: '8.0' } },
      { campaignId: '2', campaignName: 'Old', campaignStatus: 'PAUSED', fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: '12.0' } },
      { campaignId: '3', campaignName: 'Ended', campaignStatus: 'ENDED', fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: '5.0' } },
    ] },
    '/sell/finances/v1/transaction': { transactions: [{ transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', amount: { value: '4.39' } }] },
  });
  const r = await readAll(f, 'token');
  assertEquals(r.errors, []);
  assertEquals([r.read.ebay_type, r.read.username], ['INDIVIDUAL', 'cartandkeep']);
  assertEquals(JSON.stringify(r.read).includes('never-kept'), false);
  assertEquals(r.read.campaigns.map((c: Json) => [c.id, c.ads]), [['1', 2], ['2', 0]]);
  assertEquals(r.read.typical_ad, 0.09);
  assertEquals(r.ads?.map((a) => a.listing_id), ['111', '222']);
  assertEquals(r.read.fees.charged, { AD_FEE: 4.39 });
  assertEquals(seen.some((u) => u.includes('/ad_campaign/2/ad')), false);
  assertEquals(seen.some((u) => u.startsWith('https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionDate')), true);
});

Deno.test('one part refused keeps the others and says which', async () => {
  const { f } = fakeEbay({
    '/commerce/identity/v1/user/': { accountType: 'BUSINESS' },
    '/ad_campaign': 403,
    '/sell/finances/v1/transaction': { transactions: [] },
  });
  const r = await readAll(f, 'token');
  assertEquals(r.read.ebay_type, 'BUSINESS');
  assertEquals('campaigns' in r.read, false);
  assertEquals('typical_ad' in r.read, false);
  assertEquals(r.ads, null);
  assertEquals(r.errors.length, 1);
  assertEquals(r.errors[0].startsWith('Campaigns: refused 403'), true);
  assertEquals(r.read.error, r.errors[0]);
});
