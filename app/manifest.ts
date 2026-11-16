import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.PAGES_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "沿途｜過程本身，就是風景",
    short_name: "沿途",
    description: "在不同風景和人文（科目）裡走一圈，找到自己的答案。把考古題變成一趟旅程：車票、護照、路線圖與明信片。",
    id: `${base}/`,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7ec",
    theme_color: "#fff7ec",
    lang: "zh-Hant",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
