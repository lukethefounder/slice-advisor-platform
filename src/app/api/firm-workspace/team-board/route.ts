import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

type EmailResult = {
  status: string;
  reason: string;
  simulated: boolean;
};

function cleanText(
  value: unknown,
  fallback = ""
) {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 25_000)
    : fallback;
}

function cleanNullableText(
  value: unknown
) {
  const text = cleanText(value);

  return text || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isComplete(
  status: string | null | undefined
) {
  return (
    status === "Complete" ||
    status === "Done"
  );
}

function startOfWeek(
  dateString?: string | null
) {
  const source =
    dateString ||
    new Date()
      .toISOString()
      .slice(0, 10);

  const date = new Date(
    `${source}T12:00:00`
  );

  const day = date.getDay();

  const distance =
    day === 0 ? -6 : 1 - day;

  date.setDate(
    date.getDate() + distance
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function canManageProjects(
  membership: any
) {
  return Boolean(
    membership &&
      (membership.role === "Owner" ||
        membership.role === "Admin" ||
        membership.canManageProjects ||
        membership.canManageFirm)
  );
}

function displayName(member: any) {
  return (
    member?.user?.name ||
    member?.user?.email ||
    "Team member"
  );
}

async function getMembership(
  userId: string,
  firmId: string
) {
  return db.firmMembership.findFirst({
    where: {
      userId,
      firmId,
      status: "Active",
    },
    include: {
      firm: true,
      user: true,
    },
  });
}

async function ensureAgenda(input: {
  firmId: string;
  membershipId: string;
  memberName: string;
  weekStart: string;
}) {
  const existing =
    await db.weeklyAgenda.findFirst({
      where: {
        firmId: input.firmId,
        membershipId:
          input.membershipId,
        weekStart: input.weekStart,
      },
    });

  if (existing) {
    return existing;
  }

  return db.weeklyAgenda.create({
    data: {
      firmId: input.firmId,
      membershipId:
        input.membershipId,
      weekStart: input.weekStart,
      title: `${input.memberName}'s Weekly Agenda`,
      focus:
        "Assigned through SLICE Team Board OS.",
      blockers: null,
      status: "Open",
    },
  });
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

async function createDashboardNotification(
  input: {
    userId: string;
    email?: string | null;
    title: string;
    body: string;
    urgency: string;
    score: number;
    reason: string;
  }
) {
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
        reason: input.reason,
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
  reason: string;
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
        reason: `${input.reason}; ${input.result.reason}`,
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

function reminderBody(input: {
  firmId: string;
  taskId: string;
  targetMembershipId: string;
  firstReminderAt: string;
  cadence: string;
  createdByUserId: string;
  createdByEmail: string;
  notifyEmail: boolean;
  message: string;
}) {
  return [
    "SLICE_TASK_REMINDER_V3",
    `firmId=${input.firmId}`,
    `taskId=${input.taskId}`,
    `targetMembershipId=${input.targetMembershipId}`,
    `firstReminderAt=${input.firstReminderAt}`,
    `cadence=${input.cadence}`,
    `createdByUserId=${input.createdByUserId}`,
    `createdByEmail=${input.createdByEmail}`,
    `notifyEmail=${
      input.notifyEmail
        ? "true"
        : "false"
    }`,
    "message:",
    input.message,
  ].join("\n");
}

function readAuditLine(
  body: string | null | undefined,
  label: string
) {
  if (!body) {
    return "";
  }

  const escaped = label.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = body.match(
    new RegExp(
      `${escaped}:\\s*(.+)`,
      "i"
    )
  );

  return (
    match?.[1]
      ?.split("\n")[0]
      ?.trim() || ""
  );
}

async function findAssigner(
  task: any,
  firmId: string,
  currentUserId: string
) {
  const audit = (
    task.comments ?? []
  ).find((comment: any) =>
    String(
      comment.commentType || ""
    )
      .toLowerCase()
      .includes("assignment audit")
  );

  const userId = readAuditLine(
    audit?.body,
    "Assigned by user id"
  );

  const email = readAuditLine(
    audit?.body,
    "Assigned by email"
  );

  if (userId) {
    const found =
      await db.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (found) {
      return found;
    }
  }

  if (email) {
    const found =
      await db.user.findUnique({
        where: {
          email:
            email.toLowerCase(),
        },
      });

    if (found) {
      return found;
    }
  }

  const owner =
    await db.firmMembership.findFirst(
      {
        where: {
          firmId,
          status: "Active",
          userId: {
            not: currentUserId,
          },
          OR: [
            {
              role: "Owner",
            },
            {
              role: "Admin",
            },
            {
              canManageFirm: true,
            },
            {
              canManageProjects:
                true,
            },
          ],
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }
    );

  return owner?.user ?? null;
}

async function notifyCreated(input: {
  actor: CurrentUser;
  assignee: any;
  task: any;
  detail: string | null;
  dueDate: string;
  priority: string;
  firstReminderAt: string;
  cadence: string;
}) {
  const urgency =
    input.priority === "High" ||
    input.priority === "Critical"
      ? "High"
      : "Medium";

  const score =
    urgency === "High" ? 86 : 72;

  const title =
    `New SLICE task: ${input.task.title}`;

  const body =
    input.detail ||
    `A task was assigned to you. Due: ${input.dueDate}.`;

  const reason =
    `team-task-created:${input.task.id}`;

  await createDashboardNotification({
    userId:
      input.assignee.userId,
    email:
      input.assignee.user.email,
    title,
    body,
    urgency,
    score,
    reason,
  });

  const result =
    await sendResendEmail({
      to: input.assignee.user.email,
      subject: title,
      text: [
        `Hi ${
          input.assignee.user.name ||
          "there"
        },`,
        "",
        `${input.actor.name} assigned you a new task in SLICE.`,
        "",
        `Task: ${input.task.title}`,
        `Priority: ${input.priority}`,
        `Due: ${input.dueDate}`,
        input.detail
          ? `Details: ${input.detail}`
          : null,
        `First reminder: ${input.firstReminderAt}`,
        `Reminder cadence: ${input.cadence} until complete`,
        "",
        "Open SLICE Team Board to review and update the task.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="margin:0;background:#f8fafc;padding:28px;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6">
          <div style="max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:24px;background:#fff;overflow:hidden">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#022c22,#065f46,#111827);color:#fff">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#a7f3d0;font-weight:800">SLICE Team Board</div>
              <h1 style="margin:8px 0 0;font-size:24px">New task assigned</h1>
            </div>

            <div style="padding:28px">
              <p>${escapeHtml(
                input.actor.name
              )} assigned you a new task.</p>

              <div style="border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#f9fafb">
                <p><strong>Task:</strong> ${escapeHtml(
                  input.task.title
                )}</p>

                <p><strong>Priority:</strong> ${escapeHtml(
                  input.priority
                )}</p>

                <p><strong>Due:</strong> ${escapeHtml(
                  input.dueDate
                )}</p>

                ${
                  input.detail
                    ? `<p><strong>Details:</strong> ${escapeHtml(
                        input.detail
                      )}</p>`
                    : ""
                }

                <p><strong>First reminder:</strong> ${escapeHtml(
                  input.firstReminderAt
                )}</p>

                <p><strong>Cadence:</strong> ${escapeHtml(
                  input.cadence
                )} until complete</p>
              </div>
            </div>
          </div>
        </div>
      `,
    });

  await recordEmail({
    userId:
      input.assignee.userId,
    email:
      input.assignee.user.email,
    title,
    body,
    urgency,
    score,
    reason,
    result,
  });

  return result;
}

async function notifyCompleted(input: {
  actor: CurrentUser;
  task: any;
  recipient: any;
  role:
    | "assigner"
    | "assignee";
}) {
  const title =
    `Task completed: ${input.task.title}`;

  const body = [
    `${input.actor.name} marked a SLICE task complete.`,
    `Task: ${input.task.title}`,
    `Due: ${
      input.task.dueDate ||
      "No due date"
    }`,
    input.task.project?.title
      ? `Project: ${input.task.project.title}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const reason =
    `team-task-completed:${input.task.id}:${input.role}:${input.recipient.id}`;

  await createDashboardNotification({
    userId: input.recipient.id,
    email:
      input.recipient.email,
    title,
    body,
    urgency: "Medium",
    score: 78,
    reason,
  });

  const result =
    await sendResendEmail({
      to: input.recipient.email,
      subject: title,
      text: [
        `Hi ${
          input.recipient.name ||
          "there"
        },`,
        "",
        `${input.actor.name} completed a SLICE task.`,
        "",
        `Task: ${input.task.title}`,
        `Due: ${
          input.task.dueDate ||
          "No due date"
        }`,
        input.task.project?.title
          ? `Project: ${input.task.project.title}`
          : null,
        "",
        "Open SLICE Team Board to review the completed work.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="margin:0;background:#f8fafc;padding:28px;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6">
          <div style="max-width:720px;margin:0 auto;border:1px solid #d1fae5;border-radius:24px;background:#fff;overflow:hidden">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#064e3b,#047857,#111827);color:#fff">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#a7f3d0;font-weight:800">SLICE Team Board</div>
              <h1 style="margin:8px 0 0;font-size:24px">Task completed</h1>
            </div>

            <div style="padding:28px">
              <p>${escapeHtml(
                input.actor.name
              )} completed a task.</p>

              <div style="border:1px solid #d1fae5;border-radius:18px;padding:18px;background:#ecfdf5">
                <p><strong>Task:</strong> ${escapeHtml(
                  input.task.title
                )}</p>

                <p><strong>Due:</strong> ${escapeHtml(
                  input.task.dueDate ||
                    "No due date"
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
              </div>
            </div>
          </div>
        </div>
      `,
    });

  await recordEmail({
    userId: input.recipient.id,
    email:
      input.recipient.email,
    title,
    body,
    urgency: "Medium",
    score: 78,
    reason,
    result,
  });

  return result;
}

export async function POST(
  request: Request
) {
  const user =
    (await getCurrentUser()) as
      | CurrentUser
      | null;

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body = (
      await request
        .json()
        .catch(() => ({}))
    ) as Record<string, unknown>;

    const action = cleanText(
      body.action
    );

    const firmId = cleanText(
      body.firmId
    );

    if (!firmId) {
      return NextResponse.json(
        {
          error:
            "Firm ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const membership =
      await getMembership(
        user.id,
        firmId
      );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You are not an active member of this firm.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      action ===
      "createDelegatedTask"
    ) {
      if (
        !canManageProjects(
          membership
        )
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to delegate tasks.",
          },
          {
            status: 403,
          }
        );
      }

      const targetMembershipId =
        cleanText(
          body.targetMembershipId
        );

      const title = cleanText(
        body.title
      );

      const detail =
        cleanNullableText(
          body.detail
        );

      const priority =
        cleanText(
          body.priority,
          "Medium"
        ) || "Medium";

      const status =
        cleanText(
          body.status,
          "To Do"
        ) || "To Do";

      const dueDate =
        cleanText(body.dueDate) ||
        new Date()
          .toISOString()
          .slice(0, 10);

      const firstReminderAt =
        cleanText(
          body.reminderAt
        ) ||
        new Date().toISOString();

      const cadence =
        cleanText(
          body.reminderCadence,
          "Daily"
        ) || "Daily";

      const reminderNote =
        cleanText(
          body.reminderNote
        ) ||
        "Please review this task and update its status in SLICE.";

      if (
        !targetMembershipId ||
        !title
      ) {
        return NextResponse.json(
          {
            error:
              "Assignee and task title are required.",
          },
          {
            status: 400,
          }
        );
      }

      const target =
        await db.firmMembership.findFirst(
          {
            where: {
              id: targetMembershipId,
              firmId,
              status: "Active",
            },
            include: {
              user: true,
            },
          }
        );

      if (!target) {
        return NextResponse.json(
          {
            error:
              "Assignee not found.",
          },
          {
            status: 404,
          }
        );
      }

      const agenda =
        await ensureAgenda({
          firmId,
          membershipId: target.id,
          memberName:
            displayName(target),
          weekStart:
            startOfWeek(dueDate),
        });

      const task =
        await db.firmAgendaTask.create(
          {
            data: {
              firmId,
              agendaId: agenda.id,
              projectId:
                cleanNullableText(
                  body.projectId
                ),
              title,
              detail,
              priority,
              status,
              dueDate,
            },
          }
        );

      await db.agendaComment.create({
        data: {
          taskId: task.id,
          agendaId: agenda.id,
          userId: user.id,
          commentType:
            "Assignment Audit",
          body: [
            `Assigned by: ${user.name}`,
            `Assigned by email: ${user.email}`,
            `Assigned by user id: ${user.id}`,
            `Assigned to: ${target.user.name}`,
            `Assigned to email: ${target.user.email}`,
            `Assigned to user id: ${target.userId}`,
            `Task title: ${title}`,
            `Due date: ${dueDate}`,
            `Priority: ${priority}`,
            "Notify assigner on completion: Yes",
          ].join("\n"),
        },
      });

      await db.agendaComment.create({
        data: {
          taskId: task.id,
          agendaId: agenda.id,
          userId: user.id,
          commentType:
            "Timed Reminder",
          body: reminderBody({
            firmId,
            taskId: task.id,
            targetMembershipId:
              target.id,
            firstReminderAt,
            cadence,
            createdByUserId:
              user.id,
            createdByEmail:
              user.email,
            notifyEmail:
              body.notifyAtReminders !==
              false,
            message:
              reminderNote,
          }),
        },
      });

      const emailResult =
        body.notifyEmail === false
          ? ({
              status: "Skipped",
              reason:
                "Creation email was disabled.",
              simulated: true,
            } satisfies EmailResult)
          : await notifyCreated({
              actor: user,
              assignee: target,
              task,
              detail,
              dueDate,
              priority,
              firstReminderAt,
              cadence,
            });

      return NextResponse.json({
        ok: true,
        taskId: task.id,
        emailResult,
      });
    }

    if (
      action === "updateTask" ||
      action === "moveTask"
    ) {
      const taskId = cleanText(
        body.taskId
      );

      if (!taskId) {
        return NextResponse.json(
          {
            error:
              "Task ID is required.",
          },
          {
            status: 400,
          }
        );
      }

      const task =
        await db.firmAgendaTask.findFirst(
          {
            where: {
              id: taskId,
              firmId,
            },
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
              comments: true,
            },
          }
        );

      if (!task) {
        return NextResponse.json(
          {
            error:
              "Task not found.",
          },
          {
            status: 404,
          }
        );
      }

      const ownsTask =
        task.agenda?.membership
          ?.userId === user.id;

      if (
        !ownsTask &&
        !canManageProjects(
          membership
        )
      ) {
        return NextResponse.json(
          {
            error:
              "You can only update your own task unless you manage projects.",
          },
          {
            status: 403,
          }
        );
      }

      const nextStatus =
        cleanText(
          body.status,
          task.status
        ) || task.status;

      const wasComplete =
        isComplete(task.status);

      const willComplete =
        isComplete(nextStatus);

      await db.firmAgendaTask.update({
        where: {
          id: task.id,
        },
        data: {
          title:
            typeof body.title ===
              "string" &&
            body.title.trim()
              ? body.title.trim()
              : undefined,
          detail:
            typeof body.detail ===
            "string"
              ? body.detail.trim() ||
                null
              : undefined,
          status: nextStatus,
          priority:
            typeof body.priority ===
              "string" &&
            body.priority.trim()
              ? body.priority.trim()
              : undefined,
          dueDate:
            typeof body.dueDate ===
            "string"
              ? body.dueDate.trim() ||
                null
              : undefined,
          delayReason:
            typeof body.delayReason ===
            "string"
              ? body.delayReason.trim() ||
                null
              : undefined,
          inquiry:
            typeof body.inquiry ===
            "string"
              ? body.inquiry.trim() ||
                null
              : undefined,
          completedAt:
            willComplete
              ? new Date()
              : nextStatus ===
                    "Open" ||
                  nextStatus ===
                    "To Do"
                ? null
                : undefined,
        },
      });

      const completionEmailResults: EmailResult[] =
        [];

      if (
        willComplete &&
        !wasComplete
      ) {
        await db.agendaComment.create({
          data: {
            taskId: task.id,
            agendaId:
              task.agendaId,
            userId: user.id,
            commentType:
              "Completion Audit",
            body: [
              `Completed by: ${user.name}`,
              `Completed by email: ${user.email}`,
              `Completed at: ${new Date().toISOString()}`,
              `Task title: ${task.title}`,
              `Due date: ${
                task.dueDate ||
                "No due date"
              }`,
            ].join("\n"),
          },
        });

        const assigner =
          await findAssigner(
            task,
            firmId,
            user.id
          );

        const recipients =
          new Map<
            string,
            {
              user: any;
              role:
                | "assigner"
                | "assignee";
            }
          >();

        if (assigner) {
          recipients.set(
            assigner.id,
            {
              user: assigner,
              role: "assigner",
            }
          );
        }

        const assignee =
          task.agenda?.membership
            ?.user;

        if (assignee) {
          recipients.set(
            assignee.id,
            {
              user: assignee,
              role:
                recipients.has(
                  assignee.id
                )
                  ? "assigner"
                  : "assignee",
            }
          );
        }

        for (const recipient of recipients.values()) {
          completionEmailResults.push(
            await notifyCompleted({
              actor: user,
              task,
              recipient:
                recipient.user,
              role: recipient.role,
            })
          );
        }
      }

      return NextResponse.json({
        ok: true,
        taskId: task.id,
        completionEmailResults,
      });
    }

    if (
      action ===
      "createTimedReminder"
    ) {
      const taskId = cleanText(
        body.taskId
      );

      if (!taskId) {
        return NextResponse.json(
          {
            error:
              "Task ID is required.",
          },
          {
            status: 400,
          }
        );
      }

      const task =
        await db.firmAgendaTask.findFirst(
          {
            where: {
              id: taskId,
              firmId,
            },
            include: {
              agenda: {
                include: {
                  membership: true,
                },
              },
            },
          }
        );

      if (!task) {
        return NextResponse.json(
          {
            error:
              "Task not found.",
          },
          {
            status: 404,
          }
        );
      }

      const targetMembershipId =
        cleanText(
          body.targetMembershipId
        ) ||
        task.agenda?.membership?.id;

      if (!targetMembershipId) {
        return NextResponse.json(
          {
            error:
              "Reminder assignee not found.",
          },
          {
            status: 400,
          }
        );
      }

      await db.agendaComment.create({
        data: {
          taskId: task.id,
          agendaId:
            task.agendaId,
          userId: user.id,
          commentType:
            "Timed Reminder",
          body: reminderBody({
            firmId,
            taskId: task.id,
            targetMembershipId,
            firstReminderAt:
              cleanText(
                body.reminderAt
              ) ||
              new Date().toISOString(),
            cadence:
              cleanText(
                body.reminderCadence,
                "Daily"
              ) || "Daily",
            createdByUserId:
              user.id,
            createdByEmail:
              user.email,
            notifyEmail:
              body.notifyEmail !==
              false,
            message:
              cleanText(
                body.reminderNote
              ) ||
              "Please review this task and update its status in SLICE.",
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        taskId: task.id,
      });
    }

    return NextResponse.json(
      {
        error:
          "Unknown Team Board action.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Team Board action failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 500,
      }
    );
  }
}