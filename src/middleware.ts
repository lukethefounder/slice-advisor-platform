import { NextRequest, NextResponse } from "next/server";

import { securityHeadersForRequest } from "@/lib/security-headers";

const ADVISOR_SESSION_COOKIE = "slice_session";
const CLIENT_SESSION_COOKIE = "slice_client_portal_session";

const PUBLIC_PAGE_PREFIXES = [
  "/blog",
  "/daily-intelligence",
  "/platform",
  "/markets",
  "/knowledge-graph",
  "/capabilities",
  "/portal",
  "/founder-login",
  "/founder-bootstrap",
  "/advisor-signup",
  "/team-invite",
  "/client-login",
  "/client-signup",
  "/bot-onboarding",
] as const;

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
] as const;

const CACHEABLE_PUBLIC_GET_APIS = new Set([
  "/api/market/summary",
  "/api/intelligence/daily",
]);

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
  "%252e%252e",
] as const;

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml|woff|woff2)$/i.test(
      pathname,
    )
  );
}

function decodedPath(pathname: string) {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return pathname.toLowerCase();
  }
}

function isBlockedPath(pathname: string) {
  const lower = decodedPath(pathname);
  return BLOCKED_PATH_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isPublicPage(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_PAGE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function isClientPortalPage(pathname: string) {
  return pathname === "/client-portal" || pathname.startsWith("/client-portal/");
}

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isServiceCallback(pathname: string) {
  return (
    pathname === "/api/security/csp-report" ||
    pathname === "/api/documents/upload" ||
    pathname.startsWith("/api/cron/")
  );
}

function isCrossSiteUnsafeRequest(request: NextRequest) {
  if (!isUnsafeMethod(request.method)) return false;
  if (isServiceCallback(request.nextUrl.pathname)) return false;

  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site === "cross-site") return true;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expectedOrigin = request.nextUrl.origin;

  try {
    if (origin && new URL(origin).origin !== expectedOrigin) return true;
    if (!origin && referer && new URL(referer).origin !== expectedOrigin) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

function hasAdvisorSession(request: NextRequest) {
  return Boolean(request.cookies.get(ADVISOR_SESSION_COOKIE)?.value);
}

function hasClientSession(request: NextRequest) {
  return Boolean(request.cookies.get(CLIENT_SESSION_COOKIE)?.value);
}

function isPublicApi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/api/security/csp-report") return method === "POST";
  if (pathname === "/api/documents/upload") return method === "POST";
  if (pathname === "/api/operations/web-vitals") return method === "POST";

  if (pathname === "/api/auth/me") return method === "GET";
  if (pathname === "/api/auth/login") return method === "POST";
  if (pathname === "/api/auth/register") return method === "POST";
  if (pathname === "/api/founder-bootstrap") return method === "POST";

  if (pathname === "/api/client-portal/access") {
    return method === "GET" || method === "POST";
  }

  if (
    method === "GET" &&
    (pathname === "/api/health" ||
      pathname.startsWith("/api/health/") ||
      pathname === "/api/system/health" ||
      pathname === "/api/market/realtime" ||
      pathname === "/api/market/summary" ||
      pathname === "/api/intelligence/daily" ||
      pathname === "/api/intelligence/alpha-vantage" ||
      pathname === "/api/intelligence/forecast")
  ) {
    return true;
  }

  return false;
}

function isCacheablePublicApi(request: NextRequest) {
  return (
    request.method.toUpperCase() === "GET" &&
    CACHEABLE_PUBLIC_GET_APIS.has(request.nextUrl.pathname)
  );
}

function requestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

function securityHeaders(request: NextRequest) {
  return securityHeadersForRequest({
    development: process.env.NODE_ENV !== "production",
    https: request.nextUrl.protocol === "https:",
  });
}

function decorate(
  response: NextResponse,
  request: NextRequest,
  id: string,
  options: { sensitive?: boolean } = {},
) {
  for (const [key, value] of Object.entries(securityHeaders(request))) {
    response.headers.set(key, value);
  }

  response.headers.set("X-Request-Id", id);
  response.headers.set("X-Slice-Security-Layer", "middleware-v4");

  if (options.sensitive) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.append("Vary", "Cookie");
  }

  return response;
}

function jsonError(
  request: NextRequest,
  id: string,
  status: number,
  code: string,
  message: string,
) {
  return decorate(
    NextResponse.json(
      {
        ok: false,
        error: { code, message, requestId: id },
      },
      { status },
    ),
    request,
    id,
    { sensitive: true },
  );
}

function redirectToLogin(
  request: NextRequest,
  id: string,
  pathname: "/founder-login" | "/client-login",
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  url.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 1_500),
  );

  return decorate(NextResponse.redirect(url), request, id, { sensitive: true });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const id = requestId(request);

  if (isStaticAsset(pathname)) return NextResponse.next();

  if (isBlockedPath(pathname)) {
    return jsonError(
      request,
      id,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }

  if (isCrossSiteUnsafeRequest(request)) {
    return jsonError(
      request,
      id,
      403,
      "CROSS_SITE_REQUEST_BLOCKED",
      "Security policy blocked this request.",
    );
  }

  const advisorSession = hasAdvisorSession(request);
  const clientSession = hasClientSession(request);

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(request)) {
      return decorate(NextResponse.next(), request, id, {
        sensitive: !isCacheablePublicApi(request),
      });
    }

    if (pathname.startsWith("/api/client-portal/")) {
      return clientSession
        ? decorate(NextResponse.next(), request, id, { sensitive: true })
        : jsonError(
            request,
            id,
            401,
            "CLIENT_SESSION_REQUIRED",
            "Client login is required.",
          );
    }

    if (pathname === "/api/documents" || pathname.startsWith("/api/documents/")) {
      return advisorSession || clientSession
        ? decorate(NextResponse.next(), request, id, { sensitive: true })
        : jsonError(
            request,
            id,
            401,
            "SESSION_REQUIRED",
            "Authentication is required.",
          );
    }

    return advisorSession
      ? decorate(NextResponse.next(), request, id, { sensitive: true })
      : jsonError(
          request,
          id,
          401,
          "UNAUTHORIZED",
          "Authentication is required.",
        );
  }

  if (isClientPortalPage(pathname) && !clientSession) {
    return redirectToLogin(request, id, "/client-login");
  }

  if (
    SENSITIVE_APP_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) &&
    !advisorSession &&
    !isPublicPage(pathname)
  ) {
    return redirectToLogin(request, id, "/founder-login");
  }

  return decorate(NextResponse.next(), request, id, {
    sensitive:
      isClientPortalPage(pathname) ||
      SENSITIVE_APP_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ),
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};