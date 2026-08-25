import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { readThread, sendToThread } from '@lib/threads';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/conversation.module.css';

/*
 * One conversation, wherever it is standing.
 *
 * Two mounts and one component. The thread page passes a thread id and its own
 * token; the order confirmation passes the reference and the order's. That is
 * the one secret rule from the migration showing up in the interface: where
 * there is an order, the token the confirmation email already carried is the
 * way in, so nobody is handed a second thing to lose.
 *
 * On an order it renders before there is anything to read, because an order
 * with no conversation is somebody about to start one rather than an error.
 *
 * Correspondence rather than chat. Ruled entries with a name and a time, the
 * shop on the tinted ground. No bubbles, no tails, no typing dots: those
 * promise presence, and the shop is answering properly rather than sitting at
 * a screen.
 */

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/London', weekday: 'long', hour: '2-digit', minute: '2-digit',
}) : null);

export function Conversation({ lookup, heading = 'Your question', opener }) {
  const [state, setState] = useState({ status: 'loading', thread: null, error: null });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await readThread(lookup);
      setState({ status: 'ready', thread: data.thread ?? null, error: null });
    } catch (e) {
      setState({ status: 'error', thread: null, error: e.message });
    }
    // Serialised, because an object literal in a dependency list is a new
    // object on every render and this would fetch forever.
  }, [JSON.stringify(lookup)]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    setBusy(true);
    setFailed(null);
    try {
      const data = await sendToThread(lookup, text);
      setState({ status: 'ready', thread: data.thread, error: null });
      setText('');
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <div className={styles.loading} />;

  if (state.status === 'error') {
    return (
      <div className={styles.failed}>
        <p className={styles.failedTitle}>{state.error}</p>
        <p className={styles.failedBody}>
          The link is in the email we sent. If you cannot find it, write to us
          and we will sort it.
        </p>
        <Link className={styles.back} to={STORE_ROUTES.CONTACT}>Get in touch</Link>
      </div>
    );
  }

  const thread = state.thread;
  const messages = thread?.messages ?? [];
  const closed = thread?.status === 'closed';

  return (
    <section className={styles.conversation}>
      <p className={styles.heading}>{heading}</p>

      {/* What it is about, carried with it, which is the whole design. Nobody
          should have to work out what a conversation refers to, on either
          side of it. */}
      {thread?.product && (
        <div className={styles.subject}>
          {thread.product.image_url
            ? <img className={styles.thumb} src={imageAt(thread.product.image_url, 200)} alt="" loading="lazy" />
            : <span className={styles.thumb} aria-hidden="true" />}
          <span className={styles.subjectMain}>
            {thread.product.slug
              ? (
                <Link className={styles.subjectTitle} to={STORE_ROUTES.PRODUCT.replace(':slug', thread.product.slug)}>
                  {thread.product.title}
                </Link>
              )
              : <span className={styles.subjectTitle}>{thread.product.title}</span>}
            {thread.product.price != null && (
              <span className={styles.subjectPrice} data-price>{formatGbp(thread.product.price)}</span>
            )}
          </span>
        </div>
      )}

      {/* The snapshot, as it was when they asked.
          Shown to them as well as to her, because a conversation about a
          basket that changed underneath it makes both sides wrong, and the
          honest way to say so is to show what the conversation is about. */}
      {thread?.basket?.length > 0 && (
        <div className={styles.basket}>
          <ul className={styles.basketLines}>
            {thread.basket.map((l) => (
              <li key={`${l.product_id}:${l.variant_id ?? ''}`} className={styles.basketLine}>
                <span className={styles.basketTitle}>
                  {l.title}
                  {l.variant_label && <span className={styles.basketVariant}>{l.variant_label}</span>}
                </span>
                <span className={styles.basketQty} data-price>{l.qty}</span>
                <span className={styles.basketPrice} data-price>{formatGbp(l.qty * l.price)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.basketNote}>
            What was in your basket when you asked. Your basket itself has not
            been changed.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <ol className={styles.messages}>
          {messages.map((m) => (
            <li key={m.id} className={styles.message} data-sender={m.sender}>
              <p className={styles.byline}>
                {m.sender === 'shop' ? (m.author_name || 'Cart & Keep') : 'You'}
                <span className={styles.stamp}>{when(m.created_at)}</span>
              </p>
              <p className={styles.body}>{m.body}</p>
            </li>
          ))}
        </ol>
      )}

      {/*
        * A price, if one is standing.
        *
        * The figure and the day it runs to, and nothing else. No former price
        * beside it, no percentage, no saving. The lines above already show
        * what each thing costs, and those are real prices actually charged,
        * which is what keeps this a price given to one person rather than a
        * claim about a reduction.
        *
        * The link carries the offer and the token this page was opened with.
        * The checkout prices from the offer record rather than from anything
        * here, so the number below is a statement of what will be charged
        * rather than an instruction to charge it.
        */}
      {thread?.offer && (
        <div className={styles.offer}>
          <p className={styles.offerPrice} data-price>{formatGbp(thread.offer.price)} for this</p>
          <p className={styles.offerNote}>
            Yours until {new Date(thread.offer.expires_at).toLocaleDateString('en-GB', {
              timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
            })}. Delivery is worked out at checkout as usual.
          </p>
          <Link
            className={styles.take}
            to={`${STORE_ROUTES.CHECKOUT}?offer=${thread.offer.id}&token=${encodeURIComponent(lookup.token ?? '')}`}
          >
            Take this price
          </Link>
        </div>
      )}

      {/* An order with nothing said yet. The opener explains what the box is
          for, because a text field under a receipt with no label is a field
          nobody uses. */}
      {messages.length === 0 && opener && <p className={styles.opener}>{opener}</p>}

      {closed ? (
        <p className={styles.closed}>
          This conversation is finished. Ask again from the product page and we
          will pick it up.
        </p>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.srOnly}>Write back</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={messages.length ? 'Write back' : 'What would you like to ask?'}
            />
          </label>

          {failed && <p className={styles.error} role="alert">{failed}</p>}

          <button type="button" className={styles.send} disabled={busy || !text.trim()} onClick={send}>
            {busy ? 'Sending' : 'Send'}
          </button>
        </>
      )}

      <p className={styles.small}>
        Only you and the shop can open this page. Nothing here appears anywhere
        else.
      </p>
    </section>
  );
}
