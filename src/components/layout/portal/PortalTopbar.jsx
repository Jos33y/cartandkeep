import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@components/ui/icons';
import { supabase } from '@lib/supabase';
import { useClientVisits, screenLabel, londonDay, WINDOW_DAYS } from '@hooks/usePortalVisits';
import styles from '@styles/layout/portal/portal-topbar.module.css';

const TZ = 'Europe/London';
const at = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(new Date(iso));
// "Tue 22 Sept": parts joined by hand, because en-GB puts a comma after the weekday.
const dayName = (iso) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('weekday')} ${get('day')} ${get('month')}`;
};
const stamp = (iso) => `${dayName(iso)}, ${at(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
const clock = (iso) => at(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

function daysAgo(iso) {
  const a = new Date(`${londonDay(new Date())}T00:00:00Z`);
  const b = new Date(`${londonDay(new Date(iso))}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

function whenWord(iso) {
  const ago = daysAgo(iso);
  if (ago === 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago < 7) return `on ${at(iso, { weekday: 'long' })}`;
  return `on ${at(iso, { day: 'numeric', month: 'short' })}`;
}

const times = (n) => (n === 1 ? 'once' : `${n} times`);

// Green for recent, amber for ageing, red for gone quiet: the dot is read before the words.
function visitTone(latest) {
  if (!latest) return 'quiet';
  const ago = daysAgo(latest);
  if (ago <= 3) return 'positive';
  if (ago < WINDOW_DAYS) return 'warning';
  return 'negative';
}

function clientLine(visits) {
  if (!visits.latest) return 'No visit recorded yet';
  const total = visits.days.reduce((s, d) => s + d.visits, 0);
  if (!total) return `Client not in for ${WINDOW_DAYS} days, last ${whenWord(visits.latest)}`;
  return `Client in ${times(total)} in ${WINDOW_DAYS} days, last ${whenWord(visits.latest)}`;
}

// Fixed panels go through a portal: the topbar's backdrop blur makes it the containing block.
function Popover({ anchorRef, open, onClose, labelledBy, className, children }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return undefined;
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      // On a phone the anchor sits mid bar, so a right-aligned panel would run off the left edge.
      setPos(window.innerWidth < 600
        ? { top: r.bottom + 8, left: 8, right: 8 }
        : { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { onClose(); anchorRef.current?.focus(); } };
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div ref={panelRef} role="dialog" aria-labelledby={labelledBy} className={`${styles.popover} ${className ?? ''}`}
      style={pos}>
      {children}
    </div>,
    document.body,
  );
}

function VisitStrip({ days }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const cells = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = new Date(Date.now() - (WINDOW_DAYS - 1 - i) * 86400000);
    const key = londonDay(date);
    return { key, date, visits: byDay.get(key)?.visits ?? 0 };
  });

  return (
    <ol className={styles.strip} aria-label={`Visits by day, last ${WINDOW_DAYS} days`}>
      {cells.map((c, i) => (
        <li key={c.key} className={styles.cell} data-level={Math.min(c.visits, 3)} data-today={i === WINDOW_DAYS - 1 || undefined}
          style={{ '--i': i }}
          title={`${dayName(c.date)}: ${c.visits ? `${c.visits} ${c.visits === 1 ? 'visit' : 'visits'}` : 'not in'}`}>
          <span className={styles.cellLabel}>{at(c.date, { weekday: 'narrow' })}</span>
        </li>
      ))}
    </ol>
  );
}

function ClientVisits({ tenantId }) {
  const visits = useClientVisits(tenantId, true);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  if (visits.status !== 'ready' && visits.status !== 'error') return <span className={styles.visitSkeleton} aria-hidden="true" />;
  if (visits.status === 'error') return null;

  const tone = visitTone(visits.latest);
  const line = clientLine(visits);

  return (
    <>
      <button ref={ref} type="button" className={styles.visit} aria-expanded={open} aria-haspopup="dialog"
        title={visits.latest ? `Last here ${stamp(visits.latest)}` : undefined} onClick={() => setOpen((v) => !v)}>
        <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
        <span className={styles.visitText}>{line}</span>
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} labelledBy="client-visits-title" className={styles.visitPanel}>
        <header className={styles.panelHead}>
          <h2 id="client-visits-title" className={styles.panelTitle}>Client visits</h2>
          <span className={styles.panelNote}>Last {WINDOW_DAYS} days</span>
        </header>

        <VisitStrip days={visits.days} />

        {visits.days.length ? (
          <ul className={styles.dayList}>
            {visits.days.map((d) => (
              <li key={d.day} className={styles.day}>
                <span className={styles.dayHead}>
                  <span className={styles.dayDate}>{dayName(`${d.day}T12:00:00Z`)}</span>
                  <span className={styles.dayTimes} data-num>
                    {clock(d.firstAt) === clock(d.lastAt) ? clock(d.firstAt) : `${clock(d.firstAt)} to ${clock(d.lastAt)}`}
                  </span>
                  <span className={styles.dayVisits}>{d.visits} {d.visits === 1 ? 'visit' : 'visits'}</span>
                </span>
                {d.screens.length > 0 && (
                  <ul className={styles.screens}>
                    {d.screens.map((s) => (
                      <li key={s.screen} className={styles.screen}>
                        {screenLabel(s.screen)}
                        {s.opens > 1 && <span className={styles.opens} data-num>{s.opens}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.panelEmpty}>
            {visits.latest ? `Nothing in the last ${WINDOW_DAYS} days. Last here ${stamp(visits.latest)}.` : 'Visits are recorded from the day this went live.'}
          </p>
        )}

        <p className={styles.panelFoot}>Screens opened and visit times only. Studio visits are not counted.</p>
      </Popover>
    </>
  );
}

function AccountMenu({ account, previousAt }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef(null);
  const initial = account.email ? account.email[0].toUpperCase() : '';

  if (!account.email) return null;

  return (
    <>
      <button ref={ref} type="button" className={styles.account} aria-expanded={open} aria-haspopup="dialog"
        aria-label="Account" onClick={() => setOpen((v) => !v)}>
        <span className={styles.avatar} aria-hidden="true">{initial}</span>
        <Icon name="IconCaret" className={`${styles.caret} ${open ? styles.caretOpen : ''}`} />
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} labelledBy="account-title" className={styles.accountPanel}>
        <div className={styles.who}>
          <span className={styles.avatarLarge} aria-hidden="true">{initial}</span>
          <span className={styles.whoText}>
            <span id="account-title" className={styles.whoEmail} title={account.email}>{account.email}</span>
            {account.role && <span className={styles.whoRole}>{account.role}</span>}
          </span>
        </div>

        {previousAt && (
          <p className={styles.lastVisit}>
            <Icon name="IconClock" className={styles.lastIcon} />
            <span>Your last visit: <span data-num>{stamp(previousAt)}</span></span>
          </p>
        )}

        <button type="button" className={styles.signOut} disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.warn('[portal] sign out failed', error);
              setSigningOut(false);
            }
          }}>
          <Icon name="IconExit" className={styles.signOutIcon} />
          <span>{signingOut ? 'Signing out' : 'Sign out'}</span>
        </button>
      </Popover>
    </>
  );
}

export function PortalTopbar({ crumb, account, tenantId, previousAt, onOpenMenu, onOpenSearch, burgerRef, drawerOpen }) {
  return (
    <header className={styles.topbar}>
      <button ref={burgerRef} type="button" className={styles.burger} aria-label="Open menu" aria-expanded={drawerOpen}
        aria-controls="portal-sidebar" onClick={onOpenMenu}>
        <span /><span /><span />
      </button>

      <p className={styles.crumb}>
        {crumb.section && <span className={styles.crumbSection}>{crumb.section}</span>}
        {crumb.section && <span className={styles.crumbSep} aria-hidden="true">/</span>}
        <span className={styles.crumbPage}>
          {crumb.icon && <Icon name={crumb.icon} className={styles.crumbIcon} />}
          {crumb.page}
        </span>
      </p>

      <div className={styles.tools}>
        <button type="button" className={styles.search} onClick={onOpenSearch} aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}>
          <Icon name="IconSearch" className={styles.searchIcon} />
          <span className={styles.searchText}>Go to a screen</span>
          <kbd className={styles.kbd}>{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
        </button>

        {account.isStudio && <ClientVisits tenantId={tenantId} />}

        <AccountMenu account={account} previousAt={previousAt} />
      </div>
    </header>
  );
}
