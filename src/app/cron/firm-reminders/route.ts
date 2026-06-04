import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParsedReminder = {
  firmId: string | null;
  taskId: string | null;
  targetMembershipId: string | null;
  reminderAt: string | null;
  createdBy: string | null;
  message: string;
};

function isVercelCronRequest(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.includes("vercel-cron/1.0");
}

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecretHeader = request.headers.get("x-cron-secret") ?? "";

  if (isVercelCronRequest(request)) return true;

  if (secret) {
    return authorization === `Bearer ${secret}` || cronSecretHeader === secret;
  }

  return process.env.NODE_ENV !== "production";
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Slice-Cron-Route", "firm-reminders-v2");
  return response;
}

function parseReminder(body: string): ParsedReminder {
  if (!body.startsWith("SLICE_TIMED_REMINDER_V1")) {
    return {
      firmId: null,
      taskId: null,
      targetMembershipId: null,
      reminderAt: null,
      createdBy: null,
      message: body,
    };
  }

  const [metaPart, ...messageParts] = body.split("\nmessage:");
  const lines = metaPart.split("\n");

  const get = (key: string) => {
    const prefix = `${key}=`;
    const line = lines.find((item) => item.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : null;
  };

  return {
    firmId: get("firmId"),
    taskId: get("taskId"),
    targetMembershipId: get("targetMembershipId"),
    reminderAt: get("reminderAt"),
    createdBy: get("createdBy"),
    message: messageParts.join("\nmessage:").trim() || "Timed reminder due.",
  };
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return ymd(a) === ymd(b);
}

function nextWeekdayDate(base: Date, weekday: number) {
  const date = new Date(base);
  const current = date.getDay();
  let distance = weekday - current;

  if (distance < 0) distance += 7;
  if (distance === 0) distance = 0;

  date.setDate(date.getDate() + distance);
  return date;
}

function applyTime(date: Date, source: string) {
  const lower = source.toLowerCase();
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (!match) return date;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridian = match[3];

  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  date.setHours(hour, minute, 0, 0);
  return date;
}

function parseReminderDate(reminderAt: string | null, baseDate: Date) {
  if (!reminderAt) return null;

  const raw = reminderAt.trim();
  const lower = raw.toLowerCase();

  const exact = new Date(raw);

  if (!Number.isNaN(exact.getTime())) return exact;

  if (lower === "now" || lower.includes("asap")) return new Date(baseDate);

  if (lower.includes("today")) {
    const date = new Date(baseDate);
    return applyTime(date, raw);
  }

  if (lower.includes("tomorrow")) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + 1);
    return applyTime(date, raw);
  }

  const relativeMatch = lower.match(/in\s+(\d+)\s+(minute|minutes|hour|hours|day|days)/);

  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const date = new Date(baseDate);

    if (unit.startsWith("minute")) date.setMinutes(date.getMinutes() + amount);
    if (unit.startsWith("hour")) date.setHours(date.getHours() + amount);
    if (unit.startsWith("day")) date.setDate(date.getDate() + amount);

    return date;
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  for (const [name, day] of Object.entries(weekdays)) {
    if (lower.includes(name)) {
      const date = nextWeekdayDate(baseDate, day);
      return applyTime(date, raw);
    }
  }

  return null;
}

function reminderDue(reminderAt: string | null, createdAt: Date, now = new Date()) {
  const parsed = parseReminderDate(reminderAt, createdAt);

  if (!parsed) return false;

  return parsed <= now || sameDay(parsed, now);
}

function notificationDedupeReason(prefix: string, id: string, extra = "") {
  return `${prefix}:${id}${extra ? `:${extra}` : ""}`;
}

