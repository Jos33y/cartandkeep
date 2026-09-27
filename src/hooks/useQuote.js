import { useEffect, useRef, useState } from 'react';
import { quoteBasket } from '@lib/checkout';
import { useBasket } from '@context/BasketContext';

/*
 * What a basket really comes to, asked of the checkout function.
 *
 * The basket keeps the price from when something went in. This reads today's
 * price, delivery and anything no longer on sale from the same code that
 * charges the card, and writes the prices back onto the basket, so the figure
 * on the button is the figure on the Stripe page.
 *
 * Asked again only when what is being bought changes (lines, quantities, the
 * postcode or the agreed price), never when a price it wrote back changes.
 */
export function useQuote(lines, { postcode = null, offerId = null, token = null } = {}) {
  const { reconcile } = useBasket();
  const [state, setState] = useState({ quote: null, loading: true, error: null, changed: [] });
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const signature = [
    offerId ?? '',
    postcode ?? '',
    ...lines.map((l) => `${l.variantId ? `${l.id}:${l.variantId}` : l.id}x${l.qty}`),
  ].join('|');

  useEffect(() => {
    if (!offerId && linesRef.current.length === 0) {
      setState({ quote: null, loading: false, error: null, changed: [] });
      return undefined;
    }

    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    const timer = setTimeout(() => {
      quoteBasket({
        items: linesRef.current.map((l) => ({ id: l.id, variantId: l.variantId ?? null, qty: l.qty })),
        postcode,
        offerId,
        token,
      })
        .then((quote) => {
          if (!live) return;
          // Named by what the shopper saw, before the basket is corrected.
          const changed = offerId ? [] : quote.lines
            .filter((q) => {
              const had = linesRef.current.find((l) => (l.key ?? l.id) === q.key);
              return had && Math.round(Number(had.price) * 100) !== Math.round(Number(q.price) * 100);
            })
            .map((q) => (q.variantLabel ? `${q.title}, ${q.variantLabel}` : q.title));
          if (!offerId) reconcile(quote.lines);
          setState((s) => ({ quote, loading: false, error: null, changed: changed.length ? changed : s.changed }));
        })
        .catch((error) => {
          if (live) setState((s) => ({ ...s, loading: false, error }));
        });
    }, 250);

    return () => { live = false; clearTimeout(timer); };
    // The signature is the whole dependency on purpose; prices written back must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, token, reconcile]);

  return state;
}
