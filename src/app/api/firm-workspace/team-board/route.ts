import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, 25000)
    : fallback;
}

function cleanNullableText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function cleanDateText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isComplete(status: string | null | undefined) {
  return status === "Complete" || status === "Done";
}

function startOfWeek(dateString?: string | null) {
  const source = dateString || new Date().toISOString().slice(0, 10);
  const date = new Date(`${source}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

function memberDisplayName(member: { user?: { name?: string | null; email?: string | null } | null }) {
  return member.user?.name || member.user?.email || "Team member";
}

function canManageProjects(membership: {
  role: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
}) {
  return membership.role === "Owner" || membership.canManageProjects || membership.canManageFirm;
}

async function getActiveMembership(userId: string, firmId: string) {
  return db.firmMembership.findFirst({
    where: { userId, firmId, status: "Active" },
    include: { firm: true, user: true },
  });
}

async function ensureAgenda(input: {
  firmId: string;
  membershipId: string;
  memberName: string;
  weekStart: string;
}) {
  const existing = await db.weeklyAgenda.findFirst({
    where: {
      firmId: input.firmId,
      membershipId: input.membershipId,
      weekStart: input.weekStart,
    },
  });

  if (existing) return existing;

  return db.weeklyAgenda.create({
    data: {
      firmId: input.firmId,
      membershipId: input.membershipId,
      weekStart: input.weekStart,
      title: `${input.memberName}'s Weekly Agenda`,
      focus: "Assigned through Slice Firm Command Center.",
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
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM;

  if (!input.to) {
    return {
      status: "Skipped",
      reason: "No recipient email was available.",
      simulated: true,
    };
  }

  if (!apiKey || !from) {
    return {
      status: "Skipped",
      reason: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.",
      simulated: true,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();

      return {
        status: "Failed",
        reason: detail.slice(0, 1000) || "Resend API returned an error.",
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
      reason: error instanceof Error ? error.message : "Resend email failed.",
      simulated: false,
    };
  }
}

async function createDashboardNotification(input: {
  targetUserId: string;
  targetEmail?: string | null;
  actorName: string;
  title: string;
  body: string;
  reason: string;
  urgency?: string;
  score?: number;
}) {
  return db.notificationDelivery.create({
    data: {
      userId: input.targetUserId,
      alertEventId: null,
      channel: "Dashboard",
      destination: input.targetEmail ?? null,
      status: "Delivered",
      urgency: input.urgency ?? "Medium",
      score: input.score ?? 70,
      title: input.title,
      body: input.body,
      reason: `${input.reason} Actor: ${input.actorName}.`,
      simulated: false,
      deliveredAt: new Date(),
    },
  });
}

async function recordEmailDelivery(input: {
  targetUserId: string;
  targetEmail?: string | null;
  title: string;
  body: string;
  urgency: string;
  score: number;
  result: Awaited<ReturnType<typeof sendResendEmail>>;
}) {
  return db.notificationDelivery.create({
    data: {
      userId: input.targetUserId,
      alertEventId: null,
      channel: "Email",
      destination: input.targetEmail ?? null,
      status: input.result.status,
      urgency: input.urgency,
      score: input.score,
      title: input.title,
      body: input.body,
      reason: input.result.reason,
      simulated: input.result.simulated,
      deliveredAt: input.result.status === "Delivered" ? new Date() : null,
    },
  });
}

function readAssignmentLine(body: string | null | undefined, label: string) {
  if (!body) return "";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match?.[1]?.split("\n")[0]?.trim() || "";
}

async function findCompletionRecipient(input: {
  firmId: string;
  currentUserId: string;
  task: any;
}) {
  const assignmentAudit = (input.task.comments ?? []).find((comment: any) =>
    String(comment.commentType || "").toLowerCase().includes("assignment"),
  );

  const assignedByUserId = readAssignmentLine(assignmentAudit?.body, "Assigned by user id");
  const assignedByEmail = readAssignmentLine(assignmentAudit?.body, "Assigned by email");

  if (assignedByUserId) {
    const user = await db.user.findUnique({
      where: { id: assignedByUserId },
    });

    if (user) return user;
  }

  if (assignedByEmail) {
    const user = await db.user.findUnique({
      where: { email: assignedByEmail.toLowerCase() },
    });

    if (user) return user;
  }

  const fallbackOwner = await db.firmMembership.findFirst({
    where: {
      firmId: input.firmId,
      status: "Active",
      userId: { not: input.currentUserId },
      OR: [
        { role: "Owner" },
        { canManageFirm: true },
        { canManageProjects: true },
      ],
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return fallbackOwner?.user ?? null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanText(body.action);
    const firmId = cleanText(body.firmId);

    if (!firmId) {
      return NextResponse.json({ error: "Firm ID is required." }, { status: 400 });
    }

    const membership = await getActiveMembership(user.id, firmId);

    if (!membership) {
      return NextResponse.json(
        { error: "You are not an active member of this firm." },
        { status: 403 },
      );
    }

    if (action === "createDelegatedTask") {
      if (!canManageProjects(membership)) {
        return NextResponse.json(
          { error: "You do not have permission to delegate tasks." },
          { status: 403 },
        );
      }

      const targetMembershipId = cleanText(body.targetMembershipId);
      const title = cleanText(body.title);
      const priority = cleanText(body.priority, "Medium") || "Medium";
      const status = cleanText(body.status, "To Do") || "To Do";
      const dueDate = cleanDateText(body.dueDate) || new Date().toISOString().slice(0, 10);
      const detail = cleanNullableText(body.detail);
      const reminderAt = cleanText(body.reminderAt);
      const reminderNote = cleanText(body.reminderNote);

      if (!targetMembershipId || !title) {
        return NextResponse.json(
          { error: "Assignee and task title are required." },
          { status: 400 },
        );
      }

      const targetMembership = await db.firmMembership.findFirst({
        where: { id: targetMembershipId, firmId, status: "Active" },
        include: { user: true },
      });

      if (!targetMembership) {
        return NextResponse.json({ error: "Assignee not found." }, { status: 404 });
      }

      const weekStart = startOfWeek(dueDate);

      const agenda = await ensureAgenda({
        firmId,
        membershipId: targetMembership.id,
        memberName: memberDisplayName(targetMembership),
        weekStart,
      });

      const task = await db.firmAgendaTask.create({
        data: {
          firmId,
          agendaId: agenda.id,
          projectId: cleanNullableText(body.projectId),
          title,
          detail,
          priority,
          status,
          dueDate,
        },
      });

      await db.agendaComment.create({
        data: {
          taskId: task.id,
          agendaId: agenda.id,
          userId: user.id,
          commentType: "Assignment Audit",
          body: [
            `Assigned by: ${user.name}`,
            `Assigned by email: ${user.email}`,
            `Assigned by user id: ${user.id}`,
            `Assigned to: ${targetMembership.user.name}`,
            `Assigned to email: ${targetMembership.user.email}`,
            `Assigned to user id: ${targetMembership.userId}`,
            `Task title: ${title}`,
            `Due date: ${dueDate}`,
            `Priority: ${priority}`,
            `Notify assigner on completion: Yes`,
          ].join("\n"),
        },
      });

      if (reminderAt || reminderNote) {
        await db.agendaComment.create({
          data: {
            taskId: task.id,
            agendaId: agenda.id,
            userId: user.id,
            commentType: "Timed Reminder",
            body: [
              reminderAt ? `Reminder: ${reminderAt}` : null,
              reminderNote || "Please review this task and update the firm command center.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        });
      }

      const urgency = priority === "High" || priority === "Critical" ? "High" : "Medium";
      const score = urgency === "High" ? 84 : 70;

      const notificationTitle = `New Slice task: ${title}`;
      const notificationBody = detail || `A task was delegated to you in Slice. Due: ${dueDate}.`;

      await createDashboardNotification({
        targetUserId: targetMembership.userId,
        targetEmail: targetMembership.user.email,
        actorName: user.name,
        title: notificationTitle,
        body: notificationBody,
        reason: "Task delegated through Slice Firm Command Center.",
        urgency,
        score,
      });

      let emailResult: Awaited<ReturnType<typeof sendResendEmail>> = {
        status: "Skipped",
        reason: "Email notification was not requested.",
        simulated: true,
      };

      if (body.notifyEmail !== false) {
        emailResult = await sendResendEmail({
          to: targetMembership.user.email,
          subject: notificationTitle,
          text: [
            `Hi ${targetMembership.user.name || "there"},`,
            "",
            `${user.name} assigned you a new Slice task.`,
            "",
            `Task: ${title}`,
            `Due date: ${dueDate}`,
            `Priority: ${priority}`,
            detail ? `Details: ${detail}` : null,
            reminderAt ? `Reminder: ${reminderAt}` : null,
            "",
            "Please open Slice Firm Command Center to review and update the task.",
          ]
            .filter(Boolean)
            .join("\n"),
          html: `
            <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin:0 0 12px">New Slice task assigned</h2>
              <p>${escapeHtml(user.name)} assigned you a new task in Slice Firm Command Center.</p>
              <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#f9fafb">
                <p><strong>Task:</strong> ${escapeHtml(title)}</p>
                <p><strong>Due date:</strong> ${escapeHtml(dueDate)}</p>
                <p><strong>Priority:</strong> ${escapeHtml(priority)}</p>
                ${detail ? `<p><strong>Details:</strong> ${escapeHtml(detail)}</p>` : ""}
                ${reminderAt ? `<p><strong>Reminder:</strong> ${escapeHtml(reminderAt)}</p>` : ""}
              </div>
              <p style="margin-top:16px">Open Slice Firm Command Center to review, start, or complete the task.</p>
            </div>
          `,
        });
      }

      await recordEmailDelivery({
        targetUserId: targetMembership.userId,
        targetEmail: targetMembership.user.email,
        title: notificationTitle,
        body: notificationBody,
        urgency,
        score,
        result: emailResult,
      });

      return NextResponse.json({
        ok: true,
        taskId: task.id,
        emailResult,
      });
    }

    if (action === "moveTask" || action === "updateTask") {
      const taskId = cleanText(body.taskId);

      if (!taskId) {
        return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
      }

      const task = await db.firmAgendaTask.findFirst({
        where: { id: taskId, firmId },
        include: {
          project: true,
          agenda: {
            include: {
              membership: {
                include: { user: true },
              },
            },
          },
          comments: true,
        },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }

      const isTaskOwner = task.agenda?.membership?.userId === user.id;

      if (!isTaskOwner && !canManageProjects(membership)) {
        return NextResponse.json(
          { error: "You can only update your own task unless you manage projects." },
          { status: 403 },
        );
      }

      const nextStatus = cleanText(body.status, task.status) || task.status;
      const wasComplete = isComplete(task.status);
      const willBeComplete = isComplete(nextStatus);

      await db.firmAgendaTask.update({
        where: { id: task.id },
        data: {
          title:
            typeof body.title === "string" && body.title.trim()
              ? body.title.trim()
              : undefined,
          detail:
            typeof body.detail === "string" ? body.detail.trim() || null : undefined,
          status: nextStatus,
          priority:
            typeof body.priority === "string" && body.priority.trim()
              ? body.priority.trim()
              : undefined,
          dueDate:
            typeof body.dueDate === "string" ? body.dueDate.trim() || null : undefined,
          delayReason:
            typeof body.delayReason === "string"
              ? body.delayReason.trim() || null
              : undefined,
          inquiry:
            typeof body.inquiry === "string" ? body.inquiry.trim() || null : undefined,
          completedAt: willBeComplete
            ? new Date()
            : nextStatus === "Open" || nextStatus === "To Do"
              ? null
              : undefined,
        },
      });

      let completionEmailResult: Awaited<ReturnType<typeof sendResendEmail>> | null = null;

      if (willBeComplete && !wasComplete) {
        await db.agendaComment.create({
          data: {
            taskId: task.id,
            agendaId: task.agendaId,
            userId: user.id,
            commentType: "Completion Audit",
            body: [
              `Completed by: ${user.name}`,
              `Completed by email: ${user.email}`,
              `Completed at: ${new Date().toISOString()}`,
              `Task title: ${task.title}`,
              `Due date: ${task.dueDate || "No due date"}`,
            ].join("\n"),
          },
        });

        const assigner = await findCompletionRecipient({
          firmId,
          currentUserId: user.id,
          task,
        });

        if (assigner) {
          const completionTitle = `Task completed: ${task.title}`;
          const completionBody = [
            `${user.name} marked a Slice task complete.`,
            `Task: ${task.title}`,
            `Due date: ${task.dueDate || "No due date"}`,
            task.project?.title ? `Project: ${task.project.title}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          await createDashboardNotification({
            targetUserId: assigner.id,
            targetEmail: assigner.email,
            actorName: user.name,
            title: completionTitle,
            body: completionBody,
            reason: "Assigned task was completed.",
            urgency: "Medium",
            score: 76,
          });

          completionEmailResult = await sendResendEmail({
            to: assigner.email,
            subject: completionTitle,
            text: [
              `Hi ${assigner.name || "there"},`,
              "",
              `${user.name} completed a Slice task you assigned or manage.`,
              "",
              `Task: ${task.title}`,
              `Due date: ${task.dueDate || "No due date"}`,
              task.project?.title ? `Project: ${task.project.title}` : null,
              "",
              "Open Slice Firm Command Center to review the completed work.",
            ]
              .filter(Boolean)
              .join("\n"),
            html: `
              <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Slice task completed</h2>
                <p>${escapeHtml(user.name)} completed a task you assigned or manage.</p>
                <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#f9fafb">
                  <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
                  <p><strong>Due date:</strong> ${escapeHtml(task.dueDate || "No due date")}</p>
                  ${task.project?.title ? `<p><strong>Project:</strong> ${escapeHtml(task.project.title)}</p>` : ""}
                </div>
                <p style="margin-top:16px">Open Slice Firm Command Center to review the completed work.</p>
              </div>
            `,
          });

          await recordEmailDelivery({
            targetUserId: assigner.id,
            targetEmail: assigner.email,
            title: completionTitle,
            body: completionBody,
            urgency: "Medium",
            score: 76,
            result: completionEmailResult,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        completionEmailResult,
      });
    }

    return NextResponse.json({ error: "Unknown Firm Command Center action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Firm Command Center action failed.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}