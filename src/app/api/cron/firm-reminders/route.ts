import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type ReminderDefinition = {
  firstReminderAt: string | null;
  cadence: string;
  targetMembershipId: string | null;
  notifyEmail: boolean;
  message: string;
};

type EmailResult = {
  status: string;
  reason: string;
  simulated: boolean;
};

function isVercelCronRequest(
  request: Request
) {
  return (
    request.headers.get(
      "user-agent"
    ) ?? ""
  ).includes("vercel-cron/1.0");
}

function isAuthorized(
  request: Request
) {
  if (
    isVercelCronRequest(request)
  ) {
    return true;
  }

  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    return (
      process.env.NODE_ENV !==
      "production"
    );
  }

  return (
    request.headers.get(
      "authorization"
    ) === `Bearer ${secret}` ||
    request.headers.get(
      "x-cron-secret"
    ) === secret
  );
}

function json(
  body: unknown,
  init?: ResponseInit
) {
  const response =
    NextResponse.json(body, init);

  response.headers.set(
    "Cache-Control",
    "no-store"
  );

  response.headers.set(
    "X-Slice-Cron-Route",
    "firm-reminders-v5"
  );

  return response;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ymd(date = new Date()) {
  return date
    .toISOString()
    .slice(0, 10);
}

function isComplete(
  status: string | null | undefined
) {
  return (
    status === "Complete" ||
    status === "Done"
  );
}

function isHighPriority(
  priority: string | null | undefined
) {
  return (
    priority === "Critical" ||
    priority === "High" ||
    priority === "Urgent"
  );
}

function metadata(
  lines: string[],
  key: string
) {
  const line = lines.find(
    (item) =>
      item.startsWith(`${key}=`)
  );

  return line
    ? line
        .slice(key.length + 1)
        .trim()
    : null;
}

function legacyLine(
  body: string,
  label: string
) {
  const escaped = label.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  return (
    body.match(
      new RegExp(
        `${escaped}:\\s*(.+)`,
        "i"
      )
    )?.[1]
      ?.split("\n")[0]
      ?.trim() || null
  );
}

function parseReminder(
  body: string
): ReminderDefinition {
  if (
    body.startsWith(
      "SLICE_TASK_REMINDER_V3"
    ) ||
    body.startsWith(
      "SLICE_TASK_REMINDER_V2"
    )
  ) {
    const marker = body.includes(
      "\nmessage:\n"
    )
      ? "\nmessage:\n"
      : "\nmessage:";

    const [
      metaPart,
      ...messageParts
    ] = body.split(marker);

    const lines =
      metaPart.split("\n");

    return {
      firstReminderAt:
        metadata(
          lines,
          "firstReminderAt"
        ) ||
        metadata(
          lines,
          "reminderAt"
        ),
      cadence:
        metadata(
          lines,
          "cadence"
        ) || "Daily",
      targetMembershipId:
        metadata(
          lines,
          "targetMembershipId"
        ),
      notifyEmail:
        metadata(
          lines,
          "notifyEmail"
        ) !== "false",
      message:
        messageParts
          .join(marker)
          .trim() ||
        "Please review this task and update its status in SLICE.",
    };
  }

  return {
    firstReminderAt:
      legacyLine(
        body,
        "Reminder"
      ),
    cadence:
      legacyLine(
        body,
        "Repeat interval"
      ) || "Daily",
    targetMembershipId: null,
    notifyEmail: true,
    message:
      body
        .split("\n")
        .filter((line) => {
          const lower =
            line.toLowerCase();

          return (
            !lower.startsWith(
              "reminder:"
            ) &&
            !lower.startsWith(
              "repeat interval:"
            )
          );
        })
        .join("\n")
        .trim() ||
      "Please review this task and update its status in SLICE.",
  };
}

function applyTime(
  date: Date,
  source: string
) {
  const match = source
    .toLowerCase()
    .match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/
    );

  if (!match) {
    return date;
  }

  let hour = Number(match[1]);

  const minute = Number(
    match[2] ?? 0
  );

  if (
    match[3] === "pm" &&
    hour < 12
  ) {
    hour += 12;
  }

  if (
    match[3] === "am" &&
    hour === 12
  ) {
    hour = 0;
  }

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return date;
}

