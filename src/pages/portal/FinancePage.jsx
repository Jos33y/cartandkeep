import { useEffect, useState } from 'react';
import { ChannelImport } from '@components/ui/portal/ChannelImport';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { Breakdown } from '@components/ui/portal/Breakdown';
import { Icon } from '@components/ui/icons';
import { useFinance, CHANNEL_LABEL } from '@hooks/useFinance';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath } from '@utils/constants';
import { Link } from 'react-router';
import styles from '@styles/pages/portal/finance-page.module.css';

const FEE_LABEL = { store: 'Card fees', ebay: 'eBay fees', tiktok: 'TikTok fees' };

const monthName = (iso, short) => (iso === 'all' ? 'All time'
  : new Date(`${String(iso).slice(0, 7)}-01T00:00:00Z`)
    .toLocaleDateString('en-GB', { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric', timeZone: 'UTC' }));

// What the board budgets on eBay: 12.8% plus 30p an order in fees, and 3% for
// promoted listings, which eBay bills separately from the order fee.
const BUDGET_FVF = 0.128;
const BUDGET_FIXED = 0.3;
const BUDGET_ADS = 0.03;

export function FinancePage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, months, showing, setMonth, byChannel, totals, products, series, costs, saveCosts, saveProductCost, reload,
    pullEbay, pulling, pulled,
  } = useFinance(tenant?.id);
  const [pullError, setPullError] = useState(null);
  const [editing, setEditing] = useState(null);

  async function pull() {
    setPullError(null);
    try { await pullEbay(); } catch (e) { setPullError(e.message); }
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
        ?? `${pulled.orders} ${pulled.orders === 1 ? 'order' : 'orders'} since ${new Date(pulled.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${pulled.matched} matched to a product.`}
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
  const feeRate = totals.revenue ? totals.fees / totals.revenue : null;
  const ebay = byChannel.find((c) => c.channel === 'ebay');
  const ebayRate = ebay?.revenue ? (ebay.fees + ebay.ads) / ebay.revenue : null;
  const offShop = products.filter((p) => p.offShop).length;
  const removed = products.filter((p) => p.removed).length;
  // On the shop but uncosted: the one gap that can be closed today.
  const costable = products.filter((p) => p.product_id && p.net == null).length;
  const multi = byChannel.length > 1;
  const first = series[0]?.month;
  const period = showing === 'all' && first ? `Since ${monthName(first)}` : monthName(showing);
  const budgetOf = (c) => (BUDGET_FVF * c.revenue + BUDGET_FIXED * c.units) / c.revenue;
  const inLine = ebayRate != null && ebay.units >= 5 && Math.abs(ebay.fees / ebay.revenue - budgetOf(ebay)) < 0.005;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Performance</p>
          <h1 className={styles.title}>Finance</h1>
        </div>

        <div className={styles.headActions}>
          <PullButton />
          <div className={styles.period} role="group" aria-label="Period">
            <button type="button" aria-pressed={showing === 'all'}
              className={`${styles.periodBtn} ${showing === 'all' ? styles.periodOn : ''}`}
              onClick={() => setMonth(null)}>
              All time
            </button>
            <label className={`${styles.periodPick} ${showing !== 'all' ? styles.periodOn : ''}`}>
              <select value={showing === 'all' ? '' : showing}
                onChange={(e) => setMonth(e.target.value || null)} aria-label="Month">
                <option value="">Month</option>
                {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
            </label>
          </div>
        </div>
      </header>

      {pullNote}

      <div className={styles.stats}>
        <Card className={styles.stat}>
          <span className={styles.statLabel}>Taken</span>
          <span className={`figure ${styles.statValue}`}>{formatGbp(totals.revenue)}</span>
          <span className={styles.statFoot}>{period}</span>
        </Card>

        {/* Kept is only as certain as the costs behind it, so the coverage
            meter lives inside it rather than in a card of its own. */}
        <Card className={styles.stat}>
          <span className={styles.statLabel}>Kept</span>
          <span className={`figure ${styles.statValue} ${totals.net == null ? styles.unknown : totals.net < 0 ? styles.bad : styles.good}`}>
            {totals.net == null ? 'Unknown' : formatGbp(totals.net)}
          </span>
          <span className={styles.meter} aria-hidden="true">
            <span style={{ width: `${Math.max(coverage * 100, 2)}%` }} className={coverage === 1 ? styles.meterFull : ''} />
          </span>
          <span className={styles.statFoot}>
            {totals.covered} of {totals.lines} {totals.lines === 1 ? 'product' : 'products'} costed
          </span>
          {costable > 0 && (
            <Link to={portalPath('/products')} className={styles.statLink}>
              Cost {costable} on your shop
            </Link>
          )}
        </Card>

        <Card className={styles.stat}>
          <span className={styles.statLabel}>Units</span>
          <span className={`figure ${styles.statValue}`}>{totals.units}</span>
          <span className={styles.statFoot}>
            {perSale != null ? `${formatGbp(perSale)} kept a unit` : `${formatGbp(totals.units ? totals.revenue / totals.units : 0)} taken a unit`}
          </span>
        </Card>

        <Card className={styles.stat}>
          <span className={styles.statLabel}>Fees</span>
          <span className={`figure ${styles.statValue}`}>{feeRate == null ? '--' : `${(feeRate * 100).toFixed(1)}%`}</span>
          <span className={styles.statFoot}>
            {formatGbp(totals.fees)} of what was taken{inLine ? ', in line with the board' : ''}
          </span>
        </Card>
      </div>

      {/* A real finding: what eBay charges against what every price on the
          board assumes. Shown only once there is enough to trust it. */}
      {/* Only worth a panel when the real fee and the budget disagree. */}
      {ebayRate != null && ebay.units >= 5 && !inLine && (() => {
        const budget = budgetOf(ebay);
        return (
          <p className={styles.insight}>
            <Icon name="IconChart" className={styles.insightIcon} />
            <span>
              eBay's selling fees came to <strong>{(ebay.fees / ebay.revenue * 100).toFixed(1)}%</strong> across {ebay.units} sales,
              against the {(budget * 100).toFixed(1)}% the board budgets for them.
              Promoted listings are billed separately and aren't in that figure; the board budgets a further {(BUDGET_ADS * 100).toFixed(0)}%.
            </span>
          </p>
        );
      })()}

      {series.length > 1 && (
        <Card>
          <CardHead title="Taken by month" note="Pick a month to see only that" />
          <MonthBars series={series} showing={showing} onPick={(m) => setMonth(m === showing ? null : m)} />
        </Card>
      )}

      {(offShop > 0 || removed > 0 || costable > 0) && (
        <p className={styles.notice}>
          <Icon name="IconInfo" className={styles.noticeIcon} />
          <span>
            {costable > 0 && <>{costable} {costable === 1 ? 'product is' : 'products are'} on your shop with no cost yet; <Link to={portalPath('/products')} className={styles.inlineLink}>add {costable === 1 ? 'it' : 'them'} under Products</Link>. </>}
            {offShop > 0 && <>{offShop} sold only on eBay; add {offShop === 1 ? 'its cost with the button beside it' : 'their costs with the button beside each one'} below. </>}
            {removed > 0 && <>{removed} {removed === 1 ? 'was' : 'were'} removed from your shop. </>}
          </span>
        </p>
      )}

      <div className={styles.channels}>
        {byChannel.map((c) => {
          const complete = c.net != null && c.uncosted === 0;
          const rate = c.revenue ? (c.fees + c.ads) / c.revenue : null;
          return (
            <Card key={c.channel}>
              <CardHead
                title={CHANNEL_LABEL[c.channel] ?? c.channel}
                note={`${c.units} ${c.units === 1 ? 'unit' : 'units'} · ${formatGbp(c.revenue)} taken${rate != null ? ` · ${(rate * 100).toFixed(1)}% fees` : ''}`}
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
                    ? `Kept covers ${c.netCovers} of ${c.netCovers + c.uncosted} products. The rest have no cost recorded.`
                    : 'None of these products has a cost recorded, so what was kept cannot be worked out yet.'}
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
          <CardHead title="By product" note={`${period}, most taken first`} />
        </div>

        <div className={`${styles.table} ${multi ? '' : styles.oneChannel}`}>
          <div className={styles.headRow}>
            <span>Product</span>
            <span>Sold on</span>
            <span className={styles.num}>Units</span>
            <span className={styles.num}>Taken</span>
            <span className={styles.num}>Kept</span>
          </div>

          {products.slice(0, 80).map((p) => (
            <div key={p.key} className={styles.group}>
              <div className={styles.row}>
                <span className={styles.product}>
                  <span className={styles.productName}>{p.title}</span>
                  {p.removed && <span className={styles.tag}>Removed from your shop</span>}
                  {p.offShop && <span className={styles.tag}>Not on your shop</span>}
                  {p.product_id && p.net == null && <span className={`${styles.tag} ${styles.tagAction}`}>On your shop, no cost yet</span>}
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
                <span className={styles.keptCell}>
                  {p.net == null ? (
                    <button type="button" className={styles.addCost}
                      onClick={() => setEditing(editing === p.key ? null : p.key)}>
                      <Icon name="IconPlus" className={styles.addCostIcon} />
                      Add cost
                    </button>
                  ) : (
                    <button type="button"
                      className={`${styles.keptValue} ${p.net < 0 ? styles.bad : styles.good}`}
                      title="Change this product's cost"
                      onClick={() => setEditing(editing === p.key ? null : p.key)}>
                      <span data-num>{formatGbp(p.net)}</span>
                      <Icon name="IconNote" className={styles.editIcon} />
                    </button>
                  )}
                </span>
              </div>

              {editing === p.key && (
                <CostEditor
                  product={p}
                  onCancel={() => setEditing(null)}
                  onSave={async (v) => {
                    await saveProductCost({ productId: p.product_id, title: p.title, ...v });
                    setEditing(null);
                  }}
                />
              )}

              {p.byChannel.length > 1 && p.byChannel.map((c) => (
                <div key={c.channel} className={styles.split}>
                  <span className={styles.splitName}>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                  <span />
                  <span className={styles.cell} data-num>{c.units}</span>
                  <span className={styles.cell} data-num>{formatGbp(c.revenue)}</span>
                  <span className={`${styles.cell} ${c.net == null ? styles.unknown : ''}`} data-num>
                    {c.net == null ? '--' : formatGbp(c.net)}
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

// One product's unit cost, applied to every sale of it, past and future.
function CostEditor({ product, onCancel, onSave }) {
  const [landed, setLanded] = useState(product.unitCost != null ? String(product.unitCost) : '');
  const [postage, setPostage] = useState(product.unitPostage != null ? String(product.unitPostage) : '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      await onSave({ landed, postage });
    } catch (e) {
      setFailed(e.message);
      setBusy(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorFields}>
        <Field label="Cost per unit" prefix="£" value={landed} onChange={setLanded}
          hint="What you paid for one, delivered to you." />
        <Field label="Postage per unit" prefix="£" value={postage} onChange={setPostage}
          hint="What it costs you to send one." />
      </div>
      <div className={styles.editorFoot}>
        <span className={styles.editorNote}>
          {product.product_id
            ? 'Saved on the shop product, so Products shows it too.'
            : 'Applies to every sale of this product, past and future.'}
        </span>
        {failed && <span className={styles.failed} role="alert">{failed}</span>}
        <button type="button" className={styles.ghost} onClick={onCancel}>Cancel</button>
        <button type="button" className={styles.primary} disabled={busy || landed.trim() === ''} onClick={save}>
          {busy ? 'Saving' : 'Save cost'}
        </button>
      </div>
    </div>
  );
}

// Taken per month. The picked month is solid, the rest recede.
function MonthBars({ series, showing, onPick }) {
  const top = Math.max(1, ...series.map((m) => m.revenue));
  return (
    <div className={styles.bars} role="group" aria-label="Taken by month">
      {series.map((m) => {
        const on = showing === m.month;
        const faded = showing !== 'all' && !on;
        return (
          <button key={m.month} type="button" aria-pressed={on}
            className={`${styles.bar} ${on ? styles.barOn : ''} ${faded ? styles.barFaded : ''}`}
            onClick={() => onPick(m.month)}
            title={`${monthName(m.month)}: ${formatGbp(m.revenue)} from ${m.units} units`}>
            <span className={styles.barValue} data-num>{formatGbp(m.revenue)}</span>
            <span className={styles.barTrack}>
              <span className={styles.barFill} style={{ height: `${Math.max((m.revenue / top) * 100, 3)}%` }} />
            </span>
            <span className={styles.barLabel}>{monthName(m.month, true)}</span>
          </button>
        );
      })}
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
