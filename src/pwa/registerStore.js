/*
 * Service worker registration, shop only.
 *
 * `injectRegister` is off in vite.config.js so this is the only place a worker
 * is installed. Registering on portal. would cache her review tool, serve a
 * stale candidate list after an import, and offer to install a research
 * instrument as an app called "a general store".
 *
 * Unregistering on the other two hosts matters as much as not registering.
 * A worker installed once persists through deploys, so anyone who loaded the
 * shop and the portal on the same origin during development keeps it forever
 * unless it is actively removed.
 */

import { isStoreHost } from '@lib/host';

export async function registerStoreWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (!isStoreHost()) {
    const existing = await navigator.serviceWorker.getRegistrations();
    await Promise.all(existing.map((r) => r.unregister()));
    return;
  }

  if (import.meta.env.DEV) return;

  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      // autoUpdate: the new worker takes over on the next navigation. No
      // prompt, because a shopper has no idea what a service worker is and a
      // dialog asking them to reload loses the basket.
      onRegisteredSW(url) {
        if (import.meta.env.DEV) console.info('[pwa] worker registered', url);
      },
      onRegisterError(err) {
        console.error('[pwa] worker failed to register', err);
      },
    });
  } catch (err) {
    // A failed worker must never take the shop down with it.
    console.error('[pwa] registration skipped', err);
  }
}
