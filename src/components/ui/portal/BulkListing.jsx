import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { ebayRequest, lastDay, reasons, startQuantity } from '@lib/bulk';
import sheet from '@styles/ui/portal/product-sheet.module.css';
import styles from '@styles/ui/portal/bulk-listing.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const day = (d) => d?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// eBay is asked about this many cards at once: quick enough for forty, gentle on its limits for three hundred.
const AT_ONCE = 3;

/*
 * The bar along the bottom once she ticks cards. It says, per channel, how many of them can go and why the rest
 * cannot, so a bulk action never leaves a card behind without a reason.
 */
export function BulkBar({ count, ebay, shop, adding, onEbay, onShop, onStop, onClear }) {
  const outEbay = reasons(ebay.out);
  const outShop = reasons(shop.out);
  // Three reasons at most, then the rest as a count of cards, so the bar stays one line on a laptop.
  const said = (out) => {
    const shown = out.length > 3 ? out.slice(0, 2) : out;
    const rest = out.slice(shown.length).reduce((n, r) => n + r.count, 0);
    return shown.map((r) => `${r.why.charAt(0).toLowerCase()}${r.why.slice(1)} (${r.count})`).join(', ')
      + (rest ? `, and ${rest} for other reasons` : '');
  };

  return (
    <div className={styles.bar} role="region" aria-label="Selected cards">
      {adding ? (
        <>
          <span className={styles.barCount}>Adding <span data-num>{adding.done}</span> of <span data-num>{adding.total}</span> to your shop</span>
          <span className={styles.barTrack} aria-hidden="true"><i style={{ width: `${(adding.done / adding.total) * 100}%` }} /></span>
          <button type="button" className={styles.barQuiet} onClick={onStop}>Stop</button>
        </>
      ) : (
        <>
          <span className={styles.barCount}><span data-num>{count}</span> selected</span>
          <button type="button" className={`${styles.barQuiet} ${styles.barGo}`} disabled={!shop.in.length} onClick={onShop}>
            <Icon name="IconShop" className={styles.barIcon} />
            {shop.in.length ? `Add ${shop.in.length} to your shop` : 'None for your shop'}
          </button>
          <button type="button" className={`${styles.barMain} ${styles.barGo}`} disabled={!ebay.in.length} onClick={onEbay}>
            <Icon name="IconTag" className={styles.barIcon} />
            {ebay.in.length ? `Check and list ${ebay.in.length} on eBay` : 'None for eBay'}
          </button>
          <button type="button" className={`${styles.barQuiet} ${styles.barClear}`} onClick={onClear}>Clear</button>
          {(outEbay.length > 0 || outShop.length > 0) && (
            <span className={styles.barWhy}>
              {outEbay.length > 0 && <span>Left out of eBay: {said(outEbay)}.</span>}
              {outShop.length > 0 && <span>Left out of your shop: {said(outShop)}.</span>}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/*
 * Before anything is queued, eBay checks each card the way it checks one on its own: the category it would file it
 * under, the item details it needs, anything that stops it. She sees every answer, chooses the category where the
 * card and eBay disagree, fills in a missing detail where she stands, and queues only what passed, strongest first,
 * within what is left of the month.
 */
export function ListSheet({ items, ahead, check, onAspects, onQueue, onHeld, onClose }) {
  const [results, setResults] = useState({});
  const [working, setWorking] = useState(0);
  const [queueing, setQueueing] = useState(false);
  const [problem, setProblem] = useState(null);
  const closeRef = useRef(null);
  // The check runs as a small pool: cards waiting their turn, how many are being asked about, and whether she stopped.
  const todo = useRef([]);
  const workers = useRef(0);
  const stopped = useRef(false);
  // Bumped when the sheet closes, so a worker still waiting on eBay from before ends quietly.
  const gen = useRef(0);
  // What she changed here, per card, on top of what it would send: a category, item details.
  const extra = useRef({});

  // What each card would send from her saved draft, so the check and the queue carry the same thing.
  const requests = useMemo(() => Object.fromEntries(items.map(({ row, a }) => [
    row.id, ebayRequest(a, row.draft ?? {}, { quantity: startQuantity(row) }),
  ])), [items]);
  const requestFor = (id) => ({ ...requests[id], ...extra.current[id] });
  const byId = useMemo(() => Object.fromEntries(items.map((x) => [x.row.id, x])), [items]);

  async function worker() {
    const mine = gen.current;
    const live = () => gen.current === mine;
    workers.current += 1;
    setWorking(workers.current);
    while (live() && !stopped.current && todo.current.length) {
      const id = todo.current.shift();
      setResults((r) => ({ ...r, [id]: { ...r[id], status: 'checking' } }));
      try {
        const dry = await check(id, requestFor(id));
        if (!live()) return;
        setResults((r) => {
          const was = r[id] ?? {};
          // The first answer holds the choice: once she picks, the category is hers and eBay stops disagreeing.
          const first = was.first ?? (dry.category_differs && dry.suggested ? { card: dry.category, ebay: dry.suggested } : null);
          return { ...r, [id]: { ...was, status: dry.problems?.length ? 'held' : 'ok', dry, first, use: was.use ?? 'card', error: null } };
        });
      } catch (e) {
        if (!live()) return;
        setResults((r) => ({ ...r, [id]: { ...r[id], status: 'error', error: e.message } }));
      }
    }
    if (!live()) return;
    workers.current -= 1;
    setWorking(workers.current);
  }

  const ask = (ids) => {
    stopped.current = false;
    todo.current = [...todo.current, ...ids.filter((id) => !todo.current.includes(id))];
    setResults((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, { ...r[id], status: 'waiting' }])) }));
    while (workers.current < Math.min(AT_ONCE, todo.current.length + workers.current) && workers.current < AT_ONCE) worker();
  };

  useEffect(() => {
    closeRef.current?.focus();
    ask(items.map(({ row }) => row.id));
    return () => { gen.current += 1; todo.current = []; workers.current = 0; };
    // Asked once, when the sheet opens. After that each card is asked again only when she changes it.
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !queueing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, queueing]);

  const running = working > 0;
  const answered = items.filter(({ row }) => ['ok', 'held', 'error'].includes(results[row.id]?.status)).length;
  const unchecked = items.length - answered;
  // Her limits as eBay's function counts them; any answer carries them.
  const limits = Object.values(results).find((r) => r.dry?.limits)?.dry.limits ?? null;
  const room = limits ? Math.max(0, limits.monthLeft - ahead) : null;

  // Passed, in the page's order, which is strongest first; past what the month has left, they wait for next month.
  const passed = items.filter(({ row }) => results[row.id]?.status === 'ok');
  const going = room == null ? passed : passed.slice(0, room);
  const goingIds = new Set(going.map(({ row }) => row.id));
  const held = items.filter(({ row }) => ['held', 'error'].includes(results[row.id]?.status));
  const differ = items.filter(({ row }) => results[row.id]?.first);
  const when = limits ? lastDay(going.length, { daily: limits.daily, todayLeft: Math.max(0, limits.daily - limits.dayUsed), ahead }) : null;

  // Another category can need other details, so a card she moves is asked again.
  const choose = (ids, use) => {
    const moved = ids.filter((id) => results[id]?.first && results[id].use !== use);
    if (!moved.length) return;
    for (const id of moved) {
      const f = results[id].first;
      extra.current[id] = { ...extra.current[id], category_id: (use === 'ebay' ? f.ebay : f.card).id };
    }
    setResults((r) => ({ ...r, ...Object.fromEntries(moved.map((id) => [id, { ...r[id], use }])) }));
    ask(moved);
  };

  const fill = (id, name, value) => setResults((r) => ({ ...r, [id]: { ...r[id], fill: { ...(r[id].fill ?? {}), [name]: value } } }));

  // The details she filled in go on her draft, as they would from the card, then eBay is asked again.
  async function saveDetails(id) {
    const r = results[id];
    const aspects = { ...(byId[id].row.draft?.aspects ?? {}), ...(extra.current[id]?.aspects ?? {}), ...r.fill };
    setResults((x) => ({ ...x, [id]: { ...x[id], saving: true, error: null } }));
    try {
      await onAspects(id, aspects);
      extra.current[id] = { ...extra.current[id], aspects };
      setResults((x) => ({ ...x, [id]: { ...x[id], saving: false, fill: {} } }));
      ask([id]);
    } catch (e) {
      setResults((x) => ({ ...x, [id]: { ...x[id], saving: false, error: e.message } }));
    }
  }

  async function queue() {
    setQueueing(true);
    setProblem(null);
    try {
      await onQueue(going.map(({ row }) => {
        const req = requestFor(row.id);
        const categoryId = req.category_id ?? results[row.id].dry.category?.id ?? null;
        return { candidateId: row.id, request: { ...req, ...(categoryId ? { category_id: categoryId } : {}) } };
      }));
    } catch (e) {
      setProblem(e.message);
      setQueueing(false);
    }
  }

  const status = running
    ? `Checking with eBay, ${answered} of ${items.length}.`
    : [
      going.length ? `${plural(going.length, 'goes', 'go')} in the queue.` : 'Nothing has passed eBay\'s check yet.',
      held.length ? `${held.length} held back.` : '',
      unchecked ? `${unchecked} not checked.` : '',
      room != null && passed.length > going.length ? `${passed.length - going.length} wait for next month's limit.` : '',
      when && going.length ? `At up to ${limits.daily} a day, the last should go up ${sameDay(when) ? 'today' : `around ${day(when)}`}.` : '',
    ].filter(Boolean).join(' ');

  return (
    <>
      <div className={sheet.scrim} onClick={() => !queueing && onClose()} aria-hidden="true" />
      <div className={sheet.sheet} role="dialog" aria-modal="true" aria-labelledby="list-sheet-title">
        <header className={`${sheet.top} ${styles.top}`}>
          <button ref={closeRef} type="button" className={sheet.close} onClick={onClose} disabled={queueing} aria-label="Close">
            <Icon name="IconX" width="18" height="18" />
          </button>
          <p className="micro">eBay</p>
          <h2 id="list-sheet-title" className={styles.title}>List {items.length} on eBay</h2>
          <p className={styles.lead}>
            eBay checks each one first: the category it would file it under, the details it needs, and anything that
            stops it. Nothing goes up until you queue them, and the queue lists them at your daily pace, with the
            portal closed or open.
          </p>
          <div className={styles.progress} aria-hidden="true">
            <i style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }} data-done={(!running && !unchecked) || undefined} />
          </div>
          {limits && (
            <p className={styles.limits}>
              This month: <b data-num>{limits.monthUsed}</b> of <span data-num>{limits.monthly}</span> listed
              {ahead > 0 && <>, <b data-num>{ahead}</b> already waiting</>}.
              Room for <b data-num>{room}</b> more.
            </p>
          )}
        </header>

        <div className={`${sheet.body} ${styles.body}`}>
          {differ.length > 1 && (
            <div className={styles.differ}>
              <Icon name="IconInfo" className={styles.differIcon} />
              <span>For {differ.length} of these, eBay would choose a different category from the title. The card's is where the listing that proves the market sits.</span>
              <button type="button" className={styles.pill} onClick={() => choose(differ.map(({ row }) => row.id), 'ebay')}>Use eBay's for all {differ.length}</button>
              <button type="button" className={styles.pill} onClick={() => choose(differ.map(({ row }) => row.id), 'card')}>Keep the cards'</button>
            </div>
          )}

          <ol className={styles.rows}>
            {items.map(({ row, a }) => {
              const r = results[row.id] ?? { status: 'waiting' };
              const d = r.dry;
              const name = row.draft?.title || a.title;
              const image = (row.draft?.images ?? [])[0] ?? row.draft?.catalogue?.images?.[0] ?? null;
              const tone = r.status === 'ok' && !goingIds.has(row.id) ? 'wait' : r.status;
              const missing = r.status === 'held' ? d.missing ?? [] : [];
              // eBay's other reasons, beyond the details asked for below.
              const others = r.status === 'held' ? d.problems.filter((x) => !missing.some((m) => x.includes(m.name))) : [];
              const filled = missing.every((m) => (r.fill?.[m.name] ?? '').trim());
              return (
                <li key={row.id} className={styles.row} data-status={tone}>
                  {image ? <img className={styles.thumb} src={thumb(image)} alt="" loading="lazy" /> : <span className={styles.thumb} aria-hidden="true" />}
                  <div className={styles.what}>
                    <span className={styles.name}>{name}</span>
                    {r.first ? (
                      <span className={styles.choice} role="radiogroup" aria-label={`Category for ${name}`}>
                        {[['card', r.first.card, 'The card\'s'], ['ebay', r.first.ebay, 'eBay\'s']].map(([key, cat, label]) => (
                          <button key={key} type="button" role="radio" aria-checked={r.use === key} disabled={r.status === 'checking'}
                            className={styles.option} onClick={() => choose([row.id], key)}>
                            <span className={styles.optionLabel}>{label}</span>{cat.name ?? `#${cat.id}`}
                          </button>
                        ))}
                      </span>
                    ) : d?.category ? (
                      <span className={styles.cat}>{d.category.name ?? `#${d.category.id}`}{d.image_source === 'catalogue' ? ', eBay\'s catalogue photos' : ''}</span>
                    ) : (
                      <span className={styles.cat}>{r.status === 'checking' ? 'Checking' : 'Waiting to check'}</span>
                    )}
                    {others.map((x) => <span key={x} className={styles.why}>{x}</span>)}
                    {missing.length > 0 && (
                      <div className={styles.details}>
                        <span className={styles.detailsHead}>eBay needs {missing.length === 1 ? 'this' : 'these'} for the category</span>
                        {missing.map((m) => {
                          const v = r.fill?.[m.name] ?? '';
                          const id = `${row.id}-${m.name}`;
                          return (
                            <label key={m.name} className={styles.detail}>
                              <span>{m.name}</span>
                              {m.mode === 'SELECTION_ONLY' && m.values?.length ? (
                                <select value={v} onChange={(e) => fill(row.id, m.name, e.target.value)}>
                                  <option value="">Choose</option>
                                  {m.values.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>
                              ) : (
                                <>
                                  <input value={v} list={id} onChange={(e) => fill(row.id, m.name, e.target.value)} />
                                  {m.values?.length > 0 && <datalist id={id}>{m.values.map((x) => <option key={x} value={x} />)}</datalist>}
                                </>
                              )}
                            </label>
                          );
                        })}
                        <button type="button" className={styles.pill} disabled={!filled || r.saving} onClick={() => saveDetails(row.id)}>
                          {r.saving ? 'Saving' : 'Save and check again'}
                        </button>
                      </div>
                    )}
                    {r.status === 'error' && <span className={styles.why}>Could not check: {r.error}</span>}
                    {r.status !== 'error' && r.error && <span className={styles.why}>{r.error}</span>}
                  </div>
                  <span className={styles.price} data-num>{formatGbp(requests[row.id].price)}</span>
                  <span className={styles.state}>
                    <i aria-hidden="true" />
                    {{ waiting: 'Waiting', checking: 'Checking', ok: 'Goes in the queue', held: 'Held back', error: 'Not checked', wait: 'Next month' }[tone]}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <footer className={`${sheet.foot} ${styles.foot}`}>
          <p className={sheet.status} role="status" aria-live="polite">
            {problem ? <span className={sheet.failed}>{problem}</span> : status}
          </p>
          {running ? (
            <button type="button" className={styles.ghost} onClick={() => { stopped.current = true; todo.current = []; }}>Stop checking</button>
          ) : unchecked > 0 ? (
            <button type="button" className={styles.ghost}
              onClick={() => ask(items.filter(({ row }) => !['ok', 'held', 'error'].includes(results[row.id]?.status)).map(({ row }) => row.id))}>
              Check the other {unchecked}
            </button>
          ) : held.length > 0 && (
            <button type="button" className={styles.ghost} onClick={() => onHeld(held.map(({ row }) => row.id))}>Show the {held.length} held</button>
          )}
          <button type="button" className={styles.primary} disabled={running || queueing || !going.length} onClick={queue}>
            {queueing ? 'Queueing' : going.length ? `Queue ${going.length} for eBay` : 'Queue for eBay'}
          </button>
        </footer>
      </div>
    </>
  );
}

const sameDay = (d, now = new Date()) => d.toDateString() === now.toDateString();
