import {
  TEMP_FIRM_ADVISOR_EMAIL,
  TEMP_FIRM_ADVISOR_NAME,
  TEMP_FIRM_ADVISOR_PASSWORD,
  TEMP_FIRM_CODE,
  TEMP_FIRM_EMAIL,
  TEMP_FIRM_NAME,
  TEMP_FOUNDER_EMAIL,
  TEMP_FOUNDER_NAME,
  TEMP_FOUNDER_PASSWORD,
  temporaryLoginsEnabled,
} from "@/lib/founder-access";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const temporaryLoginAccounts = [
  {
    label: "Founder",
    email: TEMP_FOUNDER_EMAIL,
    password: TEMP_FOUNDER_PASSWORD,
    name: TEMP_FOUNDER_NAME,
    role: "Founder",
    description:
      "Temporary founder account for testing founder-level Slice access.",
  },
  {
    label: "Firm Advisor",
    email: TEMP_FIRM_ADVISOR_EMAIL,
    password: TEMP_FIRM_ADVISOR_PASSWORD,
    name: TEMP_FIRM_ADVISOR_NAME,
    role: "Advisor",
    description:
      "Temporary firm advisor account connected to the Slice Demo Advisory workspace.",
  },
];

function nextMondayString() {
  const now = new Date();
  const day = now.getDay();
  const distance = day === 0 ? 1 : 8 - day;
  const date = new Date(now);

  date.setDate(now.getDate() + distance);

  return date.toISOString().slice(0, 10);
}

async function ensureTemporaryUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  return prisma.user.upsert({
    where: {
      email: normalizedEmail,
    },
    update: {
      name,
      passwordHash: hashPassword(password),
      platformStatus: "Active",
      governanceReason: null,
      governedAt: null,
    },
    create: {
      name,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      platformStatus: "Active",
    },
  });
}

