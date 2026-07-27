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

// Absolute URLs are required for link previews — WhatsApp, Telegram and iMessage
// will not resolve a relative og:image. Override per deployment with
// NEXT_PUBLIC_SITE_URL if the domain ever changes.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-way-app-two.vercel.app";
const title = "THE WAY";
const description = "מעקב תזונה וכושר בגובה העיניים";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  // These tags are server-rendered into the HTML and only ever fetched by link
  // crawlers, never by the browser on page load — no effect on load time.
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
    locale: "he_IL",
    images: [{ url: "/og.png", width: 1200, height: 630, type: "image/png", alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
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
        {/* Keep manifest and touch-icon links out of the initial head. iOS Safari
            can fetch them internally without Resource Timing entries and hold
            window load on cellular. PwaRegister injects both after load. */}
      </head>
      <body className="min-h-screen antialiased dark">
        <RootLayoutContent>{children}</RootLayoutContent>
      </body>
    </html>
  );
}
