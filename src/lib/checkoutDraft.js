/*
 * What the checkout remembers, and where.
 *
 * Two things, kept apart on purpose.
 *
 * The draft is this checkout in progress, in the tab's session storage, so a
 * declined card or a trip back to the basket finds it as it was left. It goes
 * when the tab closes.
 *
 * Saved is the buyer's own details, on this device, written only when an order
 * is sent to Stripe. Their name, email and phone are theirs to reuse. Their
 * address is kept only from orders they sent to themselves, and is offered as a
 * choice rather than filled in, so a gift can never slip out to the buyer's own
 * door because nobody noticed the form was already full.
 */

const DRAFT_KEY = 'ck.checkout.draft.v2';
const SAVED_KEY = 'ck.checkout.saved.v2';
const LEGACY_KEY = 'ck.checkout.v1';

export const EMPTY_FORM = {
  forWhom: 'me',
  name: '', email: '', phone: '',
  rName: '', rPhone: '', message: '', notify: false, rEmail: '',
  addressChoice: null,
  line1: '', line2: '', city: '', postcode: '', note: '',
};

const str = (v) => (typeof v === 'string' ? v : '');

function read(store, key) {
  try {
    const raw = window[store].getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(store, key, value) {
  try { window[store].setItem(key, JSON.stringify(value)); } catch { /* private mode: the form still works */ }
}

// The buyer's own details from earlier orders, including the shape the old checkout kept.
export function readSaved() {
  if (typeof window === 'undefined') return null;
  let saved = read('localStorage', SAVED_KEY);
  if (!saved) {
    const legacy = read('localStorage', LEGACY_KEY);
    if (legacy && typeof legacy === 'object') {
      saved = {
        name: str(legacy.name), email: str(legacy.email), phone: str(legacy.phone),
        address: legacy.line1 ? { line1: str(legacy.line1), line2: str(legacy.line2), city: str(legacy.city), postcode: str(legacy.postcode) } : null,
      };
      write('localStorage', SAVED_KEY, saved);
      try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* nothing to tidy */ }
    }
  }
  if (!saved || typeof saved !== 'object') return null;
  const a = saved.address;
  return {
    name: str(saved.name), email: str(saved.email), phone: str(saved.phone),
    address: a && str(a.line1) && str(a.postcode)
      ? { line1: str(a.line1), line2: str(a.line2), city: str(a.city), postcode: str(a.postcode) }
      : null,
  };
}

// Where a checkout starts: the draft if this tab has one, else the buyer's name and email and no address.
export function initialForm() {
  if (typeof window === 'undefined') return EMPTY_FORM;
  const draft = read('sessionStorage', DRAFT_KEY);
  if (draft && typeof draft === 'object') {
    return Object.fromEntries(Object.entries(EMPTY_FORM).map(([k, v]) => [k, typeof v === 'boolean' ? draft[k] === true : k === 'addressChoice' ? (['saved', 'new'].includes(draft[k]) ? draft[k] : null) : k === 'forWhom' ? (draft[k] === 'gift' ? 'gift' : 'me') : str(draft[k])]));
  }
  const saved = readSaved();
  return {
    ...EMPTY_FORM,
    name: saved?.name ?? '', email: saved?.email ?? '', phone: saved?.phone ?? '',
    addressChoice: saved?.address ? null : 'new',
  };
}

export const saveDraft = (form) => write('sessionStorage', DRAFT_KEY, form);

// Written once the order is on its way to Stripe. A gift keeps the buyer's own address as it was.
export function rememberBuyer(form, address) {
  const before = readSaved();
  write('localStorage', SAVED_KEY, {
    name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
    address: form.forWhom === 'me' ? address : (before?.address ?? null),
  });
}
