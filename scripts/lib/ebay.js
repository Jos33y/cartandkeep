/*
 * Every call to eBay, in one place.
 *
 * Paced rather than parallel: the Browse tier allows a few a second and a burst
 * returns 429 for the rest of the run.
 */

import { pathToFileURL } from 'node:url';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';

// ---------------------------------------------------------------------- http

let lastCall = 0;
const paced = async (fn, gap = 120) => {
  const wait = Math.max(0, gap - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fn();
};

export async function token({ clientId, clientSecret }) {
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });
  if (!res.ok) throw new Error(`ebay auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const authHeaders = (access, marketplace) => ({
  Authorization: `Bearer ${access}`,
  'X-EBAY-C-MARKETPLACE-ID': marketplace,
});

export async function search({ access, marketplace, q, limit, categoryIds, filter }) {
  const url = new URL(`${BROWSE}/item_summary/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  if (categoryIds) url.searchParams.set('category_ids', categoryIds);
  // Used goods price higher than new on appliances, so an unfiltered median
  // reads as room to buy that nobody selling new stock has.
  if (filter) url.searchParams.set('filter', filter);

  const res = await paced(() => fetch(url, { headers: authHeaders(access, marketplace) }));
  if (!res.ok) throw new Error(`browse search ${res.status} for "${q}"`);
  return res.json();
}

export async function getItem({ access, marketplace, itemId }) {
  const url = new URL(`${BROWSE}/item/${encodeURIComponent(itemId)}`);
  const res = await paced(() => fetch(url, { headers: authHeaders(access, marketplace) }));
  if (!res.ok) return { error: `${res.status}` };
  return res.json();
}
