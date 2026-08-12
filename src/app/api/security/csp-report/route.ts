import { apiJson, withApiRoute } from "@/lib/api-route";
import { createLogger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashForSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reportLog = createLogger("csp-report");
const MAX_BODY_BYTES = 64 * 1024;

function clean(value: unknown, maximum = 500) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function safeUri(value: unknown) {
  const raw = clean(value, 2_000);
  if (!raw) return null;

  if (["inline", "eval", "data", "blob"].includes(raw.toLowerCase())) {
    return raw.toLowerCase();
  }

  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 1_000);
  } catch {
    return raw.split("?")[0]?.slice(0, 1_000) ?? null;
  }
}

function extractReports(value: unknown) {
  const candidates = Array.isArray(value) ? value : [value];

  return candidates.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const body =
      record["csp-report"] && typeof record["csp-report"] === "object"
        ? (record["csp-report"] as Record<string, unknown>)
        : record.body && typeof record.body === "object"
          ? (record.body as Record<string, unknown>)
          : record;

    return [
      {
        effectiveDirective: clean(
          body["effective-directive"] ?? body.effectiveDirective,
          160,
        ),
        violatedDirective: clean(
          body["violated-directive"] ?? body.violatedDirective,
          160,
        ),
        blockedUrl: safeUri(body["blocked-uri"] ?? body.blockedURL),
        documentUrl: safeUri(body["document-uri"] ?? body.documentURL),
        sourceFile: safeUri(body["source-file"] ?? body.sourceFile),
        disposition: clean(body.disposition, 40),
        statusCode: Number(body["status-code"] ?? body.statusCode) || null,
        lineNumber: Number(body["line-number"] ?? body.lineNumber) || null,
        columnNumber: Number(body["column-number"] ?? body.columnNumber) || null,
      },
    ];
  });
}

export const POST = withApiRoute(
  {
    route: "/api/security/csp-report",
    timeoutMs: 6_000,
  },
  async ({ request }) => {
    const limit = await consumeRateLimit({
      key: hashForSecurity(getClientIp(request)),
      scope: "security.csp-report",
      limit: 120,
      windowMs: 60 * 60_000,
      failOpen: true,
    });

    if (!limit.allowed) return new Response(null, { status: 204 });

    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return apiJson({ error: "Report payload is too large." }, { status: 413 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw || "{}");
    } catch {
      return new Response(null, { status: 204 });
    }

    const reports = extractReports(parsed);

    for (const report of reports) {
      reportLog.warn("violation.received", {
        ipHash: hashForSecurity(getClientIp(request)),
        userAgentClass: clean(request.headers.get("user-agent"), 240),
        ...report,
      });
    }

    return new Response(null, { status: 204 });
  },
);