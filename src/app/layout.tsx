import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE WAY",
  description: "מעקב תזונה וכושר",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "THE WAY",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}

function PwaRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
              const WANT = 'v4';
              try {
                const regs = await navigator.serviceWorker.getRegistrations();
                // If any registered SW is not our current version, nuke them all
                let needsReset = regs.length === 0;
                for (const r of regs) {
                  const sw = r.active || r.waiting || r.installing;
                  if (!sw || (sw.scriptURL && !sw.scriptURL.includes('sw.js'))) needsReset = true;
                }
                // Ask the active SW for its version; if mismatch, reset
                const current = navigator.serviceWorker.controller;
                if (current) {
                  const mc = new MessageChannel();
                  const verPromise = new Promise((res) => {
                    mc.port1.onmessage = (e) => res(e.data);
                    setTimeout(() => res(null), 800);
                  });
                  current.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
                  const ver = await verPromise;
                  if (ver !== WANT) needsReset = true;
                }
                if (needsReset) {
                  for (const r of regs) { await r.unregister(); }
                }
                await navigator.serviceWorker.register('/sw.js');
              } catch (e) {}
            });
          }
        `,
      }}
    />
  );
}
