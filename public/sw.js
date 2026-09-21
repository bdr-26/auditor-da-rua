/* Service worker do Auditor da Rua: push notifications + deep link. Sem cache offline (v1). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { titulo: "Auditor da Rua", corpo: "", url: "/", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.corpo = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.corpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
