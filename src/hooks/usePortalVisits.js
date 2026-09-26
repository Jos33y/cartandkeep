import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { PORTAL_NAV_SECTIONS } from '@utils/constants';

const GAP_MS = 30 * 60 * 1000;
const WINDOW_DAYS = 14;

const NAV = PORTAL_NAV_SECTIONS.flatMap((s) => s.items);

// Module scope, not a ref: StrictMode remounts would otherwise record every screen twice.
const sent = { key: null, at: 0, hiddenAt: null };

// The nav entry a path belongs to, so /orders/AB12/slip is stored as /orders and no reference leaves the page.
export function screenFor(pathname) {
  if (pathname === '/' || pathname === '') return '/';
  const named = NAV.find((i) => i.route !== '/' && (pathname === i.route || pathname.startsWith(`${i.route}/`)));
  if (named) return named.route;
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  return `/${first.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
}

export function screenLabel(screen) {
  return NAV.find((i) => i.route === screen)?.label ?? screen.replace(/^\//, '').replace(/-/g, ' ');
}

export function useRecordVisit(tenantId, pathname) {
  const [previousAt, setPreviousAt] = useState(null);
  const screen = screenFor(pathname);

  useEffect(() => {
    if (!tenantId) return;
    const key = `${tenantId}${screen}`;
    const now = Date.now();
    if (sent.key === key && now - sent.at < 2000) return;
    sent.key = key;
    sent.at = now;
    record(tenantId, screen, setPreviousAt);
  }, [tenantId, screen]);

  // Coming back to a tab left open for half an hour is a new visit, and the database has to hear about it.
  useEffect(() => {
    if (!tenantId) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { sent.hiddenAt = Date.now(); return; }
      if (sent.hiddenAt && Date.now() - sent.hiddenAt > GAP_MS) {
        sent.at = Date.now();
        record(tenantId, screen, setPreviousAt);
      }
      sent.hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [tenantId, screen]);

  return previousAt;
}

async function record(tenantId, screen, setPreviousAt) {
  const { data, error } = await supabase.rpc('record_portal_visit', { p_tenant: tenantId, p_screen: screen });
  if (error) {
    console.warn('[portal] visit not recorded', error);
    return;
  }
  setPreviousAt(data ?? null);
}

const londonDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

// Members' visits for the studio: the last fortnight day by day, plus the latest visit ever for when that fortnight is empty.
export function useClientVisits(tenantId, enabled) {
  const [state, setState] = useState({ status: 'idle', days: [], latest: null });

  useEffect(() => {
    if (!tenantId || !enabled) return undefined;
    let live = true;

    const read = async () => {
      const since = new Date(Date.now() - (WINDOW_DAYS - 1) * 86400000);
      const [recent, latest] = await Promise.all([
        supabase
          .from('portal_member_visits')
          .select('day, first_at, last_at, visits, screens')
          .eq('tenant_id', tenantId)
          .gte('day', londonDay(since))
          .order('day', { ascending: false }),
        supabase
          .from('portal_member_visits')
          .select('last_at')
          .eq('tenant_id', tenantId)
          .order('last_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!live) return;
      if (recent.error || latest.error) {
        console.warn('[portal] client visits did not load', recent.error ?? latest.error);
        setState({ status: 'error', days: [], latest: null });
        return;
      }
      setState({ status: 'ready', days: mergeDays(recent.data ?? []), latest: latest.data?.last_at ?? null });
    };

    read();
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tenantId, enabled]);

  return state;
}

// More than one member on a tenant gives more than one row per day; the strip reads one day as one day.
function mergeDays(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { day: r.day, firstAt: r.first_at, lastAt: r.last_at, visits: 0, screens: new Map() };
    d.visits += r.visits;
    if (r.first_at < d.firstAt) d.firstAt = r.first_at;
    if (r.last_at > d.lastAt) d.lastAt = r.last_at;
    for (const s of r.screens ?? []) d.screens.set(s.screen, (d.screens.get(s.screen) ?? 0) + Number(s.opens ?? 0));
    byDay.set(r.day, d);
  }
  return [...byDay.values()].map((d) => ({ ...d, screens: [...d.screens].map(([screen, opens]) => ({ screen, opens })) }));
}

export { WINDOW_DAYS, londonDay };
