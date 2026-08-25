// Receipt Vault — service worker
// Bump CACHE whenever the app shell changes so old caches get cleared out.
const CACHE = "receipt-vault-v3";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Page navigations: try the network first so people always see fresh
  // content when online, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put("./index.html", res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Fonts and the Supabase SDK rarely change: cache-first, refresh in the background.
  const isStaticAsset =
    /fonts\.(googleapis|gstatic)\.com/.test(req.url) ||
    /cdn\.jsdelivr\.net/.test(req.url) ||
    req.url.includes(self.registration.scope);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
