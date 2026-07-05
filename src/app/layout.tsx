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

export const metadata: Metadata = {
  title: "THE WAY",
  description: "מעקב תזונה וכושר בגובה העיניים",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "THE WAY",
  },
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
        {/* NOTE: no <link rel="manifest"> here on purpose. iOS Safari fetches the
            manifest on a separate connection that stalls ~21s on cellular and
            blocks the window load event (confirmed twice by perf telemetry,
            2026-07-05 — even with crossOrigin="use-credentials"). PwaRegister
            injects the link after window load instead. */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen antialiased dark">
        <RootLayoutContent>{children}</RootLayoutContent>
      </body>
    </html>
  );
}
