/* ============================================================
   Sadhana — Service Worker
   Cache-first app-shell strategy so the tracker keeps working
   fully offline once it has been opened one time.
   Bump CACHE_VERSION whenever app files are updated so old
   caches are cleared and the new version is picked up.
   ============================================================ */
const CACHE_VERSION = "sadhana-v2.0.0";
const CACHE_NAME = `sadhana-cache-${CACHE_VERSION}`;

/* Files that make up the app shell. Paths are relative to the
   location of this service-worker.js file. */
const APP_SHELL = [
  "./",
  "./Sadhana_v2.0.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

/* ---------------- install: pre-cache app shell ---------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- activate: drop old caches ---------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("sadhana-cache-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------------- fetch: cache-first, network fallback, offline fallback ---------------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests; let everything else pass through.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Navigations (address bar / home-screen launch) — always try to serve the app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./Sadhana_v2.0.html"))
    );
    return;
  }

  // Everything else: cache-first, then network, then cache the fresh response.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

/* ---------------- allow page to trigger immediate activation ---------------- */
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
