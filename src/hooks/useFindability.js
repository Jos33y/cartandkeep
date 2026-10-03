import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Being found.
 *
 * Two halves that have to stay separate. The Google half is what Search Console
 * reported in a given month, stored, because the trend is the deliverable and
 * Search Console drops history after sixteen months. The catalogue half is
 * whether her products are in a state Google can do anything with, computed
 * live, because it changes the hour she writes a description.
 *
 * Storing the second would mean a screen that says a product is missing a
 * description an hour after she wrote one, which is the fastest way to make
 * somebody stop believing a number.
 */

const REPORT_SELECT = `
  month, clicks, impressions, avg_position,
  indexed_pages, submitted_pages, queries, pages,
  summary, next, source
`;

const PRODUCT_SELECT = `
  id, slug, title, status, is_sample,
  description, brand, gtin, image_url, condition, price, category_path,
  google_category_id, google_category_source
`;

/*
 * What Google requires before a product can appear in a free listing.
 *
 * Read from the product data specification rather than remembered: id, title,
 * description, link, image_link, availability and price are required outright,
 * brand is required where the product has one, and gtin is required where the
 * manufacturer assigned one. Shipping is an account setting in Merchant Center
 * rather than a per product attribute, so it is not checked here.
 *
 * Brand and gtin are the awkward pair, because "this product has no brand" and
 * "nobody has filled the brand in" are different states and the database cannot
 * tell them apart. Both are reported as a gap rather than guessed at, and the
 * screen says which are certain and which are worth a look.
 */
export function feedGaps(p) {
  const gaps = [];
  if (!p.description?.trim()) gaps.push('description');
  if (!p.image_url) gaps.push('photograph');
  if (!(Number(p.price) > 0)) gaps.push('price');
  if (!p.brand?.trim()) gaps.push('brand');
  if (!p.gtin?.trim()) gaps.push('barcode');
  // A Google category known from eBay, the title or by hand; the default is Google left to guess.
  if (!p.google_category_id || p.google_category_source === 'default') gaps.push('category');
  return gaps;
}

// Required outright. A product missing one of these cannot be listed at all,
// where a missing brand or barcode is a product that lists and ranks worse.
const HARD = new Set(['description', 'photograph', 'price']);

export const feedReady = (p) => feedGaps(p).every((g) => !HARD.has(g));

const isPublic = (p) => p.status === 'live' && !p.is_sample;

export function useFindability(tenantId) {
  const [state, setState] = useState({
    status: 'loading', reports: [], products: [], error: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const [reports, products] = await Promise.all([
      supabase.from('seo_reports').select(REPORT_SELECT)
        .eq('tenant_id', tenantId).order('month', { ascending: true }).limit(36),
      supabase.from('store_products').select(PRODUCT_SELECT)
        .eq('tenant_id', tenantId).order('title'),
    ]);

    const error = reports.error ?? products.error;
    if (error) return setState({ status: 'error', reports: [], products: [], error });

    setState({
      status: 'ready',
      reports: reports.data ?? [],
      products: products.data ?? [],
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * The state of the catalogue, as Google would find it.
   *
   * Counted over what is public, not over everything. A draft product missing a
   * description is not a search problem, it is a product she has not finished,
   * and mixing the two would put a number on this screen that the Products
   * screen already owns.
   */
  const catalogue = useMemo(() => {
    const live = state.products.filter(isPublic);

    const missing = (test) => live.filter(test).length;

    return {
      total: state.products.length,
      live: live.length,
      draft: state.products.filter((p) => !isPublic(p)).length,
      listable: live.filter(feedReady).length,
      noDescription: missing((p) => !p.description?.trim()),
      noBrand: missing((p) => !p.brand?.trim()),
      noBarcode: missing((p) => !p.gtin?.trim()),
      noPhotograph: missing((p) => !p.image_url),
      noCategory: missing((p) => !p.category_path),
    };
  }, [state.products]);

  // Worst first, and only what is public, because a draft cannot be found by
  // anybody and listing it here is noise.
  const blocked = useMemo(() => state.products
    .filter(isPublic)
    .map((p) => ({ ...p, gaps: feedGaps(p) }))
    .filter((p) => p.gaps.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length), [state.products]);

  const latest = state.reports.length ? state.reports[state.reports.length - 1] : null;

  /*
   * Month on month, and only where both months could see.
   *
   * A jump from null to eleven is not growth, it is the day the property was
   * verified, and drawing it as growth would be the first invented number on
   * this project.
   */
  const change = useMemo(() => {
    const seen = state.reports.filter((r) => r.clicks !== null && r.clicks !== undefined);
    if (seen.length < 2) return null;
    const [before, now] = seen.slice(-2);
    return { from: before.clicks, to: now.clicks, delta: now.clicks - before.clicks };
  }, [state.reports]);

  return { ...state, catalogue, blocked, latest, change, reload: load };
}

export const monthName = (iso) => new Date(`${String(iso).slice(0, 7)}-01T00:00:00Z`)
  .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
