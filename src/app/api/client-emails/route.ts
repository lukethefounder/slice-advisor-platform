import { after } from "next/server";

import { ApiError, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import { processBackgroundJobIds } from "@/lib/background-jobs/worker";
import {
  archiveClientEmailDrafts,
  cancelClientEmailDelivery,
  createAiClientEmailDrafts,
  createManualClientEmailDrafts,
  decideClientEmailApproval,
  deleteClientEmailDrafts,
  getClientEmailDraftProgress,
  listClientEmailArchive,
  listClientEmailCenter,
  polishExistingClientEmailDraft,
  queueClientEmailDraftsForApproval,
  retryAiClientEmailGeneration,
  retryClientEmailDelivery,
  saveClientEmailBranding,
  scheduleClientEmailDrafts,
  selectClientEmailDraftVersion,
  sendApprovedClientEmailDrafts,
  updateClientEmailDraft,
} from "@/lib/client-email-center";
import {
  hasSensitiveActionConfirmation,
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import { getOpenAiRuntimeStatus } from "@/lib/integrations/ai";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const immediateWorkerLog = createLogger("client-emails:immediate-worker");

type JsonBody = Record<string, unknown>;

function scheduleImmediateEmailWork(
  jobIds: Array<string | null | undefined>,
  reason: string,
) {
  const uniqueJobIds = Array.from(
    new Set(
      jobIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 50);

  if (!uniqueJobIds.length) {
    return;
  }

  /*
   * `after` sends the API response first, then keeps this route invocation
   * alive long enough to wake the exact durable jobs that were just queued.
   * The normal cron worker remains the always-on recovery path.
   */
  after(async () => {
    try {
      const summary = await processBackgroundJobIds({
        jobIds: uniqueJobIds,
        concurrency: Math.min(4, uniqueJobIds.length),
        maxRuntimeMs: 240_000,
        workerPrefix: "email-immediate",
      });

      immediateWorkerLog.info("wake.completed", {
        reason,
        requested: summary.requested,
        attempted: summary.attempted,
        completed: summary.completed,
        retrying: summary.retrying,
        failed: summary.failed,
        skipped: summary.skipped,
        durationMs: summary.durationMs,
      });
    } catch (error) {
      immediateWorkerLog.error("wake.failed", error, {
        reason,
        jobCount: uniqueJobIds.length,
      });
    }
  });
}


function actionFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => String(item ?? "").trim())
            .filter(Boolean),
        ),
      ).slice(0, 50)
    : [];
}

function requireSensitiveAction(request: Request, expected: string) {
  if (!hasSensitiveActionConfirmation(request, expected)) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_CONFIRMATION_REQUIRED",
      message: "Confirm this external email action before continuing.",
      expose: true,
      details: {
        expectedHeader: expected,
      },
    });
  }
}

async function requireEmailUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Sign in to use the client email center.",
      expose: true,
    });
  }

  return user;
}

async function protect(request: Request, user: Awaited<ReturnType<typeof requireEmailUser>>, mode: "read" | "write") {
  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Communication",
    eventType: mode === "read" ? "client_email.console" : "client_email.action",
    title: mode === "read" ? "Client email center access" : "Client email center action",
    limit: mode === "read" ? 180 : 90,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protection.response ?? noStoreJson(
      { error: "Security policy blocked this client email request." },
      { status: 403 },
    );
  }

  return null;
}

