export type SecurityHeaderOptions = {
  development?: boolean;
  https?: boolean;
  reportOnly?: boolean;
  reportPath?: string;
};

const TRADING_VIEW_SCRIPT_ORIGINS = [
  "https://s3.tradingview.com",
  "https://*.tradingview.com",
  "https://www.tradingview-widget.com",
  "https://*.tradingview-widget.com",
] as const;

const TRADING_VIEW_FRAME_ORIGINS = [
  "https://www.tradingview.com",
  "https://*.tradingview.com",
  "https://s.tradingview.com",
  "https://www.tradingview-widget.com",
  "https://*.tradingview-widget.com",
] as const;

const BLOB_ORIGINS = [
  "https://*.blob.vercel-storage.com",
  "https://*.public.blob.vercel-storage.com",
  "https://*.private.blob.vercel-storage.com",
] as const;

function booleanEnvironment(name: string, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function cleanReportPath(value: string | undefined) {
  const candidate = String(value ?? "/api/security/csp-report").trim();

  if (!candidate.startsWith("/") || candidate.includes("\\") || candidate.includes("..")) {
    return "/api/security/csp-report";
  }

  return candidate.slice(0, 200);
}

export function buildContentSecurityPolicy(
  options: SecurityHeaderOptions = {},
) {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  const reportPath = cleanReportPath(
    options.reportPath ?? process.env.SECURITY_CSP_REPORT_PATH,
  );
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(development ? ["'unsafe-eval'"] : []),
    ...TRADING_VIEW_SCRIPT_ORIGINS,
  ];
  const styleSources = [
    "'self'",
    "'unsafe-inline'",
    "https://*.tradingview.com",
    "https://www.tradingview.com",
    "https://www.tradingview-widget.com",
    "https://*.tradingview-widget.com",
  ];
  const connectSources = [
    "'self'",
    ...BLOB_ORIGINS,
    "https://*.tradingview.com",
    "wss://*.tradingview.com",
  ];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${styleSources.join(" ")}`,
    `img-src 'self' data: blob: https: ${BLOB_ORIGINS.join(" ")}`,
    "font-src 'self' data: https:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src 'self' ${TRADING_VIEW_FRAME_ORIGINS.join(" ")}`,
    "worker-src 'self' blob:",
    "media-src 'self' data: blob: https:",
    "manifest-src 'self'",
    `report-uri ${reportPath}`,
    "report-to slice-csp",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

export function securityHeadersForRequest(
  options: SecurityHeaderOptions = {},
) {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  const https = options.https ?? !development;
  const reportOnly =
    options.reportOnly ?? booleanEnvironment("SECURITY_CSP_REPORT_ONLY", false);
  const reportPath = cleanReportPath(
    options.reportPath ?? process.env.SECURITY_CSP_REPORT_PATH,
  );
  const headers: Record<string, string> = {
    [reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy"]: buildContentSecurityPolicy({
      development,
      reportPath,
    }),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
    "Permissions-Policy": [
      "camera=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "serial=()",
      "browsing-topics=()",
      "clipboard-read=()",
      "clipboard-write=(self)",
      "microphone=(self)",
    ].join(", "),
    "Reporting-Endpoints": `slice-csp=\"${reportPath}\"`,
  };

  if (https && !development) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

export function staticSecurityHeaders(production: boolean) {
  const headers = Object.entries(
    securityHeadersForRequest({
      development: !production,
      https: production,
      reportOnly: false,
    }),
  )
    .filter(([key]) => !key.toLowerCase().includes("content-security-policy"))
    .map(([key, value]) => ({ key, value }));

  return headers;
}