const CACHE_NAME = "qt-fashion-shell-v6";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/");
      if (!response.ok) throw new Error("Could not cache the app shell.");
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/", response.clone());
      const html = await response.text();
      const assets = Array.from(
        html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g),
        (match) => match[1],
      );
      await cache.addAll([
        "/index.html",
        "/site.webmanifest",
        "/favicon.png",
        "/apple-touch-icon.png",
        "/qt-fashion-icon-192.png",
        "/qt-fashion-icon-512.png",
        ...new Set(assets),
      ]);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("qt-fashion-shell-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/index.html"))),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || /\.(svg|png|jpg|jpeg|webp|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      }),
    );
  }
});
