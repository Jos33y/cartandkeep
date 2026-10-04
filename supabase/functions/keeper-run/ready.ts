// Keeper task 03 (Joseey, 4 October): an approved card got ready for eBay, the work Get it ready did on the Approved
// page, done here in Keeper's office. For each card, in order, only what is missing:
//
//   amazon  her Amazon page read again when the reading is more than 48 hours old (supplier-read), else the saved
//           reading; Amazon's facts into an empty supplier box;
//   photos  the photo check (photo-check) of her Amazon gallery, else of the shop page and eBay's catalogue; the
//           photos that passed go in, plain shots first, up to 12;
//   words   the title and the description (ebay-compose);
//   ebay    eBay's category and the item details it asks for, filled from the facts (ebay-list, a dry run);
//   parcel  the size and the weight from Amazon's package, else its product size, else the page's words.
//
// It never lists. Every write goes through keeper_ready_fill (0138), which fills a field only while it is still
// empty, so nothing she wrote is replaced. A card takes a few calls of the worker: each call does the steps it has
// time for and keeps its place (the job's result.progress), so no call runs past the function's limit.

import { asSent, supplierPageOf } from '../_shared/amazon.ts';
import { parcelFromRead, parcelPatch } from '../_shared/parcel.ts';
import { productKey, swappedTo } from '../_shared/product.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export type ReadyOutcome =
  | { state: 'done'; result: Json; cost: number }
  | { again: true; result: Json; cost: number }
  | { error: string; cost: number };

// Another of our functions, called as the service: (name, body, extra headers) to its JSON answer.
export type Call = (fn: string, body: Json, headers?: Record<string, string>) => Promise<Json>;

export type ReadyDeps = {
  call: Call;
  // The scheduler secret, for supplier-read: it reads for the schedule or for a member, and Keeper is neither.
  secret: () => Promise<string>;
  now?: () => number;
};

// A reading older than this is read again before the card is written from it (Joseey, 4 October).
export const FRESH_MS = 48 * 3600 * 1000;
// Each call stops starting new steps after this long on one card; the next call carries on.
const STEP_BUDGET_MS = 30_000;
export const STEPS = ['amazon', 'photos', 'words', 'ebay', 'parcel'] as const;

/*
 * What each step costs, in pence, roughly: Apify's page read, and Claude for the photo check, each piece of writing
 * and the item details. About 5p a card when every step runs (keepr-agent-04: about $0.05 a card).
 */
export const COST = { read: 0.12, photos: 2, title: 0.6, description: 0.9, details: 0.8 };

// The photo check's version and page rules, as src/lib/photos.js has them, so Keeper and the page agree.
const PHOTO_CHECK_VERSION = 2;
const MAX_IMAGES = 12;
const ANOTHER_SELLER = /^https?:\/\/i\.ebayimg\.com\//i;

export const pageOf = (c: Json) => (swappedTo(c)
  ? c.draft?.page ?? null
  : c.draft?.page ?? c.margin?.shelf?.url ?? c.margin?.cost_from?.url ?? null);

export function freshChecks(c: Json) {
  const pc = c.photo_checks;
  if (!pc || (pc.version ?? 1) < PHOTO_CHECK_VERSION) return null;
  if ((pc.product ?? null) !== productKey(c)) return null;
  if (pc.page && pageOf(c) && pc.page !== pageOf(c)) return null;
  return pc;
}

const checkedPhotos = (pc: Json) => [
  ...(pc?.images ?? []),
  ...((pc?.others ?? []) as Json[]).filter((o) => o.ok).flatMap((o) => o.images ?? []),
];

export function passedPhotos(c: Json): string[] {
  const pc = freshChecks(c);
  if (!pc || pc.brand_rule) return [];
  return (checkedPhotos(pc) as Json[]).filter((i) => i.ok)
    .sort((x, y) => Number(Boolean(x.extra)) - Number(Boolean(y.extra)))
    .map((i) => String(i.copy ?? i.url))
    .filter((u) => !ANOTHER_SELLER.test(u));
}

// Every passed photo after hers, up to twelve, and eBay's catalogue entry when she has none. As photosToAdd.
export function photosToAdd(c: Json): Json | null {
  const pc = freshChecks(c);
  if (!pc) return null;
  const d = c.draft ?? {};
  const patch: Json = {};
  const have: string[] = d.images ?? [];
  const offered = new Set<string>(d.photos_offered ?? []);
  const fresh = passedPhotos(c).filter((u) => !have.includes(u) && !offered.has(u));
  const room = Math.max(0, MAX_IMAGES - have.length);
  if (fresh.length && room) {
    const adding = fresh.slice(0, room);
    patch.images = [...have, ...adding];
    patch.photos_offered = [...offered, ...have, ...adding];
  }
  if (!d.catalogue?.epid && pc.catalogue?.epid) patch.catalogue = { epid: pc.catalogue.epid, title: pc.catalogue.title, images: pc.catalogue.images ?? [] };
  return Object.keys(patch).length ? patch : null;
}

