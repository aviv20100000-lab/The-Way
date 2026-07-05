"use client";

import { useEffect } from "react";
import { getCsrfToken } from "@/lib/csrf-client";

const SW_VERSION = "v6";

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
};

function reportSlowNavigation() {
  window.setTimeout(() => {
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!navigation || navigation.duration <= 8000) return;

      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      void (async () => {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const csrfToken = await getCsrfToken();
          if (csrfToken) headers["x-csrf-token"] = csrfToken;
          await fetch("/api/client-errors", {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "perf",
              path: window.location.pathname,
              userAgent: navigator.userAgent,
              duration: Math.round(navigation.duration),
              dns: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
              connect: Math.round(navigation.connectEnd - navigation.connectStart),
              ttfb: Math.round(navigation.responseStart),
              domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
              loadEventEnd: Math.round(navigation.loadEventEnd),
              transferSize: navigation.transferSize,
              effectiveType: connection?.effectiveType,
              downlink: connection?.downlink,
            }),
            keepalive: true,
          });
        } catch {
          // Performance reporting must never affect the UI.
        }
      })();
    } catch {
      // Performance APIs are best-effort across browsers.
    }
  }, 0);
}

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
    if (document.readyState === "complete") {
      reportSlowNavigation();
    } else {
      window.addEventListener("load", reportSlowNavigation, { once: true });
    }

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
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            const csrfToken = await getCsrfToken();
            if (csrfToken) headers["x-csrf-token"] = csrfToken;
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers,
              body: JSON.stringify(sub),
            });
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => window.removeEventListener("load", reportSlowNavigation);
  }, []);

  return null;
}
