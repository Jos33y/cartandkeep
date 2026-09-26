import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { STATUS_PHASES, SUPERSEDED_LABEL, lastUpdated } from '@data/statusItems';
import { DELIVERABLES, DELIVERABLE_GROUPS, committedItems, tally } from '@data/deliverables';
import { StatusHeader, portalHref } from '@components/layout/status/StatusHeader';
import { StateIcon } from '@components/status/StateIcon';
import { ScopeCupboard } from '@components/status/ScopeCupboard';
import { DeliveryTrack } from '@components/status/DeliveryTrack';
import { useStatusLastVisit } from '@hooks/useStatusLastVisit';
import styles from '@styles/pages/status/status-page.module.css';

// What it does for her business first: the shop she sells through before the plumbing under it.
const ORDER = ['store', 'shopfloor', 'ebay', 'research', 'portal', 'reporting', 'foundations'];

// Top shelf first and set apart: month two is not part of the 42.
const SHELVES = [
  { key: 'early', label: 'Month two, early', apart: true },
  { key: 'month-one', label: 'Month one' },
  { key: 'seo', label: 'SEO' },
  { key: 'analytics', label: 'Analytics' },
];

const TZ = 'Europe/London';
const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(new Date(`${iso}T12:00:00Z`));
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const sentence = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

function Row({ item, isNew, side }) {
  return (
    <li className={`${styles.row} ${item.superseded ? styles.rowOld : ''}`}>
      <StateIcon state={item.state === 'done' ? 'done' : 'queued'} className={styles.icon} />
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>
          {item.label}
          {isNew && <span className={styles.new}>New</span>}
          {item.superseded && <span className={styles.tag}>{SUPERSEDED_LABEL}</span>}
        </span>
        {item.detail && <span className={styles.rowDetail}>{sentence(item.detail)}</span>}
      </span>
      <span className={styles.rowSide}>{side}</span>
    </li>
  );
}

