import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaSetup from "./PwaSetup";

const base = process.env.PAGES_BASE_PATH || "";

export const metadata: Metadata = {
  title: "沿途｜過程本身，就是風景",
  description: "在不同風景和人文（科目）裡走一圈，找到自己的答案。把練習題變成一趟旅程：車票、護照、路線圖與明信片。",
  applicationName: "沿途",
  appleWebApp: { capable: true, title: "沿途", statusBarStyle: "default" },
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
  themeColor: "#fff7ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* 明信片用的手寫風字體；載不到時會退回系統的楷體 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&display=swap" />
      </head>
      <body>
        {children}
        <PwaSetup base={base} />
      </body>
    </html>
  );
}
