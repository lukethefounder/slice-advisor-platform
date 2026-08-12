import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { del, get, head } from "@vercel/blob";

import { ApiError } from "@/lib/api-route";
import {
  DOCUMENT_ALLOWED_CONTENT_TYPES,
  DOCUMENT_ALLOWED_EXTENSIONS,
  documentExtension,
  normaliseDocumentType,
  type DocumentActorKind,
  type DocumentAllowedContentType,
  type DocumentClassification,
  type DocumentType,
  type DocumentUploadDeclaration,
} from "@/lib/document-center/contracts";

const DOCUMENT_PATH_PREFIX = "slice-documents/";
const DEFAULT_MAXIMUM_UPLOAD_BYTES = 25 * 1024 * 1024;
const HARD_MAXIMUM_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEFAULT_PREVIEW_BYTES = 64 * 1024;
const HARD_PREVIEW_BYTES = 256 * 1024;
const DEFAULT_ACCESS_SECONDS = 5 * 60;
const MAX_ACCESS_SECONDS = 15 * 60;
const DEVELOPMENT_SIGNING_SECRET =
  "slice-development-document-access-signing-secret-change-before-production";

export type PrivateBlobReference = {
  url: string;
  pathname: string;
  contentType: string | null;
  contentDisposition: string | null;
  etag: string | null;
  size: number;
  uploadedAt: Date | null;
};

export type PrivateBlobInspection = {
  sha256: string;
  sizeBytes: number;
  contentType: string;
  fileExtension: string | null;
  signatureValid: boolean;
  securityMessage: string;
  textPreview: string | null;
  classification: DocumentClassification;
  blob: PrivateBlobReference;
};

type DocumentAccessPayload = {
  version: 1;
  documentId: string;
  actorKind: DocumentActorKind;
  actorId: string;
  disposition: "inline" | "attachment";
  expiresAt: number;
  mac: string;
};

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

export function documentMaximumUploadBytesServer() {
  return clampInteger(
    process.env.DOCUMENT_MAX_UPLOAD_BYTES ??
      process.env.NEXT_PUBLIC_DOCUMENT_MAX_UPLOAD_BYTES,
    DEFAULT_MAXIMUM_UPLOAD_BYTES,
    1 * 1024 * 1024,
    HARD_MAXIMUM_UPLOAD_BYTES,
  );
}

function documentPreviewBytes() {
  return clampInteger(
    process.env.DOCUMENT_TEXT_PREVIEW_BYTES,
    DEFAULT_PREVIEW_BYTES,
    4 * 1024,
    HARD_PREVIEW_BYTES,
  );
}

function documentAccessSeconds() {
  return clampInteger(
    process.env.DOCUMENT_ACCESS_URL_TTL_SECONDS,
    DEFAULT_ACCESS_SECONDS,
    60,
    MAX_ACCESS_SECONDS,
  );
}

export function documentStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_OIDC_TOKEN,
  );
}

export function sanitiseDocumentFileName(value: unknown) {
  const raw = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  const safe = raw
    .replace(/[^a-zA-Z0-9 ._()\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-\s]+/, "")
    .trim();

  if (!safe || safe === "." || safe === "..") {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_FILE_NAME_INVALID",
      message: "The document file name is invalid.",
      expose: true,
    });
  }

  return safe;
}

export function documentUploadPath(fileName: string) {
  const safe = sanitiseDocumentFileName(fileName);
  return `${DOCUMENT_PATH_PREFIX}${randomUUID()}-${safe}`;
}

export function documentPathIsAllowed(pathname: string) {
  const clean = pathname.trim();

  return (
    clean.startsWith(DOCUMENT_PATH_PREFIX) &&
    !clean.includes("..") &&
    !clean.includes("\\") &&
    !clean.includes("\u0000") &&
    clean.length <= 1_000
  );
}

