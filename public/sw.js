self.addEventListener("push", (event) => {
  let data = {};
  try {
    const text = event.data?.text() ?? "{}";
    data = JSON.parse(text);
  } catch (e) {
    data = { title: "THE WAY", body: event.data?.text() ?? "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "THE WAY", {
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
