// Keeper task 02, pass 1: one batch of candidates looked up on Amazon by barcode, and approved where it is the same
// product, the same pack, in stock and sent by Amazon (_shared/amazon-source.ts holds every rule). Writes only through
// keeper_source_approve (0133), and nothing in a rehearsal. Kept apart from the server so the tests can drive it.

import { nextRead, pageFor, runAxesso, type Read } from '../_shared/amazon.ts';
import { candidateGtin, fillOf, judge, pence, pickResult, runSearch, sourceOf } from '../_shared/amazon-source.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export type Outcome = { state: 'done'; result: Json; cost: number } | { error: string; cost: number };

type Deps = {
  token: string;
  gbpPerUsd?: number;
  search?: typeof runSearch;
  read?: typeof runAxesso;
};

const SEARCH_TIMEOUT_S = 60;
const READ_TIMEOUT_S = 75;

async function phase(client: Client, jobs: Json[], step: string) {
  await client.from('keeper_jobs').update({ result: { phase: step } }).in('id', jobs.map((j) => j.id));
}

/*
 * Each job's outcome, in the order given. A job ends in one of three ways:
 *   done, tray 'ready'   approved: supplier, cost and reading saved, the approval marked as Keeper's;
 *   done, tray 'choose'  left for the full check (pass 2), with what was found;
 *   done, tray 'skipped' decided on the card meanwhile, or gone: left as it is;
 *   error                Amazon did not answer: tried again, three times in all (work.ts).
 */
