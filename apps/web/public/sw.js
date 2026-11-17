// Jotaish service worker: keeps the app's screens on the device so saved
// readings open without internet. Which screens may be used offline is
// decided in the app (components/Pwa.tsx); this only supplies the pages.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `jotaish-${VERSION}`;
const PAGES = `jotaish-pages-${VERSION}`;
const SHELL = ['/offline', '/readings', '/brand/mark.svg', '/brand/icon-192.png', '/manifest.webmanifest'];

// Script, style and font files a page needs, read from its HTML.
const assetsIn = (html) => [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || [])];

async function keepPage(cache, path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(path, res);
  const assets = await caches.open(CACHE);
  await Promise.all(assetsIn(html).map((a) => assets.match(a).then((hit) => hit || assets.add(a).catch(() => undefined))));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(SHELL.map((p) => (p === '/offline' || p === '/readings' ? keepPage(cache, p) : cache.add(p))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key !== PAGES) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The app asks for its reading pages to be kept, and cleared on sign-out.
self.addEventListener('message', (event) => {
  const { type, paths } = event.data || {};
  if (type === 'keep-pages' && Array.isArray(paths)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES);
        for (const p of paths) if (!(await cache.match(p))) await keepPage(cache, p).catch(() => undefined);
      })(),
    );
  }
  if (type === 'clear-pages') event.waitUntil(caches.delete(PAGES));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: always fresh when online; offline, the kept copy or "No internet".
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && /^\/readings(\/[^/]+)?\/?$/.test(url.pathname)) {
            const copy = res.clone();
            caches.open(url.pathname === '/readings' ? CACHE : PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          return (await caches.match(url.pathname)) || (await caches.match('/offline')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Built files never change under the same name; images rarely do.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/tarot/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })(),
    );
  }
});
