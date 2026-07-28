Copy from the scope-doc project's `public/assets/`:

  favicon.ico  favicon-16x16.png  favicon-32x32.png  favicon-48x48.png
  favicon-192x192.png  apple-touch-icon.png
  android-chrome-192x192.png  android-chrome-512x512.png
  cnk-mark.svg  cnk-lockup.svg  cnk-lockup-dark.svg
  cnk-lockup-light.png  cnk-lockup-dark.png
  og-image.png

Leave brick-dev-stamp.svg and cnk-og.svg behind. The stamp is studio marking and
does not belong on her storefront; cnk-og.svg was for the scope document.

index.html references these paths, so favicons 404 until they are copied.
