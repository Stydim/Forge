// Forge service worker: keeps the app shell (index.html, the built JS/CSS,
// fonts and images) on the device so the app opens without a network. Book
// data (/api/*) is not touched here — the app keeps its own offline copy in
// IndexedDB (src/lib/offline.js) and queues changes made offline.
//
// vite.config.js copies this file into dist/sw.js at build time, filling in
// the build's file list and a version that changes with every build.
const VERSION = '__VERSION__';
const PRECACHE = self.__PRECACHE__;
const SHELL = `forge-shell-${VERSION}`;
const RUNTIME = 'forge-runtime';

// The Google Fonts stylesheet is a plain (no-cors) <link>, so it's fetched
// the same way; everything else is our own origin.
const requestFor = (url) => (url.startsWith('http') ? new Request(url, { mode: 'no-cors' }) : new Request(url, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(requestFor(url));
        if (res.ok || res.type === 'opaque') await cache.put(url, res);
      } catch { /* picked up at runtime instead */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('forge-shell-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function put(cacheName, request, res) {
  if (!res || !(res.ok || res.type === 'opaque')) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, res);
}

// Pages: the network first (so a new build shows up right away), the saved
// shell when there's none. Every route is the same index.html.
async function navigate(event) {
  try {
    const res = await fetch(event.request);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      event.waitUntil(put(SHELL, '/', res.clone()));
    }
    return res;
  } catch (err) {
    const cached = await caches.match('/');
    if (cached) return cached;
    throw err;
  }
}

// Hashed build files and font files never change: the cache first.
async function cacheFirst(event, cacheName) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  event.waitUntil(put(cacheName, event.request, res.clone()));
  return res;
}

// Images and the fonts stylesheet: the saved copy right away, refreshed in
// the background.
async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const fresh = fetch(event.request).then((res) => {
    event.waitUntil(put(RUNTIME, event.request, res.clone()));
    return res;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') { event.respondWith(navigate(event)); return; }
    if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(event, SHELL)); return; }
    event.respondWith(staleWhileRevalidate(event));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com') { event.respondWith(staleWhileRevalidate(event)); return; }
  if (url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(event, RUNTIME));
});