async function processTimedReminders(limit: number) {
  const comments = await prisma.agendaComment.findMany({
    where: {
      commentType: "Timed Reminder",
    },
    include: {
      task: {
        include: {
          agenda: {
            include: {
              membership: {
                include: {
                  user: true,
                },
              },
            },
          },
          project: true,
        },
      },
      agenda: {
        include: {
          membership: {
            include: {
              user: true,
            },
          },
        },
      },
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  let scanned = 0;
  let due = 0;
  let delivered = 0;
  let skippedNotDue = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  for (const comment of comments) {
    scanned += 1;

    const parsed = parseReminder(comment.body);

    if (!reminderDue(parsed.reminderAt, comment.createdAt)) {
      skippedNotDue += 1;
      continue;
    }

    due += 1;

    const task = comment.task;
    const agenda = comment.agenda ?? task?.agenda ?? null;

    const targetMembership =
      parsed.targetMembershipId
        ? await prisma.firmMembership.findFirst({
            where: {
              id: parsed.targetMembershipId,
              status: "Active",
            },
            include: {
              user: true,
            },
          })
        : agenda?.membership ?? null;

    if (!targetMembership) {
      failed += 1;
      continue;
    }

    const reasonKey = notificationDedupeReason("timed-reminder", comment.id);

    const existing = await prisma.notificationDelivery.findFirst({
      where: {
        userId: targetMembership.userId,
        channel: "Dashboard",
        reason: {
          contains: reasonKey,
        },
      },
    });

    if (existing) {
      skippedDuplicate += 1;
      continue;
    }

    const title = task
      ? `Timed reminder: ${task.title}`
      : "Timed workspace reminder";

    const projectLine = task?.project ? `Project: ${task.project.title}. ` : "";
    const dueLine = task?.dueDate ? `Task due: ${task.dueDate}. ` : "";

    await prisma.notificationDelivery.create({
      data: {
        userId: targetMembership.userId,
        alertEventId: null,
        channel: "Dashboard",
        destination: targetMembership.user?.email ?? null,
        status: "Delivered",
        urgency:
          task?.priority === "High" || task?.priority === "Critical"
            ? "High"
            : "Medium",
        score:
          task?.priority === "High" || task?.priority === "Critical" ? 84 : 70,
        title,
        body: `${projectLine}${dueLine}${parsed.message}`,
        reason: `${reasonKey}; createdBy:${parsed.createdBy ?? comment.user.email}`,
        simulated: false,
        deliveredAt: new Date(),
      },
    });

    delivered += 1;
  }

  return {
    scannedTimedReminders: scanned,
    dueTimedReminders: due,
    deliveredTimedReminders: delivered,
    skippedTimedNotDue: skippedNotDue,
    skippedTimedDuplicate: skippedDuplicate,
    failedTimedReminders: failed,
  };
}

async function processProjectDeadlines(limit: number) {
  const today = ymd(new Date());
  const soon = ymd(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  const projects = await prisma.firmProject.findMany({
    where: {
      dueDate: {
        not: null,
      },
      status: {
        notIn: ["Complete", "Done", "Archived"],
      },
    },
    include: {
      assignments: {
        include: {
          membership: {
            include: {
              user: true,
            },
          },
        },
      },
      firm: true,
    },
    orderBy: {
      dueDate: "asc",
    },
    take: limit,
  });

  let scanned = 0;
  let delivered = 0;
  let skippedNotDue = 0;
  let skippedDuplicate = 0;

  for (const project of projects) {
    scanned += 1;

    if (!project.dueDate) {
      skippedNotDue += 1;
      continue;
    }

    const isOverdue = project.dueDate < today;
    const isDueToday = project.dueDate === today;
    const isDueSoon = project.dueDate > today && project.dueDate <= soon;

    if (!isOverdue && !isDueToday && !isDueSoon) {
      skippedNotDue += 1;
      continue;
    }

    let targets = project.assignments.map((assignment) => assignment.membership);

    if (!targets.length) {
      targets = await prisma.firmMembership.findMany({
        where: {
          firmId: project.firmId,
          status: "Active",
          OR: [{ role: "Owner" }, { role: "Admin" }, { canManageFirm: true }],
        },
        include: {
          user: true,
        },
      });
    }

    const urgency = isOverdue || isDueToday ? "High" : "Medium";
    const score = isOverdue ? 90 : isDueToday ? 86 : 74;
    const dueLabel = isOverdue
      ? "overdue"
      : isDueToday
        ? "due today"
        : "due soon";

    for (const target of targets) {
      const reasonKey = notificationDedupeReason(
        "project-deadline",
        project.id,
        `${project.dueDate}-${dueLabel}`
      );

      const existing = await prisma.notificationDelivery.findFirst({
        where: {
          userId: target.userId,
          channel: "Dashboard",
          reason: {
            contains: reasonKey,
          },
        },
      });

      if (existing) {
        skippedDuplicate += 1;
        continue;
      }

      await prisma.notificationDelivery.create({
        data: {
          userId: target.userId,
          alertEventId: null,
          channel: "Dashboard",
          destination: target.user?.email ?? null,
          status: "Delivered",
          urgency,
          score,
          title: `Project deadline ${dueLabel}: ${project.title}`,
          body: `${project.firm.name} project deadline is ${dueLabel}. Due date: ${project.dueDate}. Priority: ${project.priority}.`,
          reason: reasonKey,
          simulated: false,
          deliveredAt: new Date(),
        },
      });

      delivered += 1;
    }
  }

  return {
    scannedProjectDeadlines: scanned,
    deliveredProjectDeadlineNotifications: delivered,
    skippedProjectNotDue: skippedNotDue,
    skippedProjectDuplicate: skippedDuplicate,
  };
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return json(
      {
        error: "Unauthorized cron request.",
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(250, Number(url.searchParams.get("limit") ?? 100))
  );

  const [timed, deadlines] = await Promise.all([
    processTimedReminders(limit),
    processProjectDeadlines(limit),
  ]);

  return json({
    ok: true,
    route: "/api/cron/firm-reminders",
    version: "firm-reminders-v2",
    vercelCron: isVercelCronRequest(request),
    limit,
    ...timed,
    ...deadlines,
    totals: {
      delivered:
        timed.deliveredTimedReminders +
        deadlines.deliveredProjectDeadlineNotifications,
      duplicates:
        timed.skippedTimedDuplicate + deadlines.skippedProjectDuplicate,
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}