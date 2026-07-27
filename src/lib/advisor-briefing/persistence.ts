import "server-only";

import type {
  AdvisorBriefPreference,
  AdvisorBriefScheduleMode,
  AdvisorMarketBrief,
  AdvisorMarketBriefRecord,
} from "@/lib/advisor-briefing/types";
import {
  BRIEF_TITLE_PREFIX,
  PREFERENCE_MEMORY_KEY,
  PREFERENCE_SUBJECT_NAME,
  PREFERENCE_SUBJECT_TYPE,
  REPORT_MARKER,
  clamp,
  cleanText,
  parseJson,
} from "@/lib/advisor-briefing/shared";
import {
  buildAdvisorMarketBriefCore,
} from "@/lib/advisor-briefing/ranking";
import {
  prisma,
} from "@/lib/prisma";

function defaultPreference(
  emailAddress = "",
): AdvisorBriefPreference {
  return {
    schemaVersion: "slice-advisor-brief-preference-1.0.0",
    enabled: false,
    scheduleMode: "Weekdays",
    intervalMinutes: 360,
    localTime: "07:00",
    weeklyDay: 1,
    timezone: "America/Phoenix",
    emailEnabled: false,
    emailAddress,
    weekdaysOnly: true,
    minimumDataQuality: 65,
    lastGeneratedAt: null,
    lastScheduledRunAt: null,
    lastSentAt: null,
    lastDeliveryStatus: null,
    updatedAt: new Date().toISOString(),
  };
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return "07:00";
  }

  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizePreference(
  value: Partial<AdvisorBriefPreference>,
  emailAddress = "",
): AdvisorBriefPreference {
  const fallback = defaultPreference(emailAddress);
  const scheduleMode: AdvisorBriefScheduleMode = [
    "Interval",
    "Daily",
    "Weekdays",
    "Weekly",
  ].includes(String(value.scheduleMode))
    ? (value.scheduleMode as AdvisorBriefScheduleMode)
    : fallback.scheduleMode;
  const timezone = cleanText(value.timezone, 100);

  return {
    schemaVersion: "slice-advisor-brief-preference-1.0.0",
    enabled: value.enabled === true,
    scheduleMode,
    intervalMinutes: Math.round(
      clamp(
        Number(value.intervalMinutes) || fallback.intervalMinutes,
        15,
        10_080,
      ),
    ),
    localTime: normalizeTime(
      String(value.localTime ?? fallback.localTime),
    ),
    weeklyDay: Math.round(
      clamp(
        Number(value.weeklyDay) || fallback.weeklyDay,
        0,
        6,
      ),
    ),
    timezone: validTimezone(timezone)
      ? timezone
      : fallback.timezone,
    emailEnabled: value.emailEnabled === true,
    emailAddress:
      cleanText(value.emailAddress, 320).toLowerCase() ||
      emailAddress,
    weekdaysOnly: value.weekdaysOnly !== false,
    minimumDataQuality: Math.round(
      clamp(
        Number(value.minimumDataQuality) ||
          fallback.minimumDataQuality,
        0,
        100,
      ),
    ),
    lastGeneratedAt:
      typeof value.lastGeneratedAt === "string" &&
      value.lastGeneratedAt
        ? value.lastGeneratedAt
        : null,
    lastScheduledRunAt:
      typeof value.lastScheduledRunAt === "string" &&
      value.lastScheduledRunAt
        ? value.lastScheduledRunAt
        : null,
    lastSentAt:
      typeof value.lastSentAt === "string" && value.lastSentAt
        ? value.lastSentAt
        : null,
    lastDeliveryStatus:
      typeof value.lastDeliveryStatus === "string" &&
      value.lastDeliveryStatus
        ? cleanText(value.lastDeliveryStatus, 100)
        : null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAdvisorBriefPreference(
  userId: string,
  emailAddress = "",
) {
  const stored = await prisma.advisorAdaptiveMemory.findUnique({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId,
        subjectType: PREFERENCE_SUBJECT_TYPE,
        subjectName: PREFERENCE_SUBJECT_NAME,
        memoryKey: PREFERENCE_MEMORY_KEY,
      },
    },
  });

  return stored
    ? normalizePreference(
        parseJson<Partial<AdvisorBriefPreference>>(
          stored.memoryValue,
          {},
        ),
        emailAddress,
      )
    : defaultPreference(emailAddress);
}

export async function saveAdvisorBriefPreference(
  userId: string,
  value: Partial<AdvisorBriefPreference>,
  emailAddress = "",
) {
  const preference = normalizePreference(value, emailAddress);

  await prisma.advisorAdaptiveMemory.upsert({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId,
        subjectType: PREFERENCE_SUBJECT_TYPE,
        subjectName: PREFERENCE_SUBJECT_NAME,
        memoryKey: PREFERENCE_MEMORY_KEY,
      },
    },
    update: {
      memoryValue: JSON.stringify(preference),
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured autonomous market-brief schedule",
      ]),
      lastAppliedAt: new Date(),
    },
    create: {
      userId,
      subjectType: PREFERENCE_SUBJECT_TYPE,
      subjectName: PREFERENCE_SUBJECT_NAME,
      memoryKey: PREFERENCE_MEMORY_KEY,
      memoryValue: JSON.stringify(preference),
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured autonomous market-brief schedule",
      ]),
      lastAppliedAt: new Date(),
    },
  });

  return preference;
}

function parseStoredBrief(record: {
  id: string;
  title: string;
  summary: string;
  status: string;
  metricsJson: string;
  createdAt: Date;
}): AdvisorMarketBriefRecord | null {
  const parsed = parseJson<{
    kind?: string;
    brief?: AdvisorMarketBrief;
  }>(record.metricsJson, {});

  if (
    parsed.kind !== REPORT_MARKER ||
    !parsed.brief ||
    parsed.brief.schemaVersion !==
      "slice-advisor-market-brief-1.0.0"
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    brief: parsed.brief,
  };
}

export async function loadAdvisorMarketBriefHistory(
  userId: string,
  take = 12,
) {
  const records = await prisma.advisorDayBrief.findMany({
    where: {
      userId,
      title: {
        startsWith: BRIEF_TITLE_PREFIX,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.max(1, Math.min(take, 50)),
  });

  return (records as Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
    metricsJson: string;
    createdAt: Date;
  }>)
    .map(parseStoredBrief)
    .filter(
      (record): record is AdvisorMarketBriefRecord =>
        record !== null,
    );
}

export async function generateAdvisorMarketBrief(input: {
  userId: string;
  userEmail: string;
  force?: boolean;
  minimumDataQuality?: number;
}) {
  const preference = await getAdvisorBriefPreference(
    input.userId,
    input.userEmail,
  );
  const brief = await buildAdvisorMarketBriefCore({
    force: input.force,
    minimumDataQuality:
      input.minimumDataQuality ??
      preference.minimumDataQuality,
  });
  const record = await prisma.advisorDayBrief.create({
    data: {
      userId: input.userId,
      title: brief.title,
      summary: brief.executiveSummary,
      topActionsJson: JSON.stringify(
        brief.overallRankedSecurities
          .slice(0, 5)
          .map(
            (security) =>
              `Review #${security.overallRank} ${security.symbol} in ${security.industryName}: ${security.explanation}`,
          ),
      ),
      metricsJson: JSON.stringify({
        kind: REPORT_MARKER,
        brief,
      }),
      status: "Generated",
    },
  });
  const updatedPreference = await saveAdvisorBriefPreference(
    input.userId,
    {
      ...preference,
      lastGeneratedAt: brief.generatedAt,
    },
    input.userEmail,
  );

  return {
    record: parseStoredBrief(record) as AdvisorMarketBriefRecord,
    preference: updatedPreference,
  };
}

export const ADVISOR_BRIEF_PREFERENCE_IDENTITY = {
  subjectType:
    PREFERENCE_SUBJECT_TYPE,
  subjectName:
    PREFERENCE_SUBJECT_NAME,
  memoryKey:
    PREFERENCE_MEMORY_KEY,
} as const;