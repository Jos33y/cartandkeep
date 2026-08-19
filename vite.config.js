import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),

    // One build serves portal., status. and the shop. The worker is registered
    // by hand in src/pwa/registerStore.js so it only ever installs on the shop,
    // and the manifest is attached the same way from index.html. Automatic
    // registration would put a service worker on her review tool and cache a
    // candidate list that changes on every import.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,

      // public/manifest.webmanifest is written by hand and ships with the brand
      // assets. The plugin must not generate a second one.
      manifest: false,

      includeAssets: [
        "icons/favicon.svg",
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/favicon-48.png",
        "icons/favicon-64.png",
        "icons/apple-touch-icon-180.png",
        "icons/app-icon-192.png",
        "icons/app-icon-512.png",
        "icons/app-icon-maskable-512.png",
        "icons/logomark.svg",
        "icons/logomark-mono.svg",
        "icons/logo-horizontal.svg",
        "og-card-1200x630.png",
        "robots.txt",
        "manifest.webmanifest",
      ],

      workbox: {
        // woff2 is deliberately not in here. Fontsource ships every unicode
        // subset of every family, and precaching them put Vietnamese Archivo
        // and Cyrillic Inter on a shopper's first load alongside two faces
        // only the portal uses. They are cached on use instead, one rule down,
        // and font-display: swap covers the first paint.
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],

        // Nine launch images at roughly 380KB, read once by iOS at install.
        // Precaching them puts that on every first visit.
        globIgnores: ["**/splash/**"],

        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        navigateFallback: "/index.html",
        // Supabase and any API call must reach the network. A cached price is
        // a wrong price.
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],

        runtimeCaching: [
          {
            // Self hosted faces, cached the first time a subset is actually
            // used. Hashed filenames, so a year is safe and a rebuild simply
            // asks for a different name.
            urlPattern: /\/assets\/.*\.woff2$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // eBay product photography. Immutable once published and the
            // heaviest thing on a category page.
            urlPattern: /^https:\/\/i\.ebayimg\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "product-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // Off in development so a stale cache never explains a bug that is not
      // there.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@app": resolve(__dirname, "./src/app"),
      "@components": resolve(__dirname, "./src/components"),
      "@context": resolve(__dirname, "./src/context"),
      "@pages": resolve(__dirname, "./src/pages"),
      "@pwa": resolve(__dirname, "./src/pwa"),
      "@styles": resolve(__dirname, "./src/styles"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@utils": resolve(__dirname, "./src/utils"),
      "@lib": resolve(__dirname, "./src/lib"),
      "@data": resolve(__dirname, "./src/data"),
    },
  },
  css: {
    modules: { localsConvention: "camelCase" },
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
});
