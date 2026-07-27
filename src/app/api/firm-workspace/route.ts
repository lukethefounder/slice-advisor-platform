import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEAM_COLORS = [
  "#10b981",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#06b6d4",
];

type FirmWorkspaceBody = Record<string, unknown>;

async function getUserMembershipsWithFirm(userId: string) {
  return prisma.firmMembership.findMany({
    where: { userId, status: "Active" },
    include: { firm: true },
    orderBy: { createdAt: "desc" },
  });
}

type MembershipWithFirm = Awaited<ReturnType<typeof getUserMembershipsWithFirm>>[number];

function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function inviteCode() {
  return randomBytes(12).toString("hex").toUpperCase();
}

function firmCode(name: string) {
  const clean = name.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `${clean || "FIRM"}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

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

function cleanIdArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item: unknown) => cleanText(item))
        .filter((item): item is string => item.length > 0)
    )
  );
}

function cleanTaskInputArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is Record<string, unknown> => {
    return Boolean(item && typeof item === "object" && !Array.isArray(item));
  });
}

function dueStatus(dueDate?: string | null) {
  if (!dueDate) return "No date";

  const today = new Date().toISOString().slice(0, 10);

  if (dueDate < today) return "Overdue";
  if (dueDate === today) return "Due today";
  return "Upcoming";
}

function completeStatus(status: string) {
  return status === "Complete" || status === "Done";
}

function nextMondayString() {
  const now = new Date();
  const day = now.getDay();
  const distance = day === 0 ? 1 : 8 - day;
  const date = new Date(now);
  date.setDate(now.getDate() + distance);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateString?: string | null) {
  const source = dateString || new Date().toISOString().slice(0, 10);
  const date = new Date(`${source}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

function permissionsForRole(roleValue: string) {
  const role = roleValue.trim().toLowerCase();

  if (role === "owner") {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: true,
    };
  }

  if (
    role === "admin" ||
    role === "firm admin" ||
    role === "manager" ||
    role === "lead advisor" ||
    role === "principal"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: false,
    };
  }

  if (
    role === "advisor" ||
    role === "portfolio manager" ||
    role === "analyst" ||
    role === "operations"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  return {
    canAccessPortfolios: false,
    canManageProjects: false,
    canInviteMembers: false,
    canManageFirm: false,
  };
}

async function getActiveMembership(userId: string, firmId: string) {
  return prisma.firmMembership.findFirst({
    where: { userId, firmId, status: "Active" },
    include: { firm: true, user: true },
  });
}

function canManageFirm(membership: { role: string; canManageFirm: boolean }) {
  return membership.role === "Owner" || membership.canManageFirm;
}

function canInvite(membership: {
  role: string;
  canInviteMembers: boolean;
  canManageFirm: boolean;
}) {
  return membership.role === "Owner" || membership.canInviteMembers || membership.canManageFirm;
}

function canManageProjects(membership: {
  role: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
}) {
  return membership.role === "Owner" || membership.canManageProjects || membership.canManageFirm;
}

function extractLinks(text: string) {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)]+/g) ?? []));
}

function extractMentions(text: string) {
  const matches = text.match(/@[a-zA-Z0-9._ -]+/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map((item) => item.replace(/^@/, "").trim())
        .filter(Boolean)
    )
  );
}

