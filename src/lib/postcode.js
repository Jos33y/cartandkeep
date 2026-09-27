/*
 * UK postcodes: format, existence, and which delivery zone they fall in.
 *
 * The zone is the part that matters commercially. A shop charging one flat
 * rate to the whole UK loses money on every parcel to Shetland, because most
 * carriers surcharge those postcodes heavily and Royal Mail is the exception
 * rather than the rule.
 *
 * Validation uses postcodes.io, which is free, open data, needs no key and has
 * no rate limit. It confirms a postcode exists and returns its region. It does
 * not return addresses: that mapping is Royal Mail's Postcode Address File and
 * it is licensed, so autofill needs a paid service and this deliberately does
 * not pretend to offer one.
 *
 * Everything here fails open. If the service is down, the postcode is accepted
 * on format alone, because an address lookup outage must never stop a sale.
 */

const API = 'https://api.postcodes.io/postcodes';

// The official pattern, near enough. Deliberately permissive: postcodes.io is
// the real check and this only stops obvious nonsense before a network call.
const FORMAT = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export const normalisePostcode = (value) => {
  const bare = String(value ?? '').toUpperCase().replace(/\s+/g, '');
  if (bare.length < 5) return bare;
  return `${bare.slice(0, -3)} ${bare.slice(-3)}`;
};

export const looksLikePostcode = (value) => FORMAT.test(String(value ?? '').trim());

const outcode = (postcode) => normalisePostcode(postcode).split(' ')[0] ?? '';
const area = (postcode) => outcode(postcode).replace(/\d.*$/, '');
const district = (postcode) => {
  const match = outcode(postcode).match(/^[A-Z]+(\d+)/);
  return match ? Number(match[1]) : null;
};

/*
 * Zones, by postcode area and district.
 *
 * The Highlands list is the one carriers actually use. It is long because it
 * is a list of exceptions rather than a rule, and getting it approximately
 * right is worse than useless: charging a surcharge to somebody in Aberdeen
 * city, which is AB10 to AB16 and mainland, is how a shop loses a customer.
 */
const HIGHLAND_AREAS = new Set(['HS', 'IV', 'KW', 'ZE']);

const HIGHLAND_RANGES = {
  AB: [[31, 38], [40, 56]],
  FK: [[17, 21]],
  KA: [[27, 28]],
  PA: [[20, 49], [60, 78]],
  PH: [[4, 44], [49, 50]],
};

const inRange = (n, ranges) => n !== null && ranges.some(([lo, hi]) => n >= lo && n <= hi);

export function postcodeZone(postcode) {
  const a = area(postcode);
  const d = district(postcode);

  // Outside the UK customs and VAT territory. An order here is an export with
  // a customs declaration, which is a different business rather than a
  // different postage rate.
  if (a === 'GY' || a === 'JE') return 'channel_islands';

  if (a === 'IM') return 'isle_of_man';
  if (a === 'BT') return 'northern_ireland';

  // Isles of Scilly. TR1 to TR20 is mainland Cornwall.
  if (a === 'TR' && d !== null && d >= 21 && d <= 25) return 'isles_of_scilly';

  if (HIGHLAND_AREAS.has(a)) return 'highlands';
  if (HIGHLAND_RANGES[a] && inRange(d, HIGHLAND_RANGES[a])) return 'highlands';

  return 'mainland';
}

export const ZONE_LABELS = {
  mainland: 'UK mainland',
  highlands: 'Scottish Highlands and Islands',
  northern_ireland: 'Northern Ireland',
  isle_of_man: 'Isle of Man',
  isles_of_scilly: 'Isles of Scilly',
  channel_islands: 'Channel Islands',
};

/*
 * Confirms the postcode exists and returns what we know about it.
 *
 * `ok: true` with `verified: false` means the service did not answer and we
 * are letting it through on format. That is the failure mode we want: a
 * shopper is never blocked by somebody else's downtime.
 */
export async function checkPostcode(postcode, { signal } = {}) {
  const normalised = normalisePostcode(postcode);
  const zone = postcodeZone(normalised);

  if (!looksLikePostcode(normalised)) {
    return { ok: false, verified: true, postcode: normalised, zone, reason: 'format' };
  }

  try {
    const res = await fetch(`${API}/${encodeURIComponent(normalised.replace(/\s/g, ''))}`, { signal });

    // A real answer that the postcode does not exist. Worth catching at the
    // form, because it is the commonest cause of a parcel going nowhere.
    if (res.status === 404) {
      return { ok: false, verified: true, postcode: normalised, zone, reason: 'unknown' };
    }
    if (!res.ok) throw new Error(String(res.status));

    const body = await res.json();
    return {
      ok: true,
      verified: true,
      postcode: body?.result?.postcode ?? normalised,
      zone,
      country: body?.result?.country ?? null,
      region: body?.result?.region ?? null,
      // A suggestion for the town box, never filled in for them: London postcodes name a borough, so London is offered instead.
      town: body?.result?.region === 'London' ? 'London' : (body?.result?.admin_district ?? null),
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // Fail open, on purpose.
    return { ok: true, verified: false, postcode: normalised, zone, reason: 'unreachable' };
  }
}
