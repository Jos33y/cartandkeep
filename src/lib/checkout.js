/*
 * Talking to the edge functions.
 *
 * The anon key is sent as the bearer, which is what Supabase functions expect
 * and is safe: the functions hold the service role themselves and the anon key
 * grants nothing beyond calling them.
 */
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(fn, body) {
  const res = await fetch(`${BASE}/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
    },
    body: JSON.stringify(body),
  });

  let data = null;
  try { data = await res.json(); } catch { /* a 500 with an empty body */ }

  if (!res.ok) {
    // The function's own message when it gave one. It knows which product went
    // out of stock and a generic failure does not.
    const error = new Error(data?.error ?? 'Something went wrong. Nothing has been charged.');
    error.status = res.status;
    error.unavailable = data?.unavailable ?? [];
    throw error;
  }
  return data;
}

export const startCheckout = (payload) => call('checkout', payload);

// The function refuses this the moment a Stripe key exists.
export const simulatePayment = ({ reference, token, outcome }) =>
  call('checkout', { action: 'simulate', reference, token, outcome });

/*
 * Two ways in. The confirmation link carries a token, and somebody who has
 * lost it can use the email they ordered with instead. The function decides
 * which is acceptable; this only passes on whichever it was given.
 */
export const fetchOrder = (reference, token, email = null) =>
  call('order', { reference, token, email });
