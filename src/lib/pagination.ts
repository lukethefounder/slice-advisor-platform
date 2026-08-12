import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/api-route";

export type SortDirection = "asc" | "desc";

type CursorPayload = {
  version: 1;
  id: string;
  scope: string;
  mac: string;
};

const DEFAULT_CURSOR_SECRET = "slice-development-pagination-secret";

function cursorSecret() {
  const configured =
    process.env.SECURITY_PEPPER ||
    process.env.SLICE_SECRET_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET;

  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new ApiError({
      status: 500,
      code: "CURSOR_SECRET_MISSING",
      message: "Pagination is temporarily unavailable.",
      expose: false,
    });
  }

  return DEFAULT_CURSOR_SECRET;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function cursorMac(input: { id: string; scope: string }) {
  return createHmac("sha256", cursorSecret())
    .update(`${input.scope}:${input.id}`)
    .digest("base64url");
}

function constantTimeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function paginationScope(value: unknown) {
  return createHash("sha256")
    .update(stableJson(value))
    .digest("base64url")
    .slice(0, 24);
}

export function encodeCursor(input: { id: string; scope: string }) {
  const payload: CursorPayload = {
    version: 1,
    id: input.id,
    scope: input.scope,
    mac: cursorMac(input),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(token: string | null | undefined, scope: string) {
  if (!token) return null;

  let parsed: Partial<CursorPayload>;

  try {
    parsed = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as Partial<CursorPayload>;
  } catch {
    throw new ApiError({
      status: 400,
      code: "INVALID_CURSOR",
      message: "The pagination cursor is invalid.",
      expose: true,
    });
  }

  if (
    parsed.version !== 1 ||
    typeof parsed.id !== "string" ||
    !parsed.id ||
    typeof parsed.scope !== "string" ||
    parsed.scope !== scope ||
    typeof parsed.mac !== "string"
  ) {
    throw new ApiError({
      status: 400,
      code: "CURSOR_SCOPE_MISMATCH",
      message: "The pagination cursor does not match this query.",
      expose: true,
    });
  }

  const expected = cursorMac({
    id: parsed.id,
    scope: parsed.scope,
  });

  if (!constantTimeStringEqual(parsed.mac, expected)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CURSOR_SIGNATURE",
      message: "The pagination cursor could not be verified.",
      expose: true,
    });
  }

  return parsed.id;
}

export function readPageSize(
  params: URLSearchParams,
  options: {
    name?: string;
    fallback?: number;
    minimum?: number;
    maximum?: number;
  } = {},
) {
  const name = options.name ?? "limit";
  const fallback = options.fallback ?? 25;
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 100;
  const raw = params.get(name);

  if (!raw) return fallback;

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError({
      status: 400,
      code: "INVALID_PAGE_SIZE",
      message: `${name} must be an integer between ${minimum} and ${maximum}.`,
      expose: true,
    });
  }

  return parsed;
}

export function readSortDirection(
  params: URLSearchParams,
  fallback: SortDirection = "desc",
) {
  const raw = params.get("direction")?.trim().toLowerCase();

  if (!raw) return fallback;
  if (raw === "asc" || raw === "desc") return raw;

  throw new ApiError({
    status: 400,
    code: "INVALID_SORT_DIRECTION",
    message: "direction must be asc or desc.",
    expose: true,
  });
}

export function readSearch(
  params: URLSearchParams,
  name = "q",
  maximumLength = 120,
) {
  const value = params.get(name)?.replace(/\s+/g, " ").trim() ?? "";

  if (value.length > maximumLength) {
    throw new ApiError({
      status: 400,
      code: "SEARCH_TOO_LONG",
      message: `${name} must be ${maximumLength} characters or fewer.`,
      expose: true,
    });
  }

  return value;
}

export function createCursorPage<T extends { id: string }>(input: {
  rows: T[];
  pageSize: number;
  scope: string;
}) {
  const hasMore = input.rows.length > input.pageSize;
  const items = hasMore ? input.rows.slice(0, input.pageSize) : input.rows;
  const last = items.at(-1);

  return {
    items,
    pagination: {
      limit: input.pageSize,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              id: last.id,
              scope: input.scope,
            })
          : null,
    },
  };
}