// Her Amazon gallery not checked yet (as ApprovedPage's unchecked).
export const unchecked = (c: Json, sent: Json | null) =>
  Boolean(sent?.images?.length) && !((c.photo_checks?.others ?? []) as Json[]).some((o) => o.sent && o.url === sent!.url);

// The facts into an empty supplier box, or one still holding the last reading's words (as supplierPatch).
export function supplierPatch(d: Json, r: Json | null): Json | null {
  const text = r?.facts?.text;
  if (!text) return null;
  const have = String(d?.supplier_text ?? '');
  if (have.trim() && have !== d?.supplier_auto) return null;
  if (have === text) return null;
  return { supplier_text: text, supplier_auto: text, ...(d?.supplier_url ? {} : { supplier_url: r!.url }) };
}

// eBay's category and Keepr's item details from a dry run, never over hers (as fromEbayCheck).
export function fromEbayCheck(dry: Json | null, d: Json = {}): Json | null {
  if (!dry?.category) return null;
  const aspects: Json = { ...(dry.filled ?? {}) };
  for (const [k, v] of Object.entries(d.aspects ?? {})) if (v) aspects[k] = v;
  return {
    ebay_category: { id: dry.category.id, name: dry.category.name ?? null, source: dry.category.source, required: ((dry.missing ?? []) as Json[]).map((a) => a.name) },
    aspects,
  };
}

const blank = (v: unknown) => !String(v ?? '').trim();
const London = { timeZone: 'Europe/London' } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...London });

// The item details eBay still needs for the category on her draft.
export function lacking(d: Json): string[] {
  const cat = d.ebay_category;
  if (!cat) return [];
  const have = new Set(Object.entries(d.aspects ?? {}).filter(([, v]) => v && String(v).trim()).map(([k]) => k.toLowerCase()));
  return ((cat.required ?? []) as string[]).filter((n) => !have.has(String(n).toLowerCase()));
}

/*
 * Where a card stands once Keeper has done what it can: ready to list, or what still needs her. The page's own
 * checklist (src/lib/golive.js) has the last word; these are the parts Keeper can fill.
 */
export function verdict(d: Json) {
  const need: string[] = [];
  if (blank(d.title)) need.push('a title');
  else if (String(d.title).length > 80) need.push('a title of 80 characters or fewer');
  if (blank(d.description)) need.push('a description');
  if (!(d.images ?? []).length) need.push('photos');
  if (!d.ebay_category) need.push("eBay's category");
  const still = lacking(d);
  if (still.length) need.push(`eBay's ${still.join(', ')}`);
  return need;
}

const CARD = 'id, tenant_id, title, image_url, external_ref, draft, supplier_read, photo_checks, listing, margin, ebay, decisions ( action )';