export async function sourceBatch(client: Client, jobs: Json[], run: Json, deps: Deps): Promise<Outcome[]> {
  const started = Date.now();
  const gbp = deps.gbpPerUsd ?? 0.75;
  const search = deps.search ?? runSearch;
  const read = deps.read ?? runAxesso;

  const ids = jobs.map((j) => j.candidate_id);
  const { data: rows, error } = await client.from('candidates')
    .select('id, tenant_id, title, image_url, margin, listing, decisions ( action )').in('id', ids);
  if (error) throw new Error(error.message);
  const byId = new Map<string, Json>((rows ?? []).map((r: Json) => [r.id, r]));

  const gtinOf = new Map<string, string | null>(ids.map((id) => [id, byId.has(id) ? candidateGtin(byId.get(id)!) : null]));
  const codes = [...new Set([...gtinOf.values()].filter(Boolean) as string[])];

  await phase(client, jobs, 'search');
  let found: Map<string, Json[]>;
  let perCode: Map<string, number>;
  try {
    const s = await search(codes, deps.token, { timeoutSecs: SEARCH_TIMEOUT_S });
    found = s.found;
    perCode = s.perCode ?? new Map();
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return jobs.map(() => ({ error: why, cost: 0 }));
  }

  // Which result is each card's product: the only one, or the one whose title matches the card's. Read in one run.
  const picked = new Map<string, ReturnType<typeof pickResult>>(jobs.map((j) => {
    const gtin = gtinOf.get(j.candidate_id);
    return [j.id, pickResult(byId.get(j.candidate_id)?.title, gtin ? found.get(gtin) ?? [] : [])];
  }));
  const asins = [...new Set([...picked.values()].map((p) => p.asin).filter(Boolean) as string[])];
  await phase(client, jobs, 'read');
  let reads = new Map<string, Read>();
  if (asins.length) {
    try {
      const r = await read(asins.map(pageFor), deps.token, { timeoutSecs: READ_TIMEOUT_S });
      reads = r.reads;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      return jobs.map((j) => ({ error: why, cost: pence(perCode.get(gtinOf.get(j.candidate_id) ?? '') ?? 0, 0, gbp) }));
    }
  }

  await phase(client, jobs, 'decide');
  const out: Outcome[] = [];
  // What Keeper found, on the card itself for every card it leaves, so it is seen in Candidates and never looked up
  // again to learn it. Not in a rehearsal.
  const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  const note = async (c: Json, body: string) => {
    if (run.rehearsal) return;
    const { error: e } = await client.from('candidate_notes').insert({ candidate_id: c.id, tenant_id: c.tenant_id, body: `Keeper on Amazon, ${day}: ${body}` });
    if (e) console.error('[keeper-run] note not written', c.id, e.message);
  };
  for (const job of jobs) {
    const c = byId.get(job.candidate_id);
    const gtin = gtinOf.get(job.candidate_id) ?? null;
    const pick = picked.get(job.id)!;
    const results = gtin ? found.get(gtin) ?? [] : [];
    // A barcode shared by two candidates is searched once; its cost is counted once, on the first.
    const first = jobs.find((j) => gtinOf.get(j.candidate_id) === gtin) === job;
    // The same page picked for two cards is read once, and paid for once.
    const firstRead = Boolean(pick.asin) && jobs.find((j) => picked.get(j.id)?.asin === pick.asin) === job;
    const cost = (first && gtin ? pence(perCode.get(gtin) ?? 0, 0, gbp) : 0) + (firstRead ? pence(0, 1, gbp) : 0);
    const base = { title: c?.title ?? null, image: c?.image_url ?? null, gtin, cost, ms: Date.now() - started };
    const done = (result: Json): Outcome => ({ state: 'done', result: { ...base, ...result }, cost });

    if (!c) { out.push(done({ tray: 'skipped', line: 'This card is no longer there.' })); continue; }
    if (c.decisions && (Array.isArray(c.decisions) ? c.decisions.length : true)) {
      out.push(done({ tray: 'skipped', line: 'Decided on the card meanwhile. Left as it is.' }));
      continue;
    }
    if (!gtin) { out.push(done({ tray: 'choose', line: 'No barcode to search with.' })); continue; }
    if (!results.length) {
      await note(c, `not found by its barcode ${gtin}.`);
      out.push(done({ tray: 'choose', line: 'Not found on Amazon by its barcode.', why: `Amazon UK's search for ${gtin} came back empty.` }));
      continue;
    }
    if (!pick.asin) {
      const seen = results.slice(0, 6).map((x) => ({ asin: x.asin, title: x.title ?? null, price: x.price ?? null, url: pageFor(x.asin).replace('?psc=1', '') }));
      await note(c, `${results.length} results for its barcode, none with a matching title: ${seen.map((x) => `${x.title ?? x.asin} ${x.url}`).join('; ')}`);
      out.push(done({ tray: 'choose', line: 'More than one result, and no title matches.', why: `${'why' in pick ? pick.why : ''}: ${results.map((x) => x.title ?? x.asin).join('; ')}.`, results: seen }));
      continue;
    }

    const r = reads.get(pick.asin);
    if (!r) { out.push({ error: 'Amazon did not return the product page.', cost }); continue; }
    const v = judge(c, gtin, r);
    if (!v.ok) {
      const url = r.asin ? pageFor(r.asin).replace('?psc=1', '') : null;
      await note(c, `${v.line} ${v.why === v.line ? '' : `${v.why} `}${url ?? ''}`.trim());
      // The reading is kept with the job, so nothing read is lost and the card is not looked up again to learn it.
      out.push(done({
        tray: 'choose', line: v.line, why: v.why, asin: r.asin, url,
        price: r.offer?.price ?? null, image: c.image_url ?? r.facts?.images?.[0] ?? null,
        read: { ...r, facts: r.facts ? { ...r.facts, text: undefined } : null },
      }));
      continue;
    }
    const yes = { v, r };
    const source = sourceOf(yes.r, v);
    const result = { line: v.line, why: v.why, asin: v.asin, url: source.url, price: v.cost, image: c.image_url ?? source.image_url };
    if (run.rehearsal) { out.push(done({ ...result, tray: 'ready', rehearsal: true })); continue; }

    const reading = nextRead(null, yes.r, { source_id: null, costed: v.cost });
    const { data: said, error: e } = await client.rpc('keeper_source_approve', {
      p_candidate: c.id, p_source: source, p_read: reading, p_note: v.line,
      // The card filled from the reading where empty: Amazon's facts, the link, the packed weight (0136).
      p_fill: fillOf(yes.r),
    });
    if (e) { out.push({ error: e.message, cost }); continue; }
    if (said?.status === 'approved') out.push(done({ ...result, tray: 'ready', source_id: said.source_id, filled: said.filled ?? null }));
    else out.push(done({ tray: 'skipped', line: said?.status === 'gone' ? 'This card is no longer there.' : 'Decided on the card meanwhile. Left as it is.' }));
  }
  return out;
}