function parseReminderDate(
  value: string | null,
  createdAt: Date
) {
  if (!value) {
    return null;
  }

  const exact = new Date(value);

  if (
    !Number.isNaN(exact.getTime())
  ) {
    return exact;
  }

  const raw = value.trim();
  const lower =
    raw.toLowerCase();

  if (
    lower === "now" ||
    lower.includes("asap")
  ) {
    return new Date(createdAt);
  }

  if (
    lower.includes("today")
  ) {
    return applyTime(
      new Date(createdAt),
      raw
    );
  }

  if (
    lower.includes("tomorrow")
  ) {
    const date =
      new Date(createdAt);

    date.setDate(
      date.getDate() + 1
    );

    return applyTime(
      date,
      raw
    );
  }

  const relative = lower.match(
    /in\s+(\d+)\s+(minute|minutes|hour|hours|day|days)/
  );

  if (relative) {
    const amount = Number(
      relative[1]
    );

    const date =
      new Date(createdAt);

    if (
      relative[2].startsWith(
        "minute"
      )
    ) {
      date.setMinutes(
        date.getMinutes() +
          amount
      );
    }

    if (
      relative[2].startsWith(
        "hour"
      )
    ) {
      date.setHours(
        date.getHours() +
          amount
      );
    }

    if (
      relative[2].startsWith(
        "day"
      )
    ) {
      date.setDate(
        date.getDate() +
          amount
      );
    }

    return date;
  }

  return null;
}

function addMonths(
  source: Date,
  months: number
) {
  const date =
    new Date(source);

  const targetDay =
    date.getDate();

  date.setDate(1);

  date.setMonth(
    date.getMonth() + months
  );

  const finalDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();

  date.setDate(
    Math.min(
      targetDay,
      finalDay
    )
  );

  return date;
}

function latestOccurrence(
  first: Date,
  cadence: string,
  now: Date
) {
  if (first > now) {
    return null;
  }

  const lower =
    cadence.toLowerCase();

  if (
    lower.includes("once")
  ) {
    return first;
  }

  if (
    lower.includes("month")
  ) {
    let occurrence =
      new Date(first);

    for (
      let index = 1;
      index <= 1200;
      index += 1
    ) {
      const next = addMonths(
        first,
        index
      );

      if (next > now) {
        return occurrence;
      }

      occurrence = next;
    }

    return occurrence;
  }

  const days =
    lower.includes("biweekly")
      ? 14
      : lower.includes("week")
        ? 7
        : lower.includes("2 day")
          ? 2
          : 1;

  const intervalMs =
    days * 86_400_000;

  const index = Math.floor(
    (now.getTime() -
      first.getTime()) /
      intervalMs
  );

  return new Date(
    first.getTime() +
      index * intervalMs
  );
}

async function sendResendEmail(input: {
  to: string | null | undefined;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM;

  if (!input.to) {
    return {
      status: "Skipped",
      reason:
        "No recipient email was available.",
      simulated: true,
    };
  }

  if (!apiKey || !from) {
    return {
      status: "Skipped",
      reason:
        "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.",
      simulated: true,
    };
  }

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      }
    );

    if (!response.ok) {
      const detail =
        await response.text();

      return {
        status: "Failed",
        reason:
          detail.slice(0, 1000) ||
          "Resend returned an error.",
        simulated: false,
      };
    }

    return {
      status: "Delivered",
      reason: "Sent through Resend.",
      simulated: false,
    };
  } catch (error) {
    return {
      status: "Failed",
      reason:
        error instanceof Error
          ? error.message
          : "Resend email failed.",
      simulated: false,
    };
  }
}

