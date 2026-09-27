import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { MailIcon, MessageIcon, PauseIcon, PlayIcon, ReturnIcon, LockIcon, VanIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { freeOver, replyPromise, returnsTerms, storeConfig } from '@lib/storeConfig';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/layout/store/announcement-bar.module.css';

const HOLD = 4800;
const pounds = (n) => (Number.isInteger(Number(n)) ? `\u00a3${Number(n)}` : formatGbp(n));

// The shop's promises in turn, each one a link to where it is kept. The first one knows what is in the basket.
function useMessages() {
  const { count, subtotal } = useBasket();
  const threshold = freeOver();
  const share = threshold > 0 ? Math.min(1, subtotal / threshold) : 0;
  const delivery = count === 0
    ? { text: `Free UK delivery from ${pounds(threshold)}` }
    : share >= 1
      ? { text: 'Your delivery is free', done: true }
      : { text: `${formatGbp(threshold - subtotal)} more and delivery is free`, share };

  // The basket page shows the delivery gap beside its own total, so the bar does not say it a second time there.
  const onBasket = useLocation().pathname === STORE_ROUTES.CART;

  return [
    ...(onBasket ? [] : [{ key: 'delivery', Icon: VanIcon, to: '/legal/delivery', ...delivery }]),
    { key: 'returns', Icon: ReturnIcon, to: '/legal/returns', text: `${returnsTerms().days ?? 30} days to change your mind` },
    { key: 'account', Icon: LockIcon, to: STORE_ROUTES.FAQ, text: 'No account needed, ever' },
    { key: 'reply', Icon: MessageIcon, to: STORE_ROUTES.CONTACT, text: `A person replies ${replyPromise()}` },
  ];
}

export function AnnouncementBar() {
  const messages = useMessages();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [still, setStill] = useState(false);
  const tagline = storeConfig().voice?.tagline;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setStill(Boolean(mq?.matches));
  }, []);

  const running = !paused && !held && !still;

  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => setI((n) => (n + 1) % messages.length), HOLD);
    return () => clearTimeout(t);
  }, [i, running, messages.length]);

  // Wrapped, because the basket page carries one message fewer than the rest of the shop.
  const m = messages[i % messages.length];

  return (
    <div className={styles.bar} role="region" aria-label="Shop promises" style={{ '--hold': `${HOLD}ms` }}>
      <div className={styles.inner}>
        {tagline && <p className={styles.voice}>{tagline}</p>}

        <div
          className={styles.ticker}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <Link key={m.key} to={m.to} className={styles.message} data-done={m.done || undefined}>
            <m.Icon size={16} />
            <span>{m.text}</span>
            {m.share != null && (
              <span className={styles.mini} aria-hidden="true"><span style={{ transform: `scaleX(${m.share})` }} /></span>
            )}
          </Link>

          <span className={styles.dots} aria-hidden="true">
            {messages.map((x, n) => <i key={x.key} data-on={n === i % messages.length || undefined} />)}
          </span>

          {!still && (
            <button
              type="button"
              className={styles.pause}
              aria-label={paused ? 'Play the messages' : 'Pause the messages'}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
            </button>
          )}
        </div>

        <nav className={styles.utility} aria-label="Help">
          <Link to={STORE_ROUTES.ORDER_LOOKUP} className={styles.utilityLink}><VanIcon size={16} />Track an order</Link>
          <Link to={STORE_ROUTES.FAQ} className={styles.utilityLink}><MessageIcon size={16} />Help</Link>
          <Link to={STORE_ROUTES.CONTACT} className={styles.utilityLink}><MailIcon size={16} />Contact</Link>
        </nav>
      </div>

      {/* The line fills while a message is shown, so the rotation is never a surprise. */}
      <span key={`${i}-${running}`} className={styles.progress} data-running={running || undefined} aria-hidden="true" />
    </div>
  );
}
