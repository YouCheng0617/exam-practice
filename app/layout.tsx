import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaSetup from "./PwaSetup";

const base = process.env.PAGES_BASE_PATH || "";

export const metadata: Metadata = {
  title: "民法大闖關",
  description: "民法概要總則篇期中考複習遊戲",
  applicationName: "民法大闖關",
  appleWebApp: { capable: true, title: "民法大闖關", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: `${base}/favicon-32.png`, sizes: "32x32" }, { url: `${base}/icon-192.png`, sizes: "192x192" }],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" }, // 舊版 iOS 全螢幕開啟要這行
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e1b4b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <PwaSetup base={base} />
      </body>
    </html>
  );
}