function memberDisplayName(member: { user?: { name: string; email: string } | null }) {
  return member.user?.name || member.user?.email || "Team member";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  return prisma.notificationDelivery.create({
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
  return prisma.notificationDelivery.create({
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

function emptyWorkspacePayload(memberships: MembershipWithFirm[]) {
  return {
    firms: memberships.map((membership) => ({
      ...membership.firm,
      membership,
    })),
    firm: null,
    membership: null,
    members: [],
    invites: [],
    projects: [],
    agendas: [],
    posts: [],
    operations: {
      scrumStatuses: ["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"],
      allTasks: [],
      calendarTasks: [],
      unifiedMessages: [],
      ideaBoard: [],
      projectDeadlines: [],
      timedReminders: [],
      openNotifications: [],
      sprintMetrics: {
        total: 0,
        open: 0,
        inProgress: 0,
        review: 0,
        blocked: 0,
        complete: 0,
        overdue: 0,
        ideas: 0,
        deadlines: 0,
        timedReminders: 0,
      },
    },
  };
}

async function ensureAgenda(input: {
  firmId: string;
  membershipId: string;
  memberName: string;
  weekStart: string;
}) {
  const existing = await prisma.weeklyAgenda.findFirst({
    where: {
      firmId: input.firmId,
      membershipId: input.membershipId,
      weekStart: input.weekStart,
    },
  });

  if (existing) return existing;

  return prisma.weeklyAgenda.create({
    data: {
      firmId: input.firmId,
      membershipId: input.membershipId,
      weekStart: input.weekStart,
      title: `${input.memberName}'s Weekly Agenda`,
      focus: "Assigned through Slice Team Board.",
      blockers: null,
      status: "Open",
    },
  });
}

async function loadFirmWorkspace(userId: string, requestedFirmId?: string | null) {
  const memberships = await getUserMembershipsWithFirm(userId);
  const firmId = requestedFirmId ?? memberships[0]?.firmId ?? null;

  if (!firmId) return emptyWorkspacePayload(memberships);

  const membership = await getActiveMembership(userId, firmId);

  if (!membership) return emptyWorkspacePayload(memberships);

  const [members, invites, projects, agendas, posts, openNotifications] =
    await Promise.all([
      prisma.firmMembership.findMany({
        where: { firmId, status: "Active" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.firmInvite.findMany({
        where: { firmId, status: "Pending" },
        include: { sentBy: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.firmProject.findMany({
        where: { firmId },
        include: {
          assignments: {
            include: {
              membership: {
                include: { user: true },
              },
            },
          },
          agendaTasks: true,
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      }),
      prisma.weeklyAgenda.findMany({
        where: { firmId },
        include: {
          membership: {
            include: { user: true },
          },
          tasks: {
            include: {
              project: true,
              comments: {
                include: { user: true },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          },
        },
        orderBy: { weekStart: "desc" },
      }),
      prisma.firmPost.findMany({
        where: { firmId },
        include: {
          project: true,
          authorMembership: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.notificationDelivery.findMany({
        where: {
          userId,
          status: { not: "Archived" },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

  const allTasks = agendas.flatMap((agenda) =>
    agenda.tasks.map((task) => ({
      ...task,
      agendaTitle: agenda.title,
      weekStart: agenda.weekStart,
      ownerName: agenda.membership.user.name,
      ownerColor: agenda.membership.calendarColor,
      ownerId: agenda.membership.id,
      ownerUserId: agenda.membership.userId,
    }))
  );

  const today = new Date().toISOString().slice(0, 10);

  const openTasks = allTasks.filter((task) => !completeStatus(task.status));
  const completeTasks = allTasks.filter((task) => completeStatus(task.status));
  const inProgressTasks = allTasks.filter((task) => task.status === "In Progress");
  const reviewTasks = allTasks.filter((task) => task.status === "Review");
  const blockedTasks = allTasks.filter((task) => task.status === "Blocked");
  const overdueTasks = allTasks.filter(
    (task) => task.dueDate && task.dueDate < today && !completeStatus(task.status)
  );

  const calendarTasks = allTasks
    .filter((task) => Boolean(task.dueDate))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const projectDeadlines = projects
    .filter((project) => Boolean(project.dueDate))
    .map((project) => ({
      ...project,
      dueStatus: dueStatus(project.dueDate),
      assignedNames: project.assignments.map(
        (assignment) => assignment.membership.user.name
      ),
    }))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const timedReminders = allTasks.flatMap((task) =>
    (task.comments ?? [])
      .filter((comment) => {
        const type = comment.commentType.toLowerCase();
        return (
          type.includes("reminder") ||
          type.includes("timed") ||
          type.includes("follow")
        );
      })
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        commentType: comment.commentType,
        createdAt: comment.createdAt,
        taskId: task.id,
        taskTitle: task.title,
        ownerName: task.ownerName,
        dueDate: task.dueDate,
      }))
  );

  const normalizedPosts = posts.map((post) => {
    const ideaStatus = post.postType.toLowerCase().startsWith("idea:")
      ? post.postType.split(":").slice(1).join(":").trim() || "Proposed"
      : undefined;

    return {
      ...post,
      fileLinks: extractLinks(post.body),
      mentions: extractMentions(`${post.title} ${post.body}`),
      ideaStatus,
      votes: (post.body.match(/#vote/gi) ?? []).length,
    };
  });

  const ideaBoard = normalizedPosts.filter((post) => {
    const type = post.postType.toLowerCase();
    return type.includes("idea") || type.includes("brainstorm");
  });

  return {
    firms: memberships.map((item) => ({
      ...item.firm,
      membership: item,
    })),
    firm: membership.firm,
    membership,
    members,
    invites,
    projects,
    agendas,
    posts: normalizedPosts,
    operations: {
      scrumStatuses: ["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"],
      allTasks,
      calendarTasks,
      unifiedMessages: normalizedPosts,
      ideaBoard,
      projectDeadlines,
      timedReminders,
      openNotifications,
      sprintMetrics: {
        total: allTasks.length,
        open: openTasks.length,
        inProgress: inProgressTasks.length,
        review: reviewTasks.length,
        blocked: blockedTasks.length,
        complete: completeTasks.length,
        overdue: overdueTasks.length,
        ideas: ideaBoard.length,
        deadlines: projectDeadlines.length,
        timedReminders: timedReminders.length,
      },
    },
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");

  const response = NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json()) as FirmWorkspaceBody;
  const action = cleanText(body.action);
  const requestedFirmId = cleanNullableText(body.firmId);

  if (action === "createFirm") {
    const name = cleanText(body.name);

    if (!name) {
      return NextResponse.json({ error: "Firm name is required." }, { status: 400 });
    }

    const firm = await prisma.firm.create({
      data: {
        name,
        firmEmail: cleanNullableText(body.firmEmail),
        firmCode: firmCode(name),
        createdBy: {
          connect: { id: user.id },
        },
      },
    });

    await prisma.firmMembership.create({
      data: {
        firmId: firm.id,
        userId: user.id,
        role: "Owner",
        status: "Active",
        calendarColor: teamColor(0),
        canAccessPortfolios: true,
        canManageProjects: true,
        canInviteMembers: true,
        canManageFirm: true,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firm.id));
  }

  if (action === "acceptInvite") {
    const code = cleanText(body.inviteCode);

    if (!code) {
      return NextResponse.json({ error: "Invite code is required." }, { status: 400 });
    }

    const invite = await prisma.firmInvite.findFirst({
      where: { inviteCode: code, status: "Pending" },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    const memberCount = await prisma.firmMembership.count({
      where: { firmId: invite.firmId, status: "Active" },
    });

    const invitePermissions = permissionsForRole(invite.role);

    await prisma.firmMembership.upsert({
      where: {
        firmId_userId: {
          firmId: invite.firmId,
          userId: user.id,
        },
      },
      update: {
        status: "Active",
        role: invite.role,
        calendarColor: teamColor(memberCount),
        canAccessPortfolios: invitePermissions.canAccessPortfolios,
        canManageProjects: invitePermissions.canManageProjects,
        canInviteMembers: invitePermissions.canInviteMembers,
        canManageFirm: invitePermissions.canManageFirm,
      },
      create: {
        firmId: invite.firmId,
        userId: user.id,
        role: invite.role,
        status: "Active",
        calendarColor: teamColor(memberCount),
        canAccessPortfolios: invitePermissions.canAccessPortfolios,
        canManageProjects: invitePermissions.canManageProjects,
        canInviteMembers: invitePermissions.canInviteMembers,
        canManageFirm: invitePermissions.canManageFirm,
      },
    });

    await prisma.firmInvite.update({
      where: { id: invite.id },
      data: { status: "Accepted", acceptedAt: new Date() },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, invite.firmId));
  }

  if (!requestedFirmId) {
    return NextResponse.json(
      { error: "Firm ID is required for this action." },
      { status: 400 }
    );
  }

  const firmId = requestedFirmId;
  const membership = await getActiveMembership(user.id, firmId);

  if (!membership) {
    return NextResponse.json(
      { error: "You are not an active member of this firm." },
      { status: 403 }
    );
  }

  if (action === "inviteMember") {
    if (!canInvite(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to invite firm members." },
        { status: 403 }
      );
    }

    const email = cleanText(body.email).toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Invite email is required." }, { status: 400 });
    }

    const invite = await prisma.firmInvite.create({
      data: {
        firmId,
        email,
        inviteCode: inviteCode(),
        role: cleanText(body.role, "Member") || "Member",
        status: "Pending",
        sentByUserId: user.id,
      },
    });

    return NextResponse.json({
      ...(await loadFirmWorkspace(user.id, firmId)),
      createdInvite: invite,
    });
  }

  if (action === "updateMember") {
    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to update firm members." },
        { status: 403 }
      );
    }

    const membershipId = cleanText(body.membershipId);

    const target = await prisma.firmMembership.findFirst({
      where: { id: membershipId, firmId },
    });

    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    await prisma.firmMembership.update({
      where: { id: target.id },
      data: {
        role: cleanText(body.role) || undefined,
        calendarColor: cleanText(body.calendarColor) || undefined,
        canAccessPortfolios:
          typeof body.canAccessPortfolios === "boolean" ? body.canAccessPortfolios : undefined,
        canManageProjects:
          typeof body.canManageProjects === "boolean" ? body.canManageProjects : undefined,
        canInviteMembers:
          typeof body.canInviteMembers === "boolean" ? body.canInviteMembers : undefined,
        canManageFirm:
          typeof body.canManageFirm === "boolean" ? body.canManageFirm : undefined,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "removeMember") {
    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to remove firm members." },
        { status: 403 }
      );
    }

    const membershipId = cleanText(body.membershipId);

    const target = await prisma.firmMembership.findFirst({
      where: { id: membershipId, firmId },
    });

    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    if (target.role === "Owner") {
      return NextResponse.json(
        { error: "Owner access cannot be removed here." },
        { status: 403 }
      );
    }

    await prisma.firmMembership.update({
      where: { id: target.id },
      data: {
        status: "Removed",
        canAccessPortfolios: false,
        canManageProjects: false,
        canInviteMembers: false,
        canManageFirm: false,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createProject") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to manage projects." },
        { status: 403 }
      );
    }

    const title = cleanText(body.title);

    if (!title) {
      return NextResponse.json({ error: "Project title is required." }, { status: 400 });
    }

    const project = await prisma.firmProject.create({
      data: {
        firmId,
        title,
        description: cleanNullableText(body.description),
        priority: cleanText(body.priority, "Medium") || "Medium",
        dueDate: cleanDateText(body.dueDate),
      },
    });

    const assignedMembershipIds = cleanIdArray(body.assignedMembershipIds);

    if (assignedMembershipIds.length > 0) {
      const validAssignees = await prisma.firmMembership.findMany({
        where: {
          firmId,
          status: "Active",
          id: { in: assignedMembershipIds },
        },
        select: { id: true },
      });

      const projectRole = cleanText(body.projectRole, "Contributor") || "Contributor";

      await Promise.all(
        validAssignees.map((target) =>
          prisma.firmProjectAssignment.upsert({
            where: {
              projectId_membershipId: {
                projectId: project.id,
                membershipId: target.id,
              },
            },
            update: { projectRole },
            create: {
              projectId: project.id,
              membershipId: target.id,
              projectRole,
            },
          })
        )
      );
    }

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "assignProject") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to assign projects." },
        { status: 403 }
      );
    }

    const projectId = cleanText(body.projectId);
    const membershipId = cleanText(body.membershipId);

    const project = await prisma.firmProject.findFirst({
      where: { id: projectId, firmId },
    });

    const target = await prisma.firmMembership.findFirst({
      where: { id: membershipId, firmId, status: "Active" },
    });

    if (!project || !target) {
      return NextResponse.json({ error: "Project or member not found." }, { status: 404 });
    }

    const projectRole = cleanText(body.projectRole, "Contributor") || "Contributor";

    await prisma.firmProjectAssignment.upsert({
      where: {
        projectId_membershipId: {
          projectId: project.id,
          membershipId: target.id,
        },
      },
      update: { projectRole },
      create: {
        projectId: project.id,
        membershipId: target.id,
        projectRole,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createAgenda") {
    const agenda = await prisma.weeklyAgenda.create({
      data: {
        firmId,
        membershipId: membership.id,
        weekStart: cleanText(body.weekStart) || nextMondayString(),
        title: cleanText(body.title) || `${user.name}'s Weekly Agenda`,
        focus: cleanNullableText(body.focus),
        blockers: cleanNullableText(body.blockers),
      },
    });

    const tasks = cleanTaskInputArray(body.tasks);

    for (const task of tasks) {
      const title = cleanText(task.title);

      if (title) {
        await prisma.firmAgendaTask.create({
          data: {
            firmId,
            agendaId: agenda.id,
            projectId: cleanNullableText(task.projectId),
            title,
            detail: cleanNullableText(task.detail),
            priority: cleanText(task.priority, "Medium") || "Medium",
            dueDate: cleanDateText(task.dueDate),
          },
        });
      }
    }

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "addAgendaTask") {
    const agendaId = cleanText(body.agendaId);

    const agenda = await prisma.weeklyAgenda.findFirst({
      where: { id: agendaId, firmId },
    });

    if (!agenda) return NextResponse.json({ error: "Agenda not found." }, { status: 404 });

    const title = cleanText(body.title);

    if (!title) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    }

    await prisma.firmAgendaTask.create({
      data: {
        firmId,
        agendaId: agenda.id,
        projectId: cleanNullableText(body.projectId),
        title,
        detail: cleanNullableText(body.detail),
        priority: cleanText(body.priority, "Medium") || "Medium",
        dueDate: cleanDateText(body.dueDate),
        status: cleanText(body.status, "To Do") || "To Do",
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createDelegatedTask") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to delegate tasks." },
        { status: 403 }
      );
    }

    const targetMembershipId = cleanText(body.targetMembershipId);
    const title = cleanText(body.title);

    if (!targetMembershipId || !title) {
      return NextResponse.json(
        { error: "Assignee and task title are required." },
        { status: 400 }
      );
    }

    const targetMembership = await prisma.firmMembership.findFirst({
      where: { id: targetMembershipId, firmId, status: "Active" },
      include: { user: true },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Assignee not found." }, { status: 404 });
    }

    const dueDate = cleanDateText(body.dueDate) || new Date().toISOString().slice(0, 10);
    const weekStart = startOfWeek(dueDate);

    const agenda = await ensureAgenda({
      firmId,
      membershipId: targetMembership.id,
      memberName: memberDisplayName(targetMembership),
      weekStart,
    });

    const detail = cleanNullableText(body.detail);

    const task = await prisma.firmAgendaTask.create({
      data: {
        firmId,
        agendaId: agenda.id,
        projectId: cleanNullableText(body.projectId),
        title,
        detail,
        priority: cleanText(body.priority, "Medium") || "Medium",
        status: cleanText(body.status, "To Do") || "To Do",
        dueDate,
      },
    });

    const reminderAt = cleanText(body.reminderAt);
    const reminderNote = cleanText(body.reminderNote);

    if (reminderAt || reminderNote) {
      await prisma.agendaComment.create({
        data: {
          taskId: task.id,
          agendaId: agenda.id,
          userId: user.id,
          commentType: "Timed Reminder",
          body: [
            reminderAt ? `Reminder: ${reminderAt}` : null,
            reminderNote || "Please review this task and update the project workspace.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
    }

    const urgency =
      cleanText(body.priority) === "High" || cleanText(body.priority) === "Critical"
        ? "High"
        : "Medium";
    const score = urgency === "High" ? 84 : 70;

    const notificationTitle = `New Slice task: ${title}`;
    const notificationBody = detail || "A task was delegated to you in Slice.";

    await createDashboardNotification({
      targetUserId: targetMembership.userId,
      targetEmail: targetMembership.user.email,
      actorName: user.name,
      title: notificationTitle,
      body: notificationBody,
      reason: "Task delegated through firm team board.",
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
          `Priority: ${cleanText(body.priority, "Medium") || "Medium"}`,
          `Due: ${dueDate}`,
          detail ? `Details: ${detail}` : null,
          reminderAt ? `Reminder: ${reminderAt}` : null,
          "",
          "Please open Slice Team Board to review and update the task.",
        ]
          .filter(Boolean)
          .join("\n"),
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
            <h2 style="margin:0 0 12px">New Slice task assigned</h2>
            <p>${escapeHtml(user.name)} assigned you a new task in Slice Team Board.</p>
            <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#f9fafb">
              <p><strong>Task:</strong> ${escapeHtml(title)}</p>
              <p><strong>Priority:</strong> ${escapeHtml(cleanText(body.priority, "Medium") || "Medium")}</p>
              <p><strong>Due:</strong> ${escapeHtml(dueDate)}</p>
              ${detail ? `<p><strong>Details:</strong> ${escapeHtml(detail)}</p>` : ""}
              ${reminderAt ? `<p><strong>Reminder:</strong> ${escapeHtml(reminderAt)}</p>` : ""}
            </div>
            <p style="margin-top:16px">Open Slice Team Board to review, start, or complete the task.</p>
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
      ...(await loadFirmWorkspace(user.id, firmId)),
      emailResult,
    });
  }

  if (action === "updateTask" || action === "moveTask") {
    const taskId = cleanText(body.taskId);

    const task = await prisma.firmAgendaTask.findFirst({
      where: { id: taskId, firmId },
    });

    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const newStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : task.status;

    await prisma.firmAgendaTask.update({
      where: { id: task.id },
      data: {
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title.trim()
            : undefined,
        detail:
          typeof body.detail === "string" ? body.detail.trim() || null : undefined,
        status: newStatus,
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
        completedAt:
          newStatus === "Complete" || newStatus === "Done"
            ? new Date()
            : newStatus === "Open" || newStatus === "To Do"
              ? null
              : undefined,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createTimedReminder") {
    const taskId = cleanText(body.taskId);
    const reminderAt = cleanText(body.reminderAt);
    const reminderNote = cleanText(body.reminderNote);

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
    }

    const task = await prisma.firmAgendaTask.findFirst({
      where: { id: taskId, firmId },
      include: { agenda: true },
    });

    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    await prisma.agendaComment.create({
      data: {
        agendaId: task.agendaId,
        taskId: task.id,
        userId: user.id,
        commentType: "Timed Reminder",
        body: [
          reminderAt ? `Reminder: ${reminderAt}` : "Reminder requested.",
          reminderNote || "Please review this task and update the project workspace.",
        ].join("\n"),
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "addComment") {
    const commentBody = cleanText(body.body);

    if (!commentBody) {
      return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
    }

    await prisma.agendaComment.create({
      data: {
        agendaId: cleanNullableText(body.agendaId),
        taskId: cleanNullableText(body.taskId),
        userId: user.id,
        body: commentBody,
        commentType: cleanText(body.commentType, "Comment") || "Comment",
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createPost" || action === "createWorkspaceMessage") {
    const title = cleanText(body.title) || "Workspace Update";
    const postBody = cleanText(body.body);
    const fileLinks = cleanIdArray(body.fileLinks);

    if (!postBody) {
      return NextResponse.json({ error: "Post body is required." }, { status: 400 });
    }

    const enrichedBody = [
      postBody,
      fileLinks.length
        ? `\nAttachments:\n${fileLinks.map((link) => `- ${link}`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.firmPost.create({
      data: {
        firmId,
        projectId: cleanNullableText(body.projectId),
        authorMembershipId: membership.id,
        title,
        body: enrichedBody,
        postType: cleanText(body.postType, "Update") || "Update",
      },
    });

    const mentioned = extractMentions(`${title} ${postBody}`);
    const firmMembers = await prisma.firmMembership.findMany({
      where: { firmId, status: "Active" },
      include: { user: true },
    });

    const targets = mentioned.length
      ? firmMembers.filter((item) => {
          const name = item.user.name.toLowerCase();
          const email = item.user.email.toLowerCase();
          return mentioned.some((mention) => {
            const lower = mention.toLowerCase();
            return name.includes(lower) || email.includes(lower);
          });
        })
      : [];

    for (const target of targets) {
      if (target.userId === user.id) continue;

      await createDashboardNotification({
        targetUserId: target.userId,
        targetEmail: target.user.email,
        actorName: user.name,
        title: `Mentioned in workspace: ${title}`,
        body: postBody.slice(0, 500),
        reason: "Mentioned in firm universal workspace.",
        urgency: "Medium",
        score: 72,
      });
    }

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "updateIdeaStatus") {
    if (!canManageProjects(membership)) {
      return NextResponse.json(
        { error: "Only firm leaders can update idea status." },
        { status: 403 }
      );
    }

    const ideaId = cleanText(body.ideaId);
    const status = cleanText(body.status, "Review") || "Review";
    const note = cleanText(body.note);

    const idea = await prisma.firmPost.findFirst({
      where: { id: ideaId, firmId },
    });

    if (!idea) return NextResponse.json({ error: "Idea not found." }, { status: 404 });

    await prisma.firmPost.update({
      where: { id: idea.id },
      data: {
        postType: `Idea: ${status}`,
        body: [
          idea.body,
          "",
          `Status update: ${status}`,
          `Updated by: ${user.name}`,
          note ? `Note: ${note}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  return NextResponse.json({ error: "Unknown firm workspace action." }, { status: 400 });
}