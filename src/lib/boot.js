// src/lib/boot.js
//
// Takes the splash down once the app has actually put something on screen.
//
// Called after the first paint rather than on mount, because mounting and
// painting are not the same frame, and hiding the splash on mount shows the
// blank frame it exists to prevent.

export function bootDone() {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.__bootDone?.());
  });
}
