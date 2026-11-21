import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { manageTeamInvitation, publicInvitation } from "@/lib/team/invitations";
import { readTeamJson, teamFailure } from "@/lib/team/http";
import { changeTeamMember } from "@/lib/team/memberships";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADDITIONAL_ACCOUNTS = 10;
const MAX_TOTAL_ACTIVE_AND_PENDING = 11;

type AccessBody = Record<string, unknown>;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanNullableText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 50);
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
      firm: { platformStatus: "Active" },
    },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, platformStatus: true } },
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
        user: { select: { id: true, name: true, email: true, createdAt: true, platformStatus: true } },
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
        sentBy: { select: { id: true, name: true, email: true } },
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
    invites: canInvite(membership) ? invites.map(invite => ({ ...publicInvitation(invite), inviteCode: "", sentBy: invite.sentBy })) : [],
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

  let body: AccessBody;
  try { body = await readTeamJson(request, 256_000); } catch (error) { return teamFailure(error); }
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
    try {
      const result = await manageTeamInvitation(request, { ...body, action: "create", firmId, role: body.role || "Associate Advisor", delivery: "link" });
      return NextResponse.json({ ...(await loadAccessCenter(user.id, firmId)), ...("invite" in result ? { createdInvite: result.invite } : {}) });
    } catch (error) { return teamFailure(error); }
  }

  if (action === "updateMemberAccess" || action === "removeMemberAccess") {
    try {
      await changeTeamMember(request, body, action === "removeMemberAccess" ? "remove" : "update");
      return NextResponse.json(await loadAccessCenter(user.id, firmId));
    } catch (error) { return teamFailure(error); }
  }

  if (action === "cancelInvite") {
    try {
      await manageTeamInvitation(request, { action: "revoke", firmId, inviteId: body.inviteId });
      return NextResponse.json(await loadAccessCenter(user.id, firmId));
    } catch (error) { return teamFailure(error); }
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
        user: { select: { id: true, name: true, email: true, createdAt: true, platformStatus: true } },
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
      permissions: defaultFunctionalPermissions(target.role),
    });

    return NextResponse.json(await loadAccessCenter(user.id, firmId));
  }

  return NextResponse.json(
    { error: "Unknown access center action." },
    { status: 400 }
  );
}