'use strict';
// Change VERSION whenever the precached game files change.
const VERSION = '2026-10-13-v3';
const BASE = new URL('./', self.location.href);
const PREFIX = `word-garden:${BASE.pathname}:`;
const CACHE = PREFIX + VERSION;
const CORE = [
  './', 'index.html', 'dist/', 'dist/index.html', 'dist/style.css',
  'dist/data.js', 'dist/speech.js', 'dist/app.js', 'dist/pwa.js',
  'dist/manifest.webmanifest', 'dist/icons/icon-192.png',
  'dist/icons/icon-512.png', 'dist/icons/icon-maskable-512.png',
  'dist/icons/apple-touch-icon.png'
].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // All files must be fetched successfully before offline readiness is announced.
    await cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'OFFLINE_STATUS' && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const ready = (await Promise.all(CORE.map(url => cache.match(url)))).every(Boolean);
      event.ports[0].postMessage({ ready, version: VERSION });
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const canonical = new URL(url.pathname, BASE.origin).href;
  if (request.mode !== 'navigate' && !CORE.includes(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(canonical);
    if (cached) return cached;
    try { return await fetch(request); }
    catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match(new URL('dist/index.html', BASE).href);
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
