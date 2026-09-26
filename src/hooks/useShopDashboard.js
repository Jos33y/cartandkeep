import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { blockers, checksUnread, isLive, isArchived } from '@hooks/useCatalogue';
import { summarise } from '@lib/readiness';

/*
 * The screen she opens.
 *
 * Assembly rather than new machinery. What is blocked comes from the same guard
 * the Products page uses, orders to send from the same test the Orders page
 * uses, and money from the profit view Finance reads. Nothing is counted twice,
 * because two versions of a count is one of them being wrong and neither
 * knowing it.
 *
 * Four reads. A dashboard that opens a connection per panel is slower than the
 * screens it summarises.
 *
 * Three things this returns that a count alone cannot carry, and each one is
 * here because the first version of this screen was a list of numbers nobody
 * could act on:
 *
 *   thumbnails   which products a count refers to, so twenty five returns
 *                policies stops being an abstraction
 *   impact       what a number blocks, not just how big it is
 *   comparison   last week beside this week, because a figure with nothing to
 *                measure against does not answer the question it was asked
 */

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/*
 * London days, not UTC ones.
 *
 * "Taken today" is a question about her calendar. At 00:30 BST a UTC boundary
 * puts a sale that happened this morning into yesterday. Same reason the
 * confirmation email moved off getUTCHours.
 */
const LONDON = 'Europe/London';

function londonDay(d) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const shiftDays = (iso, by) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return londonDay(d);
};

// Monday, because her week starts on the day the pipeline is delivered.
function weekStart(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return shiftDays(iso, -((d.getUTCDay() + 6) % 7));
}

// Below this she is one order from being out. Three rather than a rounder
// number because at her volume two is normal and one is a Saturday.
const LOW_STOCK = 3;

// Enough to show a count is about real products without becoming a gallery.
const THUMBS = 3;

const EMPTY = {
  status: 'loading',
  error: null,
  live: [],
  split: { live: 0, ready: 0, blocked: 0, total: 0 },
  jobs: [],
  money: { today: 0, month: 0, lastSameDay: 0, byChannel: [], everSold: false },
  funnel: { looked: 0, saved: 0, basket: 0, bought: 0, lookedLastWeek: 0 },
  pulse: [],
  readiness: null,
};

const PULSE_DAYS = 14;

