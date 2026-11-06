import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.PAGES_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "民法大闖關",
    short_name: "民法大闖關",
    description: "民法概要總則篇期中考複習遊戲",
    id: `${base}/`,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#1e1b4b",
    theme_color: "#1e1b4b",
    lang: "zh-Hant",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
