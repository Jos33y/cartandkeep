import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import styles from '@styles/ui/store/reviews.module.css';

/*
 * What people who bought it said.
 *
 * Every review here came from an order line, because there is no other way to
 * write one: no form on this page, no link from the grid, only the reference
 * and token the confirmation email carried. That is what makes the number at
 * the top a fact, and it is the reason the schema markup can finally emit an
 * aggregate rating without inventing one.
 *
 * Nothing renders when there are none. An empty reviews section on a shop that
 * opened last week is a section telling every visitor that nobody has bought
 * anything, which is true and is not worth saying on a product page.
 */

const STARS = 5;

function Stars({ rating, label }) {
  // Rounded to the nearest half only for the shape. The figure beside it stays
  // exact, because 4.5 drawn as four and a half stars and written as 4.5 is one
  // fact told twice rather than two facts that can disagree.
  const filled = Math.round(Number(rating) * 2) / 2;

  return (
    <span className={styles.stars} role="img" aria-label={label}>
      {Array.from({ length: STARS }, (_, i) => {
        const n = i + 1;
        return (
          <span
            key={n}
            className={styles.star}
            data-fill={filled >= n ? 'full' : filled >= n - 0.5 ? 'half' : undefined}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

const when = (iso) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(iso));

export function Reviews({ product }) {
  const [state, setState] = useState({ status: 'loading', rows: [], summary: null });

  useEffect(() => {
    if (!product?.id) return undefined;
    let live = true;

    (async () => {
      /*
       * The aggregate comes from the view rather than being averaged here.
       *
       * The product page, the portal and the schema markup all read the same
       * figure, so four and a half stars means one thing across the shop. The
       * policy already limits the rows to approved ones, so nothing here has to
       * remember to filter.
       */
      const [reviews, summary] = await Promise.all([
        supabase.from('store_reviews')
          .select('id, rating, title, body, author, reply, replied_at, created_at, variant_id')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('store_product_ratings')
          .select('review_count, rating, five, four, three, two, one')
          .eq('product_id', product.id)
          .maybeSingle(),
      ]);

      if (!live) return;
      setState({
        status: 'ready',
        rows: reviews.data ?? [],
        summary: summary.data ?? null,
      });
    })();

    return () => { live = false; };
  }, [product?.id]);

  const { rows, summary } = state;
  if (state.status === 'loading' || !summary?.review_count) return null;

  return (
    <section className={styles.section} aria-labelledby="reviews">
      <h2 id="reviews" className={styles.head}>What people said</h2>

      <div className={styles.summary}>
        <p className={styles.average}>
          <span className={styles.averageNum} data-price>{summary.rating}</span>
          <Stars rating={summary.rating} label={`${summary.rating} out of 5`} />
        </p>
        <p className={styles.count}>
          {summary.review_count} {summary.review_count === 1 ? 'review' : 'reviews'},
          {' '}all from people who bought it
        </p>
      </div>

      <ul className={styles.list}>
        {rows.map((r) => (
          <li key={r.id} className={styles.review}>
            <div className={styles.reviewHead}>
              <Stars rating={r.rating} label={`${r.rating} out of 5`} />
              {/* No verified badge. Every review here is from a purchase by
                  construction, so a badge on all of them says nothing, and a
                  badge is what a shop adds when some of them are not. */}
              <span className={styles.author}>{r.author || 'A customer'}</span>
              <span className={styles.date}>{when(r.created_at)}</span>
            </div>

            {r.title && <p className={styles.reviewTitle}>{r.title}</p>}
            {r.body && <p className={styles.body}>{r.body}</p>}

            {/* Her reply, under the review it answers. A review answered is
                worth more to the next reader than the review on its own. */}
            {r.reply && (
              <div className={styles.reply}>
                <p className={styles.replyWho}>Cart &amp; Keep replied</p>
                <p className={styles.body}>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
