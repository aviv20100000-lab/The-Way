// sw version: v7
const SW_VERSION = "v7";

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
      data: { url: typeof data.url === "string" ? data.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || "/";
  let targetUrl = new URL("/", self.location.origin);
  try {
    const parsedUrl = new URL(requestedUrl, self.location.origin);
    if (parsedUrl.origin === self.location.origin) targetUrl = parsedUrl;
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const matchingWindow = windows.find((client) => client.url === targetUrl.href);
      if (matchingWindow) return matchingWindow.focus();

      const existingWindow = windows[0];
      if (existingWindow) {
        const navigatedWindow = await existingWindow.navigate(targetUrl.href);
        return navigatedWindow?.focus();
      }

      return self.clients.openWindow(targetUrl.href);
    })
  );
});
