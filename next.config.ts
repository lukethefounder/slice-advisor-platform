import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://s3.tradingview.com",
    "https://*.tradingview.com",
    "https://www.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  [
    "style-src",
    "'self'",
    "'unsafe-inline'",
    "https://*.tradingview.com",
    "https://www.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https:",
    "https://*.tradingview.com",
    "https://www.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  [
    "font-src",
    "'self'",
    "data:",
    "https:",
    "https://*.tradingview.com",
    "https://www.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  [
    "connect-src",
    "'self'",
    "https:",
    "wss:",
    "https://*.tradingview.com",
    "wss://*.tradingview.com",
    "https://www.tradingview.com",
    "https://s3.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  [
    "frame-src",
    "'self'",
    "https://www.tradingview.com",
    "https://*.tradingview.com",
    "https://s.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ].join(" "),
  "worker-src 'self' blob:",
  "media-src 'self' data: blob: https:",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;