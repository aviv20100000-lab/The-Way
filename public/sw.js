// sw version: v5
const SW_VERSION = "v5";

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
  let raw = "";
  let data = {};
  let parsedOk = false;
  try {
    raw = event.data ? event.data.text() : "{}";
    data = JSON.parse(raw);
    parsedOk = true;
  } catch (e) {
    data = {};
  }

  // DEBUG mode: if the payload says debug, show raw bytes so we can diagnose
  let title;
  let body;
  if (data && data.debug) {
    title = "DEBUG " + SW_VERSION + (parsedOk ? " parsed" : " FAILED");
    body = "RAW: " + raw.slice(0, 120);
  } else {
    title = (data.title || "THE WAY") + " [" + SW_VERSION + "]";
    body = data.body || "";
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
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
