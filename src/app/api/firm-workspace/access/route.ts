import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADDITIONAL_ACCOUNTS = 10;
const MAX_TOTAL_ACTIVE_AND_PENDING = 11;

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

type AccessBody = Record<string, unknown>;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanNullableText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function cleanBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 50);
}

function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function rolePermissions(roleValue: string) {
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
    role === "principal" ||
    role === "lead advisor" ||
    role === "manager"
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
    role === "wealth manager" ||
    role === "portfolio manager" ||
    role === "analyst"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  if (role === "operations" || role === "client service") {
    return {
      canAccessPortfolios: false,
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

function defaultFunctionalPermissions(roleValue: string) {
  const role = roleValue.trim().toLowerCase();

  const advisorBase = {
    canViewSharedWorkspace: true,
    canUsePersonalBot: true,
    canGenerateClientEmails: true,
    canAddPeopleToPortfolio: false,
    canEditClientRecords: true,
    canApproveClientEmails: false,
    canUseOpportunityRadar: true,
    canManageFirmSettings: false,
  };

  if (role === "owner") {
    return {
      ...advisorBase,
      canAddPeopleToPortfolio: true,
      canApproveClientEmails: true,
      canManageFirmSettings: true,
    };
  }

  if (
    role === "admin" ||
    role === "firm admin" ||
    role === "principal" ||
    role === "lead advisor"
  ) {
    return {
      ...advisorBase,
      canAddPeopleToPortfolio: true,
      canApproveClientEmails: true,
    };
  }

  if (role === "advisor" || role === "wealth manager" || role === "portfolio manager") {
    return advisorBase;
  }

  if (role === "analyst") {
    return {
      ...advisorBase,
      canGenerateClientEmails: false,
      canEditClientRecords: false,
      canApproveClientEmails: false,
    };
  }

  return {
    ...advisorBase,
    canGenerateClientEmails: false,
    canEditClientRecords: false,
    canUseOpportunityRadar: false,
  };
}

function defaultBotProfile(input: {
  role: string;
  name?: string | null;
  email: string;
}) {
  const displayName = input.name || input.email.split("@")[0] || "Advisor";
  const role = input.role || "Advisor";

  return {
    botName: `${displayName.split(" ")[0] || "Advisor"} AI`,
    ownerName: displayName,
    persona:
      role === "Analyst"
        ? "Research-focused assistant that summarizes signals, validates sources, and prepares advisor-ready research notes."
        : role === "Operations"
          ? "Operations-focused assistant that tracks tasks, reminders, follow-ups, workspace updates, and firm execution."
          : "Advisor-focused assistant that understands client preferences, drafts compliant communication, tracks opportunities, and helps manage the advisor's day.",
    tone: "Professional",
    coverage: [
      "Client prep",
      "Research summaries",
      "Task follow-up",
      "Meeting notes",
      "Opportunity triage",
    ],
    tasks: [
      "Summarize client context",
      "Draft advisor-reviewed emails",
      "Rank daily priorities",
      "Explain market opportunities",
      "Prepare follow-up notes",
    ],
  };
}

async function getMembership(userId: string, firmId: string) {
  return prisma.firmMembership.findFirst({
    where: {
      userId,
      firmId,
      status: "Active",
    },
    include: {
      user: true,
      firm: true,
    },
  });
}

function isOwnerOrFirmManager(membership: {
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

async function seatSummary(firmId: string) {
  const [activeMembers, pendingInvites] = await Promise.all([
    prisma.firmMembership.count({
      where: {
        firmId,
        status: "Active",
      },
    }),
    prisma.firmInvite.count({
      where: {
        firmId,
        status: "Pending",
      },
    }),
  ]);

  const usedSeats = activeMembers + pendingInvites;
  const additionalUsed = Math.max(0, usedSeats - 1);

  return {
    activeMembers,
    pendingInvites,
    usedSeats,
    additionalUsed,
    maxAdditionalAccounts: MAX_ADDITIONAL_ACCOUNTS,
    maxTotalActiveAndPending: MAX_TOTAL_ACTIVE_AND_PENDING,
    remainingAdditionalAccounts: Math.max(
      0,
      MAX_ADDITIONAL_ACCOUNTS - additionalUsed
    ),
    isFull: usedSeats >= MAX_TOTAL_ACTIVE_AND_PENDING,
  };
}

async function loadAccessCenter(userId: string, firmId: string) {
  const membership = await getMembership(userId, firmId);

  if (!membership) {
    return null;
  }

  const [members, invites, bots, seats] = await Promise.all([
    prisma.firmMembership.findMany({
      where: {
        firmId,
        status: "Active",
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.firmInvite.findMany({
      where: {
        firmId,
        status: "Pending",
      },
      include: {
        sentBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.personalAdvisorBot.findMany({
      where: {
        firmId,
        status: "Active",
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    seatSummary(firmId),
  ]);

  return {
    firmId,
    firmName: membership.firm.name,
    viewerMembership: membership,
    viewerCanManageAccess: isOwnerOrFirmManager(membership),
    viewerCanInvite: canInvite(membership),
    seatSummary: seats,
    members,
    invites,
    bots,
  };
}

async function ensureBotForUser(input: {
  userId: string;
  firmId: string;
  role: string;
  name?: string | null;
  email: string;
  permissions?: Record<string, unknown>;
  botName?: string;
  persona?: string;
  tone?: string;
  coverage?: string[];
  tasks?: string[];
}) {
  const defaults = defaultBotProfile({
    role: input.role,
    name: input.name,
    email: input.email,
  });

  const existing = await prisma.personalAdvisorBot.findFirst({
    where: {
      userId: input.userId,
      firmId: input.firmId,
      status: "Active",
    },
  });

  const data = {
    userId: input.userId,
    firmId: input.firmId,
    botName: cleanText(input.botName, defaults.botName) || defaults.botName,
    ownerName: cleanNullableText(input.name) ?? defaults.ownerName,
    persona: cleanText(input.persona, defaults.persona) || defaults.persona,
    tone: cleanText(input.tone, defaults.tone) || defaults.tone,
    coverageJson: JSON.stringify(input.coverage?.length ? input.coverage : defaults.coverage),
    tasksJson: JSON.stringify(input.tasks?.length ? input.tasks : defaults.tasks),
    permissionsJson: JSON.stringify(
      input.permissions ?? defaultFunctionalPermissions(input.role)
    ),
    status: "Active",
    lastRunSummary:
      "Bot profile initialized for firm collaboration, shared workspace access, and personal advisor workflows.",
  };

  if (existing) {
    return prisma.personalAdvisorBot.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.personalAdvisorBot.create({
    data,
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");

  if (!firmId) {
    return NextResponse.json(
      { error: "Firm ID is required." },
      { status: 400 }
    );
  }

  const payload = await loadAccessCenter(user.id, firmId);

  if (!payload) {
    return NextResponse.json(
      { error: "You are not an active member of this firm." },
      { status: 403 }
    );
  }

  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as AccessBody;
  const action = cleanText(body.action);
  const firmId = cleanText(body.firmId);

  if (!firmId) {
    return NextResponse.json(
      { error: "Firm ID is required." },
      { status: 400 }
    );
  }

  const membership = await getMembership(user.id, firmId);

  if (!membership) {
    return NextResponse.json(
      { error: "You are not an active member of this firm." },
      { status: 403 }
    );
  }

  if (action === "inviteFirmUser") {
    if (!canInvite(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to invite firm users." },
        { status: 403 }
      );
    }

    const seats = await seatSummary(firmId);

    if (seats.isFull) {
      return NextResponse.json(
        {
          error:
            "This firm has reached the 10 additional account limit. Remove a member or wait for a pending invite to expire before inviting another user.",
          seatSummary: seats,
        },
        { status: 400 }
      );
    }

    const email = cleanText(body.email).toLowerCase();
    const role = cleanText(body.role, "Advisor") || "Advisor";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    const existingMember = await prisma.firmMembership.findFirst({
      where: {
        firmId,
        status: "Active",
        user: {
          email,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "That user is already active in this firm." },
        { status: 400 }
      );
    }

    const existingPending = await prisma.firmInvite.findFirst({
      where: {
        firmId,
        email,
        status: "Pending",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "That email already has a pending invite." },
        { status: 400 }
      );
    }

    const invite = await prisma.firmInvite.create({
      data: {
        firmId,
        email,
        role,
        status: "Pending",
        inviteCode: crypto.randomUUID().replace(/-/g, "").toUpperCase(),
        sentByUserId: user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      ...(await loadAccessCenter(user.id, firmId)),
      createdInvite: invite,
    });
  }

  if (action === "updateMemberAccess") {
    if (!isOwnerOrFirmManager(membership)) {
      return NextResponse.json(
        { error: "Only the firm owner or firm manager can update access." },
        { status: 403 }
      );
    }

    const membershipId = cleanText(body.membershipId);
    const target = await prisma.firmMembership.findFirst({
      where: {
        id: membershipId,
        firmId,
        status: "Active",
      },
      include: {
        user: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (target.role === "Owner" && target.userId !== user.id) {
      return NextResponse.json(
        { error: "Owner access cannot be changed from this panel." },
        { status: 403 }
      );
    }

    const role = cleanText(body.role, target.role) || target.role;
    const roleDefaults = rolePermissions(role);

    const canAccessPortfolios =
      typeof body.canAccessPortfolios === "boolean"
        ? body.canAccessPortfolios
        : roleDefaults.canAccessPortfolios;

    const canManageProjects =
      typeof body.canManageProjects === "boolean"
        ? body.canManageProjects
        : roleDefaults.canManageProjects;

    const canInviteMembers =
      typeof body.canInviteMembers === "boolean"
        ? body.canInviteMembers
        : roleDefaults.canInviteMembers;

    const canManageFirm =
      target.role === "Owner"
        ? true
        : typeof body.canManageFirm === "boolean"
          ? body.canManageFirm
          : roleDefaults.canManageFirm;

    const updated = await prisma.firmMembership.update({
      where: {
        id: target.id,
      },
      data: {
        role,
        canAccessPortfolios,
        canManageProjects,
        canInviteMembers,
        canManageFirm,
        calendarColor: cleanText(body.calendarColor, target.calendarColor) || target.calendarColor,
      },
      include: {
        user: true,
      },
    });

    const functionalPermissions = {
      ...defaultFunctionalPermissions(role),
      canGenerateClientEmails: cleanBoolean(
        body.canGenerateClientEmails,
        defaultFunctionalPermissions(role).canGenerateClientEmails
      ),
      canAddPeopleToPortfolio: cleanBoolean(
        body.canAddPeopleToPortfolio,
        defaultFunctionalPermissions(role).canAddPeopleToPortfolio
      ),
      canEditClientRecords: cleanBoolean(
        body.canEditClientRecords,
        defaultFunctionalPermissions(role).canEditClientRecords
      ),
      canApproveClientEmails: cleanBoolean(
        body.canApproveClientEmails,
        defaultFunctionalPermissions(role).canApproveClientEmails
      ),
      canUseOpportunityRadar: cleanBoolean(
        body.canUseOpportunityRadar,
        defaultFunctionalPermissions(role).canUseOpportunityRadar
      ),
      canManageFirmSettings: cleanBoolean(
        body.canManageFirmSettings,
        defaultFunctionalPermissions(role).canManageFirmSettings
      ),
    };

    await ensureBotForUser({
      userId: updated.userId,
      firmId,
      role,
      name: updated.user?.name,
      email: updated.user?.email ?? "",
      permissions: functionalPermissions,
      botName: cleanText(body.botName),
      persona: cleanText(body.persona),
      tone: cleanText(body.tone),
      coverage: cleanArray(body.coverage),
      tasks: cleanArray(body.tasks),
    });

    return NextResponse.json(await loadAccessCenter(user.id, firmId));
  }

  if (action === "removeMemberAccess") {
    if (!isOwnerOrFirmManager(membership)) {
      return NextResponse.json(
        { error: "Only the firm owner or firm manager can remove access." },
        { status: 403 }
      );
    }

    const membershipId = cleanText(body.membershipId);
    const target = await prisma.firmMembership.findFirst({
      where: {
        id: membershipId,
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

    await prisma.personalAdvisorBot.updateMany({
      where: {
        userId: target.userId,
        firmId,
      },
      data: {
        status: "Paused",
      },
    });

    return NextResponse.json(await loadAccessCenter(user.id, firmId));
  }

  if (action === "cancelInvite") {
    if (!canInvite(membership)) {
      return NextResponse.json(
        { error: "You do not have permission to cancel invites." },
        { status: 403 }
      );
    }

    const inviteId = cleanText(body.inviteId);

    const invite = await prisma.firmInvite.findFirst({
      where: {
        id: inviteId,
        firmId,
        status: "Pending",
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    await prisma.firmInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        status: "Cancelled",
      },
    });

    return NextResponse.json(await loadAccessCenter(user.id, firmId));
  }

  if (action === "updatePersonalBot") {
    const targetMembershipId = cleanText(body.membershipId);
    const target = await prisma.firmMembership.findFirst({
      where: {
        id: targetMembershipId,
        firmId,
        status: "Active",
      },
      include: {
        user: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const canEditThisBot =
      target.userId === user.id || isOwnerOrFirmManager(membership);

    if (!canEditThisBot) {
      return NextResponse.json(
        { error: "You can only edit your own bot unless you manage the firm." },
        { status: 403 }
      );
    }

    await ensureBotForUser({
      userId: target.userId,
      firmId,
      role: target.role,
      name: target.user?.name,
      email: target.user?.email ?? "",
      botName: cleanText(body.botName),
      persona: cleanText(body.persona),
      tone: cleanText(body.tone),
      coverage: cleanArray(body.coverage),
      tasks: cleanArray(body.tasks),
      permissions: {
        ...defaultFunctionalPermissions(target.role),
        canGenerateClientEmails: cleanBoolean(body.canGenerateClientEmails, true),
        canAddPeopleToPortfolio: cleanBoolean(body.canAddPeopleToPortfolio, false),
        canEditClientRecords: cleanBoolean(body.canEditClientRecords, true),
        canApproveClientEmails: cleanBoolean(body.canApproveClientEmails, false),
        canUseOpportunityRadar: cleanBoolean(body.canUseOpportunityRadar, true),
        canManageFirmSettings: cleanBoolean(body.canManageFirmSettings, false),
      },
    });

    return NextResponse.json(await loadAccessCenter(user.id, firmId));
  }

  return NextResponse.json(
    { error: "Unknown access center action." },
    { status: 400 }
  );
}