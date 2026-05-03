import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TEAM_COLORS = [
  "#ef4444",
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

function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function inviteCode() {
  return randomBytes(12).toString("hex").toUpperCase();
}

function firmCode(name: string) {
  const clean = name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

  return `${clean || "FIRM"}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function nextMondayString() {
  const now = new Date();
  const day = now.getDay();
  const distance = day === 0 ? 1 : 8 - day;
  const date = new Date(now);
  date.setDate(now.getDate() + distance);
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

function canManageFirm(membership: {
  role: string;
  canManageFirm: boolean;
}) {
  return membership.role === "Owner" || membership.canManageFirm;
}

function canInvite(membership: {
  role: string;
  canInviteMembers: boolean;
  canManageFirm: boolean;
}) {
  return (
    membership.role === "Owner" ||
    membership.canInviteMembers ||
    membership.canManageFirm
  );
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

async function loadFirmWorkspace(userId: string, requestedFirmId?: string | null) {
  const memberships = await prisma.firmMembership.findMany({
    where: {
      userId,
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
    };
  }

  const membership = await getActiveMembership(userId, firmId);

  if (!membership) {
    return {
      firms: memberships.map((item) => ({
        ...item.firm,
        membership: item,
      })),
      firm: null,
      membership: null,
      members: [],
      invites: [],
      projects: [],
      agendas: [],
      posts: [],
    };
  }

  const [members, invites, projects, agendas, posts] = await Promise.all([
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

    prisma.firmInvite.findMany({
      where: {
        firmId,
      },
      include: {
        sentBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
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
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
            comments: {
              include: {
                user: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
        comments: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),

    prisma.firmPost.findMany({
      where: {
        firmId,
      },
      include: {
        project: true,
        authorMembership: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
    }),
  ]);

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
    posts,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");

  const workspace = await loadFirmWorkspace(user.id, firmId);

  return NextResponse.json(workspace);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "createFirm") {
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Firm name is required." },
        { status: 400 }
      );
    }

    const firm = await prisma.firm.create({
      data: {
        name: body.name.trim(),
        firmEmail: body.firmEmail?.trim() || null,
        firmCode: firmCode(body.name),
        createdByUserId: user.id,
      },
    });

    await prisma.firmMembership.create({
      data: {
        firmId: firm.id,
        userId: user.id,
        role: "Owner",
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
    if (!body.inviteCode?.trim()) {
      return NextResponse.json(
        { error: "Invite code is required." },
        { status: 400 }
      );
    }

    const invite = await prisma.firmInvite.findUnique({
      where: {
        inviteCode: body.inviteCode.trim().toUpperCase(),
      },
      include: {
        firm: true,
      },
    });

    if (!invite || invite.status !== "Pending") {
      return NextResponse.json(
        { error: "Invite not found or no longer pending." },
        { status: 404 }
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired." },
        { status: 410 }
      );
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "This invite was sent to a different email. Log in with that email or ask for a new invite.",
        },
        { status: 403 }
      );
    }

    const memberCount = await prisma.firmMembership.count({
      where: {
        firmId: invite.firmId,
      },
    });

    const permissionPreset =
      invite.role === "Admin"
        ? {
            canAccessPortfolios: true,
            canManageProjects: true,
            canInviteMembers: true,
            canManageFirm: false,
          }
        : invite.role === "Advisor"
          ? {
              canAccessPortfolios: true,
              canManageProjects: true,
              canInviteMembers: false,
              canManageFirm: false,
            }
          : invite.role === "Viewer"
            ? {
                canAccessPortfolios: false,
                canManageProjects: false,
                canInviteMembers: false,
                canManageFirm: false,
              }
            : {
                canAccessPortfolios: true,
                canManageProjects: false,
                canInviteMembers: false,
                canManageFirm: false,
              };

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
        ...permissionPreset,
      },
      create: {
        firmId: invite.firmId,
        userId: user.id,
        role: invite.role,
        calendarColor: teamColor(memberCount),
        ...permissionPreset,
      },
    });

    await prisma.firmInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        status: "Accepted",
        acceptedAt: new Date(),
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, invite.firmId));
  }

  const firmId = body.firmId as string | undefined;

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

  if (action === "createInvite") {
    if (!canInvite(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to invite members." },
        { status: 403 }
      );
    }

    if (!body.email?.trim()) {
      return NextResponse.json(
        { error: "Invite email is required." },
        { status: 400 }
      );
    }

    const code = inviteCode();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invite = await prisma.firmInvite.create({
      data: {
        firmId,
        email: body.email.trim().toLowerCase(),
        role: body.role?.trim() || "Member",
        inviteCode: code,
        expiresAt,
        sentByUserId: user.id,
      },
    });

    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ...(await loadFirmWorkspace(user.id, firmId)),
      inviteCode: invite.inviteCode,
      inviteLink: `${origin}/workspace?invite=${invite.inviteCode}`,
    });
  }

  if (action === "updateMember") {
    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to manage firm members." },
        { status: 403 }
      );
    }

    const target = await prisma.firmMembership.findFirst({
      where: {
        id: body.membershipId,
        firmId,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (target.role === "Owner" && target.userId !== user.id) {
      return NextResponse.json(
        { error: "The owner role cannot be changed by another user." },
        { status: 403 }
      );
    }

    await prisma.firmMembership.update({
      where: {
        id: target.id,
      },
      data: {
        role: typeof body.role === "string" ? body.role : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        calendarColor:
          typeof body.calendarColor === "string" ? body.calendarColor : undefined,
        canAccessPortfolios:
          typeof body.canAccessPortfolios === "boolean"
            ? body.canAccessPortfolios
            : undefined,
        canManageProjects:
          typeof body.canManageProjects === "boolean"
            ? body.canManageProjects
            : undefined,
        canInviteMembers:
          typeof body.canInviteMembers === "boolean"
            ? body.canInviteMembers
            : undefined,
        canManageFirm:
          typeof body.canManageFirm === "boolean"
            ? body.canManageFirm
            : undefined,
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

    const target = await prisma.firmMembership.findFirst({
      where: {
        id: body.membershipId,
        firmId,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (target.role === "Owner") {
      return NextResponse.json(
        { error: "Owner access cannot be removed here." },
        { status: 403 }
      );
    }

    await prisma.firmMembership.update({
      where: {
        id: target.id,
      },
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

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Project title is required." },
        { status: 400 }
      );
    }

    const project = await prisma.firmProject.create({
      data: {
        firmId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority: body.priority?.trim() || "Medium",
        dueDate: body.dueDate?.trim() || null,
      },
    });

    const assignedMembershipIds = Array.isArray(body.assignedMembershipIds)
      ? body.assignedMembershipIds
      : [];

    for (const membershipId of assignedMembershipIds) {
      const target = await prisma.firmMembership.findFirst({
        where: {
          id: membershipId,
          firmId,
          status: "Active",
        },
      });

      if (target) {
        await prisma.firmProjectAssignment.upsert({
          where: {
            projectId_membershipId: {
              projectId: project.id,
              membershipId: target.id,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            membershipId: target.id,
            projectRole: "Contributor",
          },
        });
      }
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

    const project = await prisma.firmProject.findFirst({
      where: {
        id: body.projectId,
        firmId,
      },
    });

    const target = await prisma.firmMembership.findFirst({
      where: {
        id: body.membershipId,
        firmId,
        status: "Active",
      },
    });

    if (!project || !target) {
      return NextResponse.json(
        { error: "Project or member not found." },
        { status: 404 }
      );
    }

    await prisma.firmProjectAssignment.upsert({
      where: {
        projectId_membershipId: {
          projectId: project.id,
          membershipId: target.id,
        },
      },
      update: {
        projectRole: body.projectRole?.trim() || "Contributor",
      },
      create: {
        projectId: project.id,
        membershipId: target.id,
        projectRole: body.projectRole?.trim() || "Contributor",
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createAgenda") {
    const agenda = await prisma.weeklyAgenda.create({
      data: {
        firmId,
        membershipId: membership.id,
        weekStart: body.weekStart?.trim() || nextMondayString(),
        title: body.title?.trim() || `${user.name}'s Weekly Agenda`,
        focus: body.focus?.trim() || null,
        blockers: body.blockers?.trim() || null,
      },
    });

    const tasks = Array.isArray(body.tasks) ? body.tasks : [];

    for (const task of tasks) {
      if (task.title?.trim()) {
        await prisma.firmAgendaTask.create({
          data: {
            firmId,
            agendaId: agenda.id,
            projectId: task.projectId || null,
            title: task.title.trim(),
            detail: task.detail?.trim() || null,
            priority: task.priority?.trim() || "Medium",
            dueDate: task.dueDate?.trim() || null,
          },
        });
      }
    }

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "addAgendaTask") {
    const agenda = await prisma.weeklyAgenda.findFirst({
      where: {
        id: body.agendaId,
        firmId,
      },
    });

    if (!agenda) {
      return NextResponse.json({ error: "Agenda not found." }, { status: 404 });
    }

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Task title is required." },
        { status: 400 }
      );
    }

    await prisma.firmAgendaTask.create({
      data: {
        firmId,
        agendaId: agenda.id,
        projectId: body.projectId || null,
        title: body.title.trim(),
        detail: body.detail?.trim() || null,
        priority: body.priority?.trim() || "Medium",
        dueDate: body.dueDate?.trim() || null,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "updateTask") {
    const task = await prisma.firmAgendaTask.findFirst({
      where: {
        id: body.taskId,
        firmId,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const newStatus =
      typeof body.status === "string" ? body.status : task.status;

    await prisma.firmAgendaTask.update({
      where: {
        id: task.id,
      },
      data: {
        title: typeof body.title === "string" ? body.title : undefined,
        detail: typeof body.detail === "string" ? body.detail : undefined,
        status: newStatus,
        priority:
          typeof body.priority === "string" ? body.priority : undefined,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
        delayReason:
          typeof body.delayReason === "string" ? body.delayReason : undefined,
        inquiry: typeof body.inquiry === "string" ? body.inquiry : undefined,
        completedAt:
          newStatus === "Complete" || newStatus === "Done"
            ? new Date()
            : newStatus === "Open"
              ? null
              : undefined,
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "addComment") {
    if (!body.body?.trim()) {
      return NextResponse.json(
        { error: "Comment body is required." },
        { status: 400 }
      );
    }

    await prisma.agendaComment.create({
      data: {
        agendaId: body.agendaId || null,
        taskId: body.taskId || null,
        userId: user.id,
        body: body.body.trim(),
        commentType: body.commentType?.trim() || "Comment",
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  if (action === "createPost") {
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json(
        { error: "Post title and body are required." },
        { status: 400 }
      );
    }

    await prisma.firmPost.create({
      data: {
        firmId,
        projectId: body.projectId || null,
        authorMembershipId: membership.id,
        title: body.title.trim(),
        body: body.body.trim(),
        postType: body.postType?.trim() || "Update",
      },
    });

    return NextResponse.json(await loadFirmWorkspace(user.id, firmId));
  }

  return NextResponse.json(
    { error: "Unknown firm workspace action." },
    { status: 400 }
  );
}