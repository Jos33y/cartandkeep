import { useState } from 'react';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { legacyId, sameListing } from '@lib/product';
import styles from '@styles/ui/portal/market-listings.module.css';

const SHOWN = 4;

const soldText = (n) => (n == null ? null : Number(n) > 0 ? `${n} sold` : 'none sold');
const fbText = (n) => (n == null ? null : `${Number(n).toLocaleString('en-GB')} feedback`);
const byText = (e) => (e?.by === 'keepr'
  ? `Keepr chose it${e.sure != null ? `, ${Math.round(e.sure * 100)}% sure` : ''}`
  : e?.by === 'her' ? 'You chose it' : null);
const urlOf = (x) => x?.url ?? (x?.item_id ? `https://www.ebay.co.uk/itm/${legacyId(x.item_id)}` : null);

function Row({ x, tag, tone, meta, action, hot, onHot }) {
  const url = urlOf(x);
  return (
    <li className={styles.row} data-tone={tone} data-hot={hot || undefined}
      onMouseEnter={() => onHot(x.item_id ?? null)} onMouseLeave={() => onHot(null)}>
      <i className={styles.mark} data-sold={Number(x.sold ?? x.sold_lifetime) > 0 || undefined} aria-hidden="true" />
      <span className={styles.what}>
        {tag && <span className={styles.tag}>{tag}</span>}
        {url ? (
          <a className={styles.link} href={url} target="_blank" rel="noreferrer noopener"
            onFocus={() => onHot(x.item_id ?? null)} onBlur={() => onHot(null)}>
            <span className={styles.title}>{x.title || 'Untitled listing'}</span>
            <Icon name="IconOut" className={styles.out} />
            <span className="visually-hidden"> (opens eBay in a new tab)</span>
          </a>
        ) : <span className={styles.title}>{x.title || 'Untitled listing'}</span>}
        {meta.filter(Boolean).length > 0 && <span className={styles.meta}>{meta.filter(Boolean).join(' · ')}</span>}
      </span>
      <span className={styles.price} data-num>{x.price != null ? formatGbp(x.price) : '--'}</span>
      <span className={styles.act}>{action}</span>
    </li>
  );
}

/*
 * The listings behind the chart's dots, as a list she can read: each opens on eBay, and any one can become the
 * listing the card prices from. The one it prices from now sits first; the research's, once replaced, under it with
 * the way back.
 */
export function MarketListings({ listings = [], entry, chosen, replaced, hot, onHot, onUse, onSwitchBack, onAsk, asking = false, using = null }) {
  const [all, setAll] = useState(false);
  const rest = listings
    .filter((x) => x.item_id && !sameListing(x.item_id, entry?.item_id) && !sameListing(x.item_id, replaced?.item_id))
    .sort((p, q) => Number(p.price) - Number(q.price));
  const shown = all ? rest : rest.slice(0, SHOWN);
  const busy = Boolean(using) || asking;

  return (
    <section className={styles.wrap} aria-label="Listings on the chart">
      <header className={styles.head}>
        <span className={styles.heading}>
          <b>The listings on the chart</b>
          <span>Open one to compare. Use it when it is the product you buy.</span>
        </span>
        {onAsk && (
          <button type="button" className={styles.ask} disabled={busy} onClick={onAsk}>
            <Icon name="IconSpark" className={styles.askIcon} />{asking ? 'Keepr is matching' : 'Ask Keepr to match'}
          </button>
        )}
      </header>

      <ul className={styles.rows}>
        {entry && (
          <Row x={entry} tone="current" tag={chosen ? 'Pricing from, replaces the research\'s' : 'Pricing from'}
            hot={hot != null && sameListing(hot, entry.item_id)} onHot={onHot}
            meta={[soldText(entry.sold_lifetime), entry.age_days != null ? `in ${entry.age_days} days` : null, fbText(entry.seller_feedback), entry.proved ? 'proves the market' : 'not proved', chosen ? byText(chosen) : null]}
            action={chosen && onSwitchBack ? (
              <button type="button" className={styles.quiet} disabled={busy} onClick={onSwitchBack}>
                <Icon name="IconUndo" className={styles.btnIcon} />Switch back
              </button>
            ) : null} />
        )}
        {replaced && (
          <Row x={replaced} tone="replaced" tag="Replaced"
            hot={hot != null && sameListing(hot, replaced.item_id)} onHot={onHot}
            meta={[soldText(replaced.sold_lifetime), fbText(replaced.seller_feedback), 'the research\'s listing']}
            action={null} />
        )}
        {shown.map((x) => (
          <Row key={x.item_id} x={x} hot={hot != null && sameListing(hot, x.item_id)} onHot={onHot}
            meta={[soldText(x.sold), fbText(x.feedback)]}
            action={onUse ? (
              <button type="button" className={styles.use} disabled={busy} onClick={() => onUse(x)}>
                {using && sameListing(using, x.item_id) ? 'Reading it' : 'Use this listing'}
              </button>
            ) : null} />
        ))}
      </ul>

      {rest.length > SHOWN && (
        <button type="button" className={styles.more} onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${rest.length}`}
        </button>
      )}
    </section>
  );
}

/*
 * Keepr's match, when it is under the 95% it acts on alone: the listing, how sure, and why, for her to take or
 * turn down. At 95% or more Keepr has already moved the card, and the list above says so with the way back.
 */
export function KeeprSuggestion({ s, onUse, onDismiss, busy = false }) {
  const e = s?.entry;
  if (!e) return null;
  return (
    <div className={styles.suggest} role="status">
      <Icon name="IconSpark" className={styles.suggestIcon} />
      <span className={styles.suggestText}>
        <b>Keepr found a listing that may be the product you buy</b>
        <span>
          <a className={styles.link} href={urlOf(e)} target="_blank" rel="noreferrer noopener">
            <span className={styles.title}>{e.title}</span><Icon name="IconOut" className={styles.out} />
          </a>
        </span>
        <span className={styles.meta}>
          {[formatGbp(e.price), soldText(e.sold_lifetime), e.proved ? 'proves the market' : null, `${Math.round((e.sure ?? 0) * 100)}% sure`].filter(Boolean).join(' · ')}
          {e.why ? `. ${e.why}` : ''}
        </span>
        {s.new_product && <span className={styles.meta}>Another product from the card&apos;s: using it sets aside the title, description and photos of the old one, and Keepr writes the listing again. Switching back restores them.</span>}
      </span>
      <span className={styles.suggestActions}>
        <button type="button" className={styles.use} disabled={busy} onClick={onUse}>Use it</button>
        <button type="button" className={styles.quiet} disabled={busy} onClick={onDismiss}>Not this one</button>
      </span>
    </div>
  );
}
