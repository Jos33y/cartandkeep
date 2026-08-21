import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useReviews } from '@hooks/useReviews';
import { loadTenant } from '@lib/tenant';
import { imageAt } from '@utils/categories';
import styles from '@styles/pages/portal/reviews-page.module.css';

/*
 * Reviews, waiting on her.
 *
 * Pending first and pending by default, because this screen exists for one
 * decision and everything else on it is a record. A review sits unread on a
 * shop nobody can see it on, so the cost of leaving this screen alone is a
 * customer who wrote something and never saw it appear.
 *
 * No delete anywhere. Hidden is read and refused, which keeps both the words
 * and the evidence that they were refused. A review deleted outright leaves
 * neither, and a shop that can quietly remove a bad one is a shop whose good
 * ones mean less.
 */

const FILTERS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'On the shop' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'all', label: 'All' },
];

const when = (iso) => (iso ? new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(iso)) : null);

function Stars({ rating }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={styles.star} data-on={n <= rating || undefined} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

function Review({ review, busy, run, saved, onApprove, onHide, onReply }) {
  const [text, setText] = useState(review.reply ?? '');
  const [open, setOpen] = useState(false);

  const dirty = text.trim() !== (review.reply ?? '').trim();

  return (
    <li className={styles.review} data-status={review.status}>
      <div className={styles.head}>
        <Stars rating={review.rating} />
        <span className={styles.author}>{review.author || 'A customer'}</span>
        <span className={styles.date}>{when(review.created_at)}</span>

        {/* The state in words, because a row that has been dealt with should
            say which way rather than only look different. */}
        {review.status !== 'pending' && (
          <span className={styles.state}>
            {review.status === 'approved' ? 'On the shop' : 'Hidden'}
          </span>
        )}
      </div>

      {/* What it is about, with the photograph. She is deciding whether a
          sentence belongs under a particular product, and a list of ratings
          with no products on it sends her to another tab to find out. */}
      {review.product && (
        <p className={styles.product}>
          {review.product.image_url && (
            <img className={styles.thumb} src={imageAt(review.product.image_url, 160)} alt="" loading="lazy" />
          )}
          <span className={styles.productTitle}>
            {review.product.title}
            {review.variantLabel && <span className={styles.variant}>{review.variantLabel}</span>}
          </span>
          {review.order?.reference && (
            <span className={styles.ref} data-num>{review.order.reference}</span>
          )}
        </p>
      )}

      {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
      {review.body && <p className={styles.body}>{review.body}</p>}

      <div className={styles.actions}>
        {review.status !== 'approved' && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => run(() => onApprove(review.id))}
          >
            Put it on the shop
          </button>
        )}
        {review.status !== 'hidden' && (
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={() => run(() => onHide(review.id))}
          >
            Hide it
          </button>
        )}
        <button
          type="button"
          className={styles.ghost}
          disabled={busy}
          onClick={() => setOpen((o) => !o)}
        >
          {review.reply ? 'Edit your reply' : 'Reply'}
        </button>
      </div>

      {/* Her reply publishes with the review rather than separately, so a reply
          written on a pending one is ready the moment she approves it. */}
      {(open || review.reply) && (
        <div className={styles.replyBox}>
          <label className={styles.field}>
            <span className={styles.label}>Your reply, published under the review</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Answer the person, not the rating."
            />
          </label>
          {/* The button says what happened. An action keeps its name through
              the flow, so Save reply produces Saved. */}
          <button
            type="button"
            className={styles.ghost}
            disabled={busy || !dirty}
            onClick={() => run(() => onReply({ id: review.id, text }), review.id)}
          >
            {saved && !dirty
              ? (text.trim() ? 'Saved' : 'Removed')
              : (text.trim() ? 'Save reply' : 'Remove reply')}
          </button>
        </div>
      )}
    </li>
  );
}

export function ReviewsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, error, counts, published, approve, hide, reply } = useReviews(tenant?.id);

  // In the address, so the dashboard can link straight to what is waiting.
  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const filter = FILTERS.some((f) => f.key === requested) ? requested : 'pending';

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  /*
   * Which row just saved.
   *
   * A button that disables because there is nothing to save looks exactly like
   * one that disables because it has just saved, and on a screen whose job is
   * confirming things that is the wrong pair to leave ambiguous. Approving and
   * hiding announce themselves by moving the row out of the list; a reply does
   * not, so it says so.
   *
   * Keyed by row rather than a page wide flag, or replying to one review would
   * read as Saved on every other one open at the same time.
   */
  const [saved, setSaved] = useState(null);

  async function run(fn, key = null) {
    setBusy(true);
    setFailed(null);
    setSaved(null);
    try {
      await fn();
      if (key) {
        setSaved(key);
        // Cleared, because a permanent Saved is furniture rather than news.
        setTimeout(() => setSaved((k) => (k === key ? null : k)), 4000);
      }
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The reviews did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Reviews</p>
          <h1 className={styles.title}>
            {counts.pending
              ? `${counts.pending} waiting on you`
              : counts.all ? 'Nothing waiting' : 'No reviews yet'}
          </h1>
        </div>

        {/* The figure a stranger sees, not the average of everything written.
            Null rather than zero when nothing is approved, the same rule the
            product page uses, so the two cannot disagree. */}
        {published !== null && (
          <div className={styles.showing}>
            <p className={styles.eyebrow}>Showing on the shop</p>
            <p className={`figure ${styles.showingNum}`} data-num>{published}</p>
            <p className={styles.showingNote}>
              from {counts.approved} {counts.approved === 1 ? 'review' : 'reviews'}
            </p>
          </div>
        )}
      </header>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={styles.filter}
            data-on={filter === f.key || undefined}
            onClick={() => setParams(f.key === 'pending' ? {} : { filter: f.key }, { replace: true })}
          >
            {f.label}
            <span className={styles.filterCount} data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {counts.all === 0
            ? 'A review can only be written by somebody who bought the thing, using the link in their order email. The first one will arrive a week or so after your first sale.'
            : filter === 'pending'
              ? 'Nothing waiting. Everything written has been dealt with.'
              : 'Nothing here.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((r) => (
            <Review
              key={r.id}
              review={r}
              busy={busy}
              run={run}
              saved={saved === r.id}
              onApprove={approve}
              onHide={hide}
              onReply={reply}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
