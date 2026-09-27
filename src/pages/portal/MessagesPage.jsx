import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useThreads } from '@hooks/useThreads';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/messages-page.module.css';

// Waiting is the top of Open rather than a tab of its own, so the page never lands on an empty list.
const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const KIND = {
  product: { icon: 'IconTag', label: 'Product question' },
  basket: { icon: 'IconBought', label: 'Basket' },
  order: { icon: 'IconBox', label: 'Order' },
  general: { icon: 'IconSpeech', label: 'General' },
};

const kindOf = (t) => (t.product_id || t.product_title ? 'product'
  : t.subject_kind === 'basket' ? 'basket' : t.order_id || t.order_reference ? 'order' : 'general');

// Starting points, edited before they are sent. Nothing goes out without her pressing Send.
const quickReplies = (returns) => [
  { label: 'In stock', text: 'Yes, it is in stock and goes out within a day of your order.' },
  { label: 'Delivery', text: 'Delivery is usually two to three working days once it has been sent.' },
  { label: 'Returns', text: `You can send it back within ${Number(returns?.days) || 14} days if it is not right for you.` },
  { label: 'Thank you', text: 'Thank you for asking.' },
];

// A reply inside this counts as quick.
const QUICK_SECONDS = 12 * 3600;

const PREVIEW_COLUMNS = [
  { key: 'about', label: 'About' },
  { key: 'who', label: 'From' },
  { key: 'said', label: 'Last message' },
  { key: 'when', label: 'When', align: 'right' },
];

const PREVIEW_ROWS = [{}, {}, {}];

const EXPIRY = [
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
];

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : null);

// Short and relative in the list, where the question is only how long ago.
function ago(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const dayOf = (iso) => new Date(iso).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
});

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

function aboutOf(thread) {
  const units = thread.basket?.reduce((n, l) => n + (Number(l.qty) || 0), 0) ?? 0;
  return thread.product_title
    ?? (thread.order_reference ? `Order ${thread.order_reference}` : null)
    ?? (thread.basket
      ? `Basket, ${units} ${units === 1 ? 'thing' : 'things'}${thread.basket_total != null ? `, ${formatGbp(thread.basket_total)}` : ''}`
      : 'A general question');
}

const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0);
// An answer with no word back for this long is a conversation that has ended.
const QUIET_DAYS = 7;

const initial = (thread) => (thread.name || thread.email || '?').trim()[0]?.toUpperCase();

function ThreadHead({ thread, selected, onSelect }) {
  return (
    <li>
      <button type="button" className={styles.head} aria-current={selected || undefined}
        data-awaiting={thread.awaiting || undefined} onClick={() => onSelect(thread.id)}>
        <span className={styles.avatar} data-kind={kindOf(thread)} aria-hidden="true">
          {thread.product_image
            ? <img src={imageAt(thread.product_image, 160)} alt="" loading="lazy" />
            : <Icon name={KIND[kindOf(thread)].icon} width="18" height="18" />}
        </span>
        <span className={styles.headMain}>
          <span className={styles.headTop}>
            <span className={styles.who}>{thread.name || thread.email}</span>
            <span className={styles.when} data-num>{ago(thread.last_message_at)}</span>
          </span>
          <span className={styles.about}>{aboutOf(thread)}</span>
          <span className={styles.said}>
            {thread.last_sender === 'shop' && <span className={styles.you}>You: </span>}
            {thread.last_body}
          </span>
        </span>
        {thread.awaiting && <span className={styles.dot} aria-label="Waiting on you" />}
      </button>
    </li>
  );
}

