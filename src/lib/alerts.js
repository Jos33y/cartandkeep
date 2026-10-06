import { warningsOf } from './supplierWatch.js';
import { portalPath } from '@utils/constants';

/*
 * Everything that needs her eye, worked out from how things are now (Joseey, 5 October: "self clearing is better").
 * Nothing is marked as done: an alert is here while its cause is, and gone once it is fixed. Built from plain rows so
 * the Alerts page, its preview on the Overview and the sidebar's count all say the same thing.
 *
 *   level  stop  costing her money or a sale now
 *          warn  needs a look soon
 *   quiet  a heads-up that stays out of the sidebar's count (approved cards, not selling yet)
 */

const DAY = 24 * 3600 * 1000;
export const RECENT_DAYS = 14;
export const GROUPS = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'ebay', label: 'eBay' },
  { id: 'keeper', label: 'Keeper' },
  { id: 'stock', label: 'Stock' },
];
const RANK = { stop: 0, warn: 1 };
const ORDER = Object.fromEntries(GROUPS.map((g, i) => [g.id, i]));

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const titleOf = (c) => c?.draft_title || c?.title || 'Untitled card';

// The warnings about money: the ones a new price answers.
const MONEY = /^(now |cost now |up to |deal ended)/;

// Her live listing's Amazon supplier. A cost that moved is settled once she has changed the price since.
function supplierAlert(c, priced, now) {
  const r = c.supplier_read;
  let ws = warningsOf(r, c.candidate_sources ?? c.sources, now).filter((w) => w.level === 'stop' || w.level === 'warn');
  const movedAt = r?.cost_change?.at ? Date.parse(r.cost_change.at) : null;
  const listing = c.ebay?.listing_id ? String(c.ebay.listing_id) : null;
  if (movedAt && listing && priced.some((p) => String(p.listing_id) === listing && Date.parse(p.created_at) >= movedAt)) {
    ws = ws.filter((w) => !String(w.short ?? '').startsWith('cost now '));
  }
  if (!ws.length) return null;
  const money = ws.some((w) => MONEY.test(String(w.short ?? '')));
  const actions = [];
  if (money && listing) actions.push({ label: 'Change price', to: portalPath(`/listings?find=${listing}&price=1`) });
  if (r?.url) actions.push({ label: 'Amazon', href: r.url });
  return {
    key: `sup:${c.id}`,
    group: 'suppliers',
    level: ws[0].level,
    title: titleOf(c),
    what: ws.map((w) => w.short).filter(Boolean).join(', ') || ws[0].text,
    text: ws.map((w) => w.text).join(' '),
    where: 'Live on eBay',
    at: r?.read_at ?? null,
    actions,
  };
}

// Approved cards, not listed yet, whose supplier says something to settle: one line, with the cards a click away.
function approvedAlert(cards, now) {
  const flagged = cards.map((c) => warningsOf(c.supplier_read, c.candidate_sources ?? c.sources, now)
    .filter((w) => w.level === 'stop' || w.level === 'warn'))
    .filter((ws) => ws.length);
  if (!flagged.length) return null;
  const red = flagged.filter((ws) => ws[0].level === 'stop').length;
  return {
    key: 'sup:approved',
    group: 'suppliers',
    level: red ? 'stop' : 'warn',
    quiet: true,
    title: `${plural(flagged.length, 'approved card', 'approved cards')} with supplier warnings`,
    what: red ? `${red} red: out of stock, gone, or dearer than your cost` : 'dearer, running low, or a pack to check',
    text: 'Not selling yet, so nothing is lost. Settle each before you list it.',
    where: 'Approved',
    at: null,
    actions: [{ label: 'Open them', to: portalPath('/approved?only=supplierWarn') }],
  };
}

// The eBay queue's last word on a card, when it was a failure and the card is still not on eBay.
function queueAlerts(jobs) {
  const latest = new Map();
  for (const j of [...jobs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
    if (!latest.has(j.candidate_id)) latest.set(j.candidate_id, j);
  }
  return [...latest.values()]
    .filter((j) => j.state === 'failed' && !j.candidates?.ebay?.listing_id)
    .map((j) => ({
      key: `job:${j.candidate_id}`,
      group: 'ebay',
      level: 'stop',
      title: titleOf(j.candidates),
      what: 'eBay did not list it',
      text: j.error ? String(j.error) : 'The queue stopped without a reason from eBay.',
      where: 'eBay queue',
      at: j.finished_at ?? j.created_at,
      actions: [{ label: 'Open in Approved', to: portalPath(`/approved?card=${j.candidate_id}`) }],
    }));
}

const TASKS = {
  amazon_source: { name: 'Looking up cards on Amazon', path: '/keeper/amazon' },
  get_ready: { name: 'Getting cards ready', path: '/keeper/ready' },
  shop_check: { name: 'Checking your shop drafts', path: '/keeper' },
};
function keeperAlerts(runs, agent) {
  return runs.filter((r) => r.state === 'paused').map((r) => {
    const t = TASKS[r.task] ?? { name: 'A run', path: '/keeper' };
    return {
      key: `run:${r.id}`,
      group: 'keeper',
      level: 'warn',
      title: t.name,
      what: 'paused',
      text: `${r.paused_reason ? `${String(r.paused_reason).replace(/\.?$/, '.')} ` : ''}Resume or stop it from the run.`,
      where: agent || 'Keeper',
      at: r.updated_at ?? r.created_at ?? null,
      actions: [{ label: 'Open the run', to: portalPath(t.path) }],
    };
  });
}

function stockAlerts(low) {
  return low.map((l) => {
    const left = Number(l.stock);
    return {
      key: `stock:${l.variant_id ?? l.product_id}`,
      group: 'stock',
      level: left <= 0 ? 'stop' : 'warn',
      title: l.label ? `${l.title}, ${l.label}` : l.title,
      what: left <= 0 ? 'None left' : `${left} left`,
      text: left <= 0 ? 'Sold out on your shop. Restock it or take it off sale.' : 'Running low on your shop.',
      where: 'Your shop',
      at: null,
      actions: [{ label: 'Open Products', to: portalPath('/products?filter=live') }],
    };
  });
}

export function buildAlerts({ live = [], approved = [], jobs = [], runs = [], low = [], priced = [], agent = null, now = Date.now() } = {}) {
  const list = [
    ...live.map((c) => supplierAlert(c, priced, now)),
    approvedAlert(approved, now),
    ...queueAlerts(jobs.filter((j) => now - Date.parse(j.created_at) < RECENT_DAYS * DAY)),
    ...keeperAlerts(runs, agent),
    ...stockAlerts(low),
  ].filter(Boolean);
  return list.sort((a, b) => Number(Boolean(a.quiet)) - Number(Boolean(b.quiet))
    || RANK[a.level] - RANK[b.level]
    || ORDER[a.group] - ORDER[b.group]
    || String(a.title).localeCompare(String(b.title)));
}

// What the sidebar counts: red and amber on things that are selling. Approved warnings are a heads-up.
export const badgeOf = (alerts) => alerts.filter((a) => !a.quiet).length;

export function countsOf(alerts) {
  const by = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  for (const a of alerts) by[a.group] += 1;
  return { all: alerts.length, stop: alerts.filter((a) => a.level === 'stop').length, ...by };
}
