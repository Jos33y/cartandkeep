import { useEffect, useState } from 'react';
import { adFor, buyerProtection, ebayAccount, onEbayAccount } from '@lib/ebayAccount';
import { chooseEbayAccount, readEbayAccount } from '@lib/ebayAccountRead';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/ebay-account.module.css';

/*
 * Which eBay account she sells on, and what eBay actually takes (Joseey, 8 October 2026). One switch prices every
 * card: private pays no selling fee, only the ad rate on a promoted sale, and the buyer pays eBay's protection fee on
 * top. Beside it, what eBay says the account is, her campaigns and their rates, and what eBay charged her in 90 days,
 * so the switch is set from the facts rather than from memory.
 */

// The sale the two accounts are shown on. A typical card of hers.
const EXAMPLE = 24.99;

const FEE_LABEL = {
  AD_FEE: 'Promoted listings',
  FINAL_VALUE_FEE: 'Selling fee',
  FINAL_VALUE_FEE_FIXED_PER_ORDER: 'Per-order fee',
  SELLING_FEES: 'Selling fees',
  INSERTION_FEE: 'Listing fees',
  INTERNATIONAL_FEE: 'International fee',
  REGULATORY_OPERATING_FEE: 'Regulatory fee',
  SHIPPING_LABEL: 'Postage labels',
  BELOW_STANDARD_FEE: 'Below standard fee',
  HIGH_ITEM_NOT_AS_DESCRIBED_FEE: 'Not as described fee',
  OTHER_FEES: 'Other',
};
export const feeLabel = (k) => FEE_LABEL[k] ?? k.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const pct = (v) => `${Math.round(Number(v) * 1000) / 10}%`;
const round = (v) => Math.round(v * 100) / 100;

function ago(iso) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const STATUS = { RUNNING: 'Running', PAUSED: 'Paused', SCHEDULED: 'Scheduled', PENDING: 'Starting' };

