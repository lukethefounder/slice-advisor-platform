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
      /*
       * These are intentionally public, read-only feeds. They are listed after
       * the general API rule because Next.js applies the final matching value
       * when multiple header rules set the same key.
       */
      {
        source: "/api/market/summary",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=15, stale-while-revalidate=120, max-age=5",
          },
        ],
      },
      {
        source: "/api/intelligence/daily",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=900, stale-while-revalidate=86400, max-age=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;