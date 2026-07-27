import "server-only";

import type {
  AdvisorBriefApiPayload,
} from "@/lib/advisor-briefing/types";
import {
  BRIEF_TITLE_PREFIX,
} from "@/lib/advisor-briefing/shared";
import {
  getAdvisorBriefPreference,
  loadAdvisorMarketBriefHistory,
} from "@/lib/advisor-briefing/persistence";
import {
  prisma,
} from "@/lib/prisma";

export {
  ADVISOR_BRIEF_PREFERENCE_IDENTITY,
  generateAdvisorMarketBrief,
  getAdvisorBriefPreference,
  loadAdvisorMarketBriefHistory,
  saveAdvisorBriefPreference,
} from "@/lib/advisor-briefing/persistence";

export {
  sendAdvisorMarketBrief,
} from "@/lib/advisor-briefing/email";

export {
  advisorBriefScheduleLabel,
  isAdvisorBriefDue,
} from "@/lib/advisor-briefing/schedule";

export async function loadAdvisorBriefApiPayload(input: {
  userId: string;
  userEmail: string;
}) {
  const [
    preference,
    history,
    delivery,
  ] = await Promise.all([
    getAdvisorBriefPreference(
      input.userId,
      input.userEmail,
    ),
    loadAdvisorMarketBriefHistory(
      input.userId,
      12,
    ),
    prisma.notificationDelivery.findFirst({
      where: {
        userId:
          input.userId,
        channel:
          "Email",
        title: {
          startsWith:
            BRIEF_TITLE_PREFIX,
        },
      },
      orderBy: {
        createdAt:
          "desc",
      },
    }),
  ]);

  return {
    ok:
      true,
    preference,
    latest:
      history[0] ??
      null,
    history,
    delivery:
      delivery
        ? {
            status:
              delivery.status,
            destination:
              delivery.destination,
            createdAt:
              delivery.createdAt.toISOString(),
            deliveredAt:
              delivery.deliveredAt?.toISOString() ??
              null,
            reason:
              delivery.reason,
            simulated:
              delivery.simulated,
          }
        : null,
  } satisfies AdvisorBriefApiPayload;
}