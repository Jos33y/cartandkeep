import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Reviews, from her side.
 *
 * Nothing published until she has read it. Not so she can edit somebody's
 * words, which she cannot from here, but because a shop this size gets one
 * abusive review and has no moderation queue to absorb it, and because the
 * first thing a stranger reads about a product should not arrive unseen.
 *
 * Three states and only three. Pending is waiting on her, approved is on the
 * shop, hidden is read and refused. There is no delete: a review is a
 * customer's words and removing the record entirely would also remove the
 * evidence of what was removed.
 */

const EMPTY = { status: 'loading', rows: [], error: null };

export function useReviews(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    /*
     * The product comes with the review.
     *
     * She is deciding whether a sentence about a bed sheet should appear under
     * that bed sheet, and a list of ratings with no products on it makes her
     * open another tab to find out what each one is about.
     */
    const { data, error } = await supabase
      .from('store_reviews')
      .select(`
        id, rating, title, body, author, status, hidden_reason, reply, replied_at,
        created_at, published_at, product_id, variant_id,
        store_products ( id, title, slug, image_url ),
        order_items ( variant_label, orders ( reference, name, email ) )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      error: null,
      rows: (data ?? []).map((r) => ({
        ...r,
        product: r.store_products ?? null,
        // The order behind it, so a review can be read next to what was
        // actually sent. It is also the only place her copy of the customer's
        // name exists, and a review signed "Ada" is easier to answer when the
        // order says Adaeze.
        order: r.order_items?.orders ?? null,
        variantLabel: r.order_items?.variant_label ?? null,
      })),
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setStatus = useCallback(async (id, status, reason = null) => {
    const row = state.rows.find((r) => r.id === id);

    /*
     * Stamped on the first approval and never again.
     *
     * The shop orders by date, so re-stamping on every approval would mean
     * hiding a review and putting it back moved it to the top as though it were
     * new. Decided here from the row already in hand rather than with two
     * filtered updates, which is where the first version of this went: one
     * write, one round trip, and the condition is legible.
     */
    const patch = { status };
    if (status === 'hidden') patch.hidden_reason = reason;
    if (status === 'approved' && !row?.published_at) {
      patch.published_at = new Date().toISOString();
    }

    const { error } = await supabase.from('store_reviews').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  }, [state.rows, load]);

  const approve = useCallback((id) => setStatus(id, 'approved'), [setStatus]);
  // The reason is required by the database: the reviews page promises these are the only grounds.
  const hide = useCallback((id, reason) => setStatus(id, 'hidden', reason), [setStatus]);

  /*
   * Her reply, published under the review it answers.
   *
   * Saved separately from the approval, because answering is a different
   * decision from publishing and she will often want to do one without the
   * other. An empty box clears the reply rather than saving a blank one.
   */
  const reply = useCallback(async ({ id, text }) => {
    const trimmed = String(text ?? '').trim();
    const { error } = await supabase.from('store_reviews').update({
      reply: trimmed || null,
      replied_at: trimmed ? new Date().toISOString() : null,
    }).eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  const counts = useMemo(() => ({
    pending: state.rows.filter((r) => r.status === 'pending').length,
    approved: state.rows.filter((r) => r.status === 'approved').length,
    hidden: state.rows.filter((r) => r.status === 'hidden').length,
    all: state.rows.length,
  }), [state.rows]);

  /*
   * The average she is actually showing, computed from the same rule the view
   * uses so the portal and the product page cannot disagree.
   *
   * Null when nothing is approved, for the same reason as the view: a shop with
   * no published reviews has no rating, and 0.0 is a different claim.
   */
  const published = useMemo(() => {
    const approved = state.rows.filter((r) => r.status === 'approved');
    if (!approved.length) return null;
    const total = approved.reduce((n, r) => n + Number(r.rating), 0);
    return Math.round((total / approved.length) * 10) / 10;
  }, [state.rows]);

  return { ...state, counts, published, reload: load, approve, hide, reply };
}
