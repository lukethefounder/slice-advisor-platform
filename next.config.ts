import type { NextConfig } from "next";

import { staticSecurityHeaders } from "./src/lib/security-headers";

const production = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  typescript: {
    tsconfigPath: production ? "tsconfig.build.json" : "tsconfig.json",
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 300,
    dangerouslyAllowSVG: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.tradingview.com",
      },
      {
        protocol: "https",
        hostname: "www.tradingview.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: staticSecurityHeaders(production),
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;