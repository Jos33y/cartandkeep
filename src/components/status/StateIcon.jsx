/*
 * The state vocabulary, shared by the status page and the deliverables page.
 *
 * Extracted rather than copied, because two pages drawing their own ticks is
 * how a filled circle on one page becomes a hollow one on the other six weeks
 * later, and she reads both.
 *
 * `client` is new here and does not appear on the status page. It marks work
 * that is not ours to finish, and it is terracotta because terracotta already
 * means the thing that needs doing in this product.
 */

export function StateIcon({ state, className, pulseClass }) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 18 18" className={className} aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="9" fill="var(--c-positive)" />
        <path d="M5 9.2l2.7 2.7L13 6.6" fill="none" stroke="var(--c-base)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (state === 'active') {
    return (
      <svg viewBox="0 0 18 18" className={className} aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="4" fill="var(--c-warning)" />
        <circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--c-warning)" strokeWidth="1.5"
          className={pulseClass} />
      </svg>
    );
  }

  // Solid ring rather than dashed. Queued means nobody has started; this means
  // it is waiting on someone, and the difference should be visible at a glance.
  if (state === 'client') {
    return (
      <svg viewBox="0 0 18 18" className={className} aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--c-action-text)" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2.5" fill="var(--c-action-text)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--c-control)" strokeWidth="1.5"
        strokeDasharray="2 3" />
    </svg>
  );
}
