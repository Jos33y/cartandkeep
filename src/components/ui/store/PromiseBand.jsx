import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightIcon, MessageIcon, SearchIcon } from '@components/ui/store/icons';
import { STORE_ROUTES } from '@utils/constants';
import { replyPromise, storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/promise-band.module.css';

const useExamples = () => useMemo(() => storeConfig().voice?.requestExamples ?? [], []);

// The band fades its parts in once it is on screen, and never replays.
function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

export function PromiseBand({ from = 'home band' }) {
  const navigate = useNavigate();
  const [want, setWant] = useState('');
  const examples = useExamples();
  const [ref, seen] = useSeen();
  const input = useRef(null);

  function submit(event) {
    event.preventDefault();
    const params = new URLSearchParams({ from });
    if (want.trim()) params.set('for', want.trim());
    navigate(`${STORE_ROUTES.REQUEST}?${params}`);
  }

  const steps = [
    { Icon: MessageIcon, title: 'Name it', note: 'Make, model or part number' },
    { Icon: SearchIcon, title: 'We search', note: 'Our suppliers, not a bot' },
    { Icon: ArrowRightIcon, title: 'You hear back', note: `A reply ${replyPromise()}` },
  ];

  return (
    <section ref={ref} className={styles.band} aria-labelledby="ask" data-seen={seen || undefined}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Requests</p>
          <h2 id="ask" className={`${styles.title} wide`}>
            <span className={styles.titleLine}>Name it.</span>
            <span className={styles.titleLine}>We will look for it.</span>
          </h2>
          <p className={styles.body}>Model numbers, spare parts, the one you always buy.</p>

          <ol className={styles.steps}>
            {steps.map(({ Icon, title, note }, i) => (
              <li key={title} className={styles.step} style={{ '--i': i }}>
                <span className={styles.stepMark}><Icon size={18} /></span>
                <span className={styles.stepTitle}>{title}</span>
                <span className={styles.stepNote}>{note}</span>
              </li>
            ))}
          </ol>
        </div>

        <form className={styles.slip} onSubmit={submit}>
          <div className={styles.slipHead}>
            <span className={styles.slipLabel}>Request slip</span>
            <span className={styles.stamp} aria-hidden="true">Free<br />to ask</span>
          </div>

          <label htmlFor="band-want" className={styles.lineLabel}>I am looking for</label>
          <div className={styles.line}>
            <input
              id="band-want"
              ref={input}
              className={styles.input}
              value={want}
              onChange={(e) => setWant(e.target.value)}
              autoComplete="off"
              maxLength={200}
              placeholder="Make, model or part number"
            />
          </div>

          {examples.length > 0 && (
            <div className={styles.try}>
              <span className={styles.tryLabel}>Try</span>
              {examples.map((ex) => (
                <button key={ex} type="button" className={styles.tryChip} onClick={() => { setWant(ex); input.current?.focus(); }}>
                  {ex}
                </button>
              ))}
            </div>
          )}

          <div className={styles.slipFoot}>
            <button type="submit" className={styles.send}>
              Send the request <ArrowRightIcon size={16} />
            </button>
            <span className={styles.fine}>No account needed.</span>
          </div>
        </form>
      </div>
    </section>
  );
}
