import { useEffect, useState } from 'react';
import { ChannelImport } from '@components/ui/portal/ChannelImport';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { Breakdown } from '@components/ui/portal/Breakdown';
import { Icon } from '@components/ui/icons';
import { useFinance, CHANNEL_LABEL } from '@hooks/useFinance';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/finance-page.module.css';

const FEE_LABEL = { store: 'Card fees', ebay: 'eBay fees', tiktok: 'TikTok fees' };

const monthName = (iso, short) => new Date(`${String(iso).slice(0, 7)}-01T00:00:00Z`)
  .toLocaleDateString('en-GB', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' });

export function FinancePage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, months, showing, setMonth, byChannel, totals, products, costs, saveCosts, reload,
    pullEbay, pulling, pulled,
  } = useFinance(tenant?.id);
  const [pullError, setPullError] = useState(null);

  async function pull() {
    setPullError(null);
    try { await pullEbay(90); } catch (e) { setPullError(e.message); }
  }

  const PullButton = ({ primary }) => (
    <button type="button" className={primary ? styles.primary : styles.ghost} disabled={pulling} onClick={pull}>
      <Icon name="IconRefresh" className={`${styles.btnIcon} ${pulling ? styles.spin : ''}`} />
      {pulling ? 'Pulling from eBay' : 'Pull eBay sales'}
    </button>
  );

  const pullNote = (pullError || pulled) && (
    <p className={pullError ? styles.pullFail : styles.pullOk} role="status">
      {pullError
        ?? `${pulled.orders} ${pulled.orders === 1 ? 'order' : 'orders'} from the last 90 days, ${pulled.matched} matched to a product.`}
    </p>
  );

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={4} />;

  if (status === 'error') {
    return (
      <Card>
        <CardHead title="The figures did not load" note="Reload the page. If it happens again, send us a note." />
        <button type="button" className={styles.ghost} onClick={reload}>Try again</button>
      </Card>
    );
  }

  if (!byChannel.length) {
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <div>
            <p className="micro">Performance</p>
            <h1 className={styles.title}>Finance</h1>
          </div>
        </header>

        {/* One statement of what the page is for, and what feeds it. The old
            one repeated the page title and drew eight rows of dashes. */}
        <Card className={styles.hero}>
          <span className={styles.heroIcon}><Icon name="IconChart" className={styles.heroGlyph} /></span>
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>No sales recorded yet</h2>
            <p className={styles.heroBody}>
              Once something sells, this shows what was taken and what was actually kept after every cost.
            </p>
          </div>

          <div className={styles.flowWell}>
          <span className={styles.flowLabel}>What comes off each sale</span>
          <ol className={styles.flow} aria-label="What comes off each sale">
            {['Sale', 'Fees', 'Promoted', 'Postage', 'Packaging', 'Returns', 'Goods'].map((s, i) => (
              <li key={s} className={`${styles.flowStep} ${i === 0 ? styles.flowIn : styles.flowOut}`}>
                {i > 0 && <span className={styles.flowMinus} aria-hidden="true">−</span>}
                {s}
              </li>
            ))}
            <li className={`${styles.flowStep} ${styles.flowKeep}`}>
              <span className={styles.flowMinus} aria-hidden="true">=</span>Kept
            </li>
          </ol>
          </div>
        </Card>

        <div className={styles.sources}>
          <Card>
            <div className={styles.source}>
              <span className={`${styles.sourceIcon} ${styles.sourceAuto}`}><Icon name="IconShop" className={styles.sourceGlyph} /></span>
              <div>
                <p className={styles.sourceTitle}>Your shop</p>
                <p className={styles.sourceBody}>Every order lands here on its own, with its fees and costs.</p>
              </div>
              <span className={styles.sourceState}><Icon name="IconCheck" className={styles.stateIcon} />Automatic</span>
            </div>
          </Card>

          <Card>
            <div className={styles.source}>
              <span className={styles.sourceIcon}><Icon name="IconTag" className={styles.sourceGlyph} /></span>
              <div>
                <p className={styles.sourceTitle}>eBay</p>
                <p className={styles.sourceBody}>Connected. Pulls your orders with eBay's actual fees, no export needed.</p>
              </div>
              <PullButton primary />
            </div>
            {pullNote}
          </Card>
        </div>

        <Setup tenantId={tenant?.id} costs={costs} onSave={saveCosts} onImported={reload} />
      </div>
    );
  }

  const coverage = totals.lines ? totals.covered / totals.lines : 0;
  const perSale = totals.net != null && totals.units ? totals.net / totals.units : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Performance</p>
          <h1 className={styles.title}>Finance</h1>
        </div>

        <div className={styles.headActions}>
          <PullButton />
        {months.length > 1 && (
          <label className={styles.monthPick}>
            <Icon name="IconChart" className={styles.monthIcon} />
            <select value={showing} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              {months.slice(0, 18).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </label>
        )}
        </div>
      </header>

      {pullNote}

      {/* Taken is certain. Kept is only as certain as the costs behind it, so
          the coverage sits beside it rather than in a footnote. */}
      <div className={styles.stats}>
        <Card className={styles.stat}>
          <span className={styles.statLabel}>Taken</span>
          <span className={`figure ${styles.statValue}`}>{formatGbp(totals.revenue)}</span>
          <span className={styles.statFoot}>{monthName(showing)}</span>
        </Card>

        <Card className={styles.stat}>
          <span className={styles.statLabel}>Kept</span>
          <span className={`figure ${styles.statValue} ${totals.net == null ? styles.unknown : totals.net < 0 ? styles.bad : styles.good}`}>
            {totals.net == null ? 'Unknown' : formatGbp(totals.net)}
          </span>
          <span className={styles.statFoot}>
            {totals.net == null
              ? 'No product sold this month has a cost recorded'
              : totals.uncosted ? `Over ${totals.covered} of ${totals.lines} products` : 'After every cost'}
          </span>
        </Card>

        <Card className={styles.stat}>
          <span className={styles.statLabel}>Units</span>
          <span className={`figure ${styles.statValue}`}>{totals.units}</span>
          <span className={styles.statFoot}>
            {perSale != null ? `${formatGbp(perSale)} kept a unit` : 'across every channel'}
          </span>
        </Card>

        <Card className={styles.stat}>
          <span className={styles.statLabel}>Costed</span>
          <span className={`figure ${styles.statValue}`}>
            {totals.covered}<span className={styles.of}>/{totals.lines}</span>
          </span>
          <span className={styles.meter} aria-hidden="true">
            <span style={{ width: `${Math.max(coverage * 100, 2)}%` }} className={coverage === 1 ? styles.meterFull : ''} />
          </span>
        </Card>
      </div>

      {totals.unmatched > 0 && (
        <p className={styles.notice}>
          <Icon name="IconInfo" className={styles.noticeIcon} />
          {totals.unmatched} {totals.unmatched === 1 ? 'sale is' : 'sales are'} for products no longer in your shop,
          so there is no cost to measure {totals.unmatched === 1 ? 'it' : 'them'} against. Revenue counts, profit cannot.
        </p>
      )}

      <div className={styles.channels}>
        {byChannel.map((c) => {
          const complete = c.net != null && c.uncosted === 0;
          return (
            <Card key={c.channel}>
              <CardHead
                title={CHANNEL_LABEL[c.channel] ?? c.channel}
                note={`${c.units} ${c.units === 1 ? 'unit' : 'units'} · ${formatGbp(c.revenue)} taken`}
                aside={(
                  <span className={`figure ${styles.channelNet} ${c.net == null ? styles.unknown : c.net < 0 ? styles.bad : styles.good}`}>
                    {c.net == null ? 'Unknown' : formatGbp(c.net)}
                  </span>
                )}
              />

              {complete ? (
                <Breakdown
                  price={c.revenue}
                  fees={c.fees + c.ads}
                  postage={c.postage + c.packaging + c.returns}
                  goods={c.cost}
                  keep={c.net}
                  feeLabel={FEE_LABEL[c.channel] ?? 'Fees'}
                />
              ) : (
                <p className={styles.partial}>
                  <Icon name="IconInfo" className={styles.partialIcon} />
                  {c.netCovers
                    ? `Kept is over ${c.netCovers} of ${c.netCovers + c.uncosted} products. The rest have no cost recorded.`
                    : 'None of these products has a cost recorded, so what was kept cannot be worked out.'}
                </p>
              )}

              <dl className={styles.model}>
                <Line label="Revenue" value={c.revenue} />
                <Line label={FEE_LABEL[c.channel] ?? 'Platform fee'} value={-c.fees} />
                {c.ads > 0 && <Line label="Promoted listings" value={-c.ads} />}
                <Line label="Postage" value={-c.postage} zero={!c.postage} />
                <Line label="Packaging" value={-c.packaging} zero={!c.packaging} />
                <Line label="Returns provision" value={-c.returns} zero={!c.returns} />
                <Line label="Cost of goods" value={c.netCovers ? -c.cost : null} />
                <Line label="Kept" value={c.net} rule />
              </dl>
            </Card>
          );
        })}
      </div>

      <Card flush>
        <div className={styles.tableHead}>
          <CardHead title="By product" note="Most taken first" />
        </div>

        <div className={styles.table}>
          <div className={styles.headRow}>
            <span>Product</span>
            <span>Sold on</span>
            <span className={styles.num}>Units</span>
            <span className={styles.num}>Taken</span>
            <span className={styles.num}>Kept</span>
          </div>

          {products.slice(0, 60).map((p) => (
            <div key={p.key} className={styles.group}>
              <div className={styles.row}>
                <span className={styles.product}>
                  {p.title}
                  {p.removed && <span className={styles.removed}>No longer in your shop</span>}
                </span>
                <span className={styles.where}>
                  {p.byChannel.map((c) => (
                    <span key={c.channel} className={`${styles.chan} ${styles[c.channel]}`}>
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                  ))}
                </span>
                <span className={styles.cell} data-num>{p.units}</span>
                <span className={styles.cell} data-num>{formatGbp(p.revenue)}</span>
                <span className={`${styles.cell} ${p.net == null ? styles.unknown : p.net < 0 ? styles.bad : styles.good}`} data-num>
                  {p.net == null ? '—' : formatGbp(p.net)}
                </span>
              </div>

              {p.byChannel.length > 1 && p.byChannel.map((c) => (
                <div key={c.channel} className={styles.split}>
                  <span className={styles.splitName}>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                  <span />
                  <span className={styles.cell} data-num>{c.units}</span>
                  <span className={styles.cell} data-num>{formatGbp(c.revenue)}</span>
                  <span className={`${styles.cell} ${c.net == null ? styles.unknown : ''}`} data-num>
                    {c.net == null ? '—' : formatGbp(c.net)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Setup tenantId={tenant?.id} costs={costs} onSave={saveCosts} onImported={reload} />
    </div>
  );
}

// The three costs nothing else knows, and where outside sales come in. Setup
// rather than report, so it sits apart from the figures it feeds.
function Setup({ tenantId, costs, onSave, onImported }) {
  return (
    <div className={styles.setup}>
      <Card>
        <CardHead title="What it costs you to sell"
          note="Zero until you set them, so nothing here is guessed." />
        <SellingCosts costs={costs} onSave={onSave} />
      </Card>
      <ChannelImport tenantId={tenantId} onImported={onImported} />
    </div>
  );
}

function SellingCosts({ costs, onSave }) {
  const pctOf = (v) => (v === null || v === undefined ? '' : String(Math.round(Number(v) * 1000) / 10));

  const [packaging, setPackaging] = useState(costs?.packaging_per_order ? String(costs.packaging_per_order) : '');
  const [returns, setReturns] = useState(pctOf(costs?.returns_provision_pct));
  const [ads, setAds] = useState(pctOf(costs?.ad_rate_pct));
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
    <>
      <div className={styles.costFields}>
        <Field label="Packaging" prefix="£" suffix="a parcel" value={packaging} onChange={setPackaging} />
        <Field label="Returns provision" suffix="%" value={returns} onChange={setReturns}
          hint="Of revenue, held back for the ones that come back." />
        <Field label="Promoted listings" suffix="%" value={ads} onChange={setAds}
          hint="eBay only. An export's real figure replaces it." />
      </div>

      <div className={styles.costActions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={save}>
          {busy ? 'Saving' : 'Save'}
        </button>
        {failed
          ? <span className={styles.failed} role="alert">{failed}</span>
          : <span className={styles.saved} role="status">{note}</span>}
      </div>
    </>
  );
}

function Field({ label, prefix, suffix, hint, value, onChange }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.control}>
        {prefix ? <span className={styles.affix} aria-hidden="true">{prefix}</span> : null}
        <input className={styles.input} data-num inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)} aria-label={label} />
        {suffix ? <span className={styles.affix} aria-hidden="true">{suffix}</span> : null}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

// A cost that is unset shows as not set, not as £0.00 deducted.
function Line({ label, value, rule, zero }) {
  return (
    <div className={`${styles.line} ${rule ? styles.lineRule : ''}`}>
      <dt className={styles.lineLabel}>{label}</dt>
      <dd className={`${styles.lineValue} ${zero || value == null ? styles.unknown : ''}`} data-num>
        {value == null ? 'unknown' : zero ? 'not set' : formatGbp(value)}
      </dd>
    </div>
  );
}