export function useShopDashboard(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const today = londonDay(new Date());
    const thisWeek = weekStart(today);
    const lastWeek = shiftDays(thisWeek, -7);
    const month = `${today.slice(0, 7)}-01`;
    const from = shiftDays(today, -(PULSE_DAYS - 1));

    const [catalogue, orders, profit, events] = await Promise.all([
      /*
       * The whole catalogue, because the release guard runs in the browser.
       *
       * `blockers()` reads eight fields including a jsonb one, so these counts
       * cannot be a database aggregate without the rule existing in two places.
       * At 78 rows that is the right trade, and it is the same limitation the
       * Products page already has.
       */
      supabase.from('store_products')
        .select('id, title, price, image_url, images, status, is_sample, stock, description, availability, hazard, derived_fields, category_path, section, landed_cost, returns_class, store_variants ( id, stock, availability )')
        .eq('tenant_id', tenantId),

      supabase.from('orders')
        .select('id, reference, status, total, paid_at, dispatched_at, address')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(500),

      supabase.from('store_channel_profit')
        .select('channel, revenue, net')
        .eq('tenant_id', tenantId)
        .gte('month', month),

      // Two weeks, so this week has something to be measured against.
      supabase.from('store_events')
        .select('event, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${from < lastWeek ? from : lastWeek}T00:00:00Z`),
    ]);

    const error = catalogue.error ?? orders.error ?? profit.error ?? events.error;
    if (error) return setState({ ...EMPTY, status: 'error', error });

    const rows = catalogue.data ?? [];
    const paid = orders.data ?? [];

    const liveRows = rows.filter(isLive);
    const blockedRows = rows.filter((p) => !isLive(p) && blockers(p).length > 0);

    /*
     * The work, ranked by what it blocks rather than by how big it is.
     *
     * An order waiting is a customer waiting, and it ranks above a hundred
     * products that are merely unfinished. Everything above `blocking: true`
     * stops a product going on sale, which is the only distinction the eye
     * needs to make on this screen.
     */
    const pick = (list) => list.slice(0, THUMBS)
      .map((p) => ({ id: p.id, title: p.title, image_url: p.image_url }));

    const returns = rows.filter((p) => p.derived_fields?.returns_class);
    const checks = rows.filter(checksUnread);
    const hazard = rows.filter((p) => p.derived_fields?.hazard_suspect && !p.hazard);
    const toSend = paid.filter((o) => !o.dispatched_at);
    const lowStock = rows.filter((p) => typeof p.stock === 'number' && p.stock > 0 && p.stock < LOW_STOCK);
    const noCopy = rows.filter((p) => !p.description?.trim() && !p.derived_fields?.draft);
    const drafted = rows.filter((p) => !p.description?.trim() && p.derived_fields?.draft);

    const oldest = toSend[toSend.length - 1];

    const jobs = [
      {
        key: 'returns',
        count: returns.length,
        label: 'Returns policies to confirm',
        one: 'Returns policy to confirm',
        impact: `Blocks ${returns.length} ${returns.length === 1 ? 'product' : 'products'}. Sets what the confirmation email promises`,
        blocking: true,
        to: '/products?filter=blocked',
        action: 'Review',
        thumbs: pick(returns),
      },
      {
        key: 'hazard',
        count: hazard.length,
        label: 'Label warnings to copy off the bottle',
        impact: 'Required by law before they go on sale',
        blocking: true,
        to: '/products?filter=blocked',
        action: 'Review',
        thumbs: pick(hazard),
      },
      {
        key: 'checks',
        count: checks.length,
        label: 'Products with a question for you',
        one: 'Product with a question for you',
        impact: 'One tap each, then they can go live',
        blocking: true,
        to: '/products?filter=blocked',
        action: 'Review',
        thumbs: pick(checks),
      },
      {
        key: 'send',
        count: toSend.length,
        label: 'Orders to pack and send',
        one: 'Order to pack and send',
        // The specific parcel rather than the count, because one order is a
        // person waiting and the reference is what she needs to find it.
        impact: oldest
          ? `${oldest.reference} to ${String(oldest.address?.postcode ?? '').split(' ')[0]}, paid ${since(oldest.paid_at)}`
          : 'Nothing waiting to go out',
        to: '/orders',
        action: 'Open',
      },
      {
        key: 'drafts',
        count: drafted.length,
        label: 'Drafts to read',
        one: 'Draft to read',
        impact: 'Written and waiting for you',
        to: '/products?filter=blocked',
        action: 'Read',
        thumbs: pick(drafted),
      },
      {
        key: 'copy',
        count: noCopy.length,
        label: 'Descriptions to write',
        one: 'Description to write',
        impact: 'Google will not list a product without one',
        to: '/products?filter=all&select=nocopy',
        // The one primary action on the page, because it is the only row that
        // can be cleared from here rather than navigated to.
        action: `Draft all ${noCopy.length}`,
        primary: true,
        thumbs: pick(noCopy),
      },
      {
        key: 'stock',
        count: lowStock.length,
        label: 'Nearly out of stock',
        impact: lowStock.length
          ? lowStock.slice(0, 2).map((p) => `${short(p.title)} has ${p.stock} left`).join(' · ')
          : 'Everything counted has stock',
        quiet: true,
        to: '/products?filter=live',
        action: 'Open',
        thumbs: pick(lowStock),
      },
    ];

    const takings = (from, to) => money(paid
      .filter((o) => {
        if (!o.paid_at) return false;
        const day = londonDay(new Date(o.paid_at));
        return day >= from && (!to || day <= to);
      })
      .reduce((n, o) => n + Number(o.total ?? 0), 0));

    const byChannel = new Map();
    for (const r of profit.data ?? []) {
      const e = byChannel.get(r.channel) ?? { channel: r.channel, revenue: 0, net: 0 };
      e.revenue += Number(r.revenue ?? 0);
      e.net += Number(r.net ?? 0);
      byChannel.set(r.channel, e);
    }

    /*
     * The funnel, over this week and last.
     *
     * Counted from events rather than from `store_product_funnel`, because that
     * view is per product and all time, and the question here is what happened
     * to the shop this week.
     */
    const inWeek = (from, to) => (e) => {
      const day = londonDay(new Date(e.created_at));
      return day >= from && (!to || day < to);
    };
    const rowsThis = (events.data ?? []).filter(inWeek(thisWeek, null));
    const count = (list, name) => list.filter((e) => e.event === name).length;

    const pulse = Array.from({ length: PULSE_DAYS }, (_, i) => {
      const day = shiftDays(from, i);
      const on = (e) => londonDay(new Date(e.created_at)) === day;
      const dayEvents = (events.data ?? []).filter(on);
      const sold = paid.filter((o) => o.paid_at && londonDay(new Date(o.paid_at)) === day);
      return {
        day,
        looked: count(dayEvents, 'view_product'),
        basket: count(dayEvents, 'add_to_basket'),
        sold: sold.length,
        takings: money(sold.reduce((n, o) => n + Number(o.total ?? 0), 0)),
        today: day === today,
      };
    });

    setState({
      status: 'ready',
      pulse,
      readiness: summarise(rows.filter((p) => !isArchived(p))),
      error: null,
      live: liveRows.slice(0, 7).map((p) => ({ id: p.id, title: p.title, image_url: p.image_url })),
      split: {
        live: liveRows.length,
        ready: rows.filter((p) => !isLive(p) && blockers(p).length === 0).length,
        blocked: blockedRows.length,
        total: rows.length,
      },
      jobs,
      money: {
        today: takings(today),
        month: takings(month),
        // The same weekday a week ago, not yesterday. A Thursday compared to a
        // Wednesday is a comparison against a different kind of day.
        lastSameDay: takings(shiftDays(today, -7), shiftDays(today, -7)),
        byChannel: [...byChannel.values()]
          .map((c) => ({ ...c, revenue: money(c.revenue), net: money(c.net) }))
          .sort((a, b) => b.revenue - a.revenue),
        everSold: paid.length > 0,
      },
      funnel: {
        looked: count(rowsThis, 'view_product'),
        saved: count(rowsThis, 'save_product'),
        basket: count(rowsThis, 'add_to_basket'),
        bought: paid.filter((o) => o.paid_at && londonDay(new Date(o.paid_at)) >= thisWeek).length,
        lookedLastWeek: count((events.data ?? []).filter(inWeek(lastWeek, thisWeek)), 'view_product'),
      },
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Same as the Orders page: refresh when she comes back to the tab, rather
  // than holding a socket open for a screen that is read and left.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return { ...state, reload: load };
}

// Rounded down and said the way somebody would say it. "Paid 2 hours ago" is
// what she would tell a customer on the phone.
function since(iso) {
  if (!iso) return 'just now';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/*
 * Her titles run past seventy characters and a line naming two products needs
 * them cut, but cutting at three words turned "Black Tree Floor Lamp LED 3
 * Light Adjustable" into "Black Tree Floor", which reads as nonsense.
 *
 * Cut on length with an ellipsis instead. A visibly truncated title is
 * obviously truncated; a tidily truncated one looks like the product's name.
 */
function short(title) {
  const clean = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 24) return clean;
  // Back to the last space, so a word is not sliced in half.
  const cut = clean.slice(0, 24);
  const space = cut.lastIndexOf(' ');
  return `${(space > 12 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

/*
 * Three steps, not four. Saving is not one of them.
 *
 * The first version chained Looked, Saved, Basket, Bought and the real data
 * broke it on the first day: eight looked, none saved, three basketed. Nobody
 * has to save a thing before buying it, so a step with three in it sat below a
 * step with none and the line above read "100% went no further" while three
 * people were demonstrably going further.
 *
 * Saving is a parallel signal, not a stage. It is reported beside the funnel
 * rather than inside it, because a product with saves and no sales is a price
 * problem and a product with neither is a photograph problem, and that is a
 * different question from where the buying path leaks.
 *
 * `dropAfter` belongs to the step the people fall out of, not the one they fail
 * to reach.
 */
export function funnelSteps(f) {
  const steps = [
    { key: 'looked', label: 'Looked', count: f.looked },
    { key: 'basket', label: 'Basket', count: f.basket },
    { key: 'bought', label: 'Bought', count: f.bought },
  ];

  const peak = steps[0].count;

  return steps.map((s, i) => {
    const below = steps[i + 1];
    /*
     * Only when the step below is genuinely smaller.
     *
     * Events arrive from a browser and a basket can outlive the page view that
     * produced it, so a week can end with more baskets than views recorded. A
     * negative drop rendered as "-38% went no further" is a figure nobody can
     * read, so it is withheld rather than dressed up.
     */
    const falls = below && s.count > 0 && below.count <= s.count;
    return {
      ...s,
      width: peak ? Math.max(2, (s.count / peak) * 100) : 2,
      dropAfter: falls ? Math.round(((s.count - below.count) / s.count) * 100) : null,
    };
  });
}
