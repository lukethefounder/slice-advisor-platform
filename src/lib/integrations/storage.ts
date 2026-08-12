import "server-only";

import { createHash } from "node:crypto";

import { getOptionalEnv } from "@/lib/env";
import {
  executeIntegration,
  getIntegrationCircuitSnapshot,
  publicIntegrationFailure,
} from "@/lib/integrations/core";

export type BlobUploadResult = {
  ok: boolean;
  provider: string;
  status: "uploaded" | "failed" | "missing" | "unknown";
  url?: string;
  pathname?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  requestId?: string;
  latencyMs?: number;
};

type BlobBody = string | Buffer | Blob | ArrayBuffer;

type BlobIdempotencyRecord = {
  expiresAt: number;
  result: BlobUploadResult;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceBlobIdempotency: Map<string, BlobIdempotencyRecord> | undefined;
}

const blobIdempotency =
  globalThis.__sliceBlobIdempotency ?? new Map<string, BlobIdempotencyRecord>();

globalThis.__sliceBlobIdempotency = blobIdempotency;

function normalizeIdempotencyKey(value: string | undefined) {
  const clean = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 500);

  return clean
    ? createHash("sha256").update(clean).digest("hex").slice(0, 48)
    : "";
}

function getIdempotentResult(key: string) {
  if (!key) return null;

  const record = blobIdempotency.get(key);

  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    blobIdempotency.delete(key);
    return null;
  }

  return record.result;
}

function storeIdempotentResult(key: string, result: BlobUploadResult) {
  if (!key || !result.ok) return;

  blobIdempotency.set(key, {
    expiresAt: Date.now() + 10 * 60_000,
    result,
  });

  if (blobIdempotency.size > 500) {
    for (const [candidate, record] of blobIdempotency) {
      if (record.expiresAt <= Date.now()) blobIdempotency.delete(candidate);
    }

    while (blobIdempotency.size > 500) {
      const oldest = blobIdempotency.keys().next().value as string | undefined;
      if (!oldest) break;
      blobIdempotency.delete(oldest);
    }
  }
}

function normalizePathname(value: string) {
  const pathname = String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .trim()
    .slice(0, 1_024);

  if (
    !pathname ||
    pathname.includes("\u0000") ||
    pathname.split("/").some((segment) => segment === ".." || segment === ".")
  ) {
    return "";
  }

  return pathname;
}

function bodySize(body: BlobBody) {
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (Buffer.isBuffer(body)) return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  return null;
}

function maximumUploadBytes() {
  const configured = Number(process.env.BLOB_MAX_UPLOAD_BYTES);

  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 500 * 1024 * 1024)
    : 50 * 1024 * 1024;
}

export async function uploadBackendBlob(input: {
  pathname: string;
  body: BlobBody;
  contentType?: string;
  access?: "public" | "private";
  addRandomSuffix?: boolean;
  idempotencyKey?: string;
}): Promise<BlobUploadResult> {
  const token = getOptionalEnv("BLOB_READ_WRITE_TOKEN");
  const pathname = normalizePathname(input.pathname);
  const size = bodySize(input.body);
  const maxBytes = maximumUploadBytes();
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const cachedResult = getIdempotentResult(idempotencyKey);

  if (cachedResult) return cachedResult;

  if (!pathname) {
    return {
      ok: false,
      provider: "Vercel Blob",
      status: "failed",
      error: "A safe object-storage pathname is required.",
      errorCode: "INVALID_BLOB_PATH",
      retryable: false,
    };
  }

  if (size !== null && size > maxBytes) {
    return {
      ok: false,
      provider: "Vercel Blob",
      status: "failed",
      pathname,
      error: `The upload exceeds the configured ${maxBytes}-byte limit.`,
      errorCode: "BLOB_TOO_LARGE",
      retryable: false,
    };
  }

  if (!token) {
    return {
      ok: false,
      provider: "Vercel Blob",
      status: "missing",
      pathname,
      error: "Vercel Blob is not configured.",
      errorCode: "INTEGRATION_NOT_CONFIGURED",
      retryable: false,
    };
  }

  try {
    const result = await executeIntegration(
      {
        provider: "Vercel Blob",
        operation: "upload object",
        circuitKey: "vercel-blob:upload",
        timeoutMs: 60_000,
        // The SDK call is a side effect. Do not retry automatically because a
        // timed-out call may still complete after the caller loses confirmation.
        idempotent: false,
        idempotencyKey: idempotencyKey || undefined,
        maxAttempts: 1,
      },
      async () => {
        const { put } = await import("@vercel/blob");

        return put(pathname, input.body, {
          access:
            input.access ||
            (getOptionalEnv("BLOB_ACCESS") === "public" ? "public" : "private"),
          token,
          contentType: input.contentType,
          addRandomSuffix: input.addRandomSuffix ?? true,
        });
      },
    );

    const uploadResult: BlobUploadResult = {
      ok: true,
      provider: "Vercel Blob",
      status: "uploaded",
      url: result.data.url,
      pathname: result.data.pathname,
      requestId: result.meta.requestId,
      latencyMs: result.meta.durationMs,
    };

    storeIdempotentResult(idempotencyKey, uploadResult);
    return uploadResult;
  } catch (error) {
    const failure = publicIntegrationFailure(
      error,
      "Object storage could not confirm the upload.",
    );
    const unknownOutcome = failure.code === "INTEGRATION_TIMEOUT";

    return {
      ok: false,
      provider: "Vercel Blob",
      status: unknownOutcome ? "unknown" : "failed",
      pathname,
      error: unknownOutcome
        ? "The upload outcome could not be confirmed. Check storage before retrying."
        : failure.message,
      errorCode: failure.code,
      retryable: unknownOutcome ? false : failure.retryable,
      requestId: failure.requestId,
    };
  }
}

export function getStorageIntegrationStatus() {
  const configured = Boolean(getOptionalEnv("BLOB_READ_WRITE_TOKEN"));

  return {
    provider: "Vercel Blob",
    configured,
    ready: configured,
    defaultAccess:
      getOptionalEnv("BLOB_ACCESS") === "public" ? "public" : "private",
    maximumUploadBytes: maximumUploadBytes(),
    automaticRetries: false,
    processLocalIdempotencyWindowMinutes: 10,
    circuits: getIntegrationCircuitSnapshot("vercel-blob:"),
  };
}