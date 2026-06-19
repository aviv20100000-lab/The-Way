// sw version: v4
const SW_VERSION = "v4";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let raw = "";
  let data = {};
  try {
    raw = event.data ? event.data.text() : "{}";
    data = JSON.parse(raw);
  } catch (e) {
    data = { title: "THE WAY", body: raw };
  }

  const title = (data.title || "THE WAY") + " [" + SW_VERSION + "]";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      dir: "rtl",
      lang: "he",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
