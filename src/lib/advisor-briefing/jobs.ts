import "server-only";

import { ApiError } from "@/lib/api-route";
import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import {
  generateAdvisorMarketBrief,
  getAdvisorBriefPreference,
  loadAdvisorMarketBriefHistory,
  saveAdvisorBriefPreference,
} from "@/lib/advisor-briefing/persistence";
import { sendAdvisorMarketBrief } from "@/lib/advisor-briefing/email";
import { advisorBriefOccurrenceKey } from "@/lib/advisor-briefing/schedule";
import type { AdvisorMarketBriefRecord } from "@/lib/advisor-briefing/types";

type BriefJobMode = "generate" | "generate-and-send" | "send-latest";

type AdvisorBriefJobPayload = {
  schemaVersion: 1;
  mode: BriefJobMode;
  destination: string;
  force: boolean;
  scheduled: boolean;
  occurrence: string | null;
  minimumDataQuality: number | null;
  requestedAt: string;
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: unknown, maximum = 320) {
  return String(value ?? "")
    .replace(/[\r\n\u0000]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function parsePayload(value: unknown): AdvisorBriefJobPayload {
  const record = objectValue(value);
  const rawMode = clean(record.mode, 40);
  const mode: BriefJobMode =
    rawMode === "send-latest" || rawMode === "generate"
      ? rawMode
      : "generate-and-send";

  if (Number(record.schemaVersion) !== 1) {
    throw new ApiError({
      status: 400,
      code: "ADVISOR_BRIEF_JOB_PAYLOAD_INVALID",
      message: "The advisor briefing job payload is invalid.",
      expose: false,
    });
  }

  const minimumDataQuality = Number(record.minimumDataQuality);

  return {
    schemaVersion: 1,
    mode,
    destination: clean(record.destination),
    force: record.force === true,
    scheduled: record.scheduled === true,
    occurrence: clean(record.occurrence, 160) || null,
    minimumDataQuality: Number.isFinite(minimumDataQuality)
      ? Math.max(0, Math.min(100, Math.round(minimumDataQuality)))
      : null,
    requestedAt: clean(record.requestedAt, 80) || new Date().toISOString(),
  };
}

export async function executeAdvisorBriefGenerationJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const payload = parsePayload(runtime.payload);

  await runtime.reportProgress(5, "Loading advisor briefing schedule");
  await runtime.throwIfCancelled();

  const preference = await getAdvisorBriefPreference(
    context.userId,
    context.actorEmail ?? "",
  );
  const minimumDataQuality =
    payload.minimumDataQuality ?? preference.minimumDataQuality;
  let record: AdvisorMarketBriefRecord | null = null;

  if (payload.mode === "send-latest") {
    await runtime.reportProgress(22, "Loading the latest completed briefing");
    record = (await loadAdvisorMarketBriefHistory(context.userId, 1))[0] ?? null;

    if (!record) {
      throw new ApiError({
        status: 409,
        code: "ADVISOR_BRIEF_NOT_FOUND",
        message: "Generate an advisor market brief before sending it.",
        expose: true,
      });
    }
  } else {
    await runtime.reportProgress(18, "Collecting current market and research evidence");
    await runtime.throwIfCancelled();

    const generated = await generateAdvisorMarketBrief({
      userId: context.userId,
      userEmail: context.actorEmail ?? "",
      force: payload.force,
      minimumDataQuality,
    });
    record = generated.record;
  }

  if (!record) {
    throw new ApiError({
      status: 500,
      code: "ADVISOR_BRIEF_JOB_RESULT_MISSING",
      message: "The advisor briefing job did not produce a briefing record.",
      expose: false,
    });
  }

  await runtime.reportProgress(72, "Evaluating delivery requirements");
  await runtime.throwIfCancelled();

  const shouldSend =
    payload.mode === "generate-and-send" || payload.mode === "send-latest";
  const destination =
    payload.destination || preference.emailAddress || context.actorEmail || "";
  let deliveryStatus = "Generated";
  let emailResult: Awaited<ReturnType<typeof sendAdvisorMarketBrief>> | null = null;

  if (shouldSend) {
    if (!destination || !destination.includes("@")) {
      if (payload.scheduled) {
        deliveryStatus = "Withheld: missing destination";
      } else {
        throw new ApiError({
          status: 400,
          code: "ADVISOR_BRIEF_EMAIL_REQUIRED",
          message: "Save a valid advisor email address before sending the briefing.",
          expose: true,
        });
      }
    } else if (record.brief.dataQuality < minimumDataQuality) {
      deliveryStatus = `Withheld: data quality ${record.brief.dataQuality.toFixed(0)}/${minimumDataQuality}`;
    } else {
      await runtime.reportProgress(82, "Sending the advisor briefing email");
      emailResult = await sendAdvisorMarketBrief({
        userId: context.userId,
        userEmail: context.actorEmail ?? destination,
        record,
        destination,
      });
      deliveryStatus = emailResult.status;

      if (!emailResult.ok && emailResult.status === "failed") {
        throw new ApiError({
          status: 503,
          code: "ADVISOR_BRIEF_EMAIL_FAILED",
          message: emailResult.error || "Advisor briefing email delivery failed.",
          expose: false,
        });
      }
    }
  }

  const now = new Date().toISOString();
  const occurrence =
    payload.occurrence || advisorBriefOccurrenceKey(preference, new Date());

  await saveAdvisorBriefPreference(
    context.userId,
    {
      ...preference,
      lastGeneratedAt: record.brief.generatedAt,
      lastScheduledRunAt: payload.scheduled ? now : preference.lastScheduledRunAt,
      lastSentAt:
        emailResult?.status === "sent" ? now : preference.lastSentAt,
      lastDeliveryStatus: deliveryStatus,
    },
    context.actorEmail ?? destination,
  );

  await runtime.reportProgress(97, "Advisor briefing workflow complete");

  return {
    briefId: record.brief.briefId,
    recordId: record.id,
    generatedAt: record.brief.generatedAt,
    dataQuality: record.brief.dataQuality,
    destination: shouldSend ? destination : null,
    deliveryStatus,
    provider: emailResult?.provider ?? null,
    providerId: emailResult?.id ?? null,
    scheduled: payload.scheduled,
    occurrence,
    url: "/workspace/brief",
  };
}