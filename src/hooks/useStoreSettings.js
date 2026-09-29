import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Her shop settings.
 *
 * Everything here lives in `tenants.store`, and none of it is writable through
 * a plain update: `tenants_write` from 0001 is `is_platform_admin()` and column
 * grants cannot narrow it, because studio staff authenticate as the same role.
 * So writes go through `set_store_settings`, which checks membership and merges
 * only the keys it is willing to accept.
 *
 * Read straight from the table rather than through `loadTenant`, because that
 * caches for the life of the page and a settings screen that shows a stale
 * value after saving is worse than one that takes an extra round trip.
 */

const EMPTY = {
  trader: {
    legal_name: '', trading_as: '', address: '', return_address: '', company_number: '',
    email: '', complaints_url: '',
  },
  returns: { days: '', postage_paid_by: '' },
  delivery: {
    free_over: '', postage: '', cutoff_hour: '', transit_min: '', transit_max: '',
    zones: {},
  },
  voice: { tagline: '', hero_title: '', hero_em: '' },
  socials: { instagram: '', tiktok: '' },
  about: {
    title: '', lede: '', sections: [], refusals: [], her_words: '', closing_heading: '', closing_text: '',
  },
};

// Null and undefined both become an empty field. A form that renders "null" in
// a box is a form somebody will save with the word null in it.
const text = (v) => (v === null || v === undefined ? '' : String(v));

function shape(store) {
  const s = store ?? {};
  const t = s.trader ?? {};
  const d = s.delivery ?? {};
  const v = s.voice ?? {};
  const o = s.socials ?? {};
  const r = s.returns ?? {};

  return {
    trader: {
      legal_name: text(t.legal_name),
      trading_as: text(t.trading_as),
      address: text(t.address),
      return_address: text(t.return_address),
      company_number: text(t.company_number),
      email: text(t.email),
      complaints_url: text(t.complaints_url),
    },
    delivery: {
      free_over: text(d.free_over),
      postage: text(d.postage),
      cutoff_hour: text(d.cutoff_hour),
      transit_min: text(d.transit_min),
      transit_max: text(d.transit_max),
      zones: d.zones ?? {},
    },
    returns: { days: text(r.days), postage_paid_by: text(r.postage_paid_by) },
    voice: { tagline: text(v.tagline), hero_title: text(v.hero_title), hero_em: text(v.hero_em) },
    socials: { instagram: text(o.instagram), tiktok: text(o.tiktok) },
    about: aboutShape(v.about),
  };
}

// The About page's words, kept under voice so the existing write and read whitelists already carry them.
function aboutShape(a) {
  const x = a ?? {};
  return {
    title: text(x.title),
    lede: text(x.lede),
    sections: (x.sections ?? []).map((p) => ({ heading: text(p?.heading), text: text(p?.text) })),
    refusals: (x.refusals ?? []).map((r) => ({ no: text(r?.no), why: text(r?.why) })),
    her_words: text(x.her_words),
    closing_heading: text(x.closing?.heading),
    closing_text: text(x.closing?.text),
  };
}

/*
 * An empty box means "not set", which is a null, not an empty string.
 *
 * The difference matters on trader identity: the confirmation email omits the
 * block when a value is absent and records that it did, so an order that went
 * out short is findable later. An empty string is present and blank, which
 * would put a comma and nothing between two lines of an address.
 */
const orNull = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

const numOrNull = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error('That has to be a number.');
  return n;
};

