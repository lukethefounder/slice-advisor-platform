import "server-only";

import { prisma } from "@/lib/prisma";

export const PERSONAL_BOT_MEMORY_TURNS = 10;
export const PERSONAL_BOT_VISIBLE_MESSAGE_LIMIT = 20;
export const PERSONAL_BOT_REPORT_LIMIT = 8;

async function deleteOlderMessages(userId: string) {
  const cutoff = await prisma.personalUserBotMessage.findMany({
    where: {
      userId,
      role: "user",
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: PERSONAL_BOT_MEMORY_TURNS - 1,
    take: 1,
    select: {
      createdAt: true,
    },
  });

  const boundary = cutoff[0]?.createdAt;

  if (!boundary) {
    return 0;
  }

  const result = await prisma.personalUserBotMessage.deleteMany({
    where: {
      userId,
      createdAt: {
        lt: boundary,
      },
    },
  });

  return result.count;
}

async function deleteOlderCommands(userId: string) {
  const cutoff = await prisma.personalUserBotCommand.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: PERSONAL_BOT_MEMORY_TURNS - 1,
    take: 1,
    select: {
      createdAt: true,
    },
  });

  const boundary = cutoff[0]?.createdAt;

  if (!boundary) {
    return 0;
  }

  const result = await prisma.personalUserBotCommand.deleteMany({
    where: {
      userId,
      createdAt: {
        lt: boundary,
      },
    },
  });

  return result.count;
}

async function deleteOlderResearchRuns(userId: string) {
  const cutoff = await prisma.personalUserBotResearchRun.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: PERSONAL_BOT_MEMORY_TURNS - 1,
    take: 1,
    select: {
      createdAt: true,
    },
  });

  const boundary = cutoff[0]?.createdAt;

  if (!boundary) {
    return 0;
  }

  const result = await prisma.personalUserBotResearchRun.deleteMany({
    where: {
      userId,
      createdAt: {
        lt: boundary,
      },
    },
  });

  return result.count;
}

async function deleteOlderVoiceSessions(userId: string) {
  const cutoff = await prisma.personalUserBotVoiceSession.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: PERSONAL_BOT_MEMORY_TURNS - 1,
    take: 1,
    select: {
      createdAt: true,
    },
  });

  const boundary = cutoff[0]?.createdAt;

  if (!boundary) {
    return 0;
  }

  const result = await prisma.personalUserBotVoiceSession.deleteMany({
    where: {
      userId,
      createdAt: {
        lt: boundary,
      },
    },
  });

  return result.count;
}

/**
 * Keep the AI Studio useful without turning ordinary lookups into indefinite
 * personal memory. Reports, approvals, audit logs, and security records are
 * deliberately not deleted by this rolling-memory policy.
 */
export async function prunePersonalBotMemory(userId: string) {
  const [messages, commands, researchRuns, voiceSessions] = await Promise.all([
    deleteOlderMessages(userId),
    deleteOlderCommands(userId),
    deleteOlderResearchRuns(userId),
    deleteOlderVoiceSessions(userId),
  ]);

  return {
    messages,
    commands,
    researchRuns,
    voiceSessions,
    maximumTurns: PERSONAL_BOT_MEMORY_TURNS,
  };
}

export async function clearPersonalBotWorkingMemory(userId: string) {
  const [messages, commands, researchRuns, voiceSessions] =
    await prisma.$transaction([
      prisma.personalUserBotMessage.deleteMany({
        where: {
          userId,
        },
      }),
      prisma.personalUserBotCommand.deleteMany({
        where: {
          userId,
        },
      }),
      prisma.personalUserBotResearchRun.deleteMany({
        where: {
          userId,
        },
      }),
      prisma.personalUserBotVoiceSession.deleteMany({
        where: {
          userId,
        },
      }),
    ]);

  return {
    messages: messages.count,
    commands: commands.count,
    researchRuns: researchRuns.count,
    voiceSessions: voiceSessions.count,
  };
}

export async function countStoredPersonalBotTurns(userId: string) {
  return prisma.personalUserBotMessage.count({
    where: {
      userId,
      role: "user",
    },
  });
}