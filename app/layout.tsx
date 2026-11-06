import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "民法大闖關",
  description: "民法概要、習慣、法人、繼承、損害賠償複習小遊戲",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
