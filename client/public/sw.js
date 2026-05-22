// DRU CLEAR™ Service Worker — v3
// v3: Added push notifications for Community Connection
// Forces immediate activation, versioned cache, auto-cleans old caches,
// notifies the app when a new version is available,
// and handles Community Connection push notifications.

const CACHE_NAME = "dru-clear-v3";
const STATIC_ASSETS = [
  "/",
  "/index.html",
];

// ── Install: cache static shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

// ── Activate: delete old caches ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
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
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;
  if (
    url.hostname.includes("leadconnectorhq.com") ||
    url.hostname.includes("cloudflare-dns.com") ||
    url.hostname.includes("aiforbusiness.com")
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Message: listen for SKIP_WAITING from app ────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push: Community Connection notifications ──────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch (e) { return; }

  const title   = data.title || "Community Connection";
  const options = {
    body:               data.body || "You have a new notification",
    icon:               "/new-dru-clear-transparent-logo.png",
    badge:              "/new-dru-clear-transparent-logo.png",
    data:               { url: data.url || "https://app.druaiconsulting.com/community" },
    vibrate:            [100, 50, 100],
    requireInteraction: false,
    actions: [
      { action: "view",    title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open or focus community page ─────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "https://app.druaiconsulting.com/community";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("app.druaiconsulting.com") && "focus" in client) {
            client.postMessage({ type: "NOTIFICATION_CLICK", url });
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
