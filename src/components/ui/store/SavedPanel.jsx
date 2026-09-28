import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useBasket } from '@context/BasketContext';
import { isBuyable } from '@components/ui/store/StockSignal';
import { ArrowRightIcon, CheckIcon, GiftIcon, HeartIcon, LinkIcon, PlusIcon } from '@components/ui/store/icons';
import { freeOver } from '@lib/storeConfig';
import { readSaved } from '@lib/checkoutDraft';
import { NAME_MAX, cleanName, listPath } from '@lib/savedList';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/saved-panel.module.css';

const sizedOf = (p) => (p.variantCount ?? 0) > 0;

/*
 * What a list comes to, and the one action it most wants.
 *
 * "Add all" only adds what can go straight in: one price, in stock, not
 * already in the basket. Anything it leaves is named, so nobody wonders why
 * the count came out short.
 */
function useAddAll(items) {
  const { add, lines, subtotal } = useBasket();
  const inBasket = new Set(lines.map((l) => l.id));
  const addable = items.filter((p) => !sizedOf(p) && (p.buyable ?? true) && isBuyable(p) && !inBasket.has(p.id));
  const sized = items.filter((p) => sizedOf(p) && !inBasket.has(p.id)).length;
  const out = items.filter((p) => !((p.buyable ?? true) && isBuyable(p))).length;
  const addSum = addable.reduce((n, p) => n + Number(p.price), 0);
  const threshold = freeOver();
  const makesFree = threshold > 0 && addable.length > 0 && subtotal < threshold && subtotal + addSum >= threshold;
  const addAll = () => { addable.forEach((p) => add(p, 1)); return addable.length; };
  return { addable, sized, out, addAll, makesFree, basketEmpty: subtotal <= 0 };
}

function Together({ items }) {
  const total = items.reduce((n, p) => n + (sizedOf(p) ? Number(p.priceFrom) : Number(p.price)), 0);
  const anyRange = items.some((p) => sizedOf(p) && p.priceFrom !== p.priceTo);
  return (
    <div className={styles.together}>
      <p className={styles.count}>{items.length} {items.length === 1 ? 'thing' : 'things'}, together</p>
      <p className={styles.total}>
        {anyRange && <span className={styles.from}>from</span>}
        <span data-price>{formatGbp(total)}</span>
      </p>
    </div>
  );
}

function Leftovers({ sized, out }) {
  const bits = [];
  if (sized) bits.push(`${sized === 1 ? 'one needs' : `${sized} need`} a size choosing`);
  if (out) bits.push(`${out === 1 ? 'one is' : `${out} are`} out of stock`);
  if (!bits.length) return null;
  return <p className={styles.small}>Not included: {bits.join(', and ')}.</p>;
}

// The link, made on demand, shared through the phone's own sheet where there is one and copied where there is not.
function ShareList({ ids }) {
  const nameId = useId();
  const [name, setName] = useState(() => cleanName(String(readSaved()?.name ?? '').split(/\s+/)[0]));
  const [state, setState] = useState('idle');
  const [shown, setShown] = useState(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches;

  const url = useMemo(() => `${window.location.origin}${listPath(ids, name)}`, [ids, name]);

  async function go() {
    const who = cleanName(name);
    const title = who ? `${who}'s list at Cart & Keep` : 'A list from Cart & Keep';
    if (canShare) {
      try { await navigator.share({ title, url }); setState('shared'); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 2400);
    } catch {
      // Clipboard refused: the link is put on screen to copy by hand.
      setShown(url);
      setState('manual');
    }
  }

  return (
    <section className={styles.share} id="send-list" aria-labelledby={`${nameId}-h`}>
      <h2 id={`${nameId}-h`} className={styles.shareTitle}><LinkIcon size={16} /> Send this list</h2>
      <p className={styles.small}>
        A link to these {ids.length} {ids.length === 1 ? 'thing' : 'things'}. Open it on another device, or send it to someone as a wish list.
      </p>
      <label className={styles.label} htmlFor={nameId}>Your first name, optional</label>
      <input
        id={nameId}
        className={styles.input}
        value={name}
        maxLength={NAME_MAX}
        autoComplete="given-name"
        onChange={(e) => { setName(e.target.value); setShown(null); }}
        onBlur={() => setName((n) => cleanName(n))}
        aria-describedby={`${nameId}-hint`}
      />
      <p id={`${nameId}-hint`} className={styles.hint}>So they know whose list it is. Nothing else about you goes in the link.</p>
      <button type="button" className={styles.secondary} onClick={go} data-done={state === 'copied' || state === 'shared' || undefined}>
        {state === 'copied' ? <><CheckIcon size={16} /> Link copied</> : state === 'shared' ? <><CheckIcon size={16} /> Sent</> : <><LinkIcon size={16} /> {canShare ? 'Share the link' : 'Copy the link'}</>}
      </button>
      {shown && (
        <input className={styles.manual} readOnly value={shown} aria-label="The link to your list" onFocus={(e) => e.target.select()} />
      )}
    </section>
  );
}

// Your own Saved: the total, Add all, and the link.
export function SavedPanel({ items, ids }) {
  const { addable, sized, out, addAll, makesFree, basketEmpty } = useAddAll(items);
  const [done, setDone] = useState(0);

  return (
    <aside className={styles.panel} aria-label="Your saved list">
      <Together items={items} />
      {addable.length > 0 ? (
        <>
          <button type="button" className={styles.primary} onClick={() => setDone(addAll())}>
            <PlusIcon size={17} /> {addable.length === 1 ? 'Add the 1 not yet in your basket' : `Add all ${addable.length} to basket`}
          </button>
          {makesFree && <p className={styles.good}>{basketEmpty ? 'Together, that comes with free delivery.' : 'With your basket, that makes delivery free.'}</p>}
          <Leftovers sized={sized} out={out} />
        </>
      ) : done > 0 ? (
        <p className={styles.good} role="status">
          <CheckIcon size={16} /> Added {done} to your basket. <Link to={STORE_ROUTES.CART}>See the basket</Link>
        </p>
      ) : (
        <p className={styles.small}>Everything here that can go straight in is already in your basket.</p>
      )}
      {ids.length > 0 && <ShareList ids={ids} />}
    </aside>
  );
}

// A list someone sent: buy it for them, or keep it on your own Saved.
export function SharedPanel({ items, name, onKeep, kept }) {
  const navigate = useNavigate();
  const { lines } = useBasket();
  const { addable, sized, out, addAll, makesFree, basketEmpty } = useAddAll(items);
  const who = name || null;
  // One checkout sends one parcel to one address, so other things already in the basket would go with the gift.
  const listIds = new Set(items.map((p) => p.id));
  const others = lines.filter((l) => !listIds.has(l.id)).reduce((n, l) => n + l.qty, 0);

  function buyForThem() {
    addAll();
    if (others > 0) { navigate(STORE_ROUTES.CART); return; }
    const params = new URLSearchParams({ for: 'gift' });
    if (who) params.set('to', who);
    navigate(`${STORE_ROUTES.CHECKOUT}?${params.toString()}`);
  }

  return (
    <aside className={styles.panel} aria-label={who ? `${who}'s list` : 'This list'}>
      <Together items={items} />
      {addable.length > 0 && (
        <>
          <button type="button" className={styles.primary} onClick={buyForThem}>
            <GiftIcon size={17} /> {who ? `Buy ${addable.length === 1 ? 'it' : 'these'} for ${who}` : `Buy ${addable.length === 1 ? 'it' : 'these'} as a gift`} <ArrowRightIcon size={16} />
          </button>
          {others > 0 ? (
            <p className={styles.warn}>
              Your basket already has {others === 1 ? 'one other thing' : `${others} other things`} in it. Everything in a basket goes in one parcel, so take {others === 1 ? 'it' : 'them'} out first if this is a gift.
            </p>
          ) : (
            <p className={styles.small}>
              Goes to checkout as a gift, so no prices go in the box{who ? ` and ${who}'s address goes on the label` : ''}.
            </p>
          )}
          <button type="button" className={styles.secondary} onClick={() => addAll()}>
            <PlusIcon size={16} /> Add {addable.length === 1 ? 'it' : 'them'} to my basket instead
          </button>
          {makesFree && <p className={styles.good}>{basketEmpty ? 'Together, that comes with free delivery.' : 'With your basket, that makes delivery free.'}</p>}
          <Leftovers sized={sized} out={out} />
        </>
      )}
      <div className={styles.keep}>
        {kept ? (
          <p className={styles.good} role="status"><CheckIcon size={16} /> On your Saved. <Link to={STORE_ROUTES.SAVED}>Open Saved</Link></p>
        ) : (
          <button type="button" className={styles.ghost} onClick={onKeep}>
            <HeartIcon size={16} /> Keep this list on my Saved
          </button>
        )}
      </div>
    </aside>
  );
}
