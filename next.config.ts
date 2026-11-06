import type { NextConfig } from "next";

// GitHub Pages 會放在 /<repo 名稱>/ 底下，部署時由 workflow 傳入 PAGES_BASE_PATH
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