function ThreadPanel({ thread, messages, busy, run, onOpen, onReply, onStatus, onWithdraw, onBack, returns }) {
  const [text, setText] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [days, setDays] = useState(7);
  const canQuote = thread.subject_kind !== 'order';
  const quietFor = thread.status === 'open' && !thread.awaiting && daysSince(thread.last_message_at) >= QUIET_DAYS
    ? daysSince(thread.last_message_at) : 0;

  useEffect(() => {
    if (!messages) run(() => onOpen(thread.id));
    // Opened once per thread, not on every change to the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const send = () => run(async () => {
    await onReply({
      threadId: thread.id,
      text,
      offer: quoting ? { price: Number(price), qty: Number(qty), days } : null,
    });
    setText('');
    setPrice('');
    setQuoting(false);
  });

  return (
    <section className={styles.panel} aria-label={`Conversation with ${thread.name || thread.email}`}>
      <header className={styles.panelHead}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back to the list">
          <Icon name="IconCaret" width="16" height="16" />
        </button>
        {thread.product_image
          ? <img className={styles.panelThumb} src={imageAt(thread.product_image, 160)} alt="" />
          : <span className={`${styles.panelThumb} ${styles.panelThumbEmpty}`} data-kind={kindOf(thread)} aria-hidden="true">{initial(thread)}</span>}
        <div className={styles.panelTitle}>
          <h2>{aboutOf(thread)}</h2>
          <p className={styles.meta}>
            <span className={styles.kind} data-kind={kindOf(thread)}>
              <Icon name={KIND[kindOf(thread)].icon} width="12" height="12" />{KIND[kindOf(thread)].label}
            </span>
            <span>{thread.name ? `${thread.name}, ` : ''}<a href={`mailto:${thread.email}`}>{thread.email}</a></span>
          </p>
        </div>
        <span className={styles.state} data-state={thread.awaiting ? 'awaiting' : thread.status}>
          {thread.awaiting ? 'Waiting on you' : thread.status === 'closed' ? 'Closed' : 'Answered'}
        </span>
      </header>

      <div className={styles.transcript}>
        {thread.basket?.length > 0 && (
          <div className={styles.basket}>
            <p className={styles.basketNote}>In their basket when they asked, at that moment&apos;s prices</p>
            <ul className={styles.basketLines}>
              {thread.basket.map((l, i) => (
                <li key={`${l.product_id ?? i}:${l.variant_id ?? ''}`} className={styles.basketLine}>
                  <span className={styles.basketTitle}>
                    {l.title}
                    {l.variant_label && <span className={styles.basketVariant}>{l.variant_label}</span>}
                  </span>
                  <span className={styles.basketQty} data-num>{l.qty}</span>
                  <span className={styles.basketPrice} data-num>
                    {Number(l.qty) && Number(l.price) ? formatGbp(Number(l.qty) * Number(l.price)) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!messages ? (
          <div className={styles.loading} aria-busy="true">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        ) : (
          <ol className={styles.messages}>
            {messages.map((m) => (
              <li key={m.id} className={styles.message} data-sender={m.sender}>
                <div className={styles.bubble}>
                  <p className={styles.body}>{m.body}</p>
                </div>
                <p className={styles.byline}>
                  {m.sender === 'shop' ? (m.author_name || 'You') : (thread.name || thread.email)}
                  <span data-num>{when(m.created_at)}</span>
                </p>
                {m.sender === 'shop' && !m.sent_at && (
                  <p className={styles.unsent}>Saved, but not emailed yet.{m.send_error ? ` ${m.send_error}` : ''}</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {thread.offer && (
          <div className={styles.offer}>
            <span className={styles.offerPrice} data-num>{formatGbp(thread.offer.price)}</span>
            <span className={styles.offerNote}>Offered, theirs until {dayOf(thread.offer.expires_at)}</span>
            <button type="button" className={styles.quiet} disabled={busy} onClick={() => run(() => onWithdraw(thread.id))}>
              Take it back
            </button>
          </div>
        )}
      </div>

      {quietFor > 0 && (
        <div className={styles.quietNote}>
          <span>Answered <span data-num>{quietFor}</span> days ago and nothing since.</span>
          <button type="button" className={styles.quiet} disabled={busy}
            onClick={() => run(() => onStatus(thread.id, 'closed'))}>
            Close it
          </button>
        </div>
      )}

      <div className={styles.compose}>
        {quoting && (
          <div className={styles.quote}>
            <label className={styles.field}>
              <span className={styles.label}>Price for the lot</span>
              <span className={styles.control}>
                <span className={styles.affix} aria-hidden="true">£</span>
                <input className={styles.bare} data-num type="number" min="0" step="0.01" inputMode="decimal"
                  value={price} onChange={(e) => setPrice(e.target.value)} placeholder="130.00" />
              </span>
            </label>
            {!thread.basket && (
              <label className={styles.field}>
                <span className={styles.label}>How many</span>
                <input className={styles.input} data-num type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
            )}
            <label className={styles.field}>
              <span className={styles.label}>Good for</span>
              <select className={styles.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {EXPIRY.map((e) => <option key={e.days} value={e.days}>{e.label}</option>)}
              </select>
            </label>
            <span className={styles.quoteTip}>
              <Tip side="end">Goods only. Delivery is worked out at checkout, as on any basket. Quoting again replaces this price.</Tip>
            </span>
          </div>
        )}
        {!text.trim() && (
          <div className={styles.chips} role="group" aria-label="Start from">
            {quickReplies(returns).map((q) => (
              <button key={q.label} type="button" className={styles.chip} onClick={() => setText(q.text)}>{q.label}</button>
            ))}
          </div>
        )}
        <textarea className={styles.textarea} rows={3} value={text} onChange={(e) => setText(e.target.value)}
          aria-label="Your reply, emailed to them" placeholder="Answer the question, and say what happens next."
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) send(); }} />
        <div className={styles.actions}>
          {quietFor ? <span className={styles.spacer} /> : (
            <button type="button" className={styles.link} disabled={busy}
              onClick={() => run(() => onStatus(thread.id, thread.status === 'closed' ? 'open' : 'closed'))}>
              {thread.status === 'closed' ? 'Reopen' : 'Close it'}
            </button>
          )}
          {canQuote && (
            <button type="button" className={styles.quiet} disabled={busy} aria-pressed={quoting}
              onClick={() => setQuoting((q) => !q)}>
              {quoting ? 'Without a price' : 'Attach a price'}
            </button>
          )}
          <button type="button" className={styles.go}
            disabled={busy || !text.trim() || (quoting && !(Number(price) > 0))} onClick={send}>
            {quoting ? 'Send with the price' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  );
}

export function MessagesPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, rows, error, truncated, counts, messages, replyTime,
    reload, open, reply, setStatus, withdrawOffer,
  } = useThreads(tenant?.id);

  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  // Lands where something is, rather than on an empty Waiting tab with a conversation open elsewhere.
  const fallback = counts.open || !counts.closed ? 'open' : 'all';
  const asked = requested === 'awaiting' ? 'open' : requested;
  const filter = FILTERS.some((f) => f.key === asked) ? asked : fallback;

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showing, setShowing] = useState(false);

  async function run(fn) {
    setBusy(true);
    setFailed(null);
    try { await fn(); } catch (e) { setFailed(e?.message ?? 'That did not save.'); } finally { setBusy(false); }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const selected = visible.find((t) => t.id === selectedId) ?? visible[0] ?? null;
  const nearest = FILTERS.find((f) => f.key !== filter && f.key !== 'all' && counts[f.key] > 0);
  const waiting = visible.filter((t) => t.awaiting);
  const rest = visible.filter((t) => !t.awaiting);
  const answeredShare = rows.length ? rows.filter((r) => !r.awaiting).length / rows.length : 1;
  const quick = replyTime?.median_seconds ? Number(replyTime.median_seconds) <= QUICK_SECONDS : null;

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The messages did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Your own store"
        title="The first question lands here"
        icon="IconSpeech"
        body="Somebody looking at a product can ask about it before they buy, and the conversation arrives here with the product attached."
        columns={PREVIEW_COLUMNS}
        rows={PREVIEW_ROWS}
        note="You get an email the moment one arrives. Answer it here, so your answer reaches them and stays with the conversation."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Messages</h1>
          <p className={styles.sub}>
            {counts.awaiting
              ? <><span data-num>{counts.awaiting}</span> {counts.awaiting === 1 ? 'person is' : 'people are'} waiting on you.</>
              : 'Every question has an answer.'}
          </p>
        </div>
      </header>

      <div className={styles.inbox} data-showing={showing || undefined}>
        <aside className={styles.side}>
          <div className={styles.score} data-clear={!counts.awaiting || undefined}>
            <span className={styles.ring} style={{ '--p': answeredShare }} aria-hidden="true">
              <Icon name={counts.awaiting ? 'IconClock' : 'IconCheck'} width="18" height="18" />
            </span>
            <span className={styles.scoreText}>
              <b>{counts.awaiting ? `${counts.awaiting} to answer` : 'Inbox clear'}</b>
              <span>
                {!replyTime?.answered ? 'Your reply time shows after the first answer'
                  : replyTime.answered === 1 ? <>Your first answer took {spoken(replyTime.median_seconds)}</>
                    : <>You usually answer in {spoken(replyTime.median_seconds)}</>}
              </span>
            </span>
            {quick !== null && (
              <span className={styles.badge} data-good={quick || undefined}>
                <Tip side="end" place="below">Quick means your usual first reply lands within 12 hours of the question.</Tip>
                {quick ? 'Quick' : 'Slow'}
              </span>
            )}
          </div>

          <div className={styles.tabs} role="group" aria-label="Filter conversations">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className={styles.tab} aria-pressed={filter === f.key}
                onClick={() => { setParams(f.key === fallback ? {} : { filter: f.key }, { replace: true }); setSelectedId(null); }}>
                {f.label}
                <span data-num>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {truncated && <p className={styles.truncated}>The most recent 200 conversations.</p>}

          {visible.length === 0 ? (
            <div className={styles.none}>
              <Icon name="IconCheck" width="18" height="18" />
              <p>{filter === 'awaiting' ? 'Nothing waiting. Every question has an answer.' : 'Nothing in here.'}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {waiting.length > 0 && <li className={styles.group} data-tone="waiting">Waiting on you</li>}
              {waiting.map((t) => (
                <ThreadHead key={t.id} thread={t} selected={selected?.id === t.id}
                  onSelect={(id) => { setSelectedId(id); setShowing(true); }} />
              ))}
              {waiting.length > 0 && rest.length > 0 && <li className={styles.group}>Answered</li>}
              {rest.map((t) => (
                <ThreadHead key={t.id} thread={t} selected={selected?.id === t.id}
                  onSelect={(id) => { setSelectedId(id); setShowing(true); }} />
              ))}
            </ul>
          )}
        </aside>

        {failed && <p className={styles.error} role="alert">{failed}</p>}

        {selected ? (
          <ThreadPanel returns={tenant?.store?.returns} key={selected.id} thread={selected} messages={messages[selected.id]} busy={busy} run={run}
            onOpen={open} onReply={reply} onStatus={setStatus} onWithdraw={withdrawOffer}
            onBack={() => setShowing(false)} />
        ) : (
          <div className={styles.panelEmpty}>
            <span className={styles.clearMark} aria-hidden="true"><Icon name="IconCheck" width="28" height="28" /></span>
            {nearest ? (
              <>
                <p className={styles.clearTitle}>Nothing in here</p>
                <button type="button" className={styles.quiet}
                  onClick={() => { setParams({ filter: nearest.key }, { replace: true }); setSelectedId(null); }}>
                  See the {counts[nearest.key]} {nearest.label.toLowerCase()}
                </button>
              </>
            ) : <p className={styles.clearTitle}>No conversations yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}
