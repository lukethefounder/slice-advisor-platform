import { NextResponse } from "next/server";
import { findAccessibleClient } from "@/lib/client-access";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
  recordSecurityEvent,
} from "@/lib/security";
import { decryptSensitiveText } from "@/lib/data-vault";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

type ClientAccessScope =
  | "read"
  | "write"
  | "delete"
  | "export"
  | "email";

type SecureRouteInput = {
  request: Request;
  user: CurrentUserShape;
  area: string;
  eventType: string;
  title: string;
  limit?: number;
  windowMs?: number;
};

type ClientAccessInput = {
  user: CurrentUserShape;
  clientId: string;
  scope: ClientAccessScope;
  request?: Request;
};

export function noStoreJson(
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "X-Slice-Client-Data",
    "protected",
  );

  return response;
}

export function cleanText(
  value: unknown,
  fallback = "",
) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

export function cleanNullableText(
  value: unknown,
) {
  const clean = cleanText(value, "");

  return clean || null;
}

export function cleanEmail(
  value: unknown,
) {
  const clean = cleanText(
    value,
    "",
  ).toLowerCase();

  if (!clean) {
    return null;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      clean,
    )
  ) {
    return null;
  }

  return clean.slice(0, 320);
}

export function cleanTicker(
  value: unknown,
) {
  return cleanText(value, "")
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
}

export function cleanMoneyLike(
  value: unknown,
) {
  const clean = cleanText(value, "");

  if (!clean) {
    return null;
  }

  return (
    clean
      .replace(/[^\d.,$%-]/g, "")
      .slice(0, 80) || null
  );
}

export function sensitiveActionConfirmationRequired() {
  return (
    process.env
      .ENFORCE_SENSITIVE_CONFIRMATION ===
    "true"
  );
}

export function hasSensitiveActionConfirmation(
  request: Request,
  expected: string,
) {
  if (
    !sensitiveActionConfirmationRequired()
  ) {
    return true;
  }

  const header =
    request.headers.get(
      "x-slice-sensitive-action",
    ) ?? "";

  return header === expected;
}

export async function protectClientDataRoute(
  input: SecureRouteInput,
) {
  if (
    isPotentiallyCrossSiteUnsafeRequest(
      input.request,
    )
  ) {
    await recordSecurityEvent({
      userId: input.user.id,
      eventType: `${input.eventType}.cross_site_blocked`,
      severity: "High",
      area: input.area,
      title: `${input.title}: cross-site request blocked`,
      detail:
        "A potentially cross-site unsafe request attempted to access client data.",
      request: input.request,
    });

    return {
      allowed: false,
      response: noStoreJson(
        {
          error:
            "Security policy blocked this client-data request.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  const ipHash = hashForSecurity(
    getClientIp(input.request),
  );

  const rate = checkRateLimit({
    key: `client-data:${input.user.id}:${ipHash}:${input.eventType}`,
    limit: input.limit ?? 80,
    windowMs:
      input.windowMs ?? 60 * 1000,
  });

  if (!rate.allowed) {
    await recordSecurityEvent({
      userId: input.user.id,
      eventType: `${input.eventType}.rate_limited`,
      severity: "Medium",
      area: input.area,
      title: `${input.title}: rate limited`,
      detail:
        "Client-data endpoint rate limit triggered.",
      metadata: {
        limit: rate.limit,
        resetAt: rate.resetAt,
      },
      request: input.request,
    });

    const response = noStoreJson(
      {
        error:
          "Too many client-data requests. Try again shortly.",
      },
      {
        status: 429,
      },
    );

    response.headers.set(
      "Retry-After",
      String(rate.retryAfterSeconds),
    );

    return {
      allowed: false,
      response,
    };
  }

  return {
    allowed: true,
    response: null,
  };
}

export async function requireClientAccess(
  input: ClientAccessInput,
) {
  const { client } =
    await findAccessibleClient({
      userId: input.user.id,
      clientId: input.clientId,
    });

  if (!client) {
    await recordSecurityEvent({
      userId: input.user.id,
      eventType: `client.${input.scope}.denied`,
      severity: "High",
      area: "Client Data",
      title: "Client-data access denied",
      detail: `User attempted ${input.scope} access to a client they do not own, are not assigned to, or cannot access through firm permissions.`,
      metadata: {
        clientIdHash:
          hashForSecurity(
            input.clientId,
          ),
        scope: input.scope,
      },
      request: input.request,
    });

    return {
      allowed: false,
      client: null,
      response: noStoreJson(
        {
          error: "Client not found.",
        },
        {
          status: 404,
        },
      ),
    };
  }

  await recordSecurityEvent({
    userId: input.user.id,
    eventType: `client.${input.scope}.access`,
    severity:
      input.scope === "read"
        ? "Info"
        : input.scope === "delete"
          ? "High"
          : "Medium",
    area: "Client Data",
    title: `Client ${input.scope} access`,
    detail: `User accessed client data with ${input.scope} scope.`,
    metadata: {
      clientIdHash:
        hashForSecurity(
          input.clientId,
        ),
      clientEmailHash: client.email
        ? hashForSecurity(client.email)
        : null,
      scope: input.scope,
      firmId:
        client.firmId ?? null,
      assignedAdvisorMembershipId:
        client.assignedAdvisorMembershipId ??
        null,
    },
    request: input.request,
  });

  return {
    allowed: true,
    client,
    response: null,
  };
}

export function redactClientForSummary(
  client: any,
) {
  const decryptedEmail = client.email
    ? decryptSensitiveText(
        client.email,
      )
    : null;

  return {
    id: client.id,
    fullName: client.fullName,
    householdName:
      client.householdName,
    clientType: client.clientType,
    riskProfile: client.riskProfile,
    liquidityNeeds:
      client.liquidityNeeds,
    timeHorizon: client.timeHorizon,
    objective: client.objective,
    portfolioValue:
      client.portfolioValue
        ? "[REDACTED_IN_SUMMARY_VIEW]"
        : null,
    status: client.status,
    createdAt: client.createdAt,
    holdingsCount:
      client.holdings?.length ?? 0,
    notesCount:
      client.notesList?.length ?? 0,
    tasksCount:
      client.tasks?.length ?? 0,
    reviewsCount:
      client.reviews?.length ?? 0,
    documentsCount:
      client.documents?.length ?? 0,
    email: decryptedEmail
      ? maskEmail(decryptedEmail)
      : null,
    notes: client.notes
      ? "[REDACTED_IN_SUMMARY_VIEW]"
      : null,
  };
}

export function maskEmail(
  email: string,
) {
  const [name, domain] =
    email.split("@");

  if (!name || !domain) {
    return "masked";
  }

  return `${name.slice(0, 2)}${"*".repeat(
    Math.max(
      2,
      name.length - 2,
    ),
  )}@${domain}`;
}

export async function recordClientMutation(
  input: {
    user: CurrentUserShape;
    request?: Request;
    clientId: string;
    action: string;
    title: string;
    detail?: string;
    metadata?: Record<
      string,
      unknown
    >;
  },
) {
  await recordSecurityEvent({
    userId: input.user.id,
    eventType: `client.${input.action}`,
    severity:
      input.action.includes("delete")
        ? "High"
        : "Medium",
    area: "Client Data",
    title: input.title,
    detail: input.detail,
    metadata: {
      clientIdHash:
        hashForSecurity(
          input.clientId,
        ),
      ...(input.metadata ?? {}),
    },
    request: input.request,
  });
}