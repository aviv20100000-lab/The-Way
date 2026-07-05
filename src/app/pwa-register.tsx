"use client";

import { useEffect } from "react";
import { getCsrfToken } from "@/lib/csrf-client";

const SW_VERSION = "v6";

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
};

type VisibilityPoint = {
  t: number;
  state: string;
  event: string;
  persisted?: boolean;
};

const visibilityTimeline: VisibilityPoint[] = [];
let stuckReportSent = false;
let finalReportObserved = false;
let stuckProbeTimer: ReturnType<typeof setTimeout> | undefined;

function recordVisibility(event: string, persisted?: boolean) {
  try {
    visibilityTimeline.push({
      t: Math.round(performance.now()),
      state: document.visibilityState,
      event,
      ...(persisted === undefined ? {} : { persisted }),
    });
    if (visibilityTimeline.length > 20) visibilityTimeline.shift();
  } catch {
    // Visibility telemetry is best-effort.
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  recordVisibility("module-init");
  document.addEventListener("visibilitychange", () => recordVisibility("visibilitychange"));
  window.addEventListener("pagehide", (event) => recordVisibility("pagehide", event.persisted));
  window.addEventListener("pageshow", (event) => recordVisibility("pageshow", event.persisted));
}

function reportNavigation(phase: "stuck" | "final") {
  if (phase === "stuck") {
    if (stuckReportSent || document.readyState === "complete") return;
    stuckReportSent = true;
  } else {
    if (finalReportObserved) return;
    finalReportObserved = true;
    if (stuckProbeTimer !== undefined) clearTimeout(stuckProbeTimer);
  }

  try {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const duration = Math.round(navigation?.duration || performance.now());
    if (phase === "final" && (!navigation || duration <= 8000)) return;

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    const paints = performance.getEntriesByType("paint");
    const firstPaint = paints.find((entry) => entry.name === "first-paint")?.startTime;
    const firstContentfulPaint = paints.find(
      (entry) => entry.name === "first-contentful-paint"
    )?.startTime;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const slowResources = [...resources]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      .map((resource) => ({
        url: resource.name.replace(window.location.origin, "").slice(0, 120),
        initiatorType: resource.initiatorType,
        duration: Math.round(resource.duration),
        start: Math.round(resource.startTime),
        bytes: resource.transferSize,
      }));

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
            phase,
            path: window.location.pathname,
            userAgent: navigator.userAgent,
            duration,
            readyState: document.readyState,
            visibilityState: document.visibilityState,
            visibilityTimeline: visibilityTimeline.slice(-20),
            dns: navigation
              ? Math.round(navigation.domainLookupEnd - navigation.domainLookupStart)
              : undefined,
            connect: navigation
              ? Math.round(navigation.connectEnd - navigation.connectStart)
              : undefined,
            ttfb: navigation ? Math.round(navigation.responseStart) : undefined,
            domInteractive: navigation ? Math.round(navigation.domInteractive) : undefined,
            domContentLoaded: navigation
              ? Math.round(navigation.domContentLoadedEventEnd)
              : undefined,
            domComplete: navigation ? Math.round(navigation.domComplete) : undefined,
            loadEventStart: navigation ? Math.round(navigation.loadEventStart) : undefined,
            loadEventEnd: navigation ? Math.round(navigation.loadEventEnd) : undefined,
            transferSize: navigation?.transferSize,
            firstPaint: firstPaint === undefined ? undefined : Math.round(firstPaint),
            firstContentfulPaint:
              firstContentfulPaint === undefined ? undefined : Math.round(firstContentfulPaint),
            effectiveType: connection?.effectiveType,
            downlink: connection?.downlink,
            resourceCount: resources.length,
            slowResources,
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
}

function reportFinalNavigation() {
  window.setTimeout(() => reportNavigation("final"), 0);
}

if (typeof window !== "undefined") {
  stuckProbeTimer = setTimeout(() => reportNavigation("stuck"), 10_000);
}

// The manifest is injected after window load instead of living in the initial
// <head>: iOS Safari fetches it on a separate connection that stalls ~21s on
// cellular and holds the load event hostage. Injected this late it can't block
// anything, and it's still in place by the time the user taps "add to home screen".
function injectManifest() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.json";
    link.crossOrigin = "use-credentials";
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const icon = document.createElement("link");
    icon.rel = "apple-touch-icon";
    icon.href = "/icon-192.png";
    document.head.appendChild(icon);
  }
  const appleMeta = [
    ["apple-mobile-web-app-capable", "yes"],
    ["apple-mobile-web-app-status-bar-style", "default"],
    ["apple-mobile-web-app-title", "THE WAY"],
  ];
  for (const [name, content] of appleMeta) {
    if (document.querySelector(`meta[name="${name}"]`)) continue;
    const meta = document.createElement("meta");
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  }
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
    const presentationWasForced =
      (window as Window & { __theWayPresentationForced?: boolean }).__theWayPresentationForced === true;
    let manifestInjected = false;
    const injectManifestOnce = () => {
      if (manifestInjected) return;
      manifestInjected = true;
      window.removeEventListener("load", injectManifestOnce);
      injectManifest();
    };

    if (document.readyState === "complete" || presentationWasForced) {
      injectManifestOnce();
      reportFinalNavigation();
    } else {
      window.addEventListener("load", injectManifestOnce, { once: true });
      window.addEventListener("load", reportFinalNavigation, { once: true });
    }

    const cleanup = () => {
      window.removeEventListener("load", injectManifestOnce);
      window.removeEventListener("load", reportFinalNavigation);
    };

    if (!("serviceWorker" in navigator)) return cleanup;

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
    return cleanup;
  }, []);

  return null;
}
