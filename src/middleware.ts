import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "slice_session";

const PUBLIC_PAGE_PREFIXES = [
  "/",
  "/portal",
  "/founder-login",
  "/founder-bootstrap",
  "/bot-onboarding",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/founder-bootstrap",
  "/api/cron",
];

const BLOCKED_PATH_PATTERNS = [
  ".env",
  ".git",
  ".svn",
  ".htaccess",
  "wp-admin",
  "wp-login",
  "phpmyadmin",
  "server-status",
  "config.php",
  "composer.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "/../",
  "%2e%2e",
];

const SENSITIVE_APP_PREFIXES = [
  "/workspace",
  "/triage",
  "/opportunity-radar",
  "/advisor-command-center",
  "/market-visuals",
  "/portfolio-lab",
  "/watchlist-alerts",
  "/backend-kernel",
  "/backend-readiness",
  "/briefings",
  "/security",
  "/system",
  "/notifications",
  "/watchlists",
  "/alternative-investments",
  "/intelligence-settings",
  "/command",
  "/founder-portal",
];

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    Boolean(
      pathname.match(
        /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$/i
      )
    )
  );
}

function safeDecodePath(pathname: string) {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return pathname.toLowerCase();
  }
}

function isBlockedPath(pathname: string) {
  const lower = safeDecodePath(pathname);

  return BLOCKED_PATH_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isPublicPage(pathname: string) {
  if (pathname === "/") return true;

  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSensitiveAppRoute(pathname: string) {
  return SENSITIVE_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value);
}

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isCrossSiteUnsafeRequest(request: NextRequest) {
  if (!isUnsafeMethod(request.method)) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function buildSecurityHeaders(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  const connectSrc = [
    "'self'",
    "https://api.openai.com",
    "https://api.resend.com",
    "https://*.vercel.app",
    appUrl ? new URL(appUrl).origin : "",
  ]
    .filter(Boolean)
    .join(" ");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), clipboard-read=(), clipboard-write=(self), microphone=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Content-Security-Policy-Report-Only": csp,
    ...(request.nextUrl.protocol === "https:"
      ? {
          "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        }
      : {}),
  };
}

function withSecurityHeaders(response: NextResponse, request: NextRequest) {
  const headers = buildSecurityHeaders(request);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  response.headers.set("X-Slice-Security-Layer", "middleware-v1");
  return response;
}

function unauthorizedApi(request: NextRequest) {
  const response = NextResponse.json(
    {
      error: "Unauthorized.",
    },
    { status: 401 }
  );

  response.headers.set("Cache-Control", "no-store");
  return withSecurityHeaders(response, request);
}

function blockedSecurityResponse(
  request: NextRequest,
  reason: string,
  status = 403
) {
  const response = NextResponse.json(
    {
      error: "Security policy blocked this request.",
      reason,
    },
    { status }
  );

  response.headers.set("Cache-Control", "no-store");
  return withSecurityHeaders(response, request);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isBlockedPath(pathname)) {
    return blockedSecurityResponse(request, "Blocked suspicious path.", 404);
  }

  if (isCrossSiteUnsafeRequest(request)) {
    return blockedSecurityResponse(
      request,
      "Cross-site unsafe request blocked.",
      403
    );
  }

  const sessionPresent = hasSessionCookie(request);

  if (pathname.startsWith("/api")) {
    if (!isPublicApi(pathname) && !sessionPresent) {
      return unauthorizedApi(request);
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    return withSecurityHeaders(response, request);
  }

  if (isSensitiveAppRoute(pathname) && !sessionPresent && !isPublicPage(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/portal";
    loginUrl.searchParams.set("next", pathname);

    return withSecurityHeaders(NextResponse.redirect(loginUrl), request);
  }

  const response = NextResponse.next();

  if (isSensitiveAppRoute(pathname)) {
    response.headers.set("Cache-Control", "no-store");
  }

  return withSecurityHeaders(response, request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};