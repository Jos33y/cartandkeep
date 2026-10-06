// Her Amazon supplier's page read through Apify, for two callers:
//   the portal  reads the cards it names (when she adds an Amazon link, or before Get it ready writes from it);
//   the schedule  reads every card live on eBay with an Amazon supplier once a day, 20 at a time, for the price and
//                 stock check. Cards still waiting in Approved are read by Keeper when it gets them ready (48 hours).
// The reading goes on the card (candidates.supplier_read) and into the history (supplier_checks). Her draft is never
// written here: the portal puts the facts and photos in her draft, the way the Send button does.
// Her supplier's cost follows Amazon's price where it came from Amazon (costFollow), and so does the shop product's
// cost where it came from the supplier. A cost she set herself is never moved: she is told, and offered the price.
// A live listing whose cost changed is emailed to the shop's own address, once per change (Joseey, 5 October: only
// price changes reach her by email). Through the notify function, which owns every email.
// Needs APIFY_TOKEN in the function secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { env } from '../_shared/ebay/listing.ts';
import { BATCH, costFollow, failedRead, londonDay, nextRead, runAxesso, supplierPageOf } from '../_shared/amazon.ts';
import { priceAlert } from './alert.ts';

type Json = Record<string, any>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version, x-scheduler-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// A reading this recent is used again when the portal asks, rather than paying Apify twice for the same page. The same
// 48 hours Keeper uses when it gets a card ready (keeper-run/ready.ts).
const FRESH_HOURS = 48;
// The most cards one shop is read for in a day, whatever the list grows to. About £0.35 a day at Apify's price.
const DAILY_MAX = 240;

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function callerOf(req: Request, tenantId: string): Promise<'schedule' | 'portal' | null> {
  const sent = req.headers.get('x-scheduler-secret');
  if (sent) {
    const { data } = await db().from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
    return sameSecret(sent, data?.value ?? '') ? 'schedule' : null;
  }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  return !error && data === true ? 'portal' : null;
}

// Freight and duty mark an imported stock route, whose cost is not Amazon's price (costFollow).
const SOURCE_FIELDS = 'id, candidate_id, url, unit_cost, landed_unit_cost, price_at_moq, supplier_shipping, inbound_freight_per_unit, duty_pct, fulfilment, cost_by';
// What the portal holds for a supplier (useApproved), so a moved cost lands on the card without a reload.
const SOURCE_ROW = `id, candidate_id, supplier, supplier_kind, fulfilment, status, url, note, unit_cost, moq, price_at_moq,
  supplier_shipping, inbound_freight_per_unit, duty_pct, landed_unit_cost, ships_from, transit_days, confirmed, quoted_on,
  matched_on, cost_by`;
// A shop product's cost that came from the supplier rather than from her, so it may follow the supplier's.
const FROM_SUPPLIER = 'landed_cost.is.null,cost_note.ilike.From the confirmed supplier*,cost_note.ilike.Amazon price*';

