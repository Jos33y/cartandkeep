import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  STATUS_ITEMS,
  STATE_LABEL,
  SUPERSEDED_LABEL,
  activeItems,
  upcomingPhases,
  completedByMonth,
  nextDated,
  lastUpdated,
} from '@data/statusItems';
import { LogoMark } from '@components/ui/shared/Logo';
import { StateIcon } from '@components/status/StateIcon';
import styles from '@styles/pages/status/status-page.module.css';

const NAV_THRESHOLD = 20;

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts }).format(new Date(`${iso}T12:00:00Z`));

// Same host, different subdomain. Hardcoding cartandkeep.com would break for
// the next tenant, and dev serves all three from one document.
function portalUrl() {
  if (typeof window === 'undefined') return '/';
  const { protocol, hostname } = window.location;
  if (hostname.startsWith('status.')) {
    return `${protocol}//${hostname.replace(/^status\./, 'portal.')}`;
  }
  return '/?portal';
}

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 16 16" className={`${styles.chev} ${open ? styles.chevOpen : ''}`} aria-hidden="true">
      <path d="M4 6.5L8 10.5 12 6.5" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Row({ item, showPhase = false, showDate = false }) {
  return (
    <li className={`${styles.row} ${item.superseded ? styles.rowOld : ''}`}>
      <StateIcon state={item.state} className={styles.icon} pulseClass={styles.pulse} />
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>
          {item.label}
          {item.superseded ? <span className={styles.tag}>{SUPERSEDED_LABEL}</span> : null}
        </span>
        {item.detail ? <span className={styles.rowDetail}>{item.detail}</span> : null}
        {item.due ? <span className={styles.rowDue}>{item.due}</span> : null}
        {showPhase ? <span className={styles.rowPhase}>{item.phase}</span> : null}
      </span>
      <span className={styles.rowState}>
        {showDate && item.date ? (
          <span className={styles.rowDate}>{fmt(item.date, { day: '2-digit', month: 'short' })}</span>
        ) : (
          <span className={`${styles.stateText} ${styles[item.state] ?? ''}`.trim()}>{STATE_LABEL[item.state]}</span>
        )}
      </span>
    </li>
  );
}

