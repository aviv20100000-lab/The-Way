"use client";

import { useEffect } from "react";

const SW_VERSION = "v5";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();

        // Ask the current SW its version; if it doesn't match, wipe and reinstall
        let needsReset = false;
        const controller = navigator.serviceWorker.controller;
        if (controller) {
          const mc = new MessageChannel();
          const ver = await new Promise<string | null>((res) => {
            mc.port1.onmessage = (e) => res(e.data);
            setTimeout(() => res(null), 800);
            controller.postMessage({ type: "GET_VERSION" }, [mc.port2]);
          });
          if (ver !== SW_VERSION) needsReset = true;
        } else if (regs.length > 0) {
          needsReset = true;
        }

        if (needsReset) {
          for (const r of regs) await r.unregister();
        }

        await navigator.serviceWorker.register("/sw.js");
        const ready = await navigator.serviceWorker.ready;

        // If the user already granted permission, make sure a fresh subscription
        // exists (re-subscribing after a reset) so they never lose notifications.
        if ("Notification" in window && Notification.permission === "granted") {
          const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (vapid) {
            let sub = await ready.pushManager.getSubscription();
            if (!sub) {
              sub = await ready.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapid),
              });
            }
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sub),
            });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return null;
}
