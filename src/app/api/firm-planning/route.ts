import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TASK_KINDS = ["Objective", "Goal", "Task"] as const;
type TaskKind = (typeof TASK_KINDS)[number];

function isTaskKind(value: unknown): value is TaskKind {
  return typeof value === "string" && TASK_KINDS.includes(value as TaskKind);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function detailWithKind(kind: TaskKind, detail: unknown) {
  const cleaned = cleanString(detail);
  return cleaned ? `__kind:${kind}__\n${cleaned}` : `__kind:${kind}__\n`;
}

function parseTaskDetail(detail: string | null) {
  if (!detail) {
    return { kind: "Task" as TaskKind, detail: "" };
  }

  const match = detail.match(/^__kind:(Objective|Goal|Task)__\n?/);

  if (!match || !isTaskKind(match[1])) {
    return { kind: "Task" as TaskKind, detail };
  }

  return {
    kind: match[1],
    detail: detail.replace(/^__kind:(Objective|Goal|Task)__\n?/, ""),
  };
}

function dateOnly(value: unknown) {
  const cleaned = cleanString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function weekStartFor(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

async function getActiveMembership(userId: string, firmId: string) {
  return prisma.firmMembership.findFirst({
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

function canManageProjects(membership: {
  role: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
}) {
  return (
    membership.role === "Owner" ||
    membership.canManageProjects ||
    membership.canManageFirm
  );
}

async function writeAuditLog({
  userId,
  eventType,
  title,
  detail,
  metadata,
}: {
  userId: string;
  eventType: string;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      eventType,
      severity: "Info",
      area: "Firm Planning",
      title,
      detail: detail ?? null,
      metadataJson: JSON.stringify(metadata ?? {}),
    },
  });
}

async function loadPlanning(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  requestedFirmId?: string | null
) {
  const memberships = await prisma.firmMembership.findMany({
    where: {
      userId: user.id,
      status: "Active",
    },
    include: {
      firm: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const firmId = requestedFirmId ?? memberships[0]?.firmId ?? null;

  if (!firmId) {
    return {
      user: publicUser(user),
      firms: memberships.map((membership) => ({
        ...membership.firm,
        membership,
      })),
      firm: null,
      membership: null,
      members: [],
      projects: [],
      tasks: [],
    };
  }

  const membership = await getActiveMembership(user.id, firmId);

  if (!membership) {
    return {
      user: publicUser(user),
      firms: memberships.map((item) => ({
        ...item.firm,
        membership: item,
      })),
      firm: null,
      membership: null,
      members: [],
      projects: [],
      tasks: [],
    };
  }

  const [members, projects, agendas] = await Promise.all([
    prisma.firmMembership.findMany({
      where: {
        firmId,
        status: {
          not: "Removed",
        },
      },
      include: {
        user: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),

    prisma.firmProject.findMany({
      where: {
        firmId,
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
        agendaTasks: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),

    prisma.weeklyAgenda.findMany({
      where: {
        firmId,
      },
      include: {
        membership: {
          include: {
            user: true,
          },
        },
        tasks: {
          include: {
            project: true,
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);

  const tasks = agendas.flatMap((agenda) =>
    agenda.tasks.map((task) => {
      const parsed = parseTaskDetail(task.detail);

      return {
        id: task.id,
        agendaId: task.agendaId,
        weekStart: agenda.weekStart,
        title: task.title,
        detail: parsed.detail,
        kind: parsed.kind,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        delayReason: task.delayReason,
        inquiry: task.inquiry,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        project: task.project,
        ownerId: agenda.membership.id,
        ownerName: agenda.membership.user?.name ?? "Team member",
        ownerEmail: agenda.membership.user?.email ?? "",
        ownerColor: agenda.membership.calendarColor || "#ef4444",
      };
    })
  );

  return {
    user: publicUser(user),
    firms: memberships.map((item) => ({
      ...item.firm,
      membership: item,
    })),
    firm: membership.firm,
    membership,
    members,
    projects,
    tasks,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");
  const planning = await loadPlanning(user, firmId);

  return NextResponse.json(planning);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const action = cleanString(body.action);
  const firmId = cleanString(body.firmId);

  if (!firmId) {
    return NextResponse.json(
      { error: "Firm ID is required for this action." },
      { status: 400 }
    );
  }

  const membership = await getActiveMembership(user.id, firmId);

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this firm." },
      { status: 403 }
    );
  }

  if (action === "createCalendarTask") {
    const title = cleanString(body.title);
    const dueDate = dateOnly(body.dueDate);
    const kind = isTaskKind(body.kind) ? body.kind : "Task";
    const priority = cleanString(body.priority) || "Medium";
    const targetMembershipId =
      cleanString(body.targetMembershipId) || membership.id;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: "A valid due date is required." },
        { status: 400 }
      );
    }

    if (targetMembershipId !== membership.id && !canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to assign tasks to other members." },
        { status: 403 }
      );
    }

    const targetMembership = await prisma.firmMembership.findFirst({
      where: {
        id: targetMembershipId,
        firmId,
        status: "Active",
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Assigned team member was not found." },
        { status: 404 }
      );
    }

    let projectId: string | null = null;
    const requestedProjectId = cleanString(body.projectId);

    if (requestedProjectId) {
      const project = await prisma.firmProject.findFirst({
        where: {
          id: requestedProjectId,
          firmId,
        },
      });

      projectId = project?.id ?? null;
    }

    const weekStart = weekStartFor(dueDate);

    let agenda = await prisma.weeklyAgenda.findFirst({
      where: {
        firmId,
        membershipId: targetMembership.id,
        weekStart,
        title: "Calendar Tasks",
      },
    });

    if (!agenda) {
      agenda = await prisma.weeklyAgenda.create({
        data: {
          firmId,
          membershipId: targetMembership.id,
          weekStart,
          title: "Calendar Tasks",
          focus: "Daily objectives, goals, and task commitments.",
          blockers: null,
        },
      });
    }

    const task = await prisma.firmAgendaTask.create({
      data: {
        firmId,
        agendaId: agenda.id,
        projectId,
        title,
        detail: detailWithKind(kind, body.detail),
        status: "Open",
        priority,
        dueDate,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "FirmCalendarTaskCreated",
      title: `Created ${kind.toLowerCase()}: ${title}`,
      detail: `Due ${dueDate} for ${
        targetMembership.user?.name ?? "team member"
      }.`,
      metadata: {
        firmId,
        taskId: task.id,
        kind,
        dueDate,
        targetMembershipId: targetMembership.id,
      },
    });

    return NextResponse.json(await loadPlanning(user, firmId));
  }

  if (action === "updateCalendarTask") {
    const taskId = cleanString(body.taskId);

    const task = await prisma.firmAgendaTask.findFirst({
      where: {
        id: taskId,
        firmId,
      },
      include: {
        agenda: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    if (task.agenda.membershipId !== membership.id && !canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to update this task." },
        { status: 403 }
      );
    }

    const currentDetail = parseTaskDetail(task.detail);
    const newStatus = cleanString(body.status) || task.status;
    const shouldUpdateDetail =
      typeof body.detail === "string" || typeof body.kind === "string";
    const nextKind = isTaskKind(body.kind) ? body.kind : currentDetail.kind;
    const nextDueDate =
      typeof body.dueDate === "string" ? dateOnly(body.dueDate) || null : undefined;

    await prisma.firmAgendaTask.update({
      where: {
        id: task.id,
      },
      data: {
        title:
          typeof body.title === "string" ? cleanString(body.title) : undefined,
        detail: shouldUpdateDetail
          ? detailWithKind(
              nextKind,
              typeof body.detail === "string" ? body.detail : currentDetail.detail
            )
          : undefined,
        status: newStatus,
        priority:
          typeof body.priority === "string"
            ? cleanString(body.priority) || "Medium"
            : undefined,
        dueDate: nextDueDate,
        delayReason:
          typeof body.delayReason === "string"
            ? cleanString(body.delayReason) || null
            : undefined,
        inquiry:
          typeof body.inquiry === "string"
            ? cleanString(body.inquiry) || null
            : undefined,
        completedAt:
          newStatus === "Complete" || newStatus === "Done"
            ? new Date()
            : newStatus === "Open"
              ? null
              : undefined,
      },
    });

    if (newStatus === "Complete" || newStatus === "Done") {
      await writeAuditLog({
        userId: user.id,
        eventType: "FirmCalendarTaskCompleted",
        title: `Completed task: ${task.title}`,
        detail: task.dueDate ? `Completed for ${task.dueDate}.` : undefined,
        metadata: {
          firmId,
          taskId: task.id,
        },
      });
    }

    return NextResponse.json(await loadPlanning(user, firmId));
  }

  if (action === "createFirmGoal") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to create firm goals." },
        { status: 403 }
      );
    }

    const title = cleanString(body.title);
    const startDate = dateOnly(body.startDate);
    const targetDate = dateOnly(body.targetDate);
    const description = cleanString(body.description);
    const timeframe =
      startDate || targetDate
        ? `\n\nTimeframe: ${startDate || "Start not set"} → ${
            targetDate || "Target not set"
          }`
        : "";

    if (!title) {
      return NextResponse.json(
        { error: "Firm goal title is required." },
        { status: 400 }
      );
    }

    const goal = await prisma.firmProject.create({
      data: {
        firmId,
        title,
        description: `${description}${timeframe}`.trim() || null,
        status: "On Track",
        priority: cleanString(body.priority) || "High",
        dueDate: targetDate || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "FirmGoalCreated",
      title: `Created firm goal: ${title}`,
      detail: targetDate ? `Target date: ${targetDate}.` : undefined,
      metadata: {
        firmId,
        goalId: goal.id,
        startDate,
        targetDate,
      },
    });

    return NextResponse.json(await loadPlanning(user, firmId));
  }

  if (action === "updateFirmGoal") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to update firm goals." },
        { status: 403 }
      );
    }

    const goalId = cleanString(body.goalId);

    const goal = await prisma.firmProject.findFirst({
      where: {
        id: goalId,
        firmId,
      },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Firm goal not found." },
        { status: 404 }
      );
    }

    await prisma.firmProject.update({
      where: {
        id: goal.id,
      },
      data: {
        title:
          typeof body.title === "string" ? cleanString(body.title) : undefined,
        description:
          typeof body.description === "string"
            ? cleanString(body.description) || null
            : undefined,
        status:
          typeof body.status === "string"
            ? cleanString(body.status) || "On Track"
            : undefined,
        priority:
          typeof body.priority === "string"
            ? cleanString(body.priority) || "High"
            : undefined,
        dueDate:
          typeof body.targetDate === "string"
            ? dateOnly(body.targetDate) || null
            : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "FirmGoalUpdated",
      title: `Updated firm goal: ${goal.title}`,
      detail:
        typeof body.status === "string"
          ? `Status changed to ${cleanString(body.status)}.`
          : undefined,
      metadata: {
        firmId,
        goalId: goal.id,
      },
    });

    return NextResponse.json(await loadPlanning(user, firmId));
  }

  return NextResponse.json(
    { error: "Unknown firm planning action." },
    { status: 400 }
  );
}