export const GET = withApiRoute(
  {
    route: "/api/client-emails",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const user = await requireEmailUser();
    const blocked = await protect(request, user, "read");
    if (blocked) return blocked;

    const url = new URL(request.url);
    const requestedScope = url.searchParams.get("scope") === "firm" ? "firm" : "mine";
    const view = url.searchParams.get("view");

    if (view === "archive") {
      return noStoreJson(
        await listClientEmailArchive(user, {
          scope: requestedScope,
          deliveryId: url.searchParams.get("deliveryId"),
          cursor: url.searchParams.get("cursor"),
          limit: Number(url.searchParams.get("limit") || 40),
        }),
      );
    }

    if (view === "progress") {
      const progress = await getClientEmailDraftProgress(user, {
        scope: requestedScope,
        draftId: url.searchParams.get("draftId") ?? "",
      });

      if (
        progress.job &&
        ["Queued", "Retrying"].includes(progress.job.status)
      ) {
        scheduleImmediateEmailWork(
          [progress.job.id],
          "progress-poll-wake",
        );
      }

      return noStoreJson(progress);
    }

    const result = await listClientEmailCenter(user, {
      scope: requestedScope,
      draftId: url.searchParams.get("draftId"),
    });

    return noStoreJson({
      ...result,
      aiRuntime: getOpenAiRuntimeStatus(),
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/client-emails",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const user = await requireEmailUser();
    const blocked = await protect(request, user, "write");
    if (blocked) return blocked;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ApiError({
        status: 415,
        code: "JSON_CONTENT_TYPE_REQUIRED",
        message: "Client email actions require a JSON request body.",
        expose: true,
      });
    }

    const body = (await request.json().catch(() => null)) as JsonBody | null;
    if (!body) {
      throw new ApiError({
        status: 400,
        code: "INVALID_JSON_BODY",
        message: "Enter a valid JSON request body.",
        expose: true,
      });
    }

    const action = actionFrom(body.action);

    if (action === "createManualDrafts") {
      return noStoreJson(
        await createManualClientEmailDrafts({
          user,
          request,
          clientIds: stringArray(body.clientIds),
          subject: body.subject,
          body: body.body,
          tone: body.tone,
          allowScratch: body.allowScratch === true,
        }),
        { status: 201 },
      );
    }

    if (action === "createAiDrafts") {
      const result = await createAiClientEmailDrafts({
        user,
        request,
        clientIds: stringArray(body.clientIds),
        prompt: body.prompt,
        topic: body.topic,
        purpose: body.purpose,
        tone: body.tone,
        advisorInstructions: body.advisorInstructions,
        callToAction: body.callToAction,
        useResearch: body.useResearch === true,
        speedMode: body.speedMode,
        optionCount: body.optionCount,
      });

      scheduleImmediateEmailWork(
        result.results.map((item) => item.jobId),
        "create-ai-drafts",
      );

      return noStoreJson(result, { status: 202 });
    }

    if (action === "updateDraft" || action === "checkpointDraft") {
      return noStoreJson(
        await updateClientEmailDraft({
          user,
          request,
          draftId: body.draftId,
          subject: body.subject,
          body: body.body,
          tone: body.tone,
          branding: body.branding,
          expectedRevision: body.expectedRevision,
          checkpoint: action === "checkpointDraft" || body.checkpoint === true,
          checkpointLabel: body.checkpointLabel,
        }),
      );
    }

    if (action === "selectVersion") {
      return noStoreJson(
        await selectClientEmailDraftVersion({
          user,
          request,
          draftId: body.draftId,
          versionId: body.versionId,
          expectedRevision: body.expectedRevision,
        }),
      );
    }

    if (action === "polishDraft") {
      const result = await polishExistingClientEmailDraft({
        user,
        request,
        draftId: body.draftId,
        polishMode: body.polishMode,
        advisorInstructions: body.advisorInstructions,
        optionCount: body.optionCount,
        speedMode: body.speedMode,
      });

      scheduleImmediateEmailWork(
        [result.jobId],
        "polish-draft",
      );

      return noStoreJson(result, { status: 202 });
    }

    if (action === "retryAiGeneration") {
      const result = await retryAiClientEmailGeneration({
        user,
        request,
        draftId: body.draftId,
      });

      scheduleImmediateEmailWork([result.jobId], "retry-custom-ai");
      return noStoreJson(result, { status: 202 });
    }

    if (action === "queueDraftsForApproval" || action === "requestApproval") {
      return noStoreJson(
        await queueClientEmailDraftsForApproval({
          user,
          request,
          draftIds: stringArray(body.draftIds),
          approvalTitle: body.approvalTitle,
        }),
        { status: 201 },
      );
    }

    if (action === "decideApproval") {
      requireSensitiveAction(request, "email-approval");
      return noStoreJson(
        await decideClientEmailApproval({
          user,
          request,
          approvalId: body.approvalId,
          decision: body.decision,
          notes: body.notes,
        }),
      );
    }

    if (action === "scheduleDrafts" || action === "sendNow") {
      requireSensitiveAction(
        request,
        action === "sendNow" ? "email-send" : "email-schedule",
      );
      return noStoreJson(
        await scheduleClientEmailDrafts({
          user,
          request,
          draftIds: stringArray(body.draftIds),
          scheduledAt: action === "sendNow" ? undefined : body.scheduledAt,
          confirmRecipients: body.confirmRecipients === true,
          confirmationText: body.confirmationText,
        }),
        { status: 202 },
      );
    }

    if (action === "approveAndSend") {
      requireSensitiveAction(request, "email-send");
      return noStoreJson(
        await sendApprovedClientEmailDrafts({
          user,
          request,
          approvalId: String(body.approvalId ?? ""),
          approvalNotes: body.approvalNotes,
        }),
        { status: 202 },
      );
    }

    if (action === "cancelDelivery") {
      requireSensitiveAction(request, "email-cancel");
      return noStoreJson(
        await cancelClientEmailDelivery({
          user,
          request,
          deliveryId: body.deliveryId,
        }),
      );
    }

    if (action === "retryDelivery") {
      requireSensitiveAction(request, "email-retry");
      return noStoreJson(
        await retryClientEmailDelivery({
          user,
          request,
          deliveryId: body.deliveryId,
        }),
        { status: 202 },
      );
    }

    if (action === "saveBranding") {
      return noStoreJson(
        await saveClientEmailBranding({
          user,
          request,
          branding: body.branding,
        }),
      );
    }

    if (action === "deleteDrafts") {
      requireSensitiveAction(request, "email-delete-draft");
      return noStoreJson(
        await deleteClientEmailDrafts({
          user,
          request,
          draftIds: stringArray(body.draftIds),
        }),
      );
    }

    if (action === "archiveDrafts" || action === "restoreDrafts") {
      return noStoreJson(
        await archiveClientEmailDrafts({
          user,
          request,
          draftIds: stringArray(body.draftIds),
          restore: action === "restoreDrafts" || body.restore === true,
        }),
      );
    }

    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_EMAIL_ACTION",
      message: "This client email action is not supported.",
      expose: true,
      details: {
        supportedActions: [
          "createManualDrafts",
          "createAiDrafts",
          "updateDraft",
          "checkpointDraft",
          "selectVersion",
          "polishDraft",
          "retryAiGeneration",
          "requestApproval",
          "decideApproval",
          "scheduleDrafts",
          "sendNow",
          "cancelDelivery",
          "retryDelivery",
          "saveBranding",
          "deleteDrafts",
          "archiveDrafts",
          "restoreDrafts",
        ],
      },
    });
  },
);