import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useFindability, feedGaps, monthName } from '@hooks/useFindability';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import styles from '@styles/pages/portal/being-found-page.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

// Google refuses a product without the first three; the rest decide how well it ranks.
const CHECKS = [
  { key: 'description', label: 'Description', must: true, step: 'description' },
  { key: 'photograph', label: 'Photo', must: true, step: 'photo' },
  { key: 'price', label: 'Price', must: true, step: 'price' },
  { key: 'brand', label: 'Brand', step: 'section' },
  { key: 'barcode', label: 'Barcode', step: 'details' },
  { key: 'category', label: 'Category', step: 'section' },
];

const open = (id, step) => portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=all&open=${id}${step ? `&step=${step}` : ''}`);

function Ring({ value, total }) {
  const p = total ? value / total : 0;
  return (
    <span className={styles.ring} style={{ '--p': p }} aria-hidden="true">
      <span className={styles.ringInner}>
        <b data-num>{value}</b>
        <small>of <span data-num>{total}</span></small>
      </span>
    </span>
  );
}

function Months({ reports }) {
  const seen = reports.filter((r) => r.impressions != null);
  const peak = Math.max(1, ...seen.map((r) => r.impressions));
  return (
    <ol className={styles.months}>
      {reports.slice(-12).map((r) => (
        <li key={r.month} className={styles.month}>
          <span className={styles.monthBars}>
            {r.impressions == null
              ? <i className={styles.unknown} title="Google could not be read that month" />
              : (
                <>
                  <i className={styles.shown} style={{ height: `${(r.impressions / peak) * 100}%` }} title={`${r.impressions} times shown`} />
                  <i className={styles.clicked} style={{ height: `${((r.clicks ?? 0) / peak) * 100}%` }} title={`${r.clicks ?? 0} clicks`} />
                </>
              )}
          </span>
          <span className={styles.monthName}>{monthName(r.month).split(' ')[0].slice(0, 3)}</span>
        </li>
      ))}
    </ol>
  );
}

export function BeingFoundPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);
  const { status, error, products, reports, catalogue, latest, change, reload } = useFindability(tenant?.id);
  const [term, setTerm] = useState('');
  const [gap, setGap] = useState(null);
  const [shown, setShown] = useState(25);
  const [openReady, setOpenReady] = useState(false);
  useEffect(() => { setShown(25); }, [term, gap]);

  if (tenant === undefined || (status === 'loading' && !products.length)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>This did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  const live = products.filter((p) => p.status === 'live' && !p.is_sample)
    .map((p) => ({ ...p, gaps: feedGaps(p) }))
    .sort((a, b) => b.gaps.filter((g) => ['description', 'photograph', 'price'].includes(g)).length
      - a.gaps.filter((g) => ['description', 'photograph', 'price'].includes(g)).length || b.gaps.length - a.gaps.length);
  const blockedBy = (key) => live.filter((p) => p.gaps.includes(key)).length;
  const biggest = CHECKS.filter((c) => c.must).map((c) => ({ ...c, n: blockedBy(c.key) })).sort((a, b) => b.n - a.n)[0];
  const measured = reports.filter((r) => r.impressions != null);
  const must = ['description', 'photograph', 'price'];
  const q = term.trim().toLowerCase();
  const matching = live.filter((p) => (!q || String(p.title).toLowerCase().includes(q)) && (!gap || p.gaps.includes(gap)));
  const hidden = matching.filter((p) => p.gaps.some((g) => must.includes(g)));
  const ready = matching.filter((p) => !p.gaps.some((g) => must.includes(g)));

  // eslint-disable-next-line react/no-unstable-nested-components
  const Row = ({ p, i }) => {
    const ok = !p.gaps.some((g) => must.includes(g));
    return (
      <div className={styles.gridRow} data-ok={ok || undefined} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
        <Link className={styles.gridProduct} to={open(p.id)}>
          {thumb(p.image_url) ? <img src={thumb(p.image_url)} alt="" /> : <span className={styles.noPic} />}
          <span>{p.title}</span>
        </Link>
        {CHECKS.map((c) => {
          const missing = p.gaps.includes(c.key);
          return missing
            ? <Link key={c.key} className={styles.cell} to={open(p.id, c.step)} title={`Add the ${c.label.toLowerCase()}`}><StepMark state={c.must ? 'check' : 'missing'} /></Link>
            : <span key={c.key} className={styles.cell}><StepMark state="done" /></span>;
        })}
        <span className={styles.verdict} data-ok={ok || undefined}>
          {ok ? <><Icon name="IconCheck" width="12" height="12" />Can list</> : 'Hidden'}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Being found</h1>
        <p className={styles.sub}>
          {catalogue.live === 0 ? 'Nothing is live on the shop, so there is nothing for Google to find yet.'
            : catalogue.listable === catalogue.live
              ? <>All <span data-num>{catalogue.live}</span> products can appear in Google&apos;s shopping results.</>
              : <><span data-num>{catalogue.live - catalogue.listable}</span> of your <span data-num>{catalogue.live}</span> products are invisible to Google until they are finished.</>}
        </p>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroScore}>
          <Ring value={catalogue.listable} total={catalogue.live} />
          <div>
            <p className={styles.heroLabel}>Can appear on Google</p>
            <p className={styles.heroBig}>
              {catalogue.listable === catalogue.live ? 'Every product is ready' : `${catalogue.live - catalogue.listable} to finish`}
            </p>
            {biggest?.n > 0 && (
              <Link className={styles.heroGo} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=all&gap=${biggest.step}`)}>
                {{
                  description: `Write ${biggest.n} ${biggest.n === 1 ? 'description' : 'descriptions'}`,
                  photograph: `Add ${biggest.n} ${biggest.n === 1 ? 'photo' : 'photos'}`,
                  price: `Set ${biggest.n} ${biggest.n === 1 ? 'price' : 'prices'}`,
                }[biggest.key]}
                <Icon name="IconCaret" width="12" height="12" className={styles.right} />
              </Link>
            )}
          </div>
        </div>
        <ul className={styles.gates}>
          {CHECKS.map((c) => {
            const n = blockedBy(c.key);
            return (
              <li key={c.key} className={styles.gate} data-bad={(n > 0 && c.must) || undefined} data-warn={(n > 0 && !c.must) || undefined}>
                <b data-num>{catalogue.live - n}<small>/{catalogue.live}</small></b>
                <span>{c.label}</span>
                <em>{c.must ? 'needed to appear' : 'helps it rank'}</em>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className={styles.listHead}>
          <div>
            <h2 className={styles.h2}>Product by product</h2>
            <p className={styles.sub2}>Press a gap to go straight to it on the product.</p>
          </div>
          {live.length > 10 && (
            <label className={styles.search}>
              <Icon name="IconSearch" width="16" height="16" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find a product" aria-label="Find a product" />
            </label>
          )}
        </div>

        <div className={styles.filters} role="group" aria-label="Show products missing">
          <button type="button" className={styles.filter} aria-pressed={!gap} onClick={() => setGap(null)}>Everything</button>
          {CHECKS.map((c) => {
            const k = blockedBy(c.key);
            return k > 0 && (
              <button key={c.key} type="button" className={styles.filter} data-must={c.must || undefined} aria-pressed={gap === c.key} onClick={() => setGap(gap === c.key ? null : c.key)}>
                No {c.label.toLowerCase()}<span data-num>{k}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.grid}>
          <div className={styles.gridHead}>
            <span>Product</span>
            {CHECKS.map((c) => <span key={c.key} data-must={c.must || undefined}>{c.label}</span>)}
            <span>Google</span>
          </div>
          {hidden.length > 0 && <p className={styles.group} data-tone="hidden">Hidden from Google <span data-num>{hidden.length}</span></p>}
          {hidden.slice(0, shown).map((p, i) => <Row key={p.id} p={p} i={i} />)}
          {hidden.length > shown && (
            <button type="button" className={styles.more} onClick={() => setShown((v) => v + 25)}>
              Show <span data-num>{Math.min(25, hidden.length - shown)}</span> more hidden
            </button>
          )}
          {ready.length > 0 && (
            <button type="button" className={styles.group} data-tone="ready" aria-expanded={openReady} onClick={() => setOpenReady((v) => !v)}>
              <Icon name="IconCheck" width="12" height="12" />Can list <span data-num>{ready.length}</span>
              <Icon name="IconCaret" width="12" height="12" className={styles.groupCaret} />
            </button>
          )}
          {openReady && ready.map((p, i) => <Row key={p.id} p={p} i={i} />)}
          {hidden.length === 0 && ready.length === 0 && <p className={styles.none}>No product matches that.</p>}
        </div>
      </section>

      <Card className={styles.google}>
        <CardHead title="Google search, month by month"
          note={measured.length ? 'Times the shop was shown in results, and how many clicked' : 'Filled in from Google each month'}
          aside={<Tip side="end">From Google Search Console. A month Google could not be read shows as a dashed bar, never as zero, because not knowing and nobody coming are different things.</Tip>} />
        {measured.length === 0 ? (
          <div className={styles.waiting}>
            <div className={styles.waitingText}>
              <p className={styles.waitingTitle}>Not connected to Google yet</p>
              <p>Once the shop is set up in Google Search Console, this fills in each month: how often the shop appeared in results, how many clicked, and the searches that brought them.</p>
              <ol className={styles.setup}>
                <li data-done={catalogue.live > 0 || undefined}><i />Products live on the shop</li>
                <li><i />Shop verified in Search Console</li>
                <li><i />Product list sent to Google</li>
                <li><i />First month of results</li>
              </ol>
            </div>
            <ol className={styles.months} aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <li key={i} className={styles.month}><span className={styles.monthBars}><i className={styles.unknown} style={{ height: `${30 + i * 11}%` }} /></span></li>)}
            </ol>
          </div>
        ) : (
          <div className={styles.googleBody}>
            <div>
              <div className={styles.googleFigures}>
                <p><b data-num>{latest?.impressions ?? 0}</b><span>times shown in {monthName(latest.month).split(' ')[0]}</span></p>
                <p><b data-num>{latest?.clicks ?? 0}</b><span>clicked through{change ? <>, {change.delta >= 0 ? 'up' : 'down'} <span data-num>{Math.abs(change.delta)}</span></> : ''}</span></p>
                {latest?.avg_position != null && <p><b data-num>{Number(latest.avg_position).toFixed(1)}</b><span>average place in results</span></p>}
              </div>
              <Months reports={reports} />
              <p className={styles.key}><i className={styles.shown} />Shown <i className={styles.clicked} />Clicked</p>
            </div>
            <div className={styles.read}>
              {latest?.summary && <><p className={styles.readLabel}>What changed</p><p>{latest.summary}</p></>}
              {latest?.next && <><p className={styles.readLabel}>Before the next one</p><p>{latest.next}</p></>}
              {(latest?.queries ?? []).length > 0 && (
                <>
                  <p className={styles.readLabel}>What people searched to reach you</p>
                  <ul className={styles.queries}>
                    {latest.queries.slice(0, 8).map((q) => (
                      <li key={q.query}><span>{q.query}</span><b data-num>{q.clicks}</b><small data-num>{q.impressions} shown</small></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
