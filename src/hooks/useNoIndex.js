import { useEffect } from 'react';

// index.html ships index,follow for the storefront. Portal and status share that
// document, so they have to opt out at runtime.
export function useNoIndex() {
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);

    const existing = document.head.querySelector('link[rel="canonical"]');
    if (existing) existing.remove();

    return () => tag.remove();
  }, []);
}