async function existingDelivery(
  marker: string,
  channel:
    | "Dashboard"
    | "Email"
) {
  return db.notificationDelivery.findFirst(
    {
      where: {
        channel,
        reason: {
          contains: marker,
        },
      },
    }
  );
}

async function recordDashboard(input: {
  userId: string;
  email?: string | null;
  title: string;
  body: string;
  urgency: string;
  score: number;
  marker: string;
}) {
  return db.notificationDelivery.create(
    {
      data: {
        userId: input.userId,
        alertEventId: null,
        channel: "Dashboard",
        destination:
          input.email ?? null,
        status: "Delivered",
        urgency: input.urgency,
        score: input.score,
        title: input.title,
        body: input.body,
        reason: input.marker,
        simulated: false,
        deliveredAt: new Date(),
      },
    }
  );
}

async function recordEmail(input: {
  userId: string;
  email?: string | null;
  title: string;
  body: string;
  urgency: string;
  score: number;
  marker: string;
  result: EmailResult;
}) {
  return db.notificationDelivery.create(
    {
      data: {
        userId: input.userId,
        alertEventId: null,
        channel: "Email",
        destination:
          input.email ?? null,
        status:
          input.result.status,
        urgency: input.urgency,
        score: input.score,
        title: input.title,
        body: input.body,
        reason: `${input.marker}; ${input.result.reason}`,
        simulated:
          input.result.simulated,
        deliveredAt:
          input.result.status ===
          "Delivered"
            ? new Date()
            : null,
      },
    }
  );
}

async function deliverTaskReminder(
  input: {
    task: any;
    target: any;
    definition: ReminderDefinition;
    occurrence: Date;
    reminderId: string;
  }
) {
  const baseMarker =
    `team-task-reminder:${input.reminderId}:${input.occurrence.toISOString()}`;

  const dashboardMarker =
    `${baseMarker}:dashboard`;

  const emailMarker =
    `${baseMarker}:email`;

  const overdue =
    input.task.dueDate &&
    input.task.dueDate < ymd();

  const urgency =
    overdue ||
    isHighPriority(
      input.task.priority
    )
      ? "High"
      : "Medium";

  const score =
    urgency === "High" ? 88 : 74;

  const title =
    `Task reminder: ${input.task.title}`;

  const body = [
    input.task.project?.title
      ? `Project: ${input.task.project.title}.`
      : null,
    `Status: ${input.task.status}.`,
    `Due: ${
      input.task.dueDate ||
      "No due date"
    }.`,
    `Cadence: ${input.definition.cadence} until complete.`,
    input.definition.message,
  ]
    .filter(Boolean)
    .join(" ");

  let dashboardCreated = false;

  let emailResult:
    | EmailResult
    | null = null;

  if (
    !(await existingDelivery(
      dashboardMarker,
      "Dashboard"
    ))
  ) {
    await recordDashboard({
      userId:
        input.target.userId,
      email:
        input.target.user.email,
      title,
      body,
      urgency,
      score,
      marker:
        dashboardMarker,
    });

    dashboardCreated = true;
  }

  if (
    input.definition.notifyEmail &&
    !(await existingDelivery(
      emailMarker,
      "Email"
    ))
  ) {
    emailResult =
      await sendResendEmail({
        to: input.target.user.email,
        subject: title,
        text: [
          `Hi ${
            input.target.user.name ||
            "there"
          },`,
          "",
          "This is your SLICE reminder for an open task.",
          "",
          `Task: ${input.task.title}`,
          input.task.project?.title
            ? `Project: ${input.task.project.title}`
            : null,
          `Status: ${input.task.status}`,
          `Priority: ${input.task.priority}`,
          `Due: ${
            input.task.dueDate ||
            "No due date"
          }`,
          `Reminder cadence: ${input.definition.cadence} until complete`,
          "",
          input.definition.message,
          "",
          "Open SLICE Team Board to update or complete the task. Reminders stop automatically after completion.",
        ]
          .filter(Boolean)
          .join("\n"),
        html: `
          <div style="margin:0;background:#f8fafc;padding:28px;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6">
            <div style="max-width:720px;margin:0 auto;border:1px solid #fde68a;border-radius:24px;background:#fff;overflow:hidden">
              <div style="padding:24px 28px;background:linear-gradient(135deg,#78350f,#b45309,#111827);color:#fff">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#fde68a;font-weight:800">SLICE Team Board</div>
                <h1 style="margin:8px 0 0;font-size:24px">Open task reminder</h1>
              </div>

              <div style="padding:28px">
                <div style="border:1px solid #fde68a;border-radius:18px;padding:18px;background:#fffbeb">
                  <p><strong>Task:</strong> ${escapeHtml(
                    input.task.title
                  )}</p>

                  ${
                    input.task.project
                      ?.title
                      ? `<p><strong>Project:</strong> ${escapeHtml(
                          input.task
                            .project
                            .title
                        )}</p>`
                      : ""
                  }

                  <p><strong>Status:</strong> ${escapeHtml(
                    input.task.status
                  )}</p>

                  <p><strong>Priority:</strong> ${escapeHtml(
                    input.task.priority
                  )}</p>

                  <p><strong>Due:</strong> ${escapeHtml(
                    input.task.dueDate ||
                      "No due date"
                  )}</p>

                  <p><strong>Cadence:</strong> ${escapeHtml(
                    input.definition
                      .cadence
                  )} until complete</p>
                </div>

                <p style="margin-top:18px">${escapeHtml(
                  input.definition
                    .message
                )}</p>
              </div>
            </div>
          </div>
        `,
      });

    await recordEmail({
      userId:
        input.target.userId,
      email:
        input.target.user.email,
      title,
      body,
      urgency,
      score,
      marker: emailMarker,
      result: emailResult,
    });
  }

  return {
    dashboardCreated,
    emailResult,
  };
}

