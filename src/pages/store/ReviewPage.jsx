import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { imageAt } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/review-page.module.css';

/*
 * Where somebody writes a review.
 *
 * Reached only by the reference and token in their order email. There is no
 * link to this page from anywhere in the shop, which is the whole reason a
 * rating on a product page can be trusted.
 *
 * Nothing here is required except the stars. A rating with no words is still a
 * rating, and forcing a sentence out of somebody who wanted to press five stars
 * is how a shop ends up with no reviews at all.
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(payload) {
  const res = await fetch(`${BASE}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'Something went wrong.');
  return data;
}

const LABELS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent'];

/*
 * Buttons, not a hover strip.
 *
 * A five star control that fills on hover does nothing on a phone, which is
 * where this link is opened. Each star is its own button with its own label, so
 * it works by tap, by keyboard and by screen reader without three different
 * implementations.
 */
function StarPicker({ value, onChange, id }) {
  const [preview, setPreview] = useState(0);
  const shown = preview || value;

  return (
    <div className={styles.picker}>
      <div className={styles.stars} role="radiogroup" aria-labelledby={id}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}, ${LABELS[n]}`}
            className={styles.star}
            data-on={n <= shown || undefined}
            onClick={() => onChange(n)}
            onMouseEnter={() => setPreview(n)}
            onMouseLeave={() => setPreview(0)}
            onFocus={() => setPreview(n)}
            onBlur={() => setPreview(0)}
          >
            ★
          </button>
        ))}
      </div>
      {/* Holds its height whether or not a word is in it, so choosing a rating
          does not shift the form under the thumb that just tapped it. */}
      <span className={styles.pickerLabel}>{LABELS[shown] || ' '}</span>
    </div>
  );
}

function Item({ item, reference, token, onDone }) {
  const [rating, setRating] = useState(item.review?.rating ?? 0);
  const [title, setTitle] = useState(item.review?.title ?? '');
  const [body, setBody] = useState(item.review?.body ?? '');
  const [author, setAuthor] = useState(item.review?.author ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [saved, setSaved] = useState(false);

  const already = Boolean(item.review);

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      await call({ reference, token, orderItemId: item.id, rating, title, body, author });
      setSaved(true);
      onDone?.();
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <li className={styles.item}>
        <p className={styles.thanks}>
          Thank you. {item.title} is done.
          {/* Said now rather than left as a mystery when it does not appear.
              Somebody who wrote one yesterday and cannot find it on the shop
              should not have to wonder whether it was lost. */}
          {' '}It goes on the shop once it has been read.
        </p>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <div className={styles.product}>
        {item.image_url && (
          <img className={styles.thumb} src={imageAt(item.image_url, 200)} alt="" loading="lazy" />
        )}
        <p className={styles.productTitle} id={`t-${item.id}`}>
          {item.title}
          {item.variantLabel && <span className={styles.variant}>{item.variantLabel}</span>}
        </p>
      </div>

      {already && (
        <p className={styles.already}>
          You have written about this one.
          {item.review.waiting ? ' It is waiting to go on the shop.' : ' It is on the shop.'}
          {' '}Changing it here replaces it.
        </p>
      )}

      <StarPicker value={rating} onChange={setRating} id={`t-${item.id}`} />

      <label className={styles.field}>
        <span className={styles.label}>A headline, if you want one</span>
        <input
          className={styles.input}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Arrived when they said it would"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Anything else</span>
        <textarea
          className={styles.textarea}
          rows={4}
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What it is like, and whether it was what you expected."
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>What to call you</span>
        <input
          className={styles.input}
          value={author}
          maxLength={60}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="A first name is plenty"
        />
        <span className={styles.hint}>Shown with your review. Never your email address.</span>
      </label>

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      <button
        type="button"
        className={styles.submit}
        disabled={busy || rating === 0}
        onClick={submit}
      >
        {busy ? 'Sending' : rating === 0 ? 'Choose a rating first' : already ? 'Replace it' : 'Send it'}
      </button>
    </li>
  );
}

export function ReviewPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await call({ reference, token });
        if (live) setState({ status: 'ready', data, error: null });
      } catch (e) {
        if (live) setState({ status: 'error', data: null, error: e.message });
      }
    })();
    return () => { live = false; };
  }, [reference, token]);

  return (
    <section className={styles.page}>
      {/* Never indexed. It is one person's order behind a token, and a search
          engine finding it is a search engine that has the token. */}
      <Head title="Write a review" description="Write a review." path="/review" noindex />

      {state.status === 'loading' && <div className={styles.loading} />}

      {state.status === 'error' && (
        <div className={styles.failed}>
          <h1 className={styles.title}>{state.error}</h1>
          <p className={styles.body}>
            The link is in the email we sent when your order went out. If you
            cannot find it, write to us and we will sort it.
          </p>
          <Link className={styles.back} to={STORE_ROUTES.CONTACT}>Get in touch</Link>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <header className={styles.head}>
            <h1 className={`${styles.title} wide`}>
              {state.data.name ? `Thanks, ${String(state.data.name).split(' ')[0]}` : 'Thank you'}
            </h1>
            <p className={styles.body}>
              Tell us how {state.data.items.length === 1 ? 'it' : 'they'} turned out.
              It helps the next person more than anything we could write ourselves.
            </p>
            <p className={styles.ref} data-price>{state.data.reference}</p>
          </header>

          <ul className={styles.items}>
            {state.data.items.map((item) => (
              <Item key={item.id} item={item} reference={reference} token={token} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
