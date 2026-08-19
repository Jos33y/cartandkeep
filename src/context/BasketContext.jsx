import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { trackAdd, trackRemove } from '@lib/analytics';

/*
 * The basket.
 *
 * It lives here rather than in the checkout, because the header shows a count
 * on every route and a product card adds to it from inside a grid. Those two
 * are the whole reason this exists before the checkout does.
 *
 * Persisted to localStorage. A basket that empties on refresh is the fastest
 * way to lose an order, and a shopper on a phone switches apps constantly.
 *
 * No server. Until checkout there is nothing worth a round trip, and a basket
 * that needs the network to show a count is a basket that shows nothing on a
 * bad connection.
 */

const KEY = 'ck.basket.v1';
const BasketContext = createContext(null);

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Anything could be in storage: an older shape, a hand edit, a half
    // written value from a killed tab. Only rows that still make sense survive.
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.id === 'string' && Number.isFinite(l.qty) && l.qty > 0)
      : [];
  } catch {
    return [];
  }
}

export function BasketProvider({ children }) {
  const [lines, setLines] = useState(read);

  /*
   * The last thing added, and when.
   *
   * The mini basket needs to open on an add and needs to stay closed on a
   * quantity change, so a boolean will not do: adding the same product twice
   * has to fire twice. The timestamp is what makes the second one a new event.
   */
  const [lastAdded, setLastAdded] = useState(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // Private mode, or a full quota. The basket still works for this visit
      // and failing to persist must never break adding to it.
    }
  }, [lines]);

  // Another tab is the same shopper. A count that disagrees between two tabs
  // is the kind of thing that stops someone trusting the number.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === KEY) setLines(read());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((product, qty = 1) => {
    // Here rather than at every call site. There are five buttons that add to
    // a basket and one of them would eventually be missed.
    trackAdd(product, qty);
    setLastAdded({ id: product.id, title: product.title, qty, at: Date.now() });
    setLines((current) => {
      const found = current.find((l) => l.id === product.id);
      if (found) {
        return current.map((l) => (l.id === product.id ? { ...l, qty: l.qty + qty } : l));
      }
      // A snapshot, not a reference. If she changes a price or takes a product
      // down, the basket keeps what was shown when it went in, and checkout
      // reconciles against the live row rather than the header guessing.
      return [...current, {
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: Number(product.price),
        image_url: product.image_url ?? null,
        qty,
      }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((l) => l.id !== id)
        : current.map((l) => (l.id === id ? { ...l, qty } : l)));
  }, []);

  const remove = useCallback((id) => setLines((current) => {
    const line = current.find((l) => l.id === id);
    if (line) trackRemove(line);
    return current.filter((l) => l.id !== id);
  }), []);
  const clear = useCallback(() => setLines([]), []);

  const dismissAdded = useCallback(() => setLastAdded(null), []);

  const value = useMemo(() => ({
    lines,
    add,
    setQty,
    remove,
    clear,
    lastAdded,
    dismissAdded,
    // Units, not lines. Two of one thing reads as two in the header, which is
    // what a shopper counts.
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: lines.reduce((n, l) => n + l.price * l.qty, 0),
  }), [lines, add, setQty, remove, clear, lastAdded, dismissAdded]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used inside BasketProvider');
  return ctx;
}
