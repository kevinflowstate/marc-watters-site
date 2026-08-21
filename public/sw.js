const CACHE_NAME = "cbb-portal-v7";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      const windowClients = await self.clients.matchAll({ type: "window" });
      const portalClients = windowClients.filter((client) => {
        const pathname = new URL(client.url).pathname;
        return pathname.startsWith("/portal") || pathname === "/login";
      });
      await Promise.all(portalClients.map((client) => client.navigate(client.url)));
    })()
  );
});

function parsePushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

function safeNotificationUrl(value) {
  try {
    const target = new URL(value || "/portal", self.location.origin);
    return target.origin === self.location.origin ? target.href : `${self.location.origin}/portal`;
  } catch {
    return `${self.location.origin}/portal`;
  }
}

// Push notification handler
self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const title = data.title || "Blueprint Portal";
  const options = {
    body: data.body || "",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: data.tag || "default",
    data: { url: safeNotificationUrl(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