async function load(client: Client, id: string) {
  const [{ data: c, error: e1 }, { data: sources, error: e2 }] = await Promise.all([
    client.from('candidates').select(CARD).eq('id', id).maybeSingle(),
    client.from('candidate_sources').select('id, candidate_id, url, unit_cost, landed_unit_cost').eq('candidate_id', id),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  return c ? { c: c as Json, sources: (sources ?? []) as Json[] } : null;
}

const approved = (c: Json) => (Array.isArray(c.decisions) ? c.decisions : c.decisions ? [c.decisions] : []).some((d: Json) => d.action === 'approve');

/*
 * One card, as far as this call has time for. `progress` is where the last call got to: the next step, what was
 * done and what was left for her, and what was spent. A step that fails outright comes back as an error, so the job
 * is tried again (three times in all) from the step it was on.
 */
export async function readyOne(client: Client, job: Json, deps: ReadyDeps): Promise<ReadyOutcome> {
  const now = deps.now ?? Date.now;
  const started = now();
  const progress: Json = { step: 0, done: [], short: [], spent: 0, ...(job.result?.progress ?? {}) };
  let cost = 0;
  const base = () => ({ title: card?.c.draft?.title || card?.c.title || null, image: (card?.c.draft?.images ?? [])[0] ?? card?.c.image_url ?? null });
  let card: { c: Json; sources: Json[] } | null = await load(client, job.candidate_id);

  const finish = (result: Json): ReadyOutcome => ({ state: 'done', result: { ...base(), ...result, spent: progress.spent + cost }, cost });
  if (!card) return finish({ tray: 'skipped', line: 'This card is no longer there.' });
  if (!approved(card.c)) return finish({ tray: 'skipped', line: 'No longer approved. Left as it is.' });
  if (card.c.ebay?.listing_id) return finish({ tray: 'skipped', line: 'Already live on eBay. Left as it is.' });

  // Her draft written only through keeper_ready_fill; what came back is the card as it is now.
  const fill = async (patch: Json | null) => {
    if (!patch || !Object.keys(patch).length) return [] as string[];
    const { data, error } = await client.rpc('keeper_ready_fill', { p_candidate: card!.c.id, p_patch: patch });
    if (error) throw new Error(error.message);
    if (data?.status !== 'ok') throw Object.assign(new Error(data?.status ?? 'not written'), { status: data?.status });
    card!.c.draft = data.draft;
    return (data.applied ?? []) as string[];
  };
  const done = (s: string) => { if (!progress.done.includes(s)) progress.done.push(s); };
  const short = (s: string) => { if (!progress.short.includes(s)) progress.short.push(s); };
  const save = async (step: string) => {
    await client.from('keeper_jobs').update({ result: { phase: step, progress: { ...progress, spent: progress.spent + cost } } }).eq('id', job.id);
  };
  const reading = () => {
    const page = supplierPageOf(card!.c, card!.sources);
    const r = card!.c.supplier_read;
    return 'asin' in page && page.asin && r?.asin === page.asin && r?.facts ? r : null;
  };

  try {
    while (progress.step < STEPS.length) {
      if (progress.step > 0 && now() - started > STEP_BUDGET_MS) {
        return { again: true, result: { ...base(), phase: STEPS[progress.step], progress: { ...progress, spent: progress.spent + cost } }, cost };
      }
      const step = STEPS[progress.step];
      await save(step);
      const c: Json = card.c;
      const d: Json = c.draft ?? {};

      if (step === 'amazon') {
        const page = supplierPageOf(c, card.sources);
        if ('asin' in page && page.asin) {
          const r = c.supplier_read;
          const fresh = r?.asin === page.asin && r?.facts && r?.read_at && now() - Date.parse(r.read_at) < FRESH_MS;
          if (!fresh) {
            cost += COST.read;
            const said = await deps.call('supplier-read', { tenant_id: c.tenant_id, candidate_ids: [c.id] }, { 'x-scheduler-secret': await deps.secret() })
              .catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
            card = (await load(client, c.id)) ?? card;
            if (said?.error) short(`Amazon not read: ${said.error}`);
          }
          const now2 = reading();
          if (now2) {
            if (now() - Date.parse(now2.read_at) >= FRESH_MS) short(`Amazon could not be read today, so the reading from ${day(now2.read_at)} was used`);
            const applied = await fill(supplierPatch(card.c.draft ?? {}, now2));
            if (applied.includes('supplier_text')) done("Amazon's product details");
          } else short("Amazon's page could not be read, so the card was written from the shop's page");
        }
      }

      if (step === 'photos' && !(d.images ?? []).length) {
        const r = reading();
        const sent = r ? asSent(r) : null;
        const check = async (body: Json) => {
          cost += COST.photos;
          const out = await deps.call('photo-check', { tenant_id: c.tenant_id, candidate_id: c.id, ...body });
          if (out?.error) throw new Error(`photo check: ${out.error}`);
          card!.c.photo_checks = out.photo_checks;
        };
        if (sent && unchecked(c, sent)) await check({ supplied: sent });
        else if (!freshChecks(c)) await check({});
        let add = photosToAdd(card.c);
        // Nothing passed from her Amazon page: the shop's page, other UK shops and eBay's catalogue, once.
        if (!add?.images?.length && sent && !progress.wider) {
          progress.wider = true;
          await check({ wider: true });
          add = photosToAdd(card.c);
        }
        const before = (card.c.draft?.images ?? []).length;
        const applied = await fill(add);
        const n = (card.c.draft?.images ?? []).length - before;
        if (n > 0) done(`${n} ${n === 1 ? 'photo' : 'photos'}`);
        if (applied.includes('catalogue')) done("eBay's catalogue");
        if (!(card.c.draft?.images ?? []).length) short('No photos passed the check: add your own');
      }

      if (step === 'words') {
        const want = { title: blank(d.title), words: blank(d.description) };
        const [t, w] = await Promise.all([
          want.title ? deps.call('ebay-compose', { tenant_id: c.tenant_id, candidate_id: c.id, kind: 'title' }) : null,
          want.words ? deps.call('ebay-compose', { tenant_id: c.tenant_id, candidate_id: c.id, kind: 'description' }) : null,
        ]);
        if (want.title) cost += COST.title;
        if (want.words) cost += COST.description;
        const patch: Json = {};
        if (want.title) {
          if (t?.titles?.[0]) patch.title = t.titles[0];
          else short(t?.conflict ? `No title: the sources disagree, ${t.conflict}` : `No title: ${t?.error ?? 'none came back'}`);
        }
        if (want.words) {
          if (w?.description) patch.description = w.description;
          else short(w?.conflict ? `No description: the sources disagree, ${w.conflict}` : `No description: ${w?.error ?? 'none came back'}`);
        }
        const applied = await fill(patch);
        if (applied.includes('title')) done('a title');
        if (applied.includes('description')) done('the description');
      }

      if (step === 'ebay') {
        const now3 = card.c.draft ?? {};
        if (blank(now3.title)) short("eBay's category waits for a title");
        else if (!now3.ebay_category || lacking(now3).length) {
          const dry = await deps.call('ebay-list', {
            tenant_id: c.tenant_id, candidate_id: c.id, dry: true, fill: true, quantity: 5,
            title: now3.title, description: now3.description, images: now3.images ?? [], aspects: now3.aspects ?? {},
            use_catalogue: Boolean(now3.catalogue?.epid), package: now3.package ?? undefined,
            ...(now3.ebay_category?.id ? { category_id: now3.ebay_category.id } : {}),
          });
          if (dry?.error) short(`eBay's check: ${dry.error}`);
          else {
            if (Object.keys(dry?.filled ?? {}).length) cost += COST.details;
            const found = fromEbayCheck(dry, now3);
            const applied = await fill(found);
            if (applied.includes('ebay_category')) done(`the eBay category (${found!.ebay_category.name ?? found!.ebay_category.id})`);
            const details = applied.filter((a) => a.startsWith('aspects.')).length;
            if (details) done(`${details} item ${details === 1 ? 'detail' : 'details'}`);
            if (dry?.fill_error) short(`Item details not filled: ${dry.fill_error}`);
          }
        }
      }

      if (step === 'parcel') {
        const p = parcelFromRead(reading());
        const add = parcelPatch(card.c.draft?.package, p);
        if (add) {
          const applied = await fill({ package: add, parcel_from: p!.from });
          if (applied.some((a) => a.startsWith('package.'))) done(p!.from.replace(/^From /, 'the parcel from '));
        }
        if (p?.note) short(p.note);
      }

      progress.step += 1;
    }
  } catch (e) {
    const status = (e as { status?: string })?.status;
    if (status === 'live') return finish({ tray: 'skipped', line: 'Went live on eBay meanwhile. Left as it is.' });
    if (status === 'decided' || status === 'gone') return finish({ tray: 'skipped', line: 'No longer approved. Left as it is.' });
    // Kept where it got to, so the next try starts from this step, with what was spent counted.
    await save(STEPS[progress.step]).catch(() => {});
    return { error: `${STEPS[progress.step]}: ${e instanceof Error ? e.message : String(e)}`, cost };
  }

  // Keeper's own note on the card: what it did, and what is left for her.
  const need = verdict(card.c.draft ?? {});
  await fill({ keeper_ready: { at: new Date(now()).toISOString(), run_id: job.run_id ?? null, done: progress.done, short: progress.short, need } });
  const did = progress.done.length ? `Keeper added ${progress.done.join(', ')}.` : 'Nothing was missing.';
  return finish({
    tray: need.length ? 'choose' : 'ready',
    line: need.length ? `${did} Still needs ${need.join(', ')}.` : `${did} Ready to list.`,
    done: progress.done,
    short: progress.short,
    need,
  });
}

// A batch: each card on its own, side by side. A card that fails is tried again by the worker from where it got to.
export async function readyBatch(client: Client, jobs: Json[], deps: ReadyDeps): Promise<ReadyOutcome[]> {
  const outs = await Promise.allSettled(jobs.map((j) => readyOne(client, j, deps)));
  return outs.map((o) => (o.status === 'fulfilled' ? o.value : { error: o.reason instanceof Error ? o.reason.message : String(o.reason), cost: 0 }));
}