export function EbayAccount({ tenantId }) {
  const [acc, setAcc] = useState(ebayAccount);
  const [saving, setSaving] = useState(null);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => onEbayAccount(setAcc), []);

  async function choose(type) {
    if (!tenantId || saving || type === acc.type) return;
    setSaving(type);
    setNote(null);
    try {
      await chooseEbayAccount(tenantId, type);
      setNote({ tone: 'positive', text: `Saved. Every eBay price now follows a ${type} account.` });
    } catch (e) {
      setNote({ tone: 'negative', text: e.message });
    } finally {
      setSaving(null);
    }
  }

  async function readAgain() {
    if (!tenantId || reading) return;
    setReading(true);
    setNote(null);
    try {
      await readEbayAccount(tenantId);
    } catch (e) {
      setNote({ tone: 'negative', text: `eBay did not answer: ${e.message}` });
    } finally {
      setReading(false);
    }
  }

  // The rate a card not listed yet is costed at, as the cards cost it: the usual rate, or the research's 3% before
  // eBay has given her campaigns.
  const ad = adFor(null, 0.03).rate;
  const said = acc.ebayType === 'INDIVIDUAL' ? 'private' : acc.ebayType === 'BUSINESS' ? 'business' : null;
  const live = acc.campaigns.filter((c) => c.status !== 'ENDED');
  const promoted = acc.ads.size;
  const rates = [...acc.ads.values()].map((a) => a.rate).filter((r) => r > 0).sort((x, y) => x - y);

  const options = [
    {
      type: 'private',
      title: 'Private',
      takes: round(EXAMPLE * ad),
      lines: ['No selling fee, no per-order fee', 'Your ad rate on a promoted sale', `Buyers pay ${formatGbp(buyerProtection(EXAMPLE))} protection on top`],
    },
    {
      type: 'business',
      title: 'Business',
      takes: round(EXAMPLE * (0.128 + ad) + 0.3),
      lines: ['12.8% selling fee and 30p an order', 'Your ad rate on a promoted sale', 'Buyers pay your price, nothing added'],
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.choice} role="radiogroup" aria-label="Your eBay account">
        {options.map((o) => {
          const on = acc.type === o.type;
          return (
            <button key={o.type} type="button" role="radio" aria-checked={on}
              className={styles.option} data-on={on || undefined} disabled={Boolean(saving)}
              onClick={() => choose(o.type)}>
              <span className={styles.optionHead}>
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.optionTitle}>{o.title}</span>
                {said === o.type && <span className={styles.said}>eBay says</span>}
              </span>
              <span className={styles.takes}>
                <span className={styles.takesFigure} data-num>{formatGbp(o.takes)}</span>
                <span className={styles.takesLabel}>eBay takes on a {formatGbp(EXAMPLE)} sale</span>
              </span>
              <ul className={styles.optionLines}>
                {o.lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
              {saving === o.type && <span className={styles.optionState}>Saving</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.status}>
        <span className={styles.statusText}>
          {said
            ? <>eBay has <b>{acc.username ?? 'your account'}</b> as a {said} seller{acc.readAt ? <>, read {ago(acc.readAt)}</> : null}.</>
            : acc.readAt ? 'eBay did not say which account this is.' : 'Not read from eBay yet.'}
          {said && said !== acc.type && <span className={styles.warn}> Your prices follow your choice here, not eBay.</span>}
        </span>
        <button type="button" className={styles.read} onClick={readAgain} disabled={reading || !tenantId}>
          <svg viewBox="0 0 16 16" aria-hidden="true" className={reading ? styles.spin : ''}>
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" />
          </svg>
          {reading ? 'Reading eBay' : acc.readAt ? 'Read again' : 'Read from eBay'}
        </button>
      </div>
      {note && <p className={styles.note} data-tone={note.tone} role="status">{note.text}</p>}
      {acc.readError && !note && <p className={styles.note} data-tone="negative">Last read: {acc.readError}</p>}

      <div className={styles.panels}>
        <section className={styles.panel} aria-label="Promoted listings">
          <header className={styles.panelHead}>
            <span className={styles.panelTitle}>Promoted listings</span>
            {acc.typical != null && (
              <span className={styles.usual}>
                <span data-num>{pct(acc.typical)}</span> usual rate
              </span>
            )}
          </header>
          {!acc.readAt ? (
            <p className={styles.empty}>Your campaigns show here once eBay is read.</p>
          ) : !acc.campaignsRead ? (
            <p className={styles.empty}>eBay has not given your campaigns yet, so cards keep the ad rate they were costed with.</p>
          ) : live.length === 0 ? (
            <p className={styles.empty}>No campaigns running. Nothing is taken for promoted listings.</p>
          ) : (
            <>
              <ul className={styles.campaigns}>
                {live.map((c) => (
                  <li key={c.id} className={styles.campaign}>
                    <span className={styles.campaignName}>
                      {c.name}
                      <small>
                        {c.model === 'COST_PER_CLICK' ? 'Paid per click, no rate on a sale'
                          : c.status !== 'RUNNING' ? 'Not running, nothing charged'
                          : `${c.ads ?? 0} ${c.ads === 1 ? 'listing' : 'listings'}${c.auto ? ', adds new listings itself' : ''}${c.dynamic ? ', rate set by eBay' : ''}`}
                      </small>
                    </span>
                    <span className={styles.chip} data-state={c.status}>{STATUS[c.status] ?? c.status}</span>
                    <span className={styles.rate} data-num>{c.rate != null ? pct(c.rate) : '--'}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.foot}>
                {promoted > 0
                  ? <>{promoted} {promoted === 1 ? 'listing' : 'listings'} promoted{rates.length > 1 && rates[0] !== rates.at(-1) ? <>, at {pct(rates[0])} to {pct(rates.at(-1))}</> : null}. Each card is costed at its own listing&apos;s rate; one not listed yet at your usual rate.</>
                  : 'No listing is in a running campaign yet.'}
              </p>
            </>
          )}
        </section>

        <section className={styles.panel} aria-label="What eBay charged you">
          <header className={styles.panelHead}>
            <span className={styles.panelTitle}>What eBay charged you</span>
            {acc.fees && <span className={styles.usual}>last {acc.fees.days ?? 90} days</span>}
          </header>
          {!acc.fees ? (
            <p className={styles.empty}>eBay&apos;s own charges show here once eBay is read.</p>
          ) : (
            <Charged fees={acc.fees} />
          )}
        </section>
      </div>
    </div>
  );
}

// Postage bought on eBay is her postage, not eBay's cut: shown apart, and left out of the fee share.
const POSTAGE = new Set(['SHIPPING_LABEL']);

function Charged({ fees }) {
  const all = Object.entries(fees.charged ?? {});
  const rows = all.filter(([k]) => !POSTAGE.has(k)).sort((a, b) => b[1] - a[1]);
  const labels = all.filter(([k]) => POSTAGE.has(k)).reduce((n, [, v]) => n + v, 0);
  const total = round(rows.reduce((n, [, v]) => n + v, 0));
  const share = fees.sold > 0 ? total / fees.sold : null;
  const sales = `${fees.sales} ${fees.sales === 1 ? 'sale' : 'sales'}`;
  return (
    <>
      {rows.length ? (
        <dl className={styles.charged}>
          {rows.map(([k, v]) => (
            <div key={k} className={styles.charge}>
              <dt>{feeLabel(k)}</dt>
              <dd data-num data-credit={v < 0 || undefined}>{v < 0 ? `+${formatGbp(-v)}` : formatGbp(v)}</dd>
            </div>
          ))}
          <div className={`${styles.charge} ${styles.chargeTotal}`}>
            <dt>Fees in all</dt>
            <dd data-num>{formatGbp(total)}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.empty}>No fees{fees.sales ? ` on ${sales}` : ''}.</p>
      )}
      <p className={styles.foot}>
        {rows.length > 0 && share != null && <><b data-num>{pct(share)}</b> of {formatGbp(fees.sold)} taken ({sales}). </>}
        {labels > 0 && <>Postage labels bought on eBay, <b data-num>{formatGbp(labels)}</b>, are your postage, not a fee.</>}
      </p>
    </>
  );
}
