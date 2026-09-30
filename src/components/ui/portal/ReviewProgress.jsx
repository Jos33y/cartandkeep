import { useEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/review-progress.module.css';

/*
 * How far through the pile she is. A ring split the same three colours as the status dots below it, the count, the
 * run decided today, and the next round number to reach. The ring fills green when everything is decided.
 */

const R = 21;
const C = 2 * Math.PI * R;
const n = (v) => Number(v).toLocaleString('en-GB');

// The next round number: 25 and 50 early on, then every hundred.
function nextMark(done, total) {
  const step = done < 50 ? 25 : 100;
  const mark = Math.floor(done / step) * step + step;
  return mark >= total ? total : mark;
}

export function ReviewProgress({ approve, defer, reject, total, today }) {
  // Later is a choice to come back, not a decision, so it shows in the ring but not in the count.
  const done = approve + reject;
  const all = total > 0 && done + defer >= total;
  const pct = total ? Math.floor((done / total) * 100) : 0;
  const mark = nextMark(done, total);

  // The today count springs when it moves, so a decision is felt as well as seen.
  const [bump, setBump] = useState(false);
  const last = useRef(today);
  useEffect(() => {
    if (today > last.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      last.current = today;
      return () => clearTimeout(t);
    }
    last.current = today;
    return undefined;
  }, [today]);

  let at = 0;
  const arc = (v) => {
    const len = total ? (v / total) * C : 0;
    const seg = { dash: `${Math.max(0, len - (len > 3 ? 1.5 : 0))} ${C}`, offset: -at };
    at += len;
    return seg;
  };
  const segs = [['positive', approve], ['negative', reject], ['warning', defer]].map(([tone, v]) => ({ tone, v, ...arc(v) }));

  return (
    <div className={styles.progress} data-all={all || undefined}>
      <svg className={styles.ring} viewBox="0 0 52 52" role="img" tabIndex={0}
        aria-label={`${n(done)} of ${n(total)} decided: ${n(approve)} approved, ${n(reject)} rejected, ${n(defer)} saved for later`}>
        <circle className={styles.track} cx="26" cy="26" r={R} />
        {segs.filter((s) => s.v > 0).map((s) => (
          <circle key={s.tone} className={styles.seg} data-tone={s.tone} cx="26" cy="26" r={R}
            strokeDasharray={s.dash} strokeDashoffset={s.offset} />
        ))}
        {!all && (
          <>
            <text className={styles.pct} x="26" y="26" dominantBaseline="central" textAnchor="middle">{pct}%</text>
            {/* On hover or focus the centre turns from how far through to how many were approved. */}
            <text className={styles.kept} x="26" y="23" textAnchor="middle">{n(approve)}</text>
            <text className={styles.keptWord} x="26" y="33" textAnchor="middle">approved</text>
          </>
        )}
        {all && <path className={styles.done} d="M19 26.5l4.5 4.5 9.5-10" />}
      </svg>

      <div className={styles.text}>
        <p className={styles.line}>
          <span className={`figure ${styles.big}`} data-num>{n(done)}</span>
          <span className={styles.of}>of <span data-num>{n(total)}</span> decided</span>
        </p>
        <p className={styles.sub}>
          <span className={styles.today} data-bump={bump || undefined} data-none={!today || undefined}>
            <Icon name="IconSpark" className={styles.spark} />
            <span data-num>{n(today)}</span> today
          </span>
          {all
            ? <span className={styles.next}>{defer ? `Nothing left to review, ${n(defer)} for later` : 'All decided'}</span>
            : mark >= total
              ? <span className={styles.next}><span data-num>{n(total - done)}</span> to finish</span>
              : <span className={styles.next}><span data-num>{n(mark - done)}</span> to reach <span data-num>{n(mark)}</span></span>}
        </p>
      </div>
    </div>
  );
}
