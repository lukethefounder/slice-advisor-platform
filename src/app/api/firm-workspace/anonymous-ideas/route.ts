import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FirmMemberWithUser = {
  id: string;
  userId: string;
  role: string;
  canManageFirm: boolean;
  canManageProjects: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

function cleanMultiline(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, 25000);
}

function arrayOfCleanStrings(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 25);
}

function extractMentionCandidates(text: string) {
  const matches = text.match(/@[a-zA-Z0-9._ -]+/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map((item) => item.replace(/^@/, "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function memberDisplayName(member: {
  user?: { name: string; email: string } | null;
}) {
  return member.user?.name || member.user?.email || "Team member";
}

function memberMentionKeys(member: {
  user?: { name: string; email: string } | null;
}) {
  const name = member.user?.name ?? "";
  const email = member.user?.email ?? "";
  const first = name.split(" ")[0] ?? "";

  return [name, first, email]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function mentionedMembers(text: string, members: FirmMemberWithUser[]) {
  const candidates = extractMentionCandidates(text);

  if (!candidates.length) return [];

  return members.filter((member) => {
    const keys = memberMentionKeys(member);

    return candidates.some((candidate) =>
      keys.some(
        (key) =>
          key === candidate ||
          key.replace(/\s+/g, "") === candidate.replace(/\s+/g, "")
      )
    );
  });
}

function isLeader(member: {
  role: string;
  canManageFirm: boolean;
  canManageProjects: boolean;
}) {
  return (
    member.role === "Owner" ||
    member.role === "Admin" ||
    member.canManageFirm ||
    member.canManageProjects
  );
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

async function getFirmContext(userId: string, firmId: string) {
  const membership = await prisma.firmMembership.findFirst({
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

  if (!membership) return null;

  const members = await prisma.firmMembership.findMany({
    where: {
      firmId,
      status: "Active",
    },
    include: {
      user: true,
    },
  });

  return {
    membership,
    members: members as FirmMemberWithUser[],
  };
}

async function createIdea(input: {
  firmId: string;
  membership: FirmMemberWithUser;
  members: FirmMemberWithUser[];
  title: string;
  body: string;
  category: string;
  impact: string;
  effort: string;
  ownerHint: string;
  projectId: string | null;
  fileLinks: string[];
  anonymous: boolean;
}) {
  const ideaBody = [
    input.body || "No idea detail provided.",
    "",
    `Category: ${input.category}`,
    `Expected impact: ${input.impact}`,
    `Estimated effort: ${input.effort}`,
    input.ownerHint ? `Suggested owner / reviewer: ${input.ownerHint}` : null,
    input.anonymous
      ? "Submitted anonymously: true"
      : `Submitted by: ${memberDisplayName(input.membership)}`,
    input.fileLinks.length
      ? `Links:\n${input.fileLinks.map((link) => `- ${link}`).join("\n")}`
      : null,
    "",
    "Voting is anonymous. Vote counts are shown only to firm leadership inside Slice.",
  ]
    .filter(Boolean)
    .join("\n");

  const post = await prisma.firmPost.create({
    data: {
      firmId: input.firmId,
      projectId: input.projectId,
      authorMembershipId: input.anonymous ? null : input.membership.id,
      postType: "Idea: Proposed",
      title: input.title,
      body: ideaBody,
    },
  });

  const mentioned = mentionedMembers(
    `${input.title} ${input.body} ${input.ownerHint}`,
    input.members
  );

  const notificationTargets = mentioned.length ? mentioned : input.members;
  const actorName = input.anonymous
    ? "Anonymous Contributor"
    : memberDisplayName(input.membership);

  for (const member of notificationTargets) {
    if (!input.anonymous && member.userId === input.membership.userId) continue;

    await createDashboardNotification({
      targetUserId: member.userId,
      targetEmail: member.user?.email ?? null,
      actorName,
      title: `New firm idea: ${input.title}`,
      body: input.body || "A new idea was submitted to the firm idea board.",
      reason: input.anonymous
        ? "Anonymous idea submitted to universal firm idea board."
        : "Idea submitted to universal firm idea board.",
      urgency:
        input.impact === "High" || input.impact === "Critical"
          ? "High"
          : "Medium",
      score: input.impact === "High" || input.impact === "Critical" ? 82 : 68,
    });
  }

  return post;
}

async function voteIdea(input: {
  firmId: string;
  ideaId: string;
  membership: FirmMemberWithUser;
}) {
  const idea = await prisma.firmPost.findFirst({
    where: {
      id: input.ideaId,
      firmId: input.firmId,
    },
  });

  if (!idea) throw new Error("Idea not found.");

  const privateVoteMarker = [
    "",
    `[SLICE_PRIVATE_VOTE] #vote`,
    `Timestamp: ${new Date().toISOString()}`,
    `Anonymous: true`,
    `VisibleTo: Owner`,
  ].join("\n");

  return prisma.firmPost.update({
    where: { id: idea.id },
    data: {
      body: `${idea.body}\n${privateVoteMarker}`,
    },
  });
}

async function addIdeaNote(input: {
  firmId: string;
  ideaId: string;
  membership: FirmMemberWithUser;
  note: string;
  anonymous: boolean;
}) {
  const idea = await prisma.firmPost.findFirst({
    where: {
      id: input.ideaId,
      firmId: input.firmId,
    },
  });

  if (!idea) throw new Error("Idea not found.");

  const author = input.anonymous
    ? "Anonymous contributor"
    : memberDisplayName(input.membership);

  const noteBlock = [
    "",
    "[SLICE_IDEA_NOTE]",
    `Author: ${author}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Note: ${input.note}`,
  ].join("\n");

  const updated = await prisma.firmPost.update({
    where: { id: idea.id },
    data: {
      body: `${idea.body}\n${noteBlock}`,
    },
  });

  const leaders = await prisma.firmMembership.findMany({
    where: {
      firmId: input.firmId,
      status: "Active",
      OR: [
        { role: "Owner" },
        { role: "Admin" },
        { canManageFirm: true },
        { canManageProjects: true },
      ],
    },
    include: {
      user: true,
    },
  });

  for (const leader of leaders) {
    if (leader.userId === input.membership.userId) continue;

    await createDashboardNotification({
      targetUserId: leader.userId,
      targetEmail: leader.user.email,
      actorName: author,
      title: `New brainstorm note: ${idea.title}`,
      body: input.note,
      reason: "A note was added to a brainstorm bubble.",
      urgency: "Medium",
      score: 66,
    });
  }

  return updated;
}

async function updateIdeaStatus(input: {
  firmId: string;
  ideaId: string;
  membership: FirmMemberWithUser;
  status: string;
  note: string;
}) {
  if (!isLeader(input.membership)) {
    throw new Error("Only firm leaders can update idea status.");
  }

  const idea = await prisma.firmPost.findFirst({
    where: {
      id: input.ideaId,
      firmId: input.firmId,
    },
  });

  if (!idea) throw new Error("Idea not found.");

  const updateNote = [
    "",
    `[SLICE_STATUS_UPDATE]`,
    `Status update: ${input.status}`,
    `Updated by: ${memberDisplayName(input.membership)}`,
    input.note ? `Note: ${input.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const updated = await prisma.firmPost.update({
    where: { id: idea.id },
    data: {
      postType: `Idea: ${input.status}`,
      body: `${idea.body}\n${updateNote}`,
    },
  });

  await prisma.firmPost.create({
    data: {
      firmId: input.firmId,
      authorMembershipId: input.membership.id,
      postType: "Idea Update",
      title: `Idea moved to ${input.status}: ${idea.title}`,
      body: input.note || `Idea status changed to ${input.status}.`,
    },
  });

  return updated;
}

async function promoteIdeaToProject(input: {
  firmId: string;
  ideaId: string;
  membership: FirmMemberWithUser;
  projectTitle: string;
  description: string;
  priority: string;
  dueDate: string | null;
}) {
  if (!isLeader(input.membership)) {
    throw new Error("Only firm leaders can promote ideas into projects.");
  }

  const idea = await prisma.firmPost.findFirst({
    where: {
      id: input.ideaId,
      firmId: input.firmId,
    },
  });

  if (!idea) throw new Error("Idea not found.");

  const project = await prisma.firmProject.create({
    data: {
      firmId: input.firmId,
      title: input.projectTitle || idea.title,
      description: input.description || idea.body,
      priority: input.priority || "Medium",
      dueDate: input.dueDate,
      status: "Planning",
    },
  });

  await prisma.firmPost.update({
    where: { id: idea.id },
    data: {
      postType: "Idea: Promoted",
      projectId: project.id,
      body: `${idea.body}\n\nPromoted to project: ${project.title}\nPromoted by: ${memberDisplayName(input.membership)}`,
    },
  });

  await prisma.firmPost.create({
    data: {
      firmId: input.firmId,
      projectId: project.id,
      authorMembershipId: input.membership.id,
      postType: "Project",
      title: `Idea promoted to project: ${project.title}`,
      body: idea.body,
    },
  });

  return project;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const payload = (await request.json()) as Record<string, unknown>;
  const action = cleanText(payload.action, "createIdea");
  const firmId = cleanText(payload.firmId);

  if (!firmId) {
    return NextResponse.json({ error: "Firm ID is required." }, { status: 400 });
  }

  const context = await getFirmContext(user.id, firmId);

  if (!context) {
    return NextResponse.json(
      { error: "You do not have access to this firm." },
      { status: 403 }
    );
  }

  try {
    if (action === "voteIdea") {
      const ideaId = cleanText(payload.ideaId);

      if (!ideaId) {
        return NextResponse.json(
          { error: "Idea ID is required." },
          { status: 400 }
        );
      }

      const idea = await voteIdea({
        firmId,
        ideaId,
        membership: context.membership as FirmMemberWithUser,
      });

      return NextResponse.json({
        ok: true,
        idea,
        message: "Anonymous vote recorded.",
      });
    }

    if (action === "addIdeaNote") {
      const ideaId = cleanText(payload.ideaId);
      const note = cleanMultiline(payload.note);

      if (!ideaId || !note) {
        return NextResponse.json(
          { error: "Idea and note are required." },
          { status: 400 }
        );
      }

      const idea = await addIdeaNote({
        firmId,
        ideaId,
        membership: context.membership as FirmMemberWithUser,
        note,
        anonymous: payload.anonymous !== false,
      });

      return NextResponse.json({
        ok: true,
        idea,
        message: "Brainstorm note added.",
      });
    }

    if (action === "updateIdeaStatus") {
      const ideaId = cleanText(payload.ideaId);
      const status = cleanText(payload.status, "Reviewed");
      const note = cleanMultiline(payload.note);

      if (!ideaId) {
        return NextResponse.json(
          { error: "Idea ID is required." },
          { status: 400 }
        );
      }

      const idea = await updateIdeaStatus({
        firmId,
        ideaId,
        membership: context.membership as FirmMemberWithUser,
        status,
        note,
      });

      return NextResponse.json({
        ok: true,
        idea,
        message: `Idea moved to ${status}.`,
      });
    }

    if (action === "promoteIdeaToProject") {
      const ideaId = cleanText(payload.ideaId);

      if (!ideaId) {
        return NextResponse.json(
          { error: "Idea ID is required." },
          { status: 400 }
        );
      }

      const project = await promoteIdeaToProject({
        firmId,
        ideaId,
        membership: context.membership as FirmMemberWithUser,
        projectTitle: cleanText(payload.projectTitle),
        description: cleanMultiline(payload.description),
        priority: cleanText(payload.priority, "Medium"),
        dueDate: cleanText(payload.dueDate) || null,
      });

      return NextResponse.json({
        ok: true,
        project,
        message: "Idea promoted to project.",
      });
    }

    const title = cleanText(payload.title);

    if (!title) {
      return NextResponse.json(
        { error: "Idea title is required." },
        { status: 400 }
      );
    }

    const idea = await createIdea({
      firmId,
      membership: context.membership as FirmMemberWithUser,
      members: context.members,
      title,
      body: cleanMultiline(payload.body, "No idea detail provided."),
      category: cleanText(payload.category, "General"),
      impact: cleanText(payload.impact, "Medium"),
      effort: cleanText(payload.effort, "Medium"),
      ownerHint: cleanText(payload.ownerHint),
      projectId: cleanText(payload.projectId) || null,
      fileLinks: arrayOfCleanStrings(payload.fileLinks),
      anonymous: payload.anonymous !== false,
    });

    return NextResponse.json({
      ok: true,
      createdIdeaId: idea.id,
      idea,
      message:
        payload.anonymous === false
          ? "Idea submitted."
          : "Anonymous idea submitted.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Idea board action failed.",
      },
      { status: 500 }
    );
  }
}