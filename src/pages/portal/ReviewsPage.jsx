import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useReviews } from '@hooks/useReviews';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import styles from '@styles/pages/portal/reviews-page.module.css';

const FILTERS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'On the shop' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'all', label: 'All' },
];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ago(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STAR = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';

// Fills by fraction, so 4.5 shows four and a half.
export function Stars({ value, size = 16, tone }) {
  const id = useId();
  return (
    <span className={styles.stars} data-tone={tone} role="img" aria-label={value == null ? 'No rating' : `${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = value == null ? 0 : Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-${i}`}>
                <stop offset={fill} stopColor="currentColor" />
                <stop offset={fill} stopColor="currentColor" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path d={STAR} fill={`url(#${id}-${i})`} />
          </svg>
        );
      })}
    </span>
  );
}

function Hero({ published, approved, pending, onNext, first }) {
  const bars = [5, 4, 3, 2, 1].map((n) => ({ n, count: approved.filter((r) => Number(r.rating) === n).length }));
  const most = Math.max(1, ...bars.map((b) => b.count));

  return (
    <section className={styles.hero}>
      <div className={styles.score}>
        <p className={styles.scoreLabel}>What the shop shows</p>
        {/* No rating is not a rating of zero, the same rule store_product_ratings follows. */}
        {published == null ? (
          <p className={styles.scoreNone}>Not rated yet</p>
        ) : (
          <p className={styles.scoreFigure}>
            <span data-num>{published.toFixed(1)}</span>
            <small>/ 5</small>
          </p>
        )}
        <Stars value={published} size={22} tone="gold" />
        <p className={styles.scoreNote}>
          {approved.length ? `From ${plural(approved.length, 'published review')}` : 'No published reviews yet'}
        </p>
      </div>

      <ol className={styles.bars} aria-label="Published reviews by stars" data-first={first || undefined}>
        {bars.map((b, i) => (
          <li key={b.n} className={styles.bar}>
            <span className={styles.barLabel} data-num>{b.n}</span>
            <Icon name="IconStar" width="12" height="12" />
            <span className={styles.barTrack}>
              <i style={{ width: `${(b.count / most) * 100}%`, animationDelay: `${i * 70}ms` }} data-low={b.n <= 2 || undefined} />
            </span>
            {!first && <span className={styles.barCount} data-num>{b.count}</span>}
          </li>
        ))}
      </ol>

      <div className={styles.waiting} data-clear={!pending || undefined}>
        {!first && <span className={styles.waitingFigure} data-num>{pending}</span>}
        <span className={styles.waitingText}>
          {first ? 'Each review waits here for you before the shop shows it.'
            : pending ? `${pending === 1 ? 'review is' : 'reviews are'} waiting for you` : 'Nothing waiting. Every review is decided.'}
        </span>
        {pending > 0 && (
          <button type="button" className={styles.heroGo} onClick={onNext}>Read the next</button>
        )}
      </div>
    </section>
  );
}

// The only grounds the shop's reviews page allows. Whether a review is favourable is never one of them.
const HOLD_REASONS = [
  ['abusive', 'Abusive or unlawful'],
  ['personal_details', 'Has someone\u2019s personal details'],
  ['off_topic', 'Not about the product or order'],
  ['advertising', 'Advertises something'],
];
const HOLD_LABEL = Object.fromEntries(HOLD_REASONS);