// Approved cards with an Amazon supplier link, on her supplier list or sent from her browser.
async function cardsWithAmazon(client: ReturnType<typeof db>, tenantId: string) {
  const [{ data: src, error: e1 }, { data: sent, error: e2 }] = await Promise.all([
    client.from('candidate_sources').select('candidate_id').eq('tenant_id', tenantId).ilike('url', '%amazon.%').limit(2000),
    client.from('candidates').select('id').eq('tenant_id', tenantId).ilike('draft->>supplier_url', '%amazon.%').limit(2000),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return [...new Set([...(src ?? []).map((s) => s.candidate_id), ...(sent ?? []).map((c) => c.id)])];
}

// Of those, the cards live on eBay: the card holds its listing id (ebay-list writes it on publishing). Only these are
// read every morning (Joseey, 4 October): a card waiting in Approved is read when Keeper gets it ready.
async function liveOnEbay(client: ReturnType<typeof db>, tenantId: string, ids: string[]) {
  const { data, error } = await client.from('candidates').select('id').eq('tenant_id', tenantId)
    .not('ebay->>listing_id', 'is', null).limit(5000);
  if (error) throw new Error(error.message);
  const live = new Set((data ?? []).map((c: Json) => c.id));
  return ids.filter((id) => live.has(id));
}

async function load(client: ReturnType<typeof db>, tenantId: string, ids: string[]) {
  const cards: Json[] = [];
  const sources: Json[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const [{ data: c, error: e1 }, { data: s, error: e2 }] = await Promise.all([
      client.from('candidates').select('id, title, draft, ebay, supplier_read, decisions!inner ( action )')
        .eq('tenant_id', tenantId).eq('decisions.action', 'approve').in('id', part),
      client.from('candidate_sources').select(SOURCE_FIELDS).eq('tenant_id', tenantId).in('candidate_id', part),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2)!.message);
    cards.push(...(c ?? []));
    sources.push(...(s ?? []));
  }
  return cards.map((c) => {
    const mine = sources.filter((s) => s.candidate_id === c.id);
    return { c, sources: mine, page: supplierPageOf(c, mine) };
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const { tenant_id: tenantId, candidate_ids: asked = [], url: override = null, again = false, daily = false } = body;
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
    const caller = await callerOf(req, tenantId);
    if (!caller) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);
    if (daily && caller !== 'schedule') return json({ error: 'The daily check runs on its own schedule.' }, 400);
    const token = Deno.env.get('APIFY_TOKEN');
    if (!token) return json({ error: 'Amazon pages cannot be read yet: APIFY_TOKEN is not set on this function.' }, 503);

    const client = db();
    const now = new Date().toISOString();
    const today = londonDay(now);
    // deno-lint-ignore no-explicit-any
    let todo: Array<{ c: Json; page: any; sources: Json[] }>;
    const skipped: Record<string, string> = {};

    if (daily) {
      const all = await load(client, tenantId, await liveOnEbay(client, tenantId, await cardsWithAmazon(client, tenantId)));
      const { count } = await client.from('supplier_checks').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('started_by', 'schedule').gte('checked_at', new Date(Date.now() - 20 * 3600 * 1000).toISOString());
      const room = Math.max(0, DAILY_MAX - (count ?? 0));
      const tried = (c: Json) => c.supplier_read?.tried_at ?? c.supplier_read?.read_at ?? null;
      todo = all.filter(({ c, page }) => page.asin && londonDay(tried(c)) !== today)
        .sort((a, b) => String(tried(a.c) ?? '').localeCompare(String(tried(b.c) ?? '')))
        .slice(0, Math.min(BATCH, room));
      if (!todo.length) return json({ read: 0, left: 0 });
    } else {
      const ids = (Array.isArray(asked) ? asked : []).map(String).slice(0, BATCH);
      if (!ids.length) return json({ error: 'candidate_ids is required' }, 400);
      const loaded = await load(client, tenantId, ids);
      // A link she has just added: read before it is saved on the card, costed from her supplier with the same ASIN.
      if (override && ids.length === 1 && loaded[0]) loaded[0].page = supplierPageOf({ draft: { supplier_url: override } }, loaded[0].sources);
      todo = [];
      for (const x of loaded) {
        const r = x.c.supplier_read;
        // A reading that found no price is never fresh: read again, whatever its age (the Salus, 4 October).
        const fresh = !again && r?.asin === x.page.asin && r?.found && r?.offer?.price != null && r?.read_at && Date.now() - Date.parse(r.read_at) < FRESH_HOURS * 3600 * 1000;
        if (!x.page.asin) skipped[x.c.id] = x.page.reason === 'not_uk' ? 'Only amazon.co.uk pages are read: another Amazon prices in another currency.' : 'No Amazon link on this card.';
        else if (!fresh) todo.push(x);
      }
      for (const id of ids) if (!loaded.some((x) => x.c.id === id)) skipped[id] = 'Not an approved card.';
    }

    const { reads, failed } = todo.length ? await runAxesso(todo.map((x) => x.page.url), token) : { reads: new Map(), failed: [] as string[] };

    const out: Record<string, Json> = {};
    const moved: Record<string, Json> = {};
    const tell: Json[] = [];
    const history: Json[] = [];
    for (const { c, page, sources } of todo) {
      const r = reads.get(page.asin);
      const next: Json = r ? nextRead(c.supplier_read, r, page) : failedRead(c.supplier_read, page, failed.includes(page.asin) ? 'Apify did not return this page.' : 'Not read.', now);

      // Her cost, moved with Amazon's price where it came from Amazon. Written before the reading, so the reading
      // says what it was costed at after the move and the card's warning compares like with like.
      const source = sources.find((s) => s.id === page.source_id) ?? null;
      const follow = r ? costFollow(c.supplier_read, r, source) : null;
      if (follow && source) {
        const { data: row, error: e } = await client.from('candidate_sources')
          // Back in stock with a price: a supplier saved as unavailable is quoted again.
          .update({
            unit_cost: follow.to, price_at_moq: follow.to, supplier_shipping: follow.shipping, inbound_freight_per_unit: follow.freight,
            cost_by: 'amazon', quoted_on: r!.read_at.slice(0, 10), status: 'quoted',
          })
          .eq('id', source.id).eq('tenant_id', tenantId).select(SOURCE_ROW).single();
        if (e) console.error('[supplier-read] cost not moved', c.id, e.message);
        else {
          moved[c.id] = row;
          next.costed = row.landed_unit_cost != null ? Number(row.landed_unit_cost) : follow.to;
          next.cost_change = { from: follow.from, to: follow.to, at: r!.read_at, why: follow.why };
          const { error: e2 } = await client.from('store_products')
            .update({ landed_cost: row.landed_unit_cost, cost_note: `Amazon price, read ${londonDay(r!.read_at)}`, cost_updated_at: now })
            .eq('tenant_id', tenantId).eq('candidate_id', c.id).neq('status', 'archived').or(FROM_SUPPLIER);
          if (e2) console.error('[supplier-read] shop cost not moved', c.id, e2.message);
        }
      }

      // Live on eBay and the cost changed: she hears about it once. Followed (her cost moved with Amazon), or Amazon
      // now dearer than a cost she set herself, told once per new price.
      const alert = r ? priceAlert(c, source, moved[c.id] ?? null, follow, r, page.costed, next.told) : null;
      if (alert) {
        tell.push(alert);
        next.told = { price: alert.to, at: r!.read_at };
      }

      const { error } = await client.from('candidates').update({ supplier_read: next }).eq('id', c.id).eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      out[c.id] = next;
      history.push({
        tenant_id: tenantId, candidate_id: c.id, asin: page.asin, url: page.url, started_by: caller, checked_at: r?.read_at ?? now,
        found: r ? r.found : false, price: r?.offer.price ?? null, was: r?.offer.was ?? null, deal: r?.offer.deal ?? false,
        shipping: r?.offer.shipping ?? null, stock: r ? r.offer.stock : 'unknown', stock_text: r?.offer.stock_text ?? null,
        sold_by: r?.offer.sold_by ?? null, costed: page.costed, error: r ? null : next.error,
      });
    }
    if (history.length) {
      const { error } = await client.from('supplier_checks').insert(history);
      if (error) console.error('[supplier-read] history not written', error.message);
    }

    // Sent after the readings are saved. A send that fails is logged, not retried: the same trade every email here makes.
    if (tell.length) {
      // The price it sells at on eBay: on the card once changed from the portal, else the latest pull.
      for (const t of tell.filter((x) => x.price == null)) {
        const { data } = await client.from('ebay_traffic').select('price').eq('tenant_id', tenantId).eq('listing_id', t.listing_id)
          .not('price', 'is', null).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
        t.price = data?.price != null ? Number(data.price) : null;
      }
      try {
        const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/notify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ kind: 'price_alert', tenant_id: tenantId, items: tell }),
        });
        if (!res.ok) console.error('[supplier-read] price email', res.status, await res.text().catch(() => ''));
      } catch (e) {
        console.error('[supplier-read] price email', e instanceof Error ? e.message : String(e));
      }
    }

    // The cards that were fresh enough come back as they are.
    if (!daily) {
      for (const id of (asked as string[]).slice(0, BATCH)) {
        if (!out[id] && !skipped[id]) {
          const { data } = await client.from('candidates').select('supplier_read').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
          if (data?.supplier_read) out[id] = data.supplier_read;
        }
      }
    }
    return json({ read: reads.size, failed: failed.length, reads: out, skipped, moved, told: tell.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