export function useStoreSettings(tenantId) {
  const [state, setState] = useState({ status: 'loading', values: EMPTY, error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('tenants').select('store').eq('id', tenantId).single();

    if (error) return setState({ status: 'error', values: EMPTY, error });
    setState({ status: 'ready', values: shape(data?.store), error: null });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * One section at a time.
   *
   * Trader identity and delivery rates are different kinds of decision made at
   * different moments, and a single save button covering both means correcting
   * a postcode surcharge quietly resaves a legal name she was midway through
   * changing.
   */
  const save = useCallback(async (patch) => {
    const { error } = await supabase.rpc('set_store_settings', {
      p_tenant: tenantId,
      p_patch: patch,
    });

    if (error) {
      // 42501 is what the function raises when the caller does not belong to
      // the tenant. Anything else is a real failure and should say so.
      throw new Error(error.code === '42501'
        ? 'That is not your shop to change.'
        : error.message ?? 'That did not save.');
    }

    await load();
  }, [tenantId, load]);

  const saveTrader = useCallback((t) => {
    // A link or an address someone can write to; anything else prints on a receipt as nonsense.
    const complaints = String(t.complaints_url ?? '').trim();
    if (complaints && !/^https?:\/\/\S+$/i.test(complaints) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(complaints)) {
      return Promise.reject(new Error('Where complaints go has to be a web address or an email address.'));
    }
    return save({
    trader: {
      legal_name: orNull(t.legal_name),
      trading_as: orNull(t.trading_as),
      address: orNull(t.address),
      return_address: orNull(t.return_address),
      company_number: orNull(t.company_number),
      email: orNull(t.email),
      complaints_url: orNull(t.complaints_url),
    },
    });
  }, [save]);

  const saveDelivery = useCallback((d) => save({
    delivery: {
      free_over: numOrNull(d.free_over),
      postage: numOrNull(d.postage),
      cutoff_hour: numOrNull(d.cutoff_hour),
      transit_min: numOrNull(d.transit_min),
      transit_max: numOrNull(d.transit_max),
    },
  }), [save]);

  /*
   * Zones are sent whole rather than merged key by key.
   *
   * `set_store_settings` merges one level, so `delivery` keeps its postage and
   * threshold while `zones` is replaced entirely. That is what is wanted here:
   * the screen renders every zone every time, so the object it sends is the
   * complete picture and a zone missing from it was meant to be removed.
   */
  const saveZones = useCallback((zones) => save({ delivery: { zones } }), [save]);

  // The database refuses the same limits; checked here too so the message is in her words.
  const saveReturns = useCallback((r) => {
    const days = Number(r.days);
    if (!Number.isInteger(days) || days < 14 || days > 365) {
      return Promise.reject(new Error('The return window has to be at least 14 days, which is the legal minimum.'));
    }
    if (!['us', 'customer'].includes(r.postage_paid_by)) {
      return Promise.reject(new Error('Choose who pays return postage.'));
    }
    return save({ returns: { days, postage_paid_by: r.postage_paid_by } });
  }, [save]);

  const saveVoice = useCallback((v) => save({
    voice: {
      tagline: orNull(v.tagline),
      hero_title: orNull(v.hero_title),
      hero_em: orNull(v.hero_em),
    },
    socials: { instagram: orNull(v.instagram), tiktok: orNull(v.tiktok) },
  }), [save]);

  /*
   * Sent whole, as zones are: `voice` merges one level, so `about` is replaced
   * and the tagline beside it is left alone. Empty rows are dropped so a blank
   * box never reaches the page as an empty heading.
   */
  const saveAbout = useCallback((a) => {
    const sections = a.sections
      .map((p) => ({ heading: orNull(p.heading), text: orNull(p.text) }))
      .filter((p) => p.heading || p.text);
    const refusals = a.refusals
      .map((r) => ({ no: orNull(r.no), why: orNull(r.why) }))
      .filter((r) => r.no);
    if (a.refusals.some((r) => !orNull(r.no) && orNull(r.why))) {
      return Promise.reject(new Error('Each thing you will not do needs its line before its reason.'));
    }
    const closing = orNull(a.closing_heading) || orNull(a.closing_text)
      ? { heading: orNull(a.closing_heading), text: orNull(a.closing_text) }
      : null;
    return save({
      voice: {
        about: {
          title: orNull(a.title),
          lede: orNull(a.lede),
          sections,
          refusals,
          her_words: orNull(a.her_words),
          closing,
        },
      },
    });
  }, [save]);

  return { ...state, reload: load, saveTrader, saveDelivery, saveZones, saveReturns, saveVoice, saveAbout };
}

/*
 * What is still missing from the trader block.
 *
 * Schedule 2 items b and c: the trading name and a geographic address are
 * required on the confirmation of a distance contract. Until both are present
 * every confirmation this shop sends is short of information the regulations
 * require, so the screen says so at the top rather than leaving it as a blank
 * field among other blank fields.
 */
export function traderGaps(trader) {
  const gaps = [];
  if (!trader.legal_name.trim()) gaps.push('legal name');
  if (!trader.address.trim()) gaps.push('address');
  return gaps;
}

export const ZONES = [
  { key: 'mainland', label: 'UK mainland', fixed: true },
  { key: 'highlands', label: 'Scottish Highlands and Islands' },
  { key: 'northern_ireland', label: 'Northern Ireland' },
  { key: 'isle_of_man', label: 'Isle of Man' },
  { key: 'isles_of_scilly', label: 'Isles of Scilly' },
  { key: 'channel_islands', label: 'Channel Islands', blocked: true },
];
