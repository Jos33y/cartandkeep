/*
 * Postage rates are dated, so the question is never "what does a small parcel
 * cost" but "what did it cost on the day this batch was built". A batch rerun
 * for an old date must price that date, not today.
 */

export async function loadBands(db, { carrier, service, on }) {
  if (!carrier || !service) throw new Error('rate card needs a carrier and a service');

  const { data, error } = await db
    .from('rate_cards')
    .select('band, price, effective_from, effective_to')
    .eq('carrier', carrier)
    .eq('service', service)
    .lte('effective_from', on)
    .or(`effective_to.is.null,effective_to.gte.${on}`);

  if (error) throw new Error(`rate card load failed: ${error.message}`);
  if (!data?.length) return null;

  const bands = {};
  for (const row of data) {
    const price = Number(row.price);
    // A rate that does not parse must stop the run, never become a zero postage.
    if (!Number.isFinite(price)) {
      throw new Error(`rate card ${carrier}/${service}/${row.band} has a non-numeric price`);
    }
    bands[row.band] = price;
  }

  return bands;
}
