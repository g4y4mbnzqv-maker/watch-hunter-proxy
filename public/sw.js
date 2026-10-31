// Shows notifications (ending-soon alerts from the open app, and deal
// alerts pushed while it's closed), and keeps the app's own files so it
// opens straight away, even on a poor signal. eBay data and the app's API
// are never cached.

// App files: their names change with every release, so a cached copy is
// always the right one. Pages: fetched fresh, with the last copy kept for
// when there's no signal.
const APP_FILES = "wh-files-v1";
const PAGES = "wh-pages-v1";
// Old app files are dropped beyond this many
const MAX_FILES = 80;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => ![APP_FILES, PAGES].includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(fromCacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request));
  }
});

async function fromCacheFirst(request) {
  const cache = await caches.open(APP_FILES);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function fromNetworkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // A redirect to the passcode page isn't the app itself
    if (response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match("/"));
    if (cached) return cached;
    throw err;
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(keys.length - MAX_FILES, 0))) await cache.delete(key);
}

// Tapping a notification opens the listing on eBay
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});

// Deal alerts sent while the app is closed
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Watch Hunter", {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});