function HoldReasons({ busy, onPick, onCancel }) {
  return (
    <div className={styles.reply} role="group" aria-label="Why is it being held back">
      <span className={styles.replyLabel}>
        Why is it being held back?
        <Tip side="end">A low rating is not a reason. Hiding reviews because they are unfavourable is banned under consumer law, and the reviews page promises these four only.</Tip>
      </span>
      <div className={styles.replyActions}>
        {HOLD_REASONS.map(([key, label]) => (
          <button key={key} type="button" className={styles.quiet} disabled={busy} onClick={() => onPick(key)}>{label}</button>
        ))}
        <button type="button" className={styles.link} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Review({ review, busy, run, onApprove, onHide, onReply, example, just }) {
  const [holding, setHolding] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(review.reply ?? '');
  const [whole, setWhole] = useState(false);
  // About six lines at this width; anything longer is cut with a way to read the rest.
  const long = (review.body ?? '').length > 420 || (review.body ?? '').split('\n').length > 6;
  const low = Number(review.rating) <= 2;

  return (
    <li id={`review-${review.id}`} className={styles.review} data-status={review.status}
      data-example={example || undefined} data-just={just || undefined}>
      {example && <span className={styles.exampleTag}>Example</span>}

      <div className={styles.product}>
        {thumb(review.product?.image_url)
          ? <img src={thumb(review.product.image_url)} alt="" />
          : <span className={styles.productEmpty} aria-hidden="true" />}
        <span className={styles.productText}>
          <span className={styles.productTitle}>{review.product?.title ?? 'A product no longer listed'}</span>
          {review.variantLabel && <span className={styles.variant}>{review.variantLabel}</span>}
        </span>
      </div>

      <div className={styles.said}>
        <div className={styles.saidTop}>
          <Stars value={Number(review.rating)} size={18} tone={low ? 'low' : 'gold'} />
          {low && review.status === 'pending' && (
            <span className={styles.lowTag}>
              Low rating
              <Tip side="end">A reply on the shop, calm and specific, often counts for more with the next buyer than the stars do.</Tip>
            </span>
          )}
          <span className={styles.when}>{ago(review.created_at)}</span>
        </div>
        {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
        {review.body
          ? (
            <>
              <blockquote className={styles.body} data-cut={(long && !whole) || undefined}>{review.body}</blockquote>
              {long && (
                <button type="button" className={styles.more} onClick={() => setWhole((v) => !v)}>
                  {whole ? 'Show less' : 'Read all'}
                </button>
              )}
            </>
          )
          : <p className={styles.noWords}>Stars only, no words.</p>}
        <p className={styles.by}>
          <span className={styles.author}>{review.author || 'A customer'}</span>
          <span className={styles.verified}>
            <Icon name="IconCheck" width="12" height="12" />
            Bought it{review.order?.reference ? <>, order <span data-num>{review.order.reference}</span></> : ''}
          </span>
        </p>

        {review.reply && !replying && (
          <div className={styles.reply}>
            <span className={styles.replyLabel}>Your reply, shown under it</span>
            <p>{review.reply}</p>
          </div>
        )}

        {replying && (
          <form className={styles.replyForm} onSubmit={(e) => {
            e.preventDefault();
            run(async () => { await onReply({ id: review.id, text }); setReplying(false); });
          }}>
            <textarea className={styles.textarea} rows={3} value={text} autoFocus onChange={(e) => setText(e.target.value)}
              placeholder="Thank them, or put right what went wrong. It shows on the shop under their review." />
            <div className={styles.replyActions}>
              <button type="button" className={styles.link} onClick={() => { setReplying(false); setText(review.reply ?? ''); }}>Cancel</button>
              <button type="submit" className={styles.quiet} disabled={busy}>{text.trim() ? 'Save reply' : 'Remove reply'}</button>
            </div>
          </form>
        )}
        {holding && (
          <HoldReasons
            busy={busy}
            onCancel={() => setHolding(false)}
            onPick={(reason) => { setHolding(false); run(() => onHide(review.id, reason)); }}
          />
        )}
      </div>

      <div className={styles.decide}>
        {review.status === 'pending' && (
          <>
            <button type="button" className={styles.approve} disabled={busy} tabIndex={example ? -1 : undefined}
              onClick={() => !example && run(() => onApprove(review.id), review.id)}>
              <Icon name="IconCheck" width="16" height="16" />Put it on the shop
            </button>
            <button type="button" className={styles.link} disabled={busy || holding} tabIndex={example ? -1 : undefined} onClick={() => !example && setHolding(true)}>Hide it</button>
          </>
        )}
        {review.status === 'approved' && (
          <>
            <span className={styles.live}><i />On the shop</span>
            <button type="button" className={styles.link} disabled={busy || holding} tabIndex={example ? -1 : undefined} onClick={() => !example && setHolding(true)}>Hide it</button>
          </>
        )}
        {review.status === 'hidden' && (
          <>
            <span className={styles.hiddenTag}>{review.hidden_reason ? `Hidden: ${HOLD_LABEL[review.hidden_reason]}` : 'Hidden'}</span>
            <button type="button" className={styles.link} disabled={busy} onClick={() => run(() => onApprove(review.id), review.id)}>Put it on the shop</button>
          </>
        )}
        {!replying && (
          <button type="button" className={styles.link} disabled={busy} tabIndex={example ? -1 : undefined} onClick={() => !example && setReplying(true)}>
            {review.reply ? 'Edit your reply' : 'Reply'}
          </button>
        )}
      </div>
    </li>
  );
}

const SAMPLE_LOW = {
  id: 'example-low',
  rating: 2,
  title: 'Box crushed, one corner chipped',
  body: 'It works fine, but the box arrived crushed and one corner is chipped.',
  author: 'Ade',
  status: 'pending',
  reply: 'Sorry about that, Ade. A replacement is on its way today, no need to send this one back.',
  created_at: new Date(Date.now() - 86400000).toISOString(),
  order: { reference: 'CK-1051' },
};

const SAMPLE = {
  id: 'example',
  rating: 5,
  title: 'Made getting up so much easier',
  body: 'Bought this for my mum. It went on in ten minutes with the straps under the mattress, no drilling, and it does not move when she leans on it.',
  author: 'Sarah',
  status: 'pending',
  created_at: new Date().toISOString(),
  product: { title: 'Bed Rails for Elderly Adults Adjustable Bed Assist Rail Safety Handle Seniors', image_url: null },
  order: { reference: 'CK-1042' },
};

const HOW = [
  { icon: 'IconBox', title: 'The order goes out', body: 'You mark it dispatched as usual.' },
  { icon: 'IconEnvelope', title: 'A week later, one email', body: 'Asking how it went, with a link only that buyer has.' },
  { icon: 'IconStar', title: 'It waits here for you', body: 'Nothing reaches the shop until you put it there.' },
];

function FirstReview({ tenantId }) {
  const [shelf, setShelf] = useState([]);

  // The examples use her own products, so she sees her shop rather than a stand-in.
  useEffect(() => {
    if (!tenantId) return;
    supabase.from('store_products').select('title, image_url')
      .eq('tenant_id', tenantId).eq('status', 'live').not('image_url', 'is', null)
      .order('created_at').limit(2)
      .then(({ data }) => setShelf(data ?? []));
  }, [tenantId]);

  const first = shelf[0] ?? SAMPLE.product;
  const second = shelf[1] ?? shelf[0] ?? SAMPLE.product;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Reviews</h1>
        <p className={styles.sub}>None yet. Every one will come from somebody who actually bought the thing.</p>
      </header>

      <Hero published={null} approved={[]} pending={0} onNext={() => {}} first />

      <div className={styles.first}>
        <section className={styles.firstMain}>
          <p className={styles.firstLabel}>This is how one will arrive</p>
          <ul className={styles.list}>
            <Review review={{ ...SAMPLE, product: first }} example busy={false}
              run={() => {}} onApprove={() => {}} onHide={() => {}} onReply={() => {}} />
          </ul>
          <p className={styles.firstLabel} data-gap="">And when one goes wrong, your reply sits under it</p>
          <ul className={styles.list}>
            <Review review={{ ...SAMPLE_LOW, product: second }} example busy={false}
              run={() => {}} onApprove={() => {}} onHide={() => {}} onReply={() => {}} />
          </ul>
        </section>
        <Card className={styles.how}>
          <CardHead title="How reviews reach you" />
          <ol className={styles.steps}>
            {HOW.map((h, i) => (
              <li key={h.title} className={styles.step}>
                <span className={styles.stepIcon}><Icon name={h.icon} width="16" height="16" /><i data-num>{i + 1}</i></span>
                <span><b>{h.title}</b><span>{h.body}</span></span>
              </li>
            ))}
          </ol>
          <p className={styles.howNote}>
            Only a buyer can write one, from their own link, so the stars on the shop are facts. Nobody can add a review from a product page.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function ReviewsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, error, counts, published, approve, hide, reply, reload } = useReviews(tenant?.id);
  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const fallback = counts.pending ? 'pending' : 'approved';
  const filter = FILTERS.some((f) => f.key === requested) ? requested : fallback;

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [just, setJust] = useState(null);

  async function run(fn, done = null) {
    setBusy(true);
    setFailed(null);
    try {
      await fn();
      if (done) {
        setJust(done);
        setTimeout(() => setJust(null), 1400);
      }
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);
  const approved = useMemo(() => rows.filter((r) => r.status === 'approved'), [rows]);

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The reviews did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (counts.all === 0) return <FirstReview tenantId={tenant?.id} />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Reviews</h1>
        <p className={styles.sub}>
          {counts.pending ? <><span data-num>{counts.pending}</span> waiting for you. </> : null}
          <span data-num>{counts.approved}</span> on the shop.
        </p>
      </header>

      <Hero published={published} approved={approved} pending={counts.pending}
        onNext={() => {
          setParams({}, { replace: true });
          const next = rows.find((r) => r.status === 'pending');
          if (next) document.getElementById(`review-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }} />

      <div className={styles.tabs} role="group" aria-label="Filter reviews">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={styles.tab} aria-pressed={filter === f.key}
            onClick={() => setParams(f.key === fallback ? {} : { filter: f.key }, { replace: true })}>
            {f.label}<span data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {failed && <p className={styles.error} role="alert">{failed}</p>}
      {just && (
        <p className={styles.toast} role="status">
          <span className={styles.toastMark}><Icon name="IconCheck" width="14" height="14" /></span>
          On the shop. The rating is now <b data-num>{published?.toFixed(1) ?? '0.0'}</b>.
        </p>
      )}

      {visible.length === 0 ? (
        <Card className={styles.none}>
          <span className={styles.noneMark}><Icon name="IconCheck" width="22" height="22" /></span>
          <p className={styles.noneTitle}>{filter === 'pending' ? 'Every review is decided' : 'Nothing in here'}</p>
        </Card>
      ) : (
        <ul className={styles.list}>
          {visible.map((r) => (
            <Review key={r.id} review={r} busy={busy} run={run} onApprove={approve} onHide={hide} onReply={reply} just={just === r.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