export function isAllowedDocumentContentType(
  value: unknown,
): value is DocumentAllowedContentType {
  return DOCUMENT_ALLOWED_CONTENT_TYPES.includes(
    String(value ?? "").trim().toLowerCase() as DocumentAllowedContentType,
  );
}

export function validateDocumentUploadDeclaration(
  value: unknown,
): DocumentUploadDeclaration {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_DECLARATION_INVALID",
      message: "Document upload information is missing.",
      expose: true,
    });
  }

  const input = value as Record<string, unknown>;
  const actorHint = input.actorHint === "client" ? "client" : "advisor";
  const originalFileName = sanitiseDocumentFileName(input.originalFileName);
  const extension = documentExtension(originalFileName);
  const declaredContentType = String(input.declaredContentType ?? "")
    .trim()
    .toLowerCase();
  const declaredSizeBytes = Number(input.declaredSizeBytes);
  const rawHash = String(input.claimedSha256 ?? "")
    .trim()
    .toLowerCase();
  const clientId = String(input.clientId ?? "").trim() || null;
  const notes = String(input.notes ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5_000) || null;

  if (!extension || !DOCUMENT_ALLOWED_EXTENSIONS.includes(
      extension as (typeof DOCUMENT_ALLOWED_EXTENSIONS)[number],
    )) {
    throw new ApiError({
      status: 415,
      code: "DOCUMENT_EXTENSION_NOT_ALLOWED",
      message:
        "Use a PDF, JPG, PNG, TXT, CSV, JSON, DOCX, or XLSX document.",
      expose: true,
    });
  }

  if (!isAllowedDocumentContentType(declaredContentType)) {
    throw new ApiError({
      status: 415,
      code: "DOCUMENT_CONTENT_TYPE_NOT_ALLOWED",
      message: "This document type is not supported.",
      expose: true,
    });
  }

  const contentTypeByExtension: Record<string, readonly string[]> = {
    ".pdf": ["application/pdf"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".txt": ["text/plain"],
    ".csv": ["text/csv", "text/plain"],
    ".json": ["application/json", "text/plain"],
    ".docx": [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ".xlsx": [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  };

  if (
    extension &&
    !contentTypeByExtension[extension]?.includes(declaredContentType)
  ) {
    throw new ApiError({
      status: 415,
      code: "DOCUMENT_EXTENSION_CONTENT_TYPE_MISMATCH",
      message: "The file extension does not match its declared document type.",
      expose: true,
    });
  }

  if (
    !Number.isInteger(declaredSizeBytes) ||
    declaredSizeBytes <= 0 ||
    declaredSizeBytes > documentMaximumUploadBytesServer()
  ) {
    throw new ApiError({
      status: 413,
      code: "DOCUMENT_SIZE_INVALID",
      message: `Documents must be smaller than ${Math.round(
        documentMaximumUploadBytesServer() / 1024 / 1024,
      )} MB.`,
      expose: true,
    });
  }

  if (rawHash && !/^[a-f0-9]{64}$/.test(rawHash)) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_HASH_INVALID",
      message: "The document fingerprint is invalid.",
      expose: true,
    });
  }

  return {
    actorHint,
    clientId,
    originalFileName,
    declaredContentType,
    declaredSizeBytes,
    claimedSha256: rawHash || null,
    documentType: normaliseDocumentType(input.documentType),
    visibility:
      actorHint === "client" || input.visibility === "AdvisorAndClient"
        ? "AdvisorAndClient"
        : "AdvisorOnly",
    notes,
  };
}

