// Sending on an order creates its thread, so there is no open call for one.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(payload) {
  const res = await fetch(`${BASE}/thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // The function's own sentence: it knows which of five things went wrong.
    const error = new Error(data?.error ?? 'Something went wrong. Try again.');
    error.status = res.status;
    throw error;
  }
  return data;
}

export const askAboutProduct = ({ productId, body, email, name, website }) =>
  call({ action: 'open', productId, body, email, name, website });

// Ids and quantities only. Prices are read from the catalogue, never sent.
export const askAboutBasket = ({ lines, body, email, name, website }) =>
  call({
    action: 'open',
    basket: lines.map((l) => ({ productId: l.id, variantId: l.variantId, qty: l.qty })),
    body,
    email,
    name,
    website,
  });

export const readThread = (lookup) => call({ action: 'read', ...lookup });

// The token is the conversation's. An offer has no secret of its own.
export const readOffer = (offerId, token) => call({ action: 'offer', offerId, token });

export const sendToThread = (lookup, body) => call({ action: 'send', ...lookup, body });
