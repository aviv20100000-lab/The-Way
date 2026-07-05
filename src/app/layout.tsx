import type { Metadata, Viewport } from "next";
import { Rubik, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { RootLayoutContent } from "./layout-content";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const earlyLoginProbe = `
(() => {
  const isIphoneSafari = /iP(?:hone|ad|od)/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent) &&
    !/(?:CriOS|FxiOS|EdgiOS)/.test(navigator.userAgent);

  if (location.pathname === "/login" && isIphoneSafari) {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        const completed = new Set(
          performance.getEntriesByType("resource").map((entry) => entry.name)
        );
        const requiredScripts = Array.from(document.scripts).filter(
          (script) => script.src && !script.noModule
        );
        if (requiredScripts.length > 0 && requiredScripts.every((script) => completed.has(script.src))) {
          window.__theWayPresentationForced = true;
          window.stop();
        }
      } catch {}
    }, { once: true });
  }

  const moduleCapable = "noModule" in document.createElement("script");
  if (moduleCapable) {
    const removeLegacyPolyfill = (node) => {
      if (
        node instanceof HTMLScriptElement &&
        node.noModule &&
        node.src.includes("/_next/static/chunks/polyfills-")
      ) {
        node.remove();
      }
    };
    document.querySelectorAll("script[nomodule]").forEach(removeLegacyPolyfill);
    const polyfillObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(removeLegacyPolyfill);
      }
    });
    polyfillObserver.observe(document.documentElement, { childList: true, subtree: true });
    addEventListener("load", () => polyfillObserver.disconnect(), { once: true });
  }

  setTimeout(async () => {
    try {
      if (
        location.pathname !== "/login" ||
        document.readyState === "complete" ||
        window.__theWayPresentationForced
      ) return;
      const resources = performance.getEntriesByType("resource");
      const resourceByUrl = new Map(resources.map((entry) => [entry.name, entry]));
      const scriptStates = Array.from(document.scripts)
        .filter((script) => script.src)
        .slice(0, 20)
        .map((script) => {
          const resource = resourceByUrl.get(script.src);
          return {
            url: script.src.replace(location.origin, "").slice(0, 140),
            completed: Boolean(resource),
            duration: resource ? Math.round(resource.duration) : null,
          };
        });
      const slowResources = [...resources]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map((resource) => ({
          url: resource.name.replace(location.origin, "").slice(0, 120),
          initiatorType: resource.initiatorType,
          duration: Math.round(resource.duration),
          start: Math.round(resource.startTime),
          bytes: resource.transferSize || 0,
        }));
      const paints = performance.getEntriesByType("paint");
      const navigation = performance.getEntriesByType("navigation")[0];
      const csrfResponse = await fetch("/api/auth/csrf-token", { cache: "no-store" });
      const csrf = await csrfResponse.json();
      const token = csrf.token || csrf.csrfToken;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["x-csrf-token"] = token;
      await fetch("/api/client-errors", {
        method: "POST",
        headers,
        keepalive: true,
        body: JSON.stringify({
          type: "perf",
          phase: "stuck",
          path: location.pathname,
          userAgent: navigator.userAgent,
          duration: Math.round(performance.now()),
          readyState: document.readyState,
          visibilityState: document.visibilityState,
          visibilityTimeline: [{ t: 0, state: document.visibilityState, event: "inline-probe" }],
          domInteractive: navigation ? Math.round(navigation.domInteractive) : undefined,
          domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : undefined,
          firstPaint: paints.find((entry) => entry.name === "first-paint")?.startTime,
          firstContentfulPaint: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime,
          resourceCount: resources.length,
          scriptStates,
          slowResources,
        }),
      });
    } catch {}
  }, 10000);
})();`;

export const metadata: Metadata = {
  title: "THE WAY",
  description: "מעקב תזונה וכושר בגובה העיניים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0f0f",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${beVietnamPro.variable}`} suppressHydrationWarning>
      <head>
        {/* Keep manifest and touch-icon links out of the initial head. iOS Safari
            can fetch them internally without Resource Timing entries and hold
            window load for ~21s on cellular. PwaRegister injects both later. */}
        <script dangerouslySetInnerHTML={{ __html: earlyLoginProbe }} />
      </head>
      <body className="min-h-screen antialiased dark">
        <RootLayoutContent>{children}</RootLayoutContent>
      </body>
    </html>
  );
}