export async function headPrivateDocumentBlob(
  urlOrPathname: string,
  signal?: AbortSignal,
): Promise<PrivateBlobReference> {
  if (!documentStorageConfigured()) {
    throw new ApiError({
      status: 503,
      code: "DOCUMENT_STORAGE_NOT_CONFIGURED",
      message: "Secure document storage is not configured.",
      expose: true,
    });
  }

  const blob = await head(urlOrPathname, {
    abortSignal: signal,
  });

  if (!documentPathIsAllowed(blob.pathname)) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_STORAGE_PATH_INVALID",
      message: "The uploaded object is outside the Slice document vault.",
      expose: false,
    });
  }

  if (blob.size > documentMaximumUploadBytesServer()) {
    throw new ApiError({
      status: 413,
      code: "DOCUMENT_STORAGE_SIZE_INVALID",
      message: "The uploaded document exceeds the permitted size.",
      expose: true,
    });
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType ?? null,
    contentDisposition: blob.contentDisposition ?? null,
    etag: blob.etag ?? null,
    size: blob.size,
    uploadedAt: blob.uploadedAt ?? null,
  };
}

export async function deletePrivateDocumentBlob(
  urlOrPathname: string,
  signal?: AbortSignal,
) {
  if (!urlOrPathname) return;

  await del(urlOrPathname, {
    abortSignal: signal,
  });
}

function startsWithBytes(value: Uint8Array, expected: number[]) {
  if (value.byteLength < expected.length) return false;
  return expected.every((byte, index) => value[index] === byte);
}

function likelyUtf8Text(value: Uint8Array) {
  if (!value.byteLength) return true;

  let printable = 0;

  for (const byte of value) {
    if (byte === 0) return false;
    if (
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126) ||
      byte >= 128
    ) {
      printable += 1;
    }
  }

  return printable / value.byteLength >= 0.9;
}

