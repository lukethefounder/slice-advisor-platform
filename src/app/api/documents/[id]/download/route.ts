import { get } from "@vercel/blob";

import { ApiError, withApiRoute } from "@/lib/api-route";
import {
  loadDocumentForSignedAccess,
  recordDocumentAccess,
} from "@/lib/document-center/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeAsciiFileName(value: string) {
  return value
    .replace(/[\r\n"]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180) || "document";
}

export const GET = withApiRoute(
  {
    route: "/api/documents/[id]/download",
    timeoutMs: 30_000,
  },
  async ({ request, signal }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      throw new ApiError({
        status: 400,
        code: "DOCUMENT_ACCESS_TOKEN_REQUIRED",
        message: "A secure document access token is required.",
        expose: true,
      });
    }

    const access = await loadDocumentForSignedAccess({ token });
    const encodedPathId = url.pathname.match(
      /\/api\/documents\/([^/]+)\/download\/?$/i,
    )?.[1];
    let pathDocumentId = "";

    try {
      pathDocumentId = encodedPathId ? decodeURIComponent(encodedPathId) : "";
    } catch {
      pathDocumentId = "";
    }

    if (!pathDocumentId || pathDocumentId !== access.document.id) {
      throw new ApiError({
        status: 403,
        code: "DOCUMENT_ACCESS_PATH_MISMATCH",
        message: "The document access path is invalid.",
        expose: true,
      });
    }

    const result = await get(access.storagePath, {
      access: "private",
      abortSignal: signal,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new ApiError({
        status: 404,
        code: "DOCUMENT_STORAGE_OBJECT_NOT_FOUND",
        message: "The stored document could not be found.",
        expose: true,
      });
    }

    await recordDocumentAccess({
      actor: access.actor,
      documentId: access.document.id,
      clientId: access.document.clientId,
      disposition: access.disposition,
    });

    const headers = new Headers();
    const ascii = safeAsciiFileName(access.fileName);
    const encoded = encodeURIComponent(access.fileName);
    const disposition = access.disposition === "inline" ? "inline" : "attachment";

    headers.set(
      "Content-Type",
      result.blob.contentType || access.document.contentType || "application/octet-stream",
    );
    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    );
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    if (disposition === "inline") {
      headers.set("Content-Security-Policy", "sandbox");
    }

    if (typeof result.blob.size === "number") {
      headers.set("Content-Length", String(result.blob.size));
    }

    if (result.blob.etag) headers.set("ETag", result.blob.etag);

    return new Response(result.stream, {
      status: 200,
      headers,
    });
  },
);