import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret, safeJsonParse } from "@/lib/secret-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_SOURCE_KINDS = new Set(["RSS", "JSON_API", "HEADLINE_API"]);

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function assertHttpsUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Advisor source URLs must use HTTPS.");
  }

  return url.toString();
}

function sanitizeHeaders(value: unknown) {
  if (!value || typeof value !== "object") return {};

  const headers = value as Record<string, unknown>;
  const sanitized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(headers)) {
    const headerName = key.trim();

    if (!headerName) continue;
    if (/authorization|api[-_ ]?key|token|secret|password|cookie/i.test(headerName)) {
      continue;
    }

    if (typeof rawValue === "string" && rawValue.trim()) {
      sanitized[headerName] = rawValue.trim();
    }
  }

  return sanitized;
}

function publicSource(source: {
  id: string;
  name: string;
  platformType: string;
  sourceKind: string;
  sourceUrl: string;
  method: string;
  enabled: boolean;
  termsAcknowledged: boolean;
  accessMode: string;
  headersJson: string;
  encryptedSecretJson: string | null;
  minScoreToRetain: number;
  minScoreToAlert: number;
  maxItemsPerRun: number;
  lastRunAt: Date | null;
  lastStatus: string;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const headers = safeJsonParse<Record<string, string>>(source.headersJson, {});

  return {
    id: source.id,
    name: source.name,
    platformType: source.platformType,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    method: source.method,
    enabled: source.enabled,
    termsAcknowledged: source.termsAcknowledged,
    accessMode: source.accessMode,
    headers,
    hasSecret: Boolean(source.encryptedSecretJson),
    secretPreview: source.encryptedSecretJson ? maskSecret("connected-secret") : "",
    minScoreToRetain: source.minScoreToRetain,
    minScoreToAlert: source.minScoreToAlert,
    maxItemsPerRun: source.maxItemsPerRun,
    lastRunAt: source.lastRunAt,
    lastStatus: source.lastStatus,
    lastError: source.lastError,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const sources = await prisma.advisorRealtimeSource.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return Response.json(
      {
        sources: sources.map(publicSource),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Unable to load advisor sources.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));

    const name = cleanString(body.name);
    const platformType = cleanString(body.platformType, "Research");
    const sourceKind = cleanString(body.sourceKind, "RSS").toUpperCase();
    const sourceUrl = assertHttpsUrl(cleanString(body.sourceUrl));
    const termsAcknowledged = Boolean(body.termsAcknowledged);

    if (!name) throw new Error("Source name is required.");
    if (!ALLOWED_SOURCE_KINDS.has(sourceKind)) {
      throw new Error("Only RSS, JSON_API, and HEADLINE_API source kinds are supported.");
    }

    if (!termsAcknowledged) {
      throw new Error(
        "The advisor must confirm they have a paid, licensed, or otherwise authorized right to connect this source."
      );
    }

    const authHeaderName = cleanString(body.authHeaderName);
    const authHeaderValue = cleanString(body.authHeaderValue);

    if (/cookie|password/i.test(authHeaderName)) {
      throw new Error(
        "Do not store website passwords, browser cookies, or paywall session cookies. Use an approved API key, bearer token, or paid RSS/export endpoint."
      );
    }

    const encryptedSecretJson =
      authHeaderName && authHeaderValue
        ? encryptSecret(
            JSON.stringify({
              authHeaderName,
              authHeaderValue,
            })
          )
        : null;

    const headersJson = JSON.stringify(sanitizeHeaders(body.headers));

    const source = await prisma.advisorRealtimeSource.create({
      data: {
        userId: user.id,
        name,
        platformType,
        sourceKind,
        sourceUrl,
        method: "GET",
        enabled: Boolean(body.enabled ?? true),
        termsAcknowledged,
        accessMode: "Licensed API/RSS/Export",
        headersJson,
        encryptedSecretJson,
        minScoreToRetain: Number.isFinite(Number(body.minScoreToRetain))
          ? Math.max(1, Math.min(100, Number(body.minScoreToRetain)))
          : 55,
        minScoreToAlert: Number.isFinite(Number(body.minScoreToAlert))
          ? Math.max(1, Math.min(100, Number(body.minScoreToAlert)))
          : 88,
        maxItemsPerRun: Number.isFinite(Number(body.maxItemsPerRun))
          ? Math.max(1, Math.min(100, Number(body.maxItemsPerRun)))
          : 40,
      },
    });

    return Response.json(
      {
        source: publicSource(source),
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Unable to create advisor source.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}