import type { NextConfig } from "next";

// 部署在 Vercel：需要後端（app/api/analyze）保管 AI 金鑰，所以不再輸出成純靜態網站。
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