export function StatusPage() {
  const [openHistory, setOpenHistory] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [current, setCurrent] = useState('now');

  // Work whose method has since been replaced is delivered, and it is not
  // part of what is live, so it is counted separately rather than inflating
  // the bar she reads.
  const live = STATUS_ITEMS.filter((i) => !i.superseded);
  const replaced = STATUS_ITEMS.length - live.length;
  const done = live.filter((i) => i.state === 'done').length;
  const total = live.length;
  const running = activeItems();
  const upcoming = upcomingPhases();
  const history = completedByMonth();
  const next = nextDated();
  const updated = lastUpdated();
  const queued = total - done - running.length;
  const pct = Math.round((done / total) * 100);

  const visibleHistory = showAllMonths ? history : history.slice(0, 1);
  const hiddenMonths = history.length - visibleHistory.length;

  // Chrome earns its place by length. Below this the whole page is one screen.
  const showNav = total > NAV_THRESHOLD;

  const sections = [
    { id: 'now', label: 'In progress', count: running.length },
    { id: 'next', label: 'Coming up', count: queued },
    { id: 'done', label: 'Completed', count: done },
  ].filter((s) => s.count > 0);

  useEffect(() => {
    if (!showNav) return;
    const nodes = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setCurrent(seen[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [showNav, sections.length]);

  function jump(e, id) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        {/* The real mark, not the letter C placeholder that had been here
            since July. Pure path data, so it needs no font and cannot flash a
            fallback. 32px, because below that it switches to the solid variant
            and this header has the room. */}
        <LogoMark size={32} className={styles.mark} />
        <span className={styles.wordmark}>Cart &amp; Keep</span>
        <Link className={styles.headLink} to="/deliverables">Deliverables</Link>
        <a className={styles.signIn} href={portalUrl()}>Sign in</a>
      </header>

      <section className={styles.hero}>
        <p className={styles.verdict}>
          <StateIcon state={running.length ? 'active' : 'queued'} className={styles.verdictIcon}
            pulseClass={styles.pulse} />
          <span>{running.length ? 'Build in progress' : 'No work in progress'}</span>
        </p>

        {next ? (
          <p className={styles.next}>
            Next up, {next.label.toLowerCase()}
            <span className={styles.nextDue}>{next.due}</span>
          </p>
        ) : null}

        <div className={styles.line} role="progressbar" aria-valuemin={0} aria-valuemax={total}
          aria-valuenow={done} aria-label="Build milestones complete">
          <span className={styles.lineFill} style={{ width: `${pct}%` }} />
          <span className={styles.lineActive} style={{ width: `${Math.round((running.length / total) * 100)}%` }} />
        </div>

        <ul className={styles.tally}>
          <li><span className={styles.tallyFigure}>{done}</span><span className={styles.tallyLabel}>Built</span></li>
          <li><span className={styles.tallyFigure}>{running.length}</span><span className={styles.tallyLabel}>In progress</span></li>
          <li><span className={styles.tallyFigure}>{queued}</span><span className={styles.tallyLabel}>Coming up</span></li>
        </ul>

        <p className={styles.meta}>
          <span className={styles.metaNum}>{done}</span> of <span className={styles.metaNum}>{total}</span> build
          milestones complete{replaced ? `, with ${replaced} since replaced by a better method` : ''}
          {updated ? `. Updated ${fmt(updated, { day: 'numeric', month: 'long' })}` : ''}
        </p>
      </section>

      {showNav && (
        <nav className={styles.nav} aria-label="Sections">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
              aria-current={current === s.id ? 'true' : undefined}
              className={`${styles.pill} ${current === s.id ? styles.pillOn : ''}`}
            >
              {s.label}
              <span className={styles.pillCount}>{s.count}</span>
            </a>
          ))}
        </nav>
      )}

      {running.length > 0 && (
        <section id="now" className={`${styles.block} ${styles.live}`}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockLabel}>In progress</h2>
            <span className={styles.blockCount}>{running.length}</span>
          </div>
          <ul className={styles.list}>
            {running.map((item) => (
              <Row key={item.label} item={item} showPhase />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section id="next" className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockLabel}>Coming up</h2>
            <span className={styles.blockCount}>{queued}</span>
          </div>
          {upcoming.map((phase) => (
            <div key={phase.key} className={styles.phase}>
              <p className={styles.phaseLabel}>{phase.label}</p>
              <ul className={styles.list}>
                {phase.items.map((item) => (
                  <Row key={item.label} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section id="done" className={styles.block}>
          {/* Shut by default. The log only grows, and it is the part nobody
              opens twice. */}
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={openHistory}
            aria-controls="completed-list"
            onClick={() => setOpenHistory((v) => !v)}
          >
            <span className={styles.blockLabel}>Completed</span>
            <span className={styles.blockCount}>{done}</span>
            <Chevron open={openHistory} />
          </button>

          <div id="completed-list" hidden={!openHistory}>
            {visibleHistory.map((group) => (
              <div key={group.key} className={styles.phase}>
                <p className={styles.phaseLabel}>{fmt(`${group.key}-01`, { month: 'long', year: 'numeric' })}</p>
                <ul className={styles.list}>
                  {group.items.map((item) => (
                    <Row key={item.label} item={item} showPhase showDate />
                  ))}
                </ul>
              </div>
            ))}

            {hiddenMonths > 0 && (
              <button type="button" className={styles.more} onClick={() => setShowAllMonths(true)}>
                Show {hiddenMonths} earlier {hiddenMonths === 1 ? 'month' : 'months'}
              </button>
            )}
          </div>
        </section>
      )}

      <footer className={styles.foot}>
        <span>Built by The Brick Dev Studios</span>
        <a className={styles.footLink} href="mailto:hello@thebrickdev.com">hello@thebrickdev.com</a>
      </footer>
    </div>
  );
}
