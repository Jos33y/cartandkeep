import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { registerStoreWorker } from '@pwa/registerStore';
import '@styles/base/reset.css';
import '@styles/base/tokens.css';
import '@styles/base/global.css';

// No font imports here. Every face loads with the app chunk that uses it, so
// the shop does not download Geist and IBM Plex Mono and the portal does not
// download Archivo. The Booting fallback in App.jsx renders in a system face
// for the moment before a chunk arrives, which is the correct trade.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Not awaited, on purpose. A service worker must never sit in front of first
// paint, and it decides for itself whether this host should have one at all.
registerStoreWorker();