function validateFileSignature(input: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  const extension = documentExtension(input.fileName);
  const pdf = startsWithBytes(input.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  const png = startsWithBytes(input.bytes, [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const jpeg = startsWithBytes(input.bytes, [0xff, 0xd8, 0xff]);
  const zip = startsWithBytes(input.bytes, [0x50, 0x4b, 0x03, 0x04]);
  const text = likelyUtf8Text(input.bytes);

  if (extension === ".pdf") {
    return {
      valid: pdf && input.contentType === "application/pdf",
      message: pdf
        ? "PDF signature verified."
        : "The file does not contain a valid PDF signature.",
    };
  }

  if (extension === ".png") {
    return {
      valid: png && input.contentType === "image/png",
      message: png
        ? "PNG signature verified."
        : "The file does not contain a valid PNG signature.",
    };
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return {
      valid: jpeg && input.contentType === "image/jpeg",
      message: jpeg
        ? "JPEG signature verified."
        : "The file does not contain a valid JPEG signature.",
    };
  }

  if (extension === ".docx") {
    return {
      valid:
        zip &&
        input.contentType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      message: zip
        ? "Office container signature verified."
        : "The file does not contain a valid DOCX container signature.",
    };
  }

  if (extension === ".xlsx") {
    return {
      valid:
        zip &&
        input.contentType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      message: zip
        ? "Office container signature verified."
        : "The file does not contain a valid XLSX container signature.",
    };
  }

  if ([".txt", ".csv", ".json"].includes(extension ?? "")) {
    return {
      valid: text,
      message: text
        ? "Text content signature verified."
        : "The file contains binary content inconsistent with its extension.",
    };
  }

  return {
    valid: false,
    message: "The document format could not be verified.",
  };
}

function classificationFor(input: {
  fileName: string;
  contentType: string;
  textPreview: string | null;
}): DocumentClassification {
  const haystack = `${input.fileName}\n${input.textPreview ?? ""}`.toLowerCase();
  const signals: string[] = [];
  let category: DocumentType = "General";
  let confidence = 45;

  const match = (pattern: RegExp, next: DocumentType, score: number, signal: string) => {
    if (!pattern.test(haystack) || score <= confidence) return;
    category = next;
    confidence = score;
    signals.length = 0;
    signals.push(signal);
  };

  match(
    /\b(1099|w-?2|tax|irs|return|schedule [a-z])\b/i,
    "Tax",
    92,
    "Tax terminology detected.",
  );
  match(
    /\b(statement|account summary|brokerage|custodian|ending balance)\b/i,
    "Account Statement",
    88,
    "Account-statement terminology detected.",
  );
  match(
    /\b(will|trust|estate|beneficiary|power of attorney|probate)\b/i,
    "Estate Planning",
    91,
    "Estate-planning terminology detected.",
  );
  match(
    /\b(policy|premium|coverage|insurance|annuity)\b/i,
    "Insurance",
    86,
    "Insurance terminology detected.",
  );
  match(
    /\b(passport|driver'?s license|identification|social security)\b/i,
    "Identity",
    89,
    "Identity-document terminology detected.",
  );
  match(
    /\b(agreement|contract|engagement|signature|terms and conditions)\b/i,
    "Agreement",
    84,
    "Agreement terminology detected.",
  );
  match(
    /\b(compliance|disclosure|attestation|acknowledg(e)?ment|regulatory)\b/i,
    "Compliance",
    86,
    "Compliance terminology detected.",
  );
  match(
    /\b(financial plan|retirement|cash flow|goal|planning)\b/i,
    "Planning",
    80,
    "Planning terminology detected.",
  );

  if (!signals.length) {
    signals.push("No high-confidence category phrase was detected.");
  }

  const image = input.contentType === "image/jpeg" || input.contentType === "image/png";
  const pdf = input.contentType === "application/pdf";

  return {
    category,
    confidence,
    method: input.textPreview
      ? "filename-signature-and-text"
      : "filename-and-signature",
    textPreviewAvailable: Boolean(input.textPreview),
    requiresOcr: image ? true : pdf ? "undetermined" : false,
    ocrStatus: image || pdf ? "Not Requested" : "Not Required",
    malwareScan: {
      status: "Not Configured",
      note:
        "Slice verified the file signature, but no external malware-scanning provider is configured.",
    },
    signals,
  };
}

export async function inspectPrivateDocumentBlob(input: {
  pathname: string;
  fileName: string;
  declaredContentType?: string | null;
  signal?: AbortSignal;
}): Promise<PrivateBlobInspection> {
  if (!documentPathIsAllowed(input.pathname)) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_STORAGE_PATH_INVALID",
      message: "The document path is invalid.",
      expose: false,
    });
  }

  const result = await get(input.pathname, {
    access: "private",
    abortSignal: input.signal,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new ApiError({
      status: 404,
      code: "DOCUMENT_BLOB_NOT_FOUND",
      message: "The stored document could not be found.",
      expose: true,
    });
  }

  const maximum = documentMaximumUploadBytesServer();
  const previewLimit = documentPreviewBytes();
  const hash = createHash("sha256");
  const previewChunks: Uint8Array[] = [];
  let previewLength = 0;
  let total = 0;
  const reader = result.stream.getReader();

  try {
    while (true) {
      if (input.signal?.aborted) {
        throw new DOMException("Document processing was cancelled.", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;

      if (total > maximum) {
        throw new ApiError({
          status: 413,
          code: "DOCUMENT_TOO_LARGE",
          message: "The stored document exceeds the permitted size.",
          expose: true,
        });
      }

      hash.update(value);

      if (previewLength < previewLimit) {
        const remaining = previewLimit - previewLength;
        const chunk = value.byteLength <= remaining ? value : value.slice(0, remaining);
        previewChunks.push(chunk);
        previewLength += chunk.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const previewBytes = new Uint8Array(previewLength);
  let offset = 0;
  for (const chunk of previewChunks) {
    previewBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const contentType = String(
    result.blob.contentType || input.declaredContentType || "application/octet-stream",
  )
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!isAllowedDocumentContentType(contentType)) {
    throw new ApiError({
      status: 415,
      code: "DOCUMENT_CONTENT_TYPE_NOT_ALLOWED",
      message: "The stored document type is not supported.",
      expose: true,
    });
  }

  const signature = validateFileSignature({
    fileName: input.fileName,
    contentType,
    bytes: previewBytes,
  });

  let textPreview: string | null = null;

  if (
    signature.valid &&
    ["text/plain", "text/csv", "application/json"].includes(contentType)
  ) {
    textPreview = new TextDecoder("utf-8", { fatal: false })
      .decode(previewBytes)
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 8_000) || null;
  }

  return {
    sha256: hash.digest("hex"),
    sizeBytes: total,
    contentType,
    fileExtension: documentExtension(input.fileName),
    signatureValid: signature.valid,
    securityMessage: signature.message,
    textPreview,
    classification: classificationFor({
      fileName: input.fileName,
      contentType,
      textPreview,
    }),
    blob: {
      url: result.blob.url,
      pathname: result.blob.pathname,
      contentType: result.blob.contentType ?? null,
      contentDisposition: result.blob.contentDisposition ?? null,
      etag: result.blob.etag ?? null,
      size: result.blob.size ?? total,
      uploadedAt: result.blob.uploadedAt ?? null,
    },
  };
}

function documentSigningSecret() {
  const configured =
    process.env.DOCUMENT_ACCESS_SIGNING_SECRET ||
    process.env.SECURITY_PEPPER ||
    process.env.SLICE_SECRET_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET;

  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new ApiError({
      status: 503,
      code: "DOCUMENT_SIGNING_SECRET_MISSING",
      message: "Secure document access is temporarily unavailable.",
      expose: true,
    });
  }

  return DEVELOPMENT_SIGNING_SECRET;
}

function accessMac(input: Omit<DocumentAccessPayload, "mac">) {
  return createHmac("sha256", documentSigningSecret())
    .update(
      [
        input.version,
        input.documentId,
        input.actorKind,
        input.actorId,
        input.disposition,
        input.expiresAt,
      ].join(":"),
    )
    .digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function issueDocumentAccessToken(input: {
  documentId: string;
  actorKind: DocumentActorKind;
  actorId: string;
  disposition?: "inline" | "attachment";
}) {
  const base: Omit<DocumentAccessPayload, "mac"> = {
    version: 1,
    documentId: input.documentId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    disposition: input.disposition === "inline" ? "inline" : "attachment",
    expiresAt: Date.now() + documentAccessSeconds() * 1_000,
  };

  const payload: DocumentAccessPayload = {
    ...base,
    mac: accessMac(base),
  };

  return {
    token: Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    expiresAt: new Date(payload.expiresAt),
  };
}

export function verifyDocumentAccessToken(value: string) {
  let parsed: Partial<DocumentAccessPayload>;

  try {
    parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<DocumentAccessPayload>;
  } catch {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ACCESS_TOKEN_INVALID",
      message: "The document access link is invalid.",
      expose: true,
    });
  }

  if (
    parsed.version !== 1 ||
    typeof parsed.documentId !== "string" ||
    !parsed.documentId ||
    (parsed.actorKind !== "advisor" && parsed.actorKind !== "client") ||
    typeof parsed.actorId !== "string" ||
    !parsed.actorId ||
    (parsed.disposition !== "inline" && parsed.disposition !== "attachment") ||
    typeof parsed.expiresAt !== "number" ||
    typeof parsed.mac !== "string"
  ) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ACCESS_TOKEN_INVALID",
      message: "The document access link is invalid.",
      expose: true,
    });
  }

  if (parsed.expiresAt <= Date.now()) {
    throw new ApiError({
      status: 410,
      code: "DOCUMENT_ACCESS_TOKEN_EXPIRED",
      message: "The document access link has expired.",
      expose: true,
    });
  }

  const base = {
    version: 1 as const,
    documentId: parsed.documentId,
    actorKind: parsed.actorKind,
    actorId: parsed.actorId,
    disposition: parsed.disposition,
    expiresAt: parsed.expiresAt,
  };
  const expected = accessMac(base);

  if (!constantTimeEqual(parsed.mac, expected)) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ACCESS_TOKEN_INVALID",
      message: "The document access link could not be verified.",
      expose: true,
    });
  }

  return base;
}