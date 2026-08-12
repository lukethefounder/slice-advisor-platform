import "server-only";

import {
  hasFirmPermission,
  requireCurrentAccessContext,
  type AccessContext,
} from "@/lib/access-control";
import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { boolEnv, getIntegrationStatuses } from "@/lib/env";
import {
  getIntegrationRuntimeSnapshot,
  publicIntegrationFailure,
  stableIntegrationId,
} from "@/lib/integrations/core";
import {
  generateAiText,
  getOpenAiRuntimeStatus,
  parseSliceCommandWithAi,
} from "@/lib/integrations/ai";
import {
  getEmailIntegrationStatus,
  sendEmail,
} from "@/lib/integrations/email";
import { getMarketIntegrationStatus, fetchMarketQuote } from "@/lib/integrations/market";
import { getSmsIntegrationStatus, sendSms } from "@/lib/integrations/sms";
import {
  getStorageIntegrationStatus,
  uploadBackendBlob,
} from "@/lib/integrations/storage";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEST_ACTIONS = new Set([
  "testMarket",
  "testAi",
  "testAiCommand",
  "testEmail",
  "testSms",
  "testBlob",
  "testAll",
]);

function readText(value: unknown, fallback = "", maximum = 2_000) {
  if (typeof value !== "string") return fallback;

  const clean = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);

  return clean || fallback;
}

function readBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function testingAllowed(context: AccessContext) {
  return context.isFounder || hasFirmPermission(context, "security.review");
}

async function requireTestingAccess() {
  const context = await requireCurrentAccessContext();

  if (!testingAllowed(context)) {
    throw new ApiError({
      status: 403,
      code: "INTEGRATION_TEST_ACCESS_DENIED",
      message: "Founder or security-review access is required to run provider tests.",
      expose: true,
    });
  }

  return context;
}

function requireJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    throw new ApiError({
      status: 415,
      code: "JSON_REQUIRED",
      message: "Send this request as application/json.",
      expose: true,
    });
  }
}

function hasConfirmation(request: Request, expected: string) {
  return request.headers.get("x-slice-sensitive-action")?.trim() === expected;
}

function requireConfirmation(request: Request, expected: string, message: string) {
  if (hasConfirmation(request, expected)) return;

  throw new ApiError({
    status: 403,
    code: "SENSITIVE_ACTION_CONFIRMATION_REQUIRED",
    message,
    expose: true,
    details: {
      requiredHeader: `x-slice-sensitive-action: ${expected}`,
    },
  });
}

function operationIdempotencyKey(
  action: string,
  userId: string,
  target: string,
  supplied: unknown,
) {
  const explicit = readText(supplied, "", 200).replace(/[^A-Za-z0-9._:-]/g, "-");

  if (explicit) {
    return stableIntegrationId(action, `${userId}:${explicit}`);
  }

  const tenMinuteBucket = Math.floor(Date.now() / (10 * 60_000));
  return stableIntegrationId(action, `${userId}:${target}:${tenMinuteBucket}`);
}

async function recordTestEvent(input: {
  context: AccessContext;
  request: Request;
  action: string;
  metadata?: Record<string, unknown>;
  log: {
    warn: (event: string, metadata?: Record<string, unknown>) => void;
  };
}) {
  try {
    await recordSecurityEvent({
      userId: input.context.user.id,
      eventType: `integration.${input.action}`,
      severity:
        input.action === "testEmail" ||
        input.action === "testSms" ||
        input.action === "testBlob" ||
        input.action === "testAll"
          ? "Medium"
          : "Info",
      area: "Integrations",
      title: `Integration diagnostic: ${input.action}`,
      detail: "An authorized user ran a Slice integration diagnostic.",
      metadata: {
        action: input.action,
        firmId: input.context.firm?.id ?? null,
        ...(input.metadata ?? {}),
      },
      request: input.request,
    });
  } catch (error) {
    input.log.warn("integration.audit.failed", {
      action: input.action,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function settled<T>(result: PromiseSettledResult<T>) {
  if (result.status === "fulfilled") {
    return {
      ok: true,
      value: result.value,
    };
  }

  return {
    ok: false,
    error: publicIntegrationFailure(
      result.reason,
      "The integration diagnostic could not be completed.",
    ),
  };
}

function operationSucceeded(value: unknown) {
  if (!value || typeof value !== "object") return false;

  if ("ok" in value && typeof (value as { ok?: unknown }).ok === "boolean") {
    return (value as { ok: boolean }).ok;
  }

  if ("price" in value) {
    const price = (value as { price?: unknown }).price;
    return typeof price === "number" && Number.isFinite(price);
  }

  return true;
}

function configuredAdapters() {
  return {
    market: getMarketIntegrationStatus(),
    ai: getOpenAiRuntimeStatus(),
    email: getEmailIntegrationStatus(),
    sms: getSmsIntegrationStatus(),
    storage: getStorageIntegrationStatus(),
  };
}

export const GET = withApiRoute(
  {
    route: "/api/integrations/status",
    timeoutMs: 15_000,
    cacheControl: "private, no-store, max-age=0",
  },
  async () => {
    const context = await requireCurrentAccessContext();
    const canRunTests = testingAllowed(context);

    return apiJson({
      ok: true,
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
      firm: context.firm
        ? {
            id: context.firm.id,
            name: context.firm.name,
          }
        : null,
      permissions: {
        canRunTests,
      },
      // Preserve the existing response field for current integration-status UIs.
      integrations: getIntegrationStatuses(),
      adapters: configuredAdapters(),
      aiCommandLayer: {
        structuredCommandParsing: true,
        approvalGates: true,
      },
      runtime: canRunTests ? getIntegrationRuntimeSnapshot() : null,
      checkedAt: new Date().toISOString(),
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/integrations/status",
    timeoutMs: 120_000,
    cacheControl: "private, no-store, max-age=0",
  },
  async ({ request, log }) => {
    const context = await requireTestingAccess();

    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_REQUEST_BLOCKED",
        message: "Security policy blocked this integration test request.",
        expose: true,
      });
    }

    requireJsonRequest(request);

    const ipHash = hashForSecurity(getClientIp(request));
    const rate = checkRateLimit({
      key: `integration-tests:${context.user.id}:${ipHash}`,
      limit: 12,
      windowMs: 5 * 60_000,
    });

    if (!rate.allowed) {
      return apiJson(
        {
          ok: false,
          error: {
            code: "INTEGRATION_TEST_RATE_LIMITED",
            message: "Too many integration tests were requested. Try again after the cooldown.",
            retryAfterSeconds: rate.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
          },
        },
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_JSON",
        message: "The request body is not valid JSON.",
        expose: true,
      });
    }

    const action = readText(body.action, "", 80);

    if (!TEST_ACTIONS.has(action)) {
      throw new ApiError({
        status: 400,
        code: "UNKNOWN_INTEGRATION_ACTION",
        message: "Choose a supported integration diagnostic action.",
        expose: true,
        details: {
          supportedActions: Array.from(TEST_ACTIONS),
        },
      });
    }

    await recordTestEvent({
      context,
      request,
      action,
      metadata: {
        includeDeliveryTests: readBoolean(body.includeDeliveryTests),
        includeStorageTest: readBoolean(body.includeStorageTest),
      },
      log,
    });

    if (action === "testMarket") {
      const symbol = readText(body.symbol, "NVDA", 20).toUpperCase();
      const quote = await fetchMarketQuote(symbol);

      return apiJson({
        ok: quote.price !== null,
        action,
        quote,
        completedAt: new Date().toISOString(),
      });
    }

    if (action === "testAi") {
      const result = await generateAiText({
        safetyIdentifier: context.user.email,
        prompt:
          "Return a concise confirmation that the Slice AI provider is connected. Use fewer than 20 words.",
        enableWebSearch: false,
        researchMode: "off",
        speedMode: "instant",
        timeoutMs: 30_000,
        maxOutputTokens: 120,
        useCache: false,
        appendSources: false,
        metadata: {
          surface: "integration_status",
          diagnostic: true,
        },
      });

      return apiJson({
        ok: result.ok,
        action,
        result,
        completedAt: new Date().toISOString(),
      });
    }

    if (action === "testAiCommand") {
      const prompt = readText(body.prompt, "Open market visuals", 1_000);
      const result = await parseSliceCommandWithAi({
        prompt,
        userName: context.user.name,
        userEmail: context.user.email,
        firmName: context.firm?.name ?? "Slice",
        botName: "Slice Bot",
        memory: ["Use precise, approval-gated financial workflow execution."],
        openTasks: 2,
        unreadAlerts: 3,
        clients: 4,
        portfolioValue: 1_000_000,
      });

      return apiJson({
        ok: result.ok,
        action,
        result,
        completedAt: new Date().toISOString(),
      });
    }

    if (action === "testEmail") {
      const to = readText(body.to, context.user.email, 320).toLowerCase();

      if (boolEnv("ENABLE_LIVE_EMAIL")) {
        requireConfirmation(
          request,
          "integration-test-email",
          "Confirm the live email integration test before sending it.",
        );
      }

      const result = await sendEmail({
        to,
        subject: "Slice email integration test",
        text:
          "This is an authorized Slice email-provider diagnostic. No client data is included.",
        idempotencyKey: operationIdempotencyKey(
          "integration-test-email",
          context.user.id,
          to,
          body.idempotencyKey,
        ),
      });

      return apiJson({
        ok: result.ok,
        action,
        result,
        completedAt: new Date().toISOString(),
      });
    }

    if (action === "testSms") {
      const to = readText(body.to, "", 40);

      if (!to) {
        throw new ApiError({
          status: 400,
          code: "PHONE_NUMBER_REQUIRED",
          message: "A destination phone number is required for the SMS diagnostic.",
          expose: true,
        });
      }

      if (boolEnv("ENABLE_LIVE_SMS")) {
        requireConfirmation(
          request,
          "integration-test-sms",
          "Confirm the live SMS integration test before sending it.",
        );
      }

      const result = await sendSms({
        to,
        body: "Slice backend SMS integration test.",
        idempotencyKey: operationIdempotencyKey(
          "integration-test-sms",
          context.user.id,
          to,
          body.idempotencyKey,
        ),
      });

      return apiJson({
        ok: result.ok,
        action,
        result,
        completedAt: new Date().toISOString(),
      });
    }

    if (action === "testBlob") {
      requireConfirmation(
        request,
        "integration-test-blob",
        "Confirm the object-storage integration test before creating a test object.",
      );

      const result = await uploadBackendBlob({
        pathname: `slice-tests/integration-${context.user.id}.txt`,
        body: `Slice Blob integration test created at ${new Date().toISOString()}`,
        contentType: "text/plain",
        access: "private",
        idempotencyKey: operationIdempotencyKey(
          "integration-test-blob",
          context.user.id,
          "private-test-object",
          body.idempotencyKey,
        ),
      });

      return apiJson({
        ok: result.ok,
        action,
        result,
        completedAt: new Date().toISOString(),
      });
    }

    const includeDeliveryTests = readBoolean(body.includeDeliveryTests);
    const includeStorageTest = readBoolean(body.includeStorageTest);
    const emailTo = readText(body.emailTo, context.user.email, 320).toLowerCase();
    const smsTo = readText(body.smsTo, "", 40);

    if (includeDeliveryTests || includeStorageTest) {
      requireConfirmation(
        request,
        "integration-test-all",
        "Confirm the full integration test before any delivery or storage side effects are attempted.",
      );
    }

    const operations = await Promise.allSettled([
      fetchMarketQuote(readText(body.symbol, "NVDA", 20).toUpperCase()),
      generateAiText({
        safetyIdentifier: context.user.email,
        prompt: "Confirm the Slice AI provider connection in one short sentence.",
        enableWebSearch: false,
        researchMode: "off",
        speedMode: "instant",
        timeoutMs: 30_000,
        maxOutputTokens: 120,
        useCache: false,
        appendSources: false,
        metadata: {
          surface: "integration_status",
          diagnostic: true,
        },
      }),
      parseSliceCommandWithAi({
        prompt: "Create a price alert for NVDA above 1000",
        userName: context.user.name,
        userEmail: context.user.email,
        firmName: context.firm?.name ?? "Slice",
        botName: "Slice Bot",
      }),
      includeDeliveryTests
        ? sendEmail({
            to: emailTo,
            subject: "Slice full integration test",
            text:
              "This is an authorized Slice integration diagnostic. No client data is included.",
            idempotencyKey: operationIdempotencyKey(
              "integration-test-all-email",
              context.user.id,
              emailTo,
              body.idempotencyKey,
            ),
          })
        : Promise.resolve({
            ok: true,
            provider: "Resend",
            status: "disabled" as const,
            reason: "Delivery tests were not requested.",
          }),
      includeDeliveryTests && smsTo
        ? sendSms({
            to: smsTo,
            body: "Slice full integration SMS diagnostic.",
            idempotencyKey: operationIdempotencyKey(
              "integration-test-all-sms",
              context.user.id,
              smsTo,
              body.idempotencyKey,
            ),
          })
        : Promise.resolve({
            ok: true,
            provider: "Twilio",
            status: "disabled" as const,
            reason: includeDeliveryTests
              ? "No SMS destination was supplied."
              : "Delivery tests were not requested.",
          }),
      includeStorageTest
        ? uploadBackendBlob({
            pathname: `slice-tests/full-integration-${context.user.id}.txt`,
            body: `Slice full integration test created at ${new Date().toISOString()}`,
            contentType: "text/plain",
            access: "private",
            idempotencyKey: operationIdempotencyKey(
              "integration-test-all-blob",
              context.user.id,
              "private-full-test-object",
              body.idempotencyKey,
            ),
          })
        : Promise.resolve({
            ok: true,
            provider: "Vercel Blob",
            status: "unknown" as const,
            reason: "Storage testing was not requested.",
          }),
    ]);

    const [market, ai, aiCommand, email, sms, blob] = operations;

    return apiJson({
      ok: operations.every(
        (operation) =>
          operation.status === "fulfilled" && operationSucceeded(operation.value),
      ),
      action,
      sideEffects: {
        deliveryTestsRequested: includeDeliveryTests,
        storageTestRequested: includeStorageTest,
      },
      results: {
        market: settled(market),
        ai: settled(ai),
        aiCommand: settled(aiCommand),
        email: settled(email),
        sms: settled(sms),
        blob: settled(blob),
      },
      runtime: getIntegrationRuntimeSnapshot(),
      completedAt: new Date().toISOString(),
    });
  },
);