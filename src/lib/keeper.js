/*
 * Keeper's runs, as the portal reads them (keeper-task-01-shop-drafts.md). The trays, what a run adds up to, how
 * long is left, and the two things the product sheet needs: her changes to Keeper's work, and a save that does not
 * write over a check that landed while the sheet was open.
 */

// The out-trays, in the order the office shows them. Only "Needs you" waits on her; the rest can go on sale.
export const TRAYS = [
  { key: 'ready', label: 'Ready for sale', hint: 'Returns set, title and address tidied', tone: 'positive' },
  { key: 'label', label: 'Warnings added', hint: 'A chemical: its label warnings are on the page', tone: 'warning' },
  { key: 'choose', label: 'Needs you', hint: 'Already on the shop, a returns call, or something only you can add', tone: 'info' },
  { key: 'unread', label: 'Could not read', hint: 'Tried three times; the next check tries again', tone: 'negative' },
];

/*
 * After the run, the report says where each checked draft is now, not only where Keeper put it: a draft that has gone
 * on sale since leaves its tray for "On sale", and one archived since leaves the trays altogether. Keeper's verdict
 * stays on the job; this is the product's status read over it.
 */
export const ON_SALE = { key: 'live', label: 'On sale', hint: 'Live on your shop now', tone: 'positive' };
export const REPORT_TRAYS = [ON_SALE, ...TRAYS];

/*
 * Looking candidates up on Amazon (keeper-task-02-amazon-sourcing.md, pass 1). The same three tray keys, so the
 * office draws them in the same inks: sourced (approved), left for the full check, and could not read.
 */
export const SOURCE_TRAYS = [
  { key: 'ready', label: 'Sourced on Amazon', stamp: 'Sourced', hint: 'Approved, with the Amazon supplier, cost, seller and stock saved', tone: 'positive' },
  { key: 'choose', label: 'Left for the full check', stamp: 'Left', hint: 'Not found by its barcode, or another pack. What was found is noted on the card', tone: 'info' },
  { key: 'unread', label: 'Could not read', stamp: 'Not read', hint: 'Amazon did not answer three times; the next run tries again', tone: 'negative' },
];

/*
 * Getting approved cards ready for eBay (keeper-task-03, 4 October). The same three tray keys again: ready to list,
 * needs you (something Keeper could not fill, said on the card), and could not finish.
 */
export const READY_TRAYS = [
  { key: 'ready', label: 'Ready to list', stamp: 'Ready', hint: 'Title, description, photos, eBay\'s details and the parcel in. Read it over, then list', tone: 'positive' },
  { key: 'choose', label: 'Needs you', stamp: 'Needs you', hint: 'Something Keeper could not fill, said on the card', tone: 'info' },
  { key: 'unread', label: 'Could not finish', stamp: 'Not finished', hint: 'Stopped three times; send it again from Approved', tone: 'negative' },
];

// Trays from the first version of the check, read as today's.
const LEGACY = { not_chemical: 'ready' };
// The trays whose drafts can go straight on sale.
export const SELLABLE = ['ready', 'label'];

// A draft Keeper has not checked: what a run picks up (start_keeper_run, 0123).
export const unchecked = (p) => p?.status === 'draft' && !p?.archived_at && !p?.is_sample && !p?.derived_fields?.rules;

// The tray a finished job landed in, or null while it is still waiting or working.
export function trayOf(job) {
  if (job.state === 'failed') return 'unread';
  if (job.state !== 'done') return null;
  // An approval from Amazon that was undone afterwards.
  if (job.result?.undone) return 'undone';
  const t = job.result?.tray ?? null;
  return LEGACY[t] ?? t;
}

/*
 * Where a finished job's draft is now: 'live' once it is on sale, 'archived' once it is archived, otherwise the tray
 * Keeper put it in. A product not read yet stays in its tray. Null while the job is still waiting or working.
 */
export function placeOf(job, product) {
  const t = trayOf(job);
  if (!t || t === 'skipped' || !product) return t;
  if (product.status === 'archived' || product.archived_at) return 'archived';
  if (product.status === 'live' && !product.is_sample) return 'live';
  return t;
}

/*
 * Everything the office counts: the trays always add up to what is done. Given the products, it counts where each
 * draft is now (placeOf), with "live" and "archived" beside the trays; without, Keeper's verdicts as they landed.
 */
export function summarise(jobs = [], products = null, own = TRAYS) {
  const trays = Object.fromEntries((products ? [...REPORT_TRAYS, { key: 'archived' }] : own).map((t) => [t.key, 0]));
  let waiting = 0; let working = 0; let skipped = 0; let stopped = 0; let undone = 0; let ms = 0; let timed = 0;
  for (const j of jobs) {
    if (j.state === 'queued') waiting += 1;
    else if (j.state === 'working') working += 1;
    else if (j.state === 'stopped') stopped += 1;
    else {
      const t = products ? placeOf(j, products.get(j.product_id)) : trayOf(j);
      if (t === 'skipped') skipped += 1;
      else if (t === 'undone') undone += 1;
      else if (t && t in trays) trays[t] += 1;
      const took = Number(j.result?.ms);
      if (Number.isFinite(took) && took > 0) { ms += took; timed += 1; }
    }
  }
  const done = Object.values(trays).reduce((a, b) => a + b, 0) + skipped + undone;
  return { trays, waiting, working, skipped, stopped, undone, done, left: waiting + working, avgMs: timed ? ms / timed : null };
}

// Time to go, in words: at watch pace each draft takes at least three and a half seconds.
export function timeLeft(left, avgMs, pace) {
  if (!left) return null;
  const each = Math.max(pace === 'watch' ? 3500 : 0, avgMs ?? 6000) / (pace === 'watch' ? 1 : 3);
  const mins = Math.ceil((left * each) / 60000);
  return mins <= 1 ? 'about a minute' : `about ${mins} minutes`;
}

export const pounds = (pence) => `£${(Math.max(0, Number(pence) || 0) / 100).toFixed(2)}`;

/*
 * A sheet save writes derived_fields whole, from the copy loaded when the sheet opened. A Keeper check that landed
 * meanwhile would be lost. So only the keys she changed are taken from her copy; every other key comes from the
 * database as it is now.
 */
export function mergeDerived(opened = {}, mine = {}, latest = {}) {
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out = { ...(latest ?? {}) };
  for (const k of new Set([...Object.keys(opened ?? {}), ...Object.keys(mine ?? {})])) {
    if (same(opened?.[k], mine?.[k])) continue;
    if (k in (mine ?? {})) out[k] = mine[k];
    else delete out[k];
  }
  return out;
}

/*
 * Her changes to what Keeper set, from a sheet save: a title Keeper wrote that she changed, a returns class she chose
 * against Keeper's, a label where Keeper said there was none, or none where Keeper said there was one. Read before
 * Keeper's next run (keeper_overrides, 0123).
 */
export function overridesFor(row, patch) {
  const d = row?.derived_fields ?? {};
  const rules = d.rules ?? null;
  const out = [];
  if (d.title_by === 'keeper' && 'title' in patch && patch.title !== row.title) {
    out.push({ field: 'title', keeper_value: row.title, her_value: patch.title });
  }
  if (rules?.returns && 'returns_class' in patch && patch.returns_class !== rules.returns) {
    out.push({ field: 'returns', keeper_value: rules.returns, her_value: patch.returns_class });
  }
  if (rules && 'hazard' in patch) {
    if (rules.chemical === false && patch.hazard) out.push({ field: 'chemical', keeper_value: false, her_value: true });
    if (rules.chemical === true && patch.hazard === null) out.push({ field: 'chemical', keeper_value: true, her_value: false });
  }
  return out.map((o) => ({ ...o, tenant_id: row.tenant_id, product_id: row.id }));
}
