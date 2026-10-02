import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { NewProduct } from '@components/ui/portal/NewProduct';
import { ProductRow } from '@components/ui/portal/ProductRow';
import { ProductSheet } from '@components/ui/portal/product/ProductSheet';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import {
  useCatalogue, categoryCounts, isLive, isReady, isNeedsYou, isBlocked, isArchived, isNewFromEbay,
} from '@hooks/useCatalogue';
import { useKeeper } from '@hooks/useKeeper';
import { KeeperDock } from '@components/ui/portal/KeeperDock';
import { stepsFor, columnsFor, isOpen } from '@lib/readiness';
import { useCategoryNames } from '@hooks/useCategoryNames';
import { sectionOf } from '@utils/categories';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import { unchecked } from '@lib/keeper';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/products-page.module.css';

const FILTERS = [
  { key: 'ready', label: 'Ready', tone: 'info' },
  { key: 'needs', label: 'Needs you', tone: 'warning' },
  { key: 'blocked', label: 'Blocked', tone: 'negative' },
  { key: 'live', label: 'Live', tone: 'positive' },
  { key: 'imported', label: 'New from eBay' },
  { key: 'all', label: 'All' },
  { key: 'archived', label: 'Archived' },
];

const MATCH = {
  live: isLive, archived: isArchived, blocked: isBlocked, needs: isNeedsYou, ready: isReady, imported: isNewFromEbay, all: () => true,
};

// What the biggest gap card says, per step.
const GAP = {
  photo: { all: 'No product has a photograph', one: 'has no photograph', many: 'have no photograph', body: 'Nothing goes live without one.', go: 'Add a photograph to' },
  price: { all: 'No product has a price', one: 'has no price', many: 'have no price', body: 'Nothing goes live without one.', go: 'Price' },
  returns: { all: 'Every product has returns to confirm', one: 'has returns to confirm', many: 'have returns to confirm', body: 'Each one comes with a suggestion, and the customer email quotes the answer.', go: 'Confirm returns on' },
  checks: { all: 'Every product has a question for you', one: 'has a question for you', many: 'have a question for you', body: 'One tap each, then they can go live.', go: 'Answer the question on' },
  hazard: { all: 'Every product needs its label warning', one: 'needs its label warning', many: 'need their label warning', body: 'The warning on the bottle has to show next to the price.', go: 'Add the warning to' },
  stock: { all: 'Everything is off sale', one: 'is off sale', many: 'are off sale', body: 'Marked unavailable, or none left.', go: 'Check stock on' },
  description: { all: 'No product has a description', one: 'has no description', many: 'have no description', body: 'Google will not list a product without one.', go: 'Write one for' },
  section: { all: 'No product is in a section', one: 'is not in a section', many: 'are not in a section', body: 'They sit in Everything else until you place them.', go: 'Place' },
  cost: { all: 'No product has a cost', one: 'has no cost', many: 'have no cost', body: 'Without it nothing here can say what a sale earns you.', go: 'Add a cost to' },
};

