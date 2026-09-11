/*
 * Service worker — offline app shell and content cache (#32).
 *
 * Classic worker, hand-written, no Workbox. The routing below is about forty lines; a
 * build-time precache manifest generator would be more machinery than the thing it
 * generates, and BUILD-PLAN's dependency policy applies to the free/self-hosted critical
 * path, which this is squarely in.
 *
 * Three strategies, one per kind of request:
 *
 *   navigation  network first, fall back to the cached shell. A learner opening the app
 *               offline gets the app, not the browser's dinosaur.
 *   asset       cache first, refreshed in the background. Hashed filenames mean a cached
 *               asset is never the wrong one.
 *   content     stale-while-revalidate. The cached lesson is served immediately and
 *               refreshed behind it — this is the "last-known-good cached lesson" the
 *               anxiety-safe rule asks for, and it makes the offline path the same code
 *               path as the online one rather than a special case that only runs when
 *               something has already gone wrong.
 *
 * Bump CACHE_VERSION to evict everything on the next activation.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `seim-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `seim-assets-${CACHE_VERSION}`;
const CONTENT_CACHE = `seim-content-${CACHE_VERSION}`;
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, CONTENT_CACHE]);

/** Enough to boot offline. Hashed bundles arrive through the asset strategy on first run. */
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll is all-or-nothing; a single 404 would leave no shell at all.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function strategyFor(request, url) {
  if (request.method !== 'GET') return 'bypass';
  if (url.origin !== self.location.origin) return 'bypass';
  if (request.mode === 'navigate') return 'navigation';
  if (url.pathname.includes('/content/')) return 'content';
  return 'asset';
}

async function navigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) {
    // Refresh behind the response; a failure here is not the learner's problem.
    void fetch(request).then((res) => res.ok && cache.put(request, res.clone())).catch(() => {});
    return hit;
  }
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

async function content(request) {
  const cache = await caches.open(CONTENT_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) void cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const fresh = await network;
  return fresh ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  switch (strategyFor(event.request, url)) {
    case 'navigation':
      event.respondWith(navigation(event.request));
      break;
    case 'content':
      event.respondWith(content(event.request));
      break;
    case 'asset':
      event.respondWith(asset(event.request));
      break;
    default:
      break; // bypass: let the network handle it
  }
});
