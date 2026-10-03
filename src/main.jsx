import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { registerStoreWorker } from '@pwa/registerStore';
import { reloadOnce } from '@lib/staleBuild';
import '@styles/base/reset.css';
import '@styles/base/tokens.css';
import '@styles/base/global.css';

// Fonts load with the chunk that uses them, so the shop never downloads the portal's.

// A tab opened before a deploy asks for page files the new build no longer has. Vite reports it here first: load
// the new build once instead of failing (lib/staleBuild.js). A second failure goes on to the error screens.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Not awaited: a service worker must never sit in front of first paint.
registerStoreWorker();
