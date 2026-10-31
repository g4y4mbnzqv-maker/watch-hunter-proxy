// Here so phones can show notifications: ending-soon alerts from the open
// app, and deal alerts pushed while it's closed. It caches nothing and
// doesn't handle requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
