// sw version: v6
const SW_VERSION = "v6";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GET_VERSION") {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(SW_VERSION);
    }
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = JSON.parse(event.data ? event.data.text() : "{}");
  } catch (e) {
    data = {};
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "THE WAY", {
      body: data.body || "",
      icon: "/icon-192.png",
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