async function processConfiguredReminders(
  limit: number
) {
  const comments =
    await db.agendaComment.findMany(
      {
        where: {
          commentType:
            "Timed Reminder",
        },
        include: {
          task: {
            include: {
              project: true,
              agenda: {
                include: {
                  membership: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
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
        },
        orderBy: {
          createdAt: "asc",
        },
        take: limit,
      }
    );

  const metrics = {
    scanned: 0,
    due: 0,
    dashboard: 0,
    emailDelivered: 0,
    emailSimulated: 0,
    failed: 0,
    skippedNotDue: 0,
    skippedComplete: 0,
    skippedDuplicate: 0,
  };

  for (const comment of comments) {
    metrics.scanned += 1;

    const task = comment.task;

    if (
      !task ||
      isComplete(task.status)
    ) {
      metrics.skippedComplete += 1;
      continue;
    }

    const definition =
      parseReminder(comment.body);

    const first =
      parseReminderDate(
        definition.firstReminderAt,
        comment.createdAt
      );

    if (!first) {
      metrics.skippedNotDue += 1;
      continue;
    }

    const occurrence =
      latestOccurrence(
        first,
        definition.cadence,
        new Date()
      );

    if (!occurrence) {
      metrics.skippedNotDue += 1;
      continue;
    }

    metrics.due += 1;

    const target =
      definition.targetMembershipId
        ? await db.firmMembership.findFirst(
            {
              where: {
                id: definition.targetMembershipId,
                status: "Active",
              },
              include: {
                user: true,
              },
            }
          )
        : comment.agenda
            ?.membership ??
          task.agenda
            ?.membership ??
          null;

    if (!target?.user) {
      metrics.failed += 1;
      continue;
    }

    const baseMarker =
      `team-task-reminder:${comment.id}:${occurrence.toISOString()}`;

    const dashboardExists =
      await existingDelivery(
        `${baseMarker}:dashboard`,
        "Dashboard"
      );

    const emailExists =
      definition.notifyEmail
        ? await existingDelivery(
            `${baseMarker}:email`,
            "Email"
          )
        : true;

    if (
      dashboardExists &&
      emailExists
    ) {
      metrics.skippedDuplicate += 1;
      continue;
    }

    const delivered =
      await deliverTaskReminder({
        task,
        target,
        definition,
        occurrence,
        reminderId: comment.id,
      });

    if (
      delivered.dashboardCreated
    ) {
      metrics.dashboard += 1;
    }

    if (
      delivered.emailResult
        ?.status === "Delivered"
    ) {
      metrics.emailDelivered += 1;
    } else if (
      delivered.emailResult
        ?.simulated
    ) {
      metrics.emailSimulated += 1;
    } else if (
      delivered.emailResult
        ?.status === "Failed"
    ) {
      metrics.failed += 1;
    }
  }

  return metrics;
}

async function processFallbackTasks(
  limit: number
) {
  const today = ymd();

  const tasks =
    await db.firmAgendaTask.findMany(
      {
        where: {
          dueDate: {
            lte: today,
          },
          status: {
            notIn: [
              "Complete",
              "Done",
            ],
          },
        },
        include: {
          project: true,
          comments: true,
          agenda: {
            include: {
              membership: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: limit,
      }
    );

  const metrics = {
    scanned: 0,
    delivered: 0,
    simulated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const task of tasks) {
    metrics.scanned += 1;

    if (
      task.comments.some(
        (comment: any) =>
          comment.commentType ===
          "Timed Reminder"
      )
    ) {
      metrics.skipped += 1;
      continue;
    }

    const target =
      task.agenda?.membership;

    if (!target?.user) {
      metrics.failed += 1;
      continue;
    }

    const marker =
      `team-task-fallback:${task.id}:${today}:email`;

    if (
      await existingDelivery(
        marker,
        "Email"
      )
    ) {
      metrics.skipped += 1;
      continue;
    }

    const overdue =
      task.dueDate
        ? task.dueDate < today
        : false;

    const title =
      `${
        overdue
          ? "Overdue task"
          : "Task due today"
      }: ${task.title}`;

    const body =
      `${
        task.project
          ? `Project: ${task.project.title}. `
          : ""
      }Status: ${task.status}. Due: ${
        task.dueDate ||
        "No due date"
      }. Daily fallback reminders continue until completion.`;

    const result =
      await sendResendEmail({
        to: target.user.email,
        subject: title,
        text: body,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
            <h2>${escapeHtml(
              title
            )}</h2>
            <p>${escapeHtml(
              body
            )}</p>
          </div>
        `,
      });

    await recordEmail({
      userId: target.userId,
      email: target.user.email,
      title,
      body,
      urgency:
        overdue ||
        isHighPriority(
          task.priority
        )
          ? "High"
          : "Medium",
      score:
        overdue ||
        isHighPriority(
          task.priority
        )
          ? 88
          : 72,
      marker,
      result,
    });

    if (
      result.status === "Delivered"
    ) {
      metrics.delivered += 1;
    } else if (result.simulated) {
      metrics.simulated += 1;
    } else {
      metrics.failed += 1;
    }
  }

  return metrics;
}

async function processProjectDeadlines(
  limit: number
) {
  const today = ymd();

  const soon = ymd(
    new Date(
      Date.now() +
        3 * 86_400_000
    )
  );

  const projects =
    await db.firmProject.findMany(
      {
        where: {
          dueDate: {
            not: null,
          },
          status: {
            notIn: [
              "Complete",
              "Done",
              "Archived",
            ],
          },
        },
        include: {
          firm: true,
          assignments: {
            include: {
              membership: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: limit,
      }
    );

  const metrics = {
    scanned: 0,
    delivered: 0,
    simulated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const project of projects) {
    metrics.scanned += 1;

    if (!project.dueDate) {
      metrics.skipped += 1;
      continue;
    }

    const overdue =
      project.dueDate < today;

    const dueToday =
      project.dueDate === today;

    const dueSoon =
      project.dueDate > today &&
      project.dueDate <= soon;

    if (
      !overdue &&
      !dueToday &&
      !dueSoon
    ) {
      metrics.skipped += 1;
      continue;
    }

    let targets =
      project.assignments.map(
        (assignment: any) =>
          assignment.membership
      );

    if (!targets.length) {
      targets =
        await db.firmMembership.findMany(
          {
            where: {
              firmId:
                project.firmId,
              status: "Active",
              OR: [
                {
                  role: "Owner",
                },
                {
                  role: "Admin",
                },
                {
                  canManageFirm:
                    true,
                },
              ],
            },
            include: {
              user: true,
            },
          }
        );
    }

    const label = overdue
      ? "overdue"
      : dueToday
        ? "due today"
        : "due soon";

    for (const target of targets) {
      if (!target?.user) {
        continue;
      }

      const marker =
        `project-deadline:${project.id}:${project.dueDate}:${label}:${today}:${target.userId}:email`;

      if (
        await existingDelivery(
          marker,
          "Email"
        )
      ) {
        metrics.skipped += 1;
        continue;
      }

      const title =
        `Project deadline ${label}: ${project.title}`;

      const body =
        `${project.firm.name} project deadline is ${label}. Due: ${project.dueDate}. Priority: ${project.priority}.`;

      const result =
        await sendResendEmail({
          to: target.user.email,
          subject: title,
          text: body,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
              <h2>${escapeHtml(
                title
              )}</h2>
              <p>${escapeHtml(
                body
              )}</p>
            </div>
          `,
        });

      await recordEmail({
        userId: target.userId,
        email: target.user.email,
        title,
        body,
        urgency:
          overdue || dueToday
            ? "High"
            : "Medium",
        score: overdue
          ? 92
          : dueToday
            ? 87
            : 75,
        marker,
        result,
      });

      if (
        result.status ===
        "Delivered"
      ) {
        metrics.delivered += 1;
      } else if (
        result.simulated
      ) {
        metrics.simulated += 1;
      } else {
        metrics.failed += 1;
      }
    }
  }

  return metrics;
}

export async function GET(
  request: Request
) {
  if (!isAuthorized(request)) {
    return json(
      {
        error:
          "Unauthorized cron request.",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(
    request.url
  );

  const limit = Math.max(
    1,
    Math.min(
      250,
      Number(
        url.searchParams.get(
          "limit"
        ) ?? 150
      )
    )
  );

  const [
    configured,
    fallback,
    deadlines,
  ] = await Promise.all([
    processConfiguredReminders(
      limit
    ),
    processFallbackTasks(limit),
    processProjectDeadlines(
      limit
    ),
  ]);

  return json({
    ok: true,
    route:
      "/api/cron/firm-reminders",
    version:
      "firm-reminders-v5",
    vercelCron:
      isVercelCronRequest(
        request
      ),
    limit,
    configured,
    fallback,
    deadlines,
    totals: {
      dashboard:
        configured.dashboard,
      emailDelivered:
        configured.emailDelivered +
        fallback.delivered +
        deadlines.delivered,
      emailSimulated:
        configured.emailSimulated +
        fallback.simulated +
        deadlines.simulated,
      failed:
        configured.failed +
        fallback.failed +
        deadlines.failed,
      duplicatesOrSkipped:
        configured.skippedDuplicate +
        configured.skippedNotDue +
        configured.skippedComplete +
        fallback.skipped +
        deadlines.skipped,
    },
  });
}

export async function POST(
  request: Request
) {
  return GET(request);
}