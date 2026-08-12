import { ApiError, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  getAdvisorBriefPreference,
  loadAdvisorBriefApiPayload,
  saveAdvisorBriefPreference,
} from "@/lib/advisor-briefing/engine";
import type { AdvisorBriefPreference } from "@/lib/advisor-briefing/types";
import {
  getBackgroundJob,
  requestBackgroundJobCancellation,
  retryBackgroundJob,
} from "@/lib/background-jobs/queue";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { noStoreJson } from "@/lib/client-data-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAXIMUM_BODY_BYTES = 48_000;

type RequestBody = {
  action?: unknown;
  preference?: Partial<AdvisorBriefPreference>;
  destination?: unknown;
  force?: unknown;
  jobId?: unknown;
};

type CurrentAccessContext = Awaited<
  ReturnType<typeof requireCurrentAccessContext>
>;

type AdvisorBriefAccessContext = Omit<
  CurrentAccessContext,
  "firm"
> & {
  firm: NonNullable<
    CurrentAccessContext["firm"]
  >;
};

function clean(value: unknown, maximum = 320) {
  return typeof value === "string"
    ? value.replace(/[\r\n\u0000]+/g, " ").trim().slice(0, maximum)
    : "";
}


function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError({
      status: 415,
      code: "JSON_CONTENT_TYPE_REQUIRED",
      message: "Advisor briefing actions require a JSON request body.",
      expose: true,
    });
  }
}

async function access(): Promise<
  AdvisorBriefAccessContext
> {
  const context =
    await requireCurrentAccessContext({
      requireFirm: true,
    });

  const firm = context.firm;

  if (!firm) {
    throw new ApiError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message:
        "An active firm workspace is required.",
      expose: true,
    });
  }

  /*
   * Returning a copied context with the validated local value gives
   * downstream actions a structurally non-null firm while preserving
   * the real runtime authorization check.
   */
  return {
    ...context,
    firm,
  };
}

export const GET = withApiRoute(
  {
    route: "/api/advisor-brief",
    timeoutMs: 15_000,
  },
  async () => {
    const context = await access();

    return noStoreJson(
      await loadAdvisorBriefApiPayload({
        userId: context.user.id,
        userEmail: context.user.email,
      }),
    );
  },
);

export const POST = withApiRoute(
  {
    route: "/api/advisor-brief",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const context = await access();
    requireJson(request);
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_BYTES) {
      throw new ApiError({
        status: 413,
        code: "ADVISOR_BRIEF_REQUEST_TOO_LARGE",
        message: `Advisor brief request exceeds ${MAXIMUM_BODY_BYTES} bytes.`,
        expose: true,
      });
    }

    let body: RequestBody;

    try {
      body = JSON.parse(rawBody || "{}") as RequestBody;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_JSON_BODY",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const action = clean(body.action, 50).toLowerCase();

    if (action === "save-preference") {
      const requestedEmail = clean(
        body.preference?.emailAddress || context.user.email,
      ).toLowerCase();

      if (body.preference?.emailEnabled === true && !validEmail(requestedEmail)) {
        throw new ApiError({
          status: 400,
          code: "ADVISOR_BRIEF_EMAIL_INVALID",
          message: "Enter a valid advisor email before enabling automatic delivery.",
          expose: true,
        });
      }

      const preference = await saveAdvisorBriefPreference(
        context.user.id,
        body.preference ?? {},
        context.user.email,
      );

      return noStoreJson({
        ok: true,
        action,
        preference,
        payload: await loadAdvisorBriefApiPayload({
          userId: context.user.id,
          userEmail: context.user.email,
        }),
      });
    }

    if (action === "cancel-job") {
      const jobId = clean(body.jobId, 160);
      if (!jobId) {
        throw new ApiError({
          status: 400,
          code: "ADVISOR_BRIEF_JOB_REQUIRED",
          message: "Choose a briefing job to cancel.",
          expose: true,
        });
      }

      const job = await requestBackgroundJobCancellation({
        jobId,
        userId: context.user.id,
        firmId: context.firm.id,
      });

      return noStoreJson({ ok: true, action, job });
    }

    if (action === "retry-job") {
      const jobId = clean(body.jobId, 160);
      if (!jobId) {
        throw new ApiError({
          status: 400,
          code: "ADVISOR_BRIEF_JOB_REQUIRED",
          message: "Choose a briefing job to retry.",
          expose: true,
        });
      }

      const job = await retryBackgroundJob({
        jobId,
        userId: context.user.id,
        firmId: context.firm.id,
        resetAttempts: true,
      });

      return noStoreJson({ ok: true, action, job });
    }

    const supported = new Set([
      "generate",
      "generate-and-send",
      "send-latest",
      "run-scheduled-now",
    ]);

    if (!supported.has(action)) {
      throw new ApiError({
        status: 400,
        code: "ADVISOR_BRIEF_ACTION_UNSUPPORTED",
        message:
          "Use save-preference, generate, generate-and-send, send-latest, run-scheduled-now, cancel-job, or retry-job.",
        expose: true,
      });
    }

    const preference = body.preference
      ? await saveAdvisorBriefPreference(
          context.user.id,
          body.preference,
          context.user.email,
        )
      : await getAdvisorBriefPreference(
          context.user.id,
          context.user.email,
        );
    const mode =
      action === "generate"
        ? "generate"
        : action === "send-latest"
          ? "send-latest"
          : action === "run-scheduled-now"
            ? preference.emailEnabled
              ? "generate-and-send"
              : "generate"
            : "generate-and-send";
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const queued = await enqueueBackendJob(
      {
        userId: context.user.id,
        firmId: context.firm.id,
        actorName: context.user.name,
        actorEmail: context.user.email,
      },
      "advisor_brief_generate",
      {
        payload: {
          schemaVersion: 1,
          mode,
          destination:
            clean(body.destination) ||
            preference.emailAddress ||
            "",
          force: body.force === true,
          scheduled: action === "run-scheduled-now",
          occurrence: null,
          minimumDataQuality:
            preference.minimumDataQuality,
          requestedAt: new Date().toISOString(),
        },
        idempotencyKey: `advisor-brief:manual:${context.user.id}:${mode}:${minuteBucket}`,
      },
    );
    const job = await getBackgroundJob({
      jobId: queued.job.id,
      userId: context.user.id,
      firmId: context.firm.id,
    });

    return noStoreJson(
      {
        ok: true,
        queued: true,
        duplicate: queued.duplicate,
        action,
        job,
        message: queued.duplicate
          ? "An equivalent advisor briefing job is already active."
          : "Advisor briefing job queued. You can leave this page while it runs.",
      },
      { status: 202 },
    );
  },
);