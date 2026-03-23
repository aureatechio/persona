// Arena PWA — Client component that ensures PWA meta tags exist in DOM
// Fallback for when Next.js metadata merge doesn't work properly

'use client';

import { useEffect } from 'react';

function ensureMeta(name: string, content: string, attr = 'name') {
  if (!document.querySelector(`meta[${attr}="${name}"]`)) {
    const meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    meta.content = content;
    document.head.appendChild(meta);
  }
}

function ensureLink(rel: string, href: string, extra?: Record<string, string>) {
  const selector = extra
    ? `link[rel="${rel}"][href="${href}"]`
    : `link[rel="${rel}"]`;
  if (!document.querySelector(selector)) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (extra) Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
    document.head.appendChild(link);
  }
}

export function PwaHead() {
  useEffect(() => {
    // Manifest
    ensureLink('manifest', '/arena-manifest.json');

    // iOS PWA
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    ensureMeta('apple-mobile-web-app-title', 'Arena');
    ensureLink('apple-touch-icon', '/arena-icons/icon-192.png');

    // Android PWA
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('theme-color', '#000000');

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/arena-sw.js')
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }
  }, []);

  return null;
}
