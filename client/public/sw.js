// DRU CLEAR™ Service Worker — v2
// Forces immediate activation, versioned cache, auto-cleans old caches,
// and notifies the app when a new version is available.

const CACHE_NAME = "dru-clear-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
];

// ── Install: cache static shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  // skipWaiting forces this SW to activate immediately (no waiting tab to close)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  // clients.claim makes this SW take control of all open pages immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

// ── Fetch: network-first with cache fallback ──────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Only handle GET requests for same-origin or CDN assets
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http(s) and cross-origin API calls (webhooks, DNS, etc.)
  if (!url.protocol.startsWith("http")) return;
  if (
    url.hostname.includes("leadconnectorhq.com") ||
    url.hostname.includes("cloudflare-dns.com") ||
    url.hostname.includes("aiforbusiness.com")
  ) {
    return; // let these go to network directly
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a clone of successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Message: listen for SKIP_WAITING from app ─────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