async function ensureDemoFirm(founderUserId: string, advisorUserId: string) {
  const firm = await prisma.firm.upsert({
    where: {
      firmCode: TEMP_FIRM_CODE,
    },
    update: {
      name: TEMP_FIRM_NAME,
      firmEmail: TEMP_FIRM_EMAIL,
      platformStatus: "Active",
      governanceReason: null,
      governedAt: null,
    },
    create: {
      name: TEMP_FIRM_NAME,
      firmEmail: TEMP_FIRM_EMAIL,
      firmCode: TEMP_FIRM_CODE,
      createdByUserId: founderUserId,
      platformStatus: "Active",
    },
  });

  const founderMembership = await prisma.firmMembership.upsert({
    where: {
      firmId_userId: {
        firmId: firm.id,
        userId: founderUserId,
      },
    },
    update: {
      role: "Owner",
      status: "Active",
      calendarColor: "#ef4444",
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: true,
    },
    create: {
      firmId: firm.id,
      userId: founderUserId,
      role: "Owner",
      status: "Active",
      calendarColor: "#ef4444",
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: true,
    },
  });

  const advisorMembership = await prisma.firmMembership.upsert({
    where: {
      firmId_userId: {
        firmId: firm.id,
        userId: advisorUserId,
      },
    },
    update: {
      role: "Advisor",
      status: "Active",
      calendarColor: "#3b82f6",
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    },
    create: {
      firmId: firm.id,
      userId: advisorUserId,
      role: "Advisor",
      status: "Active",
      calendarColor: "#3b82f6",
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    },
  });

  const project = await prisma.firmProject.upsert({
    where: {
      id: `${firm.id}-demo-project`,
    },
    update: {
      title: "Demo advisor operating sprint",
      description:
        "Temporary demo project for testing Slice firm collaboration, task boards, Advisor OS, meeting prep, and client communication workflows.",
      status: "Active",
      priority: "High",
      dueDate: nextMondayString(),
    },
    create: {
      id: `${firm.id}-demo-project`,
      firmId: firm.id,
      title: "Demo advisor operating sprint",
      description:
        "Temporary demo project for testing Slice firm collaboration, task boards, Advisor OS, meeting prep, and client communication workflows.",
      status: "Active",
      priority: "High",
      dueDate: nextMondayString(),
    },
  });

  await prisma.firmProjectAssignment.upsert({
    where: {
      projectId_membershipId: {
        projectId: project.id,
        membershipId: advisorMembership.id,
      },
    },
    update: {
      projectRole: "Lead Advisor",
    },
    create: {
      projectId: project.id,
      membershipId: advisorMembership.id,
      projectRole: "Lead Advisor",
    },
  });

  const agenda = await prisma.weeklyAgenda.upsert({
    where: {
      id: `${firm.id}-demo-agenda`,
    },
    update: {
      membershipId: advisorMembership.id,
      weekStart: nextMondayString(),
      title: "Demo weekly advisor agenda",
      focus:
        "Review source credibility, portfolio impact, client communication drafts, and pending advisor actions.",
      blockers:
        "External data feeds are simulated until live providers are connected.",
      status: "Open",
    },
    create: {
      id: `${firm.id}-demo-agenda`,
      firmId: firm.id,
      membershipId: advisorMembership.id,
      weekStart: nextMondayString(),
      title: "Demo weekly advisor agenda",
      focus:
        "Review source credibility, portfolio impact, client communication drafts, and pending advisor actions.",
      blockers:
        "External data feeds are simulated until live providers are connected.",
      status: "Open",
    },
  });

  const demoTasks = [
    {
      id: `${firm.id}-demo-task-alerts`,
      title: "Review high-priority market alerts",
      detail:
        "Use Slice intelligence to determine which alerts require client communication or task board action.",
      priority: "High",
    },
    {
      id: `${firm.id}-demo-task-briefing`,
      title: "Prepare model client briefing",
      detail:
        "Generate a client-safe summary with source context, AI briefing, and compliance notes attached.",
      priority: "Medium",
    },
    {
      id: `${firm.id}-demo-task-advisor-os`,
      title: "Check Advisor OS autopilot queue",
      detail:
        "Confirm that recommended actions are reviewed by an advisor before communication is sent.",
      priority: "High",
    },
  ];

  for (const task of demoTasks) {
    await prisma.firmAgendaTask.upsert({
      where: {
        id: task.id,
      },
      update: {
        firmId: firm.id,
        agendaId: agenda.id,
        projectId: project.id,
        title: task.title,
        detail: task.detail,
        status: "Open",
        priority: task.priority,
        dueDate: nextMondayString(),
      },
      create: {
        id: task.id,
        firmId: firm.id,
        agendaId: agenda.id,
        projectId: project.id,
        title: task.title,
        detail: task.detail,
        status: "Open",
        priority: task.priority,
        dueDate: nextMondayString(),
      },
    });
  }

  return {
    firm,
    founderMembership,
    advisorMembership,
  };
}

export async function ensureTemporaryLogins() {
  if (!temporaryLoginsEnabled()) {
    return {
      enabled: false,
      accounts: [],
      seedError: null,
    };
  }

  try {
    const founder = await ensureTemporaryUser({
      name: TEMP_FOUNDER_NAME,
      email: TEMP_FOUNDER_EMAIL,
      password: TEMP_FOUNDER_PASSWORD,
    });

    const advisor = await ensureTemporaryUser({
      name: TEMP_FIRM_ADVISOR_NAME,
      email: TEMP_FIRM_ADVISOR_EMAIL,
      password: TEMP_FIRM_ADVISOR_PASSWORD,
    });

    const firmResult = await ensureDemoFirm(founder.id, advisor.id);

    return {
      enabled: true,
      accounts: temporaryLoginAccounts,
      firm: firmResult.firm,
      seedError: null,
    };
  } catch (error) {
    return {
      enabled: true,
      accounts: temporaryLoginAccounts,
      seedError: error instanceof Error ? error.message : "Unknown seed error",
    };
  }
}