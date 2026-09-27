import { useState } from 'react';
import { BasketTotals } from '@components/ui/store/BasketTotals';
import { ChevronDownIcon } from '@components/ui/store/icons';
import { imageAt } from '@utils/categories';
import { formatDeliveryDay } from '@utils/delivery';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/parcel-label.module.css';

const FOLD_AFTER = 4;

// The outward half of a postcode, printed large the way a sorting office reads a real label.
const outward = (postcode) => {
  const bare = String(postcode ?? '').toUpperCase().replace(/\s+/g, '');
  return bare.length > 3 ? bare.slice(0, -3) : bare;
};

const short = (iso) => formatDeliveryDay(iso, { withDate: false }).slice(0, 3);
const dayOf = (iso) => `${short(iso)} ${Number(iso.slice(8, 10))}`;
// "Tue 29 or Wed 30", whichever months they fall in.
const window2 = ({ from, to }) => (from === to ? dayOf(from) : `${dayOf(from)} or ${dayOf(to)}`);

/*
 * The order as the parcel it is about to become.
 *
 * The address is written onto a label as it is typed, so the thing being
 * checked is the thing that will be stuck on the box: "To: your own name" on
 * a present is obvious here in a way it never is in a form. Everything below
 * the perforation is the receipt side of the label: what is packed, what it
 * comes to, and the three days of its trip.
 *
 * On phones it folds to one line at the top of the page, carrying who it is
 * for and the total, and opens on a tap. On wider screens it never grows
 * past the window: the label scrolls within itself and Pay stays pinned below.
 */
export function ParcelLabel({
  gift, deliverTo, from, address, lines, was = {}, gone = [], figures, arrival, agreed, count, dock, children,
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);

  const shown = all ? lines : lines.slice(0, FOLD_AFTER);
  const hidden = lines.length - shown.length;
  const code = outward(address.postcode);
  const offSale = new Set(gone.map((g) => g.key));
  const keyOf = (l) => (l.variantId ? `${l.id}:${l.variantId}` : l.id);

  return (
    <aside className={styles.board} aria-label="Your order">
      <button
        type="button"
        className={styles.fold}
        aria-expanded={open}
        aria-controls="parcel-label"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.foldText}>
          <span className={styles.foldWho}>{deliverTo ? `To ${deliverTo}` : 'Your order'}{code ? `, ${code}` : ''}</span>
          <span className={styles.foldCount}>{count} {count === 1 ? 'item' : 'items'}{gift ? ', a gift' : ''}</span>
        </span>
        <span className={styles.foldTotal}>
          <strong data-price>{formatGbp(figures.total)}</strong>
          <ChevronDownIcon size={16} />
        </span>
      </button>

      <div className={styles.label} id="parcel-label" data-open={open || undefined}>
        <header className={styles.top}>
          <span className={styles.brand}>Cart &amp; Keep</span>
          <span className={styles.code} data-empty={!code || undefined} aria-hidden="true">{code || '···'}</span>
        </header>

        <div className={styles.to}>
          <span className={styles.micro}>Deliver to</span>
          <p className={styles.name} data-empty={!deliverTo || undefined}>{deliverTo || (gift ? 'Their name' : 'Your name')}</p>
          <p data-empty={!address.line1 || undefined}>{address.line1 || 'Street and number'}</p>
          {address.line2 && <p>{address.line2}</p>}
          <p data-empty={!address.city || undefined}>{address.city || 'Town'}</p>
          <p className={styles.postcode} data-empty={!address.postcode || undefined}>{address.postcode || 'Postcode'}</p>

          {gift && (
            <>
              <p className={styles.from}>From {from || 'you'}</p>
              <span className={styles.stamp} aria-hidden="true">A gift<br /><small>No prices inside</small></span>
            </>
          )}
        </div>

        {arrival && (
          <ol className={styles.route} aria-label="Its trip">
            <li><span>Today</span><b>Ordered</b></li>
            <li><span>{dayOf(arrival.leaves)}</span><b>Leaves us</b></li>
            <li data-end><span>{window2(arrival)}</span><b>{gift ? 'With them' : 'With you'}</b></li>
          </ol>
        )}

        <div className={styles.perforation} aria-hidden="true" />

        <div className={styles.box}>
          <p className={styles.boxHead}>
            <span className={styles.micro}>In the box</span>
            <span className={styles.micro}>{count} {count === 1 ? 'item' : 'items'}</span>
          </p>

          {agreed && <p className={styles.agreed}>The price you were given in your conversation with the shop.</p>}

          <ul className={styles.lines}>
            {shown.map((l) => {
              const key = keyOf(l);
              const before = was[key];
              const off = offSale.has(key);
              return (
                <li key={key} data-gone={off || undefined}>
                  <span className={styles.thumb}>
                    {l.image_url ? <img src={imageAt(l.image_url, 300)} alt="" loading="lazy" /> : null}
                    {l.qty > 1 && <span className={styles.qty} data-price>{l.qty}</span>}
                  </span>
                  <span className={styles.lineText}>
                    <span className={styles.lineTitle}>{l.title}</span>
                    {l.variantLabel && <span className={styles.lineVariant}>{l.variantLabel}</span>}
                  </span>
                  <span className={styles.lineMoney}>
                    {off
                      ? <span className={styles.offSale}>Off sale</span>
                      : <span data-price>{formatGbp(l.price * l.qty)}</span>}
                    {!off && before !== undefined && <s data-price>{formatGbp(before * l.qty)}</s>}
                  </span>
                </li>
              );
            })}
          </ul>

          {lines.length > FOLD_AFTER && (
            <button type="button" className={styles.more} onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Show fewer' : `and ${hidden} more`}
            </button>
          )}
        </div>

        <div className={styles.sums}>
          <BasketTotals {...figures} agreed={agreed} />
        </div>

        {children && <div className={styles.after}>{children}</div>}
      </div>

      {/* Pinned under the label on wide screens, so Pay is in view however long the order is. */}
      {dock && <div className={styles.dock}>{dock}</div>}
    </aside>
  );
}
