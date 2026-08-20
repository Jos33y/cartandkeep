import { useEffect, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ChannelImport } from '@components/ui/portal/ChannelImport';
import { useFinance, CHANNEL_LABEL } from '@hooks/useFinance';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/finance-page.module.css';

/*
 * What is left after everything.
 *
 * The page this replaces had been advertising an eight line model since July
 * with nothing behind it. Every one of those lines now exists: revenue, the
 * platform fee, promoted listings, packaging, a returns provision, postage and
 * cost of goods.
 *
 * The comparison across channels is the point of the screen rather than a
 * feature of it. The same product at the same price nets differently on each,
 * and that difference is the argument for her own shop made in her own figures.
 */

// Kept from the page this replaces, because it says which costs are counted and
// most sellers only ever find out about half of them.
const COLUMNS = [
  { key: 'line', label: 'Line' },
  { key: 'value', label: 'Per unit', align: 'right' },
];

const ROWS = [
  { cells: ['Revenue'] },
  { cells: ['Platform fee'] },
  { cells: ['Promoted listings'] },
  { cells: ['Postage'] },
  { cells: ['Packaging'] },
  { cells: ['Returns provision'] },
  { cells: ['Cost of goods'] },
  { cells: ['Net'], rule: true },
];

const monthName = (iso) => new Date(`${String(iso).slice(0, 7)}-01T00:00:00Z`)
  .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function FinancePage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, months, showing, setMonth, byChannel, totals, products, costs, saveCosts, reload,
  } = useFinance(tenant?.id);

  if (tenant === undefined || status === 'loading') {
    return <p className={styles.status} role="status" aria-live="polite">Loading</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>The figures did not load</h1>
        <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.retry} onClick={reload}>Try again</button>
      </div>
    );
  }

  // Before any sale anywhere, the old empty state is still the right screen: it
  // says which costs are counted, which is the only useful thing to say when
  // there are no figures.
  if (!byChannel.length) {
    return (
      <div className={styles.page}>
        {/*
          * Zero is a starting point rather than something to apologise for.
          * The model below still says which costs are counted, which is the
          * useful thing, and these three say plainly that none of it has
          * happened yet.
          */}
        <header className={styles.head}>
          <div>
            <p className="micro">Your shop</p>
            <h1 className={styles.title}>Finance</h1>
          </div>
          <dl className={styles.stats}>
            <Stat label="Taken" value={formatGbp(0)} />
            <Stat label="Left after everything" value={formatGbp(0)} />
            <Stat label="Units" value={0} />
          </dl>
        </header>

        <EmptyState
          eyebrow="Finance"
          title="No figures yet"
          icon="IconChart"
          body="What is actually left after every cost, not just after the platform fee."
          columns={COLUMNS}
          rows={ROWS}
          note="Nothing has sold anywhere yet. Sales from your shop arrive here on their own, and your eBay and TikTok Shop sales come in from the exports below, so all three sit in the same figures."
        />
        <SellingCosts costs={costs} onSave={saveCosts} />
        <ChannelImport tenantId={tenant?.id} onImported={reload} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Your shop</p>
          <h1 className={styles.title}>Finance</h1>
        </div>

        <dl className={styles.stats}>
          <Stat label="Taken" value={formatGbp(totals.revenue)} />
          <Stat
            label="Left after everything"
            value={formatGbp(totals.net)}
            foot={totals.uncosted > 0
              ? `${totals.uncosted} ${totals.uncosted === 1 ? 'product has' : 'products have'} no cost recorded, so ${totals.uncosted === 1 ? 'it is' : 'they are'} not in this`
              : null}
          />
          <Stat label="Units" value={totals.units} />
        </dl>
      </header>

      {months.length > 1 && (
        <div className={styles.months} role="group" aria-label="Month">
          {months.slice(0, 12).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === showing}
              className={`${styles.chip} ${m === showing ? styles.chipOn : ''}`}
              onClick={() => setMonth(m)}
            >
              {monthName(m)}
            </button>
          ))}
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="micro">{monthName(showing)}, by channel</h2>
        </div>

        <div className={styles.ledger}>
          {byChannel.map((c) => (
            <div key={c.channel} className={styles.channel}>
              <div className={styles.channelHead}>
                <h3 className={styles.channelName}>{CHANNEL_LABEL[c.channel] ?? c.channel}</h3>
                <span className={`figure ${styles.channelNet} ${c.net < 0 ? styles.bad : ''}`}>
                  {formatGbp(c.net)}
                </span>
              </div>

              <dl className={styles.model}>
                <Line label="Revenue" value={c.revenue} />
                <Line label="Platform fee" value={-c.fees} />
                {c.ads > 0 && <Line label="Promoted listings" value={-c.ads} />}
                <Line label="Postage" value={-c.postage} />
                <Line label="Packaging" value={-c.packaging} />
                <Line label="Returns provision" value={-c.returns} />
                <Line label="Cost of goods" value={-c.cost} />
                <Line label="Net" value={c.net} rule />
              </dl>

              {/*
                * The figure above is real and it is not the whole month.
                *
                * It used to be withheld entirely whenever any product on the
                * channel lacked a cost, which is the normal state and meant the
                * screen showed nothing for months. A total over what is costed
                * is a number she can act on; what it leaves out is said here
                * rather than by refusing to show it.
                */}
              {c.uncosted > 0 && (
                <p className={styles.note}>
                  Covers <span data-num>{c.netCovers}</span> of{' '}
                  <span data-num>{c.netCovers + c.uncosted}</span> products.{' '}
                  {c.uncosted === 1 ? 'One has' : `${c.uncosted} have`} no cost recorded, so{' '}
                  {c.uncosted === 1 ? 'it is' : 'they are'} left out. Put a cost on{' '}
                  {c.uncosted === 1 ? 'it' : 'them'} under Products and this covers everything.
                </p>
              )}

              {c.unmatched > 0 && (
                <p className={styles.note}>
                  <span data-num>{c.unmatched}</span> lines did not match anything in your shop.
                  They count as revenue and cannot show a profit.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="micro">By product</h2>
        </div>

        <div className={styles.table}>
          <div className={styles.headRow}>
            <span>Product</span>
            <span className={styles.num}>Sold on</span>
            <span className={styles.num}>Units</span>
            <span className={styles.num}>Taken</span>
            <span className={styles.num}>Left</span>
          </div>

          {products.slice(0, 60).map((p) => (
            <div key={p.key}>
            <div className={styles.row}>
              <span className={styles.product}>{p.title}</span>
              <span className={styles.where}>
                {p.byChannel.map((c) => CHANNEL_LABEL[c.channel] ?? c.channel).join(', ')}
              </span>
              <span className={styles.cell} data-num>{p.units}</span>
              <span className={styles.cell} data-num>{formatGbp(p.revenue)}</span>
              <span className={`${styles.cell} ${p.net !== null && p.net < 0 ? styles.bad : ''}`} data-num>
                {p.net === null ? 'no cost' : formatGbp(p.net)}
              </span>
            </div>

            {/*
              * The split, where there is one.
              *
              * Net per product per channel is the line Section 5 asks for and
              * the comparison this whole screen exists to make. Only shown when
              * a product actually sold on more than one channel, because a
              * single row repeating itself underneath is furniture.
              */}
            {p.byChannel.length > 1 && p.byChannel.map((c) => (
              <div key={c.channel} className={styles.split}>
                <span className={styles.splitName}>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                <span className={styles.cell} data-num>{c.units}</span>
                <span className={styles.cell} data-num>{formatGbp(c.revenue)}</span>
                <span className={`${styles.cell} ${c.net !== null && c.net < 0 ? styles.bad : ''}`} data-num>
                  {c.net === null ? 'no cost' : formatGbp(c.net)}
                </span>
              </div>
            ))}
            </div>
          ))}
        </div>
      </section>

      <SellingCosts costs={costs} onSave={saveCosts} />
      <ChannelImport tenantId={tenant?.id} onImported={reload} />
    </div>
  );
}

/*
 * The three costs nothing else knows.
 *
 * Fees come off the platform, the goods cost sits on the product, postage sits
 * on the product. These three are hers and they have never been recorded
 * anywhere, which is why the model has been four lines pretending to be eight.
 *
 * All three default to zero, so nothing changes until she puts real figures in
 * and no number on this page is ever inflated by an assumption I made.
 */
function SellingCosts({ costs, onSave }) {
  const pct = (v) => (v === null || v === undefined ? '' : String(Math.round(Number(v) * 1000) / 10));

  const [packaging, setPackaging] = useState(
    costs?.packaging_per_order ? String(costs.packaging_per_order) : '');
  const [returns, setReturns] = useState(pct(costs?.returns_provision_pct));
  const [ads, setAds] = useState(pct(costs?.ad_rate_pct));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(null);

  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      await onSave({ packaging, returns, ads });
      setNote('Saved');
    } catch (e) {
      setFailed(e?.message ?? 'Those did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.costs}>
      <h2 className="micro">What it costs you to sell</h2>
      <p className={styles.costsBody}>
        Three figures nothing else can know. All zero until you set them, so nothing above
        is guessed on your behalf.
      </p>

      <div className={styles.costFields}>
        <Field label="Packaging, per parcel" prefix="£" value={packaging} onChange={setPackaging} />
        <Field label="Returns provision" suffix="%" value={returns} onChange={setReturns}
          hint="Of revenue, set aside against the ones that come back." />
        <Field label="Promoted listings" suffix="%" value={ads} onChange={setAds}
          hint="eBay only. Ignored where an export gives the real figure." />
      </div>

      <div className={styles.costActions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={save}>
          {busy ? 'Saving' : 'Save'}
        </button>
        {failed
          ? <span className={styles.failed} role="alert">{failed}</span>
          : <span className={styles.saved} role="status">{note}</span>}
      </div>
    </section>
  );
}

function Field({ label, prefix, suffix, hint, value, onChange }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.control}>
        {prefix ? <span className={styles.affix} aria-hidden="true">{prefix}</span> : null}
        <input
          className={styles.input}
          data-num
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        {suffix ? <span className={styles.affix} aria-hidden="true">{suffix}</span> : null}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

function Line({ label, value, rule, missing }) {
  return (
    <div className={`${styles.line} ${rule ? styles.lineRule : ''}`}>
      <dt className={styles.lineLabel}>{label}</dt>
      <dd className={styles.lineValue} data-num>
        {missing || value === null ? 'unknown' : formatGbp(value)}
      </dd>
    </div>
  );
}

function Stat({ label, value, foot }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
      {foot ? <dd className={styles.statFoot}>{foot}</dd> : null}
    </div>
  );
}
