import "server-only";

import type {
  AdvisorBriefApiPayload,
  AdvisorBriefJobView,
} from "@/lib/advisor-briefing/types";
import { BRIEF_TITLE_PREFIX } from "@/lib/advisor-briefing/shared";
import {
  getAdvisorBriefPreference,
  loadAdvisorMarketBriefHistory,
} from "@/lib/advisor-briefing/persistence";
import {
  advisorBriefScheduleLabel,
  nextAdvisorBriefRunAt,
} from "@/lib/advisor-briefing/schedule";
import { listBackgroundJobs } from "@/lib/background-jobs/queue";
import { prisma } from "@/lib/prisma";

export {
  ADVISOR_BRIEF_PREFERENCE_IDENTITY,
  generateAdvisorMarketBrief,
  getAdvisorBriefPreference,
  loadAdvisorMarketBriefHistory,
  saveAdvisorBriefPreference,
} from "@/lib/advisor-briefing/persistence";

export { sendAdvisorMarketBrief } from "@/lib/advisor-briefing/email";

export {
  advisorBriefOccurrenceKey,
  advisorBriefScheduleLabel,
  isAdvisorBriefDue,
  nextAdvisorBriefRunAt,
} from "@/lib/advisor-briefing/schedule";

function publicBriefJob(job: Awaited<ReturnType<typeof listBackgroundJobs>>[number]): AdvisorBriefJobView {
  return {
    id: job.id,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    availableAt: job.availableAt,
    completedAt: job.completedAt,
    error: job.error,
    output: job.output,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function loadAdvisorBriefApiPayload(input: {
  userId: string;
  userEmail: string;
}) {
  const [preference, history, delivery, jobs] = await Promise.all([
    getAdvisorBriefPreference(input.userId, input.userEmail),
    loadAdvisorMarketBriefHistory(input.userId, 12),
    prisma.notificationDelivery.findFirst({
      where: {
        userId: input.userId,
        channel: "Email",
        title: {
          startsWith: BRIEF_TITLE_PREFIX,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    listBackgroundJobs({
      userId: input.userId,
      limit: 12,
    }),
  ]);
  const briefJobs = jobs
    .filter((job) => job.jobKey === "advisor_brief_generate")
    .slice(0, 8)
    .map(publicBriefJob);

  return {
    ok: true,
    preference,
    latest: history[0] ?? null,
    history,
    schedule: {
      label: advisorBriefScheduleLabel(preference),
      nextRunAt: nextAdvisorBriefRunAt(preference),
      emailReady: Boolean(
        preference.emailEnabled &&
          preference.emailAddress &&
          preference.emailAddress.includes("@"),
      ),
      cronCadence: "Every 5 minutes",
    },
    jobs: briefJobs,
    delivery: delivery
      ? {
          status: delivery.status,
          destination: delivery.destination,
          createdAt: delivery.createdAt.toISOString(),
          deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
          reason: delivery.reason,
          simulated: delivery.simulated,
        }
      : null,
  } satisfies AdvisorBriefApiPayload;
}