/*
 * Keeper's runs, as the portal reads them (keeper-task-01-shop-drafts.md). The trays, what a run adds up to, how
 * long is left, and the two things the product sheet needs: her changes to Keeper's work, and a save that does not
 * write over a check that landed while the sheet was open.
 */

// The out-trays, in the order the office shows them. Tones are the portal's: green done, amber hers, blue a question.
export const TRAYS = [
  { key: 'ready', label: 'Ready for sale', hint: 'Standard returns, no label needed', tone: 'positive' },
  { key: 'label', label: 'Label to copy', hint: 'A chemical: check the label against the bottle', tone: 'warning' },
  { key: 'not_chemical', label: 'Not a chemical', hint: 'Flagged by a word: tick no label, with the reason', tone: 'info' },
  { key: 'choose', label: 'Yours to choose', hint: 'Sealed or no return, a title, or the same product twice', tone: 'info' },
  { key: 'unread', label: 'Could not read', hint: 'Open it, or check it again', tone: 'negative' },
];

// A draft Keeper has not checked: what a run picks up (start_keeper_run, 0123).
export const unchecked = (p) => p?.status === 'draft' && !p?.archived_at && !p?.is_sample && !p?.derived_fields?.rules;

// The tray a finished job landed in, or null while it is still waiting or working.
export function trayOf(job) {
  if (job.state === 'failed') return 'unread';
  if (job.state !== 'done') return null;
  return job.result?.tray ?? null;
}

// Everything the office counts, from the jobs alone: the trays always add up to what is done.
export function summarise(jobs = []) {
  const trays = Object.fromEntries(TRAYS.map((t) => [t.key, 0]));
  let waiting = 0; let working = 0; let skipped = 0; let stopped = 0; let ms = 0; let timed = 0;
  for (const j of jobs) {
    if (j.state === 'queued') waiting += 1;
    else if (j.state === 'working') working += 1;
    else if (j.state === 'stopped') stopped += 1;
    else {
      const t = trayOf(j);
      if (t === 'skipped') skipped += 1;
      else if (t && t in trays) trays[t] += 1;
      const took = Number(j.result?.ms);
      if (Number.isFinite(took) && took > 0) { ms += took; timed += 1; }
    }
  }
  const done = Object.values(trays).reduce((a, b) => a + b, 0) + skipped;
  return { trays, waiting, working, skipped, stopped, done, left: waiting + working, avgMs: timed ? ms / timed : null };
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