// First words of a title, enough to recognise it on a button.
function shortName(title = '') {
  const out = [];
  for (const w of String(title).split(/\s+/)) {
    if (out.join(' ').length + w.length > 20 && out.length) break;
    out.push(w.replace(/,$/, ''));
  }
  return out.join(' ');
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ProductsPage() {
  const [tenant, setTenant] = useState(undefined);
  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const filter = FILTERS.some((f) => f.key === requested) ? requested : 'ready';
  const gapKey = params.get('gap');

  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const catalogue = useCatalogue(tenant?.id);
  const agentName = tenant?.store?.agent?.name || 'Your assistant';
  const { status, rows, counts, reload, publish, unpublish, create } = catalogue;
  const keeper = useKeeper(tenant?.id, { onFinished: reload });

  // Drafts Keeper has not checked, and a check already going: the way into Keeper's office.
  const uncheckedCount = useMemo(() => rows.filter(unchecked).length, [rows]);
  const [keeperRun, setKeeperRun] = useState(null);
  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('keeper_runs').select('id, state, total').eq('tenant_id', tenant.id).in('state', ['running', 'paused'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setKeeperRun(data ?? null), () => setKeeperRun(null));
  }, [tenant?.id]);

  const setView = (next) => {
    const merged = { filter, gap: gapKey, ...next };
    const out = {};
    if (merged.filter && merged.filter !== 'ready') out.filter = merged.filter;
    if (merged.gap) out.gap = merged.gap;
    setParams(out, { replace: true });
  };

  const byCategory = useMemo(() => categoryCounts(rows), [rows]);
  const columns = useMemo(() => columnsFor(rows), [rows]);
  const working = useMemo(() => rows.filter((r) => !isArchived(r)), [rows]);

  const sections = useCategoryNames(tenant?.id);
  // Departments as the shop sees them, including sections she made that are still empty.
  const categories = useMemo(() => sections.departments
    .map((d) => ({ path: d.path, label: d.label, count: d.live })), [sections.departments]);
  const labels = useMemo(() => new Map(categories.map((c) => [c.path, c.label])), [categories]);

  const tally = useMemo(() => {
    const t = { done: 0, wait: 0, check: 0, missing: 0 };
    const byStep = Object.fromEntries(columns.map((c) => [c.key, { done: 0, open: 0, first: null, firstLive: null }]));
    for (const r of working) {
      for (const s of stepsFor(r, columns)) {
        if (s.state === 'none') continue;
        t[s.state] += 1;
        const b = byStep[s.key];
        if (s.state === 'done') b.done += 1;
        else {
          b.open += 1;
          if (!isLive(r) && !b.first) b.first = r.id;
          if (!b.firstLive) b.firstLive = r.id;
        }
      }
    }
    return { ...t, total: t.done + t.wait + t.check + t.missing, byStep };
  }, [working, columns]);

  // A gate step blocking a draft beats a bigger gap on something already live.
  const gap = useMemo(() => {
    const blocking = columns.find((c) => c.gate && tally.byStep[c.key]?.first);
    if (blocking) return { ...blocking, ...tally.byStep[blocking.key], go: tally.byStep[blocking.key].first };
    const widest = [...columns].sort((a, b) => tally.byStep[b.key].open - tally.byStep[a.key].open)[0];
    const s = widest && tally.byStep[widest.key];
    return s?.open ? { ...widest, ...s, go: s.firstLive } : null;
  }, [columns, tally]);

  const visible = useMemo(() => {
    const inFilter = rows.filter(MATCH[filter]);
    if (!gapKey) return inFilter;
    return inFilter.filter((r) => isOpen(stepsFor(r, columns).find((s) => s.key === gapKey)?.state));
  }, [rows, filter, gapKey, columns]);

  const shown = useMemo(() => {
    const out = Object.fromEntries(columns.map((c) => [c.key, { done: 0, open: 0 }]));
    for (const r of visible) {
      for (const st of stepsFor(r, columns)) {
        if (st.state === 'none') continue;
        if (st.state === 'done') out[st.key].done += 1; else out[st.key].open += 1;
      }
    }
    return out;
  }, [visible, columns]);

  const undrafted = useMemo(
    () => rows.filter((r) => picked.has(r.id) && !isArchived(r) && !keeper.stateOf(r.id) && r.derived_fields?.draft?.version !== 2),
    [rows, picked, keeper],
  );

  // A selection carried in from the dashboard's "Draft all" count.
  useEffect(() => {
    if (params.get('select') !== 'nocopy' || rows.length === 0) return;
    setPicked(new Set(rows.filter((r) => !r.description?.trim() && !r.derived_fields?.draft).map((r) => r.id)));
    setParams({ filter: 'all', ...(gapKey ? { gap: gapKey } : {}) }, { replace: true });
  }, [params, rows, setParams, gapKey]);

  // Other pages link straight to a product and a step with ?open=<id>&step=<key>.
  useEffect(() => {
    const id = params.get('open');
    if (!id || rows.length === 0) return;
    if (rows.some((r) => r.id === id)) setOpen({ id, step: params.get('step') });
    const rest = Object.fromEntries([...params.entries()].filter(([k]) => k !== 'open' && k !== 'step'));
    setParams(rest, { replace: true });
  }, [params, rows, setParams]);

  // A selection that survives a filter change publishes things she cannot see.
  useEffect(() => { setPicked(new Set()); }, [filter, gapKey]);

  const select = (id, on) => setPicked((current) => {
    const next = new Set(current);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const pickedLive = rows.filter((r) => picked.has(r.id) && isLive(r));
  const pickedDraft = rows.filter((r) => picked.has(r.id) && !isLive(r) && !isArchived(r));
  const allPicked = visible.length > 0 && visible.every((p) => picked.has(p.id));

  async function fillIn() {
    if (asking) return;
    setAsking(true);
    setFailed(null);
    try {
      await keeper.ask(undrafted.map((p) => p.id), categories);
      setPicked(new Set());
    } catch (e) {
      setFailed(e?.message ?? `${agentName} could not start. Try again.`);
    } finally {
      setAsking(false);
    }
  }

  async function go(fn, ids) {
    setBusy(true);
    setFailed(null);
    try {
      await fn(ids);
      setPicked(new Set());
    } catch (e) {
      setFailed(e?.message ?? 'That did not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const openSheet = useCallback((id, step = null) => setOpen({ id, step }), []);
  const reloadSections = sections.reload;
  const closeSheet = useCallback(() => { setOpen(null); reloadSections(); }, [reloadSections]);
  const openProduct = open && rows.find((r) => r.id === open.id);

  if (tenant === undefined) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The catalogue did not load</h1>
        <p className={styles.failureBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  const gate = columns.filter((c) => c.gate);
  const rest = columns.filter((c) => !c.gate);
  const left = tally.total - tally.done;
  const pct = (n) => `${tally.total ? (n / tally.total) * 100 : 0}%`;
  const filters = FILTERS.filter((f) => (f.key !== 'archived' || counts.archived > 0) && (f.key !== 'imported' || counts.imported > 0));
  const gapCopy = gap && GAP[gap.key];

  const header = (c) => {
    const s = shown[c.key];
    const n = s.done + s.open;
    const on = gapKey === c.key;
    return (
      <button key={c.key} type="button" className={styles.col} data-gap={s.open > 0 || undefined}
        aria-pressed={on} onClick={() => setView({ gap: on ? null : c.key })}
        title={s.open ? `Show the ${s.open} missing ${c.label.toLowerCase()}` : `${c.label}: all done`}>
        <span className={styles.colLabel}>{c.label}</span>
        {n > 0 && (
          <>
            <span className={styles.colTrack}><i style={{ width: `${(s.done / n) * 100}%` }} /></span>
            <span className={styles.colCount} data-num>{s.done}/{n}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Products</h1>
          <p className={styles.sub}>
            {status === 'loading' ? 'Reading the catalogue'
              : `${counts.live} on the shop${counts.ready ? `, ${counts.ready} ready to go live` : ''}${counts.needs ? `, ${counts.needs} with a question for you` : ''}${counts.blocked ? `, ${counts.blocked} blocked` : ''}. `}
            {status === 'ready' && (left
              ? <><span data-num>{left}</span> {left === 1 ? 'step' : 'steps'} from complete.</>
              : 'Every step is done.')}
          </p>
        </div>
        <button type="button" className={styles.quiet} onClick={() => setAdding(true)}>
          <Icon name="IconPlus" width="16" height="16" />
          Add a product
        </button>
      </header>

      {adding && (
        <NewProduct
          categories={categories}
          columns={columns}
          onCancel={() => setAdding(false)}
          onCreate={async (fields) => {
            const id = await create(fields);
            setAdding(false);
            setView({ filter: 'blocked', gap: null });
            if (id) openSheet(id, 'photo');
          }}
        />
      )}

      {status === 'loading' && (
        <div className={styles.summary} aria-hidden="true">
          <div className={styles.progress}>
            <span className={`skeleton ${styles.skFigure}`} />
            <span className={`skeleton ${styles.skMeter}`} />
            <span className={`skeleton skeleton-line ${styles.skLegend}`} />
          </div>
          <div className={styles.next}>
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
            <span className={`skeleton ${styles.skButton}`} />
          </div>
        </div>
      )}

      {status === 'ready' && tally.total > 0 && (
        <section className={styles.summary} aria-label="How complete the catalogue is">
          <div className={styles.progress}>
            <p className="micro">Your catalogue</p>
            <div className={styles.progressBody}>
            <p className={styles.progressLine}>
              <span className={styles.progressFigure} data-num>{tally.done}<small> of {tally.total}</small></span>
              <span className={styles.progressLabel}>steps done across the catalogue</span>
            </p>
            <div className={styles.meter} role="img"
              aria-label={`${tally.done} done, ${tally.wait} waiting for you, ${tally.check} to read, ${tally.missing} missing`}>
              <span data-state="done" style={{ width: pct(tally.done) }} />
              <span data-state="wait" style={{ width: pct(tally.wait) }} />
              <span data-state="check" style={{ width: pct(tally.check) }} />
              <span data-state="missing" style={{ width: pct(tally.missing) }} />
            </div>
            <ul className={styles.legend}>
              <li><StepMark state="done" size="sm" /><b data-num>{tally.done}</b> done</li>
              <li><StepMark state="wait" size="sm" /><b data-num>{tally.wait}</b> waiting for you</li>
              {tally.check > 0 && <li><StepMark state="check" size="sm" /><b data-num>{tally.check}</b> to read</li>}
              <li><StepMark state="missing" size="sm" /><b data-num>{tally.missing}</b> missing</li>
            </ul>
            </div>
          </div>

          {(uncheckedCount > 0 || keeperRun) ? (
            // The assistant can clear most of the gap in one go, so it is the one thing offered.
            <div className={styles.next} data-agent>
              <p className={styles.agentKicker}><Icon name="IconKeeper" className={styles.agentIcon} />{agentName}</p>
              <p className={styles.agentLine}>
                {keeperRun ? `${agentName} is checking your drafts now.` : <><b data-num>{uncheckedCount.toLocaleString('en-GB')}</b> {uncheckedCount === 1 ? 'draft' : 'drafts'} to check</>}
              </p>
              <p className={styles.nextBody}>Returns, label warnings, a clean title and a short address for each, while you watch.</p>
              <div className={styles.nextActions}>
                <Link className={styles.go} to={portalPath('/keeper')}>
                  <Icon name="IconKeeper" className={styles.agentIcon} />
                  {keeperRun ? `See ${agentName} at work` : `Let ${agentName} check them`}
                </Link>
              </div>
            </div>
          ) : gap && gapCopy && (
            <div className={styles.next}>
              <p className="micro">Biggest gap</p>
              <p className={styles.nextBody}>
                <strong>
                  {gap.open === working.length && working.length > 1
                    ? gapCopy.all
                    : `${plural(gap.open, 'product')} ${gap.open === 1 ? gapCopy.one : gapCopy.many}`}.
                </strong>{' '}
                {gapCopy.body}
              </p>
              <div className={styles.nextActions}>
                <button type="button" className={styles.go} onClick={() => openSheet(gap.go, gap.key)}>
                  {gapCopy.go} {shortName(rows.find((r) => r.id === gap.go)?.title)}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Filter products">
          {filters.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key}
              className={styles.tab} onClick={() => setView({ filter: f.key })}>
              {f.tone && <i className={styles.dot} data-tone={f.tone} aria-hidden="true" />}
              {f.label}
              <span className={styles.tabCount} data-num>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {gapKey && (
          <span className={styles.gapChip}>
            Missing {columns.find((c) => c.key === gapKey)?.label.toLowerCase()}, <span data-num>{visible.length}</span>
            <button type="button" aria-label="Show every step" onClick={() => setView({ gap: null })}>
              <Icon name="IconX" width="12" height="12" />
            </button>
          </span>
        )}

        <span className={styles.help}>
          How to read this
          <Tip label="How to read the grid" side="end">
            Each square is one step. The first group has to be done before a product can go live; the second
            finishes the record. Press a square to go straight to it, or a column heading to see only the gaps.
          </Tip>
        </span>
      </div>

      {failed && picked.size === 0 && <p className={styles.error} role="alert">{failed}</p>}

      <div className={styles.ledger} style={{ '--gate': gate.length, '--rest': rest.length }}>
        <div className={styles.cols}>
          <label className={styles.all}>
            <input type="checkbox" checked={allPicked} disabled={visible.length === 0}
              onChange={(e) => setPicked(e.target.checked ? new Set(visible.map((p) => p.id)) : new Set())} />
            <span className="visually-hidden">Select every product shown</span>
          </label>
          <span className={styles.colName}>Product</span>
          <span className={`${styles.colName} ${styles.colPrice}`}>Price</span>
          <span className={styles.group} style={{ gridColumn: `4 / span ${gate.length}` }}>To go live</span>
          <span className={styles.group} style={{ gridColumn: `${5 + gate.length} / span ${rest.length}` }}>To finish</span>
          {gate.map(header)}
          <span className={styles.divider} aria-hidden="true" />
          {rest.map(header)}
        </div>

        {status === 'loading' && [0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.ghost} aria-hidden="true">
            <span /><span className={styles.ghostName}><i className="skeleton" /><span className="skeleton skeleton-line" /></span>
            <span />{gate.map((c) => <span key={c.key} className={`${styles.ghostCell} skeleton`} />)}<span />{rest.map((c) => <span key={c.key} className={`${styles.ghostCell} skeleton`} />)}
          </div>
        ))}

        {status === 'ready' && visible.map((product, i) => (
          <ProductRow key={product.id} index={i} product={product} columns={columns}
            where={labels.get(sectionOf(product)) ?? 'Odds and ends'} keeper={keeper.stateOf(product.id)} agent={agentName}
            selected={picked.has(product.id)} onSelect={select} onOpen={openSheet} />
        ))}

        {status === 'ready' && visible.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.ghosts} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.ghost}>
                  <span /><span className={styles.ghostName}><i /><span /></span>
                  <span />{gate.map((c) => <span key={c.key} className={styles.ghostCell} />)}<span />{rest.map((c) => <span key={c.key} className={styles.ghostCell} />)}
                </div>
              ))}
            </div>
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>{EMPTY[gapKey ? 'gap' : filter].title}</h2>
              <p className={styles.emptyBody}>{EMPTY[gapKey ? 'gap' : filter].body(counts)}</p>
              <div className={styles.emptyActions}>
                {gapKey
                  ? <button type="button" className={styles.quiet} onClick={() => setView({ gap: null })}>Show every step</button>
                  : <button type="button" className={styles.quiet} onClick={() => setAdding(true)}>
                    <Icon name="IconPlus" width="16" height="16" />Add a product
                  </button>}
                {!gapKey && filter !== 'live' && counts.live > 0 && (
                  <button type="button" className={styles.link} onClick={() => setView({ filter: 'live' })}>
                    See the {plural(counts.live, 'live one', 'live ones')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <KeeperDock keeper={keeper} agent={agentName} titleOf={(id) => rows.find((r) => r.id === id)?.title}
        onOpen={(id) => openSheet(id, 'checks')} onRetry={(ids) => keeper.ask(ids, categories)}>
      {picked.size > 0 && (
        <div className={styles.selection} role="region" aria-label="Selected products">
          <span className={styles.selCount}><b data-num>{picked.size}</b> selected</span>
          {undrafted.length > 0 && (
            <button type="button" className={styles.selButton} disabled={busy || asking} onClick={fillIn}>
              {asking ? `Handing over to ${agentName}` : `Fill in ${plural(undrafted.length, 'product')} with ${agentName}`}
            </button>
          )}
          {pickedLive.length > 0 && (
            <button type="button" className={styles.selButton} disabled={busy}
              onClick={() => go(unpublish, pickedLive.map((p) => p.id))}>
              Take {pickedLive.length} off the shop
            </button>
          )}
          {pickedDraft.length > 0 && (
            <button type="button" className={styles.selGo} disabled={busy}
              onClick={() => go(publish, pickedDraft.map((p) => p.id))}>
              Take {pickedDraft.length} live
            </button>
          )}
          <button type="button" className={styles.selClear} aria-label="Clear the selection" onClick={() => setPicked(new Set())}>
            <Icon name="IconX" width="16" height="16" />
          </button>
          {failed && <p className={styles.selError} role="alert">{failed}</p>}
        </div>
      )}
      </KeeperDock>

      {openProduct && (
        <ProductSheet
          key={openProduct.id}
          product={openProduct}
          focus={open.step}
          onClose={closeSheet}
          catalogue={catalogue}
          categories={categories}
          categoryCount={byCategory.get(sectionOf(openProduct)) ?? 0}
          fees={tenant?.fees}
          tenantId={tenant?.id}
          returnDays={Number(tenant?.store?.returns?.days) || null}
          agent={agentName}
          keeper={keeper}
          onCreateSection={async (name) => { const path = await sections.create(name); return path; }}
        />
      )}
    </div>
  );
}

const EMPTY = {
  ready: {
    title: 'Nothing is waiting to go live',
    body: (c) => (c.blocked
      ? `${plural(c.blocked, 'product is', 'products are')} blocked on a step. A product arrives here once the first group of squares is done.`
      : `${c.live ? `All ${c.live} of your products are on the shop. ` : ''}A new one arrives here once the first group of squares is done.`),
  },
  imported: {
    title: 'Nothing new from eBay',
    body: () => 'Listings you bring over from the eBay Traffic page wait here until they go live.',
  },
  needs: {
    title: 'Nothing is waiting on you',
    body: () => 'Products land here when the only thing left is a question for you.',
  },
  blocked: {
    title: 'Nothing is blocked',
    body: () => 'Every draft has what it needs to go live.',
  },
  live: {
    title: 'Nothing is on the shop yet',
    body: (c) => (c.ready ? `${plural(c.ready, 'product is', 'products are')} ready. Tick them under Ready and take them live.` : 'Products appear here once you take them live.'),
  },
  all: { title: 'No products yet', body: () => 'Add the first one and it lands under Blocked until it has a photograph.' },
  archived: { title: 'Nothing archived', body: () => 'Products you take out for good are kept here, with the reason.' },
  gap: { title: 'No gaps in this column', body: () => 'Every product shown has this step done.' },
};
