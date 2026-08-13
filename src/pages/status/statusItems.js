// Hand-maintained until the pipeline writes here. Phase order is delivery order.
// state: done | active | queued. A done item needs a date or it cannot be logged.

export const STATUS_PHASES = [
  {
    key: 'foundations',
    label: 'Foundations',
    items: [
      { label: 'Domains registered', detail: 'cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'Business email active', detail: 'support@cartandkeep.com', state: 'done', date: '2026-07-26' },
      { label: 'DNS and SSL configured', state: 'done', date: '2026-07-26' },
      { label: 'Database provisioned', state: 'done', date: '2026-07-26' },
    ],
  },
  {
    key: 'portal',
    label: 'Operations portal',
    items: [
      { label: 'Status page live', state: 'done', date: '2026-07-26' },
      { label: 'Portal sign in', state: 'done', date: '2026-07-27' },
      { label: 'Candidate review interface', state: 'done', date: '2026-08-03' },
      { label: 'Product images and eBay categories', state: 'done', date: '2026-08-03' },
      { label: 'Notes on any product', state: 'done', date: '2026-08-05' },
      { label: 'Supplier costs and margin', detail: 'add a supplier, see what is left', state: 'done', date: '2026-08-05' },
      { label: 'Products grouped by type', detail: 'reviewed a shelf at a time rather than one long list', state: 'done', date: '2026-08-12' },
      { label: 'Decision history', detail: 'every approval and change kept on record', state: 'done', date: '2026-08-05' },
    ],
  },
  {
    key: 'research',
    label: 'Research pipeline',
    items: [
      { label: 'Seller Hub research access', detail: 'Terapeak, research areas only', state: 'done', date: '2026-08-03' },
      { label: 'Research pipeline data sources', state: 'done', date: '2026-08-03' },
      { label: 'What every figure means', detail: 'in the portal, under Metrics', state: 'done', date: '2026-08-05' },
      { label: 'Research coverage published', detail: 'every keyword searched and what it found', state: 'done', date: '2026-08-05' },
      { label: 'First review session', state: 'done', date: '2026-07-30' },
      { label: 'First candidate batch delivered', state: 'done', date: '2026-08-10' },
      { label: 'Twelve months of sales history per product', detail: 'seven monthly windows, direction and season', state: 'done', date: '2026-08-12' },
      { label: 'Second candidate batch delivered', detail: '178 products', due: 'Monday 17 August', state: 'active' },
      { label: 'Live competition check', detail: 'how many sellers compete, and at what price', state: 'done', date: '2026-08-13' },
    ],
  },
  {
    key: 'store',
    label: 'Custom store',
    items: [
      { label: 'Custom store live', state: 'queued' },
      { label: 'Checkout integrated', state: 'queued' },
      { label: 'SEO foundation shipped', state: 'queued' },
      { label: 'Legal pages published', state: 'queued' },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    items: [{ label: 'Financial dashboard live', state: 'queued' }],
  },
];

export const STATE_LABEL = { done: 'Complete', active: 'In progress', queued: 'Queued' };

const withPhase = STATUS_PHASES.flatMap((p) => p.items.map((i) => ({ ...i, phase: p.label })));

export const STATUS_ITEMS = withPhase;

export const activeItems = () => withPhase.filter((i) => i.state === 'active');

export const upcomingPhases = () =>
  STATUS_PHASES.map((p) => ({ ...p, items: p.items.filter((i) => i.state === 'queued') })).filter(
    (p) => p.items.length > 0,
  );

// The first unfinished thing with a date on it. This is the only forward
// commitment on the page, so it comes from the data rather than being written.
export const nextDated = () => withPhase.find((i) => i.state !== 'done' && i.due) ?? null;

// Completed work leaves the plan and becomes a log, newest first, grouped by
// month. This is what stops the page growing without bound at the top.
export function completedByMonth() {
  const done = withPhase.filter((i) => i.state === 'done' && i.date).sort((a, b) => b.date.localeCompare(a.date));
  const groups = [];
  for (const item of done) {
    const key = item.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function lastUpdated() {
  const dates = withPhase.map((i) => i.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}