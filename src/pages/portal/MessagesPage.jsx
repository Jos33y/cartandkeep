import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useThreads } from '@hooks/useThreads';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { loadTenant } from '@lib/tenant';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/messages-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

/*
 * Conversations, waiting on her.
 *
 * A ledger of one decision, the same shape as Reviews: one row per thread, the
 * row carrying enough to know what it is about without opening it, and the
 * answer written in place rather than on a second screen.
 *
 * No second route for a thread. At 375 a two pane inbox is a list that
 * navigates away and loses its place, and the whole point of a thread carrying
 * its subject is that she never has to go and look something up.
 */

const FILTERS = [
  { key: 'awaiting', label: 'Waiting' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const PREVIEW_COLUMNS = [
  { key: 'about', label: 'About' },
  { key: 'who', label: 'From' },
  { key: 'said', label: 'Last message' },
  { key: 'when', label: 'When', align: 'right' },
];

const PREVIEW_ROWS = [{}, {}, {}];

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : null);

/*
 * A duration a person would say out loud.
 *
 * "10800 seconds" is a number and "three hours" is an answer. Rounded to the
 * unit above it once it passes a day, because "26 hours" is arithmetic nobody
 * asked for.
 */
function spoken(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 3600) return `${Math.max(1, Math.round(n / 60))} minutes`;
  if (n < 86400) {
    const h = Math.round(n / 3600);
    return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  const d = Math.round(n / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

const EXPIRY = [
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
];

const dayOf = (iso) => new Date(iso).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
});

function Thread({ thread, messages, busy, run, onOpen, onReply, onStatus, onWithdraw }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  // A price is attached to a reply rather than sent on its own. An offer with
  // no sentence beside it is a shop quoting without speaking.
  const [quoting, setQuoting] = useState(false);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [days, setDays] = useState(7);

  // An order is already paid for. There is nothing left to price.
  const canQuote = thread.subject_kind !== 'order';

  /*
   * What it is about, in the row.
   *
   * A basket has no title, so it is named by what is in it and what it comes
   * to. Those two facts are the whole reason a basket conversation is worth
   * having: she can see whether it is worth answering before she opens it.
   */
  const units = thread.basket?.reduce((n, l) => n + Number(l.qty ?? 0), 0) ?? 0;

  const about = thread.product_title
    ?? (thread.order_reference ? `Order ${thread.order_reference}` : null)
    ?? (thread.basket
      ? `Basket, ${units} ${units === 1 ? 'thing' : 'things'}, ${formatGbp(thread.basket_total ?? 0)}`
      : 'The shop');

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !messages) run(() => onOpen(thread.id));
  }

  return (
    <article className={styles.thread} data-awaiting={thread.awaiting || undefined}>
      <div
        className={styles.head}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      >
        {thread.product_image
          ? <img className={styles.thumb} src={imageAt(thread.product_image, 160)} alt="" loading="lazy" />
          : <span className={styles.thumb} aria-hidden="true" />}

        <div className={styles.headMain}>
          <p className={styles.about}>{about}</p>
          <p className={styles.said}>
            {thread.last_sender === 'shop' && <span className={styles.you}>You: </span>}
            {thread.last_body}
          </p>
        </div>

        <div className={styles.headMeta}>
          <p className={styles.who}>{thread.name || thread.email}</p>
          <p className={styles.when} data-num>{when(thread.last_message_at)}</p>
          {/* The state in words as well as in the rail, because a row that has
              been dealt with should say which way rather than only look
              different. */}
          {thread.awaiting
            ? <p className={styles.waiting}>Waiting on you</p>
            : thread.status === 'closed' && <p className={styles.closed}>Closed</p>}
        </div>
      </div>

      {open && (
        <div className={styles.panel}>
          {/* What she is being asked about, before what was said, because the
              question usually does not repeat it. Frozen at the moment they
              asked, which the line underneath says plainly so nothing here
              reads as a live basket she could act on. */}
          {thread.basket?.length > 0 && (
            <div className={styles.basket}>
              <ul className={styles.basketLines}>
                {thread.basket.map((l) => (
                  <li key={`${l.product_id}:${l.variant_id ?? ''}`} className={styles.basketLine}>
                    <span className={styles.basketTitle}>
                      {l.title}
                      {l.variant_label && <span className={styles.basketVariant}>{l.variant_label}</span>}
                    </span>
                    <span className={styles.basketQty} data-num>{l.qty}</span>
                    <span className={styles.basketPrice} data-num>{formatGbp(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.basketNote}>
                What was in the basket when they asked, priced at that moment.
              </p>
            </div>
          )}

          {!messages ? (
            <p className={styles.loading} role="status">Opening</p>
          ) : (
            <ol className={styles.messages}>
              {messages.map((m) => (
                <li key={m.id} className={styles.message} data-sender={m.sender}>
                  <p className={styles.byline}>
                    {m.sender === 'shop' ? (m.author_name || 'You') : (thread.name || thread.email)}
                    <span className={styles.stamp} data-num>{when(m.created_at)}</span>
                  </p>
                  {/* Their line breaks kept. A question written as three short
                      paragraphs is three paragraphs. */}
                  <p className={styles.body}>{m.body}</p>

                  {/* Only ever said about a message that failed. A row that
                      says "sent" on every line is furniture. */}
                  {m.sender === 'shop' && !m.sent_at && (
                    <p className={styles.unsent}>
                      Saved, but not emailed yet.
                      {m.send_error ? ` ${m.send_error}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {/* What is standing, if anything. Above the box, because it is the
              thing she has to know before she types the next sentence. */}
          {thread.offer && (
            <div className={styles.offer}>
              <p className={styles.offerPrice} data-num>{formatGbp(thread.offer.price)}</p>
              <p className={styles.offerNote}>
                Offered, and theirs until {dayOf(thread.offer.expires_at)}.
              </p>
              <button
                type="button"
                className={styles.ghost}
                disabled={busy}
                onClick={() => run(() => onWithdraw(thread.id))}
              >
                Take it back
              </button>
            </div>
          )}

          <div className={styles.replyBox}>
            <label className={styles.field}>
              <span className={styles.label}>Your reply, emailed to them</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Answer the question, and say what happens next."
              />
            </label>

            {quoting && (
              <div className={styles.quote}>
                <label className={styles.quoteField}>
                  <span className={styles.label}>Price for the lot</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="130.00"
                  />
                </label>

                {/* Only where there is no snapshot to price. A basket
                    conversation already says how many of what. */}
                {!thread.basket && (
                  <label className={styles.quoteField}>
                    <span className={styles.label}>How many</span>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      step="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </label>
                )}

                <label className={styles.quoteField}>
                  <span className={styles.label}>Good for</span>
                  <select className={styles.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    {EXPIRY.map((e) => <option key={e.days} value={e.days}>{e.label}</option>)}
                  </select>
                </label>

                <p className={styles.quoteNote}>
                  Goods only. Delivery is worked out at checkout the same way it
                  is on any basket. Quoting again replaces this price rather
                  than adding a second one.
                </p>
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || !text.trim() || (quoting && !(Number(price) > 0))}
                onClick={() => run(async () => {
                  await onReply({
                    threadId: thread.id,
                    text,
                    offer: quoting ? { price: Number(price), qty: Number(qty), days } : null,
                  });
                  setText('');
                  setPrice('');
                  setQuoting(false);
                })}
              >
                {quoting ? 'Send it with the price' : 'Send it'}
              </button>

              {canQuote && (
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => setQuoting((q) => !q)}
                >
                  {quoting ? 'Without a price' : 'Attach a price'}
                </button>
              )}

              <button
                type="button"
                className={styles.ghost}
                disabled={busy}
                onClick={() => run(() => onStatus(thread.id, thread.status === 'closed' ? 'open' : 'closed'))}
              >
                {thread.status === 'closed' ? 'Reopen' : 'Close it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function MessagesPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, rows, error, truncated, counts, messages, replyTime,
    reload, open, reply, setStatus, withdrawOffer,
  } = useThreads(tenant?.id);

  // In the address, so the dashboard can link straight to what is waiting.
  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const filter = FILTERS.some((f) => f.key === requested) ? requested : 'awaiting';

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  async function run(fn) {
    setBusy(true);
    setFailed(null);
    try { await fn(); } catch (e) { setFailed(e?.message ?? 'That did not save.'); } finally { setBusy(false); }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'awaiting') return rows.filter((r) => r.awaiting);
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  /*
   * The measured figure, and the reason it is only here.
   *
   * A median over three conversations is arithmetic rather than a fact about
   * the shop, so it says how many it is from and it stays off the storefront
   * until she has seen a number she would defend.
   */
  const median = replyTime && replyTime.answered >= 5 ? spoken(replyTime.median_seconds) : null;

  if (tenant === undefined) {
    return <PageSkeleton />;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>The messages did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
        <button type="button" className={styles.ghost} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Your own store"
        title="The first question lands here"
        icon="IconSpeech"
        body="Somebody looking at a product can ask about it before they buy, and the conversation arrives here with the product attached."
        columns={PREVIEW_COLUMNS}
        rows={PREVIEW_ROWS}
        note="You get an email the moment one arrives. Answer it here rather than by replying to that email, so your answer reaches them and stays with the conversation."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className="micro">Your own store</p>
          <h1 className={styles.title}>
            {counts.awaiting
              ? `${counts.awaiting} waiting on you`
              : counts.all ? 'Nothing waiting' : 'No messages yet'}
          </h1>
        </div>

        {median && (
          <div className={styles.measure}>
            <p className="micro">You usually reply in</p>
            <p className={`figure ${styles.measureNum}`}>{median}</p>
            <p className={styles.measureNote}>
              from {replyTime.answered} {replyTime.answered === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>
        )}
      </header>

      <div className={styles.filters} role="group" aria-label="Filter conversations">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={styles.filter}
            data-on={filter === f.key || undefined}
            onClick={() => setParams(f.key === 'awaiting' ? {} : { filter: f.key }, { replace: true })}
          >
            {f.label}
            <span className={styles.filterCount} data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {truncated && (
        <p className={styles.truncated}>
          Showing the most recent 200 conversations. The counts above cover those.
        </p>
      )}

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      {visible.length === 0 ? (
        <p className={styles.none}>
          {filter === 'awaiting'
            ? 'Nothing waiting. Everything anybody has asked has been answered.'
            : 'Nothing here.'}
        </p>
      ) : (
        <div className={styles.list}>
          {visible.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              messages={messages[t.id]}
              busy={busy}
              run={run}
              onOpen={open}
              onReply={reply}
              onStatus={setStatus}
              onWithdraw={withdrawOffer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
