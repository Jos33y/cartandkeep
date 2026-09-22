import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { registerStoreWorker } from '@pwa/registerStore';
import '@styles/base/reset.css';
import '@styles/base/tokens.css';
import '@styles/base/global.css';

// Fonts load with the chunk that uses them, so the shop never downloads the portal's.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Not awaited: a service worker must never sit in front of first paint.
registerStoreWorker();