export function StatusPage() {
  const lastVisit = useStatusLastVisit();
  const seen = lastVisit ? dayKey(lastVisit) : null;
  const isNew = (item) => Boolean(seen && item.state === 'done' && item.date && item.date > seen);

  const scope = tally();
  const shelves = SHELVES.map((s) => ({ ...s, items: DELIVERABLE_GROUPS.find((g) => g.key === s.key)?.items ?? [] }))
    .filter((s) => s.items.length);
  const waiting = DELIVERABLES.filter((i) => i.state === 'client');
  const byHer = DELIVERABLE_GROUPS.find((g) => g.key === 'with-you')?.items.filter((i) => i.state === 'done') ?? [];
  const notYet = committedItems().filter((i) => i.state !== 'done');
  const updated = lastUpdated();

  const phases = ORDER.map((key) => STATUS_PHASES.find((p) => p.key === key)).filter(Boolean)
    .map((p) => ({
      ...p,
      done: p.items.filter((i) => i.state === 'done').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }))
    .filter((p) => p.done.length);

  const allDone = phases.flatMap((p) => p.done);
  const [current, setCurrent] = useState(phases[0]?.key);

  useEffect(() => {
    const nodes = phases.map((p) => document.getElementById(`delivered-${p.key}`)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setCurrent(top.target.id.replace('delivered-', ''));
    }, { rootMargin: '-80px 0px -65% 0px' });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [phases.length]);

  const jump = (e, id) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className={styles.page}>
      <StatusHeader on="status" />

      <section className={styles.hero} aria-labelledby="status-title">
        <div className={styles.heroText}>
          <div className={styles.heroTop}>
            <p className={styles.eyebrow}>Delivery status</p>
            {updated && <p className={styles.updated}>Updated {fmt(updated, { day: 'numeric', month: 'long' })}</p>}
          </div>
          <h1 id="status-title" className={styles.title}>
            <span className={styles.titleFigure}>{scope.done} of {scope.total}</span> delivered.
          </h1>
          <p className={styles.lead}>Every filled box works today. The top shelf is month two, done early.</p>
          {waiting.length > 0 && (
            <a className={styles.waitingLink} href="#waiting" onClick={(e) => jump(e, 'waiting')}>
              <span className={styles.waitingDot} aria-hidden="true" />
              {waiting.length} waiting on you
            </a>
          )}
        </div>
        <div className={styles.heroArt}>
          <ScopeCupboard shelves={shelves} isNew={isNew} />
          <p className={styles.legend} aria-hidden="true">
            <span className={styles.keyFilled} /> Delivered
            <span className={styles.keyEmpty} /> Not yet
          </p>
        </div>
      </section>

      {waiting.length > 0 && (
        <section id="waiting" className={styles.waiting} aria-labelledby="waiting-title">
          <header className={styles.sectionHead}>
            <h2 id="waiting-title" className={styles.sectionTitle}>Waiting on you</h2>
          </header>
          <ol className={styles.tasks}>
            {waiting.map((item, i) => (
              <li key={item.label} className={styles.task}>
                <span className={styles.taskNo} data-num>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.taskMain}>
                  <span className={styles.taskLabel}>{item.label}</span>
                  <span className={styles.taskDetail}>{item.detail}</span>
                </span>
                {item.screen && (
                  <a className={styles.taskLink} href={portalHref(item.screen)}>
                    Open in the portal
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>
                  </a>
                )}
              </li>
            ))}
          </ol>

          {byHer.length > 0 && (
            <div className={styles.byHer}>
              <p className={styles.byHerTitle}>Done by you</p>
              <ul className={styles.byHerList}>
                {byHer.map((item) => (
                  <li key={item.label} title={item.detail}>
                    <StateIcon state="done" className={styles.byHerIcon} />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className={styles.delivered}>
        <nav className={styles.index} aria-label="Delivered">
          <p className={styles.indexTitle}>Delivered</p>
          <ul className={styles.indexList}>
            {phases.map((p) => {
              const fresh = p.done.filter(isNew).length;
              return (
                <li key={p.key}>
                  <a href={`#delivered-${p.key}`} onClick={(e) => jump(e, `delivered-${p.key}`)}
                    aria-current={current === p.key ? 'true' : undefined}
                    className={`${styles.indexLink} ${current === p.key ? styles.indexOn : ''}`}>
                    <span className={styles.indexLabel}>{p.label}</span>
                    {fresh > 0 && <span className={styles.indexNew} title={`${fresh} new since your last visit`}>{fresh} new</span>}
                    <span className={styles.indexCount} data-num>{p.done.length}</span>
                  </a>
                </li>
              );
            })}
            {notYet.length > 0 && (
              <li>
                <a href="#not-yet" onClick={(e) => jump(e, 'not-yet')} className={`${styles.indexLink} ${styles.indexNotYet}`}>
                  <span className={styles.indexLabel}>Not yet</span>
                  <span className={styles.indexCount} data-num>{notYet.length}</span>
                </a>
              </li>
            )}
          </ul>
        </nav>

        <div className={styles.groups}>
          <section className={styles.arrived} aria-labelledby="arrived-title">
            <h2 id="arrived-title" className={styles.arrivedTitle}>When it arrived</h2>
            <DeliveryTrack items={allDone} lastVisit={lastVisit} />
          </section>

          {phases.map((p) => (
            <section key={p.key} id={`delivered-${p.key}`} className={styles.group} aria-labelledby={`h-${p.key}`}>
              <header className={styles.groupHead}>
                <h2 id={`h-${p.key}`} className={styles.groupTitle}>{p.label}</h2>
                <span className={styles.groupCount} data-num>{p.done.length}</span>
                {p.purpose && <p className={styles.groupPurpose}>{p.purpose}</p>}
              </header>
              <ul className={styles.list}>
                {p.done.map((item) => (
                  <Row key={item.label} item={item} isNew={isNew(item)}
                    side={item.date
                      ? <time className={styles.rowDate} dateTime={item.date}>{fmt(item.date, { day: 'numeric', month: 'short' })}</time>
                      : <span className={styles.rowDate}>Delivered</span>} />
                ))}
              </ul>
            </section>
          ))}

          {notYet.length > 0 && (
            <section id="not-yet" className={`${styles.group} ${styles.notYet}`} aria-labelledby="h-not-yet">
              <header className={styles.groupHead}>
                <h2 id="h-not-yet" className={styles.groupTitle}>Not yet</h2>
                <span className={styles.groupCount} data-num>{notYet.length}</span>
                <p className={styles.groupPurpose}>From the signed scope, with the one thing each is waiting on.</p>
              </header>
              <ul className={styles.list}>
                {notYet.map((item) => (
                  <li key={item.label} className={styles.notRow}>
                    <StateIcon state="queued" className={styles.icon} />
                    <span className={styles.rowMain}>
                      <span className={styles.rowLabel}>{item.label}</span>
                      {item.why && <span className={styles.why}>{item.why}</span>}
                    </span>
                    <span className={styles.rowSide}><span className={styles.rowGroup}>{item.group}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <Link className={styles.scope} to="/deliverables">
        <span>See the signed scope, item by item</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>
      </Link>

      <footer className={styles.foot}>
        <span>Built by The Brick Dev Studios</span>
        <a className={styles.footLink} href="mailto:hello@thebrickdev.com">hello@thebrickdev.com</a>
      </footer>
    </div>
  );
}
