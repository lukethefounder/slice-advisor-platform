import { cookies } from "next/headers";
import {
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "slice_session";

const CURRENT_PASSWORD_SCHEME = "pbkdf2_sha512";
const CURRENT_PASSWORD_ITERATIONS = 310000;
const LEGACY_PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

function sessionTtlHours() {
  const parsed = Number(process.env.SESSION_TTL_HOURS);

  if (!Number.isFinite(parsed)) return 12;

  return Math.max(1, Math.min(24 * 30, Math.round(parsed)));
}

function maxActiveSessions() {
  const parsed = Number(process.env.SESSION_MAX_ACTIVE);

  if (!Number.isFinite(parsed)) return 5;

  return Math.max(1, Math.min(20, Math.round(parsed)));
}

function safeTimingEqualHex(left: string, right: string) {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(24).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    CURRENT_PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");

  return `${CURRENT_PASSWORD_SCHEME}:${CURRENT_PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split(":");

  if (parts.length === 2) {
    const [salt, originalHash] = parts;

    if (!salt || !originalHash) return false;

    const hash = pbkdf2Sync(
      password,
      salt,
      LEGACY_PASSWORD_ITERATIONS,
      PASSWORD_KEY_LENGTH,
      PASSWORD_DIGEST
    ).toString("hex");

    return safeTimingEqualHex(originalHash, hash);
  }

  if (parts.length === 4) {
    const [scheme, iterationsRaw, salt, originalHash] = parts;
    const iterations = Number(iterationsRaw);

    if (
      scheme !== CURRENT_PASSWORD_SCHEME ||
      !Number.isFinite(iterations) ||
      iterations < LEGACY_PASSWORD_ITERATIONS ||
      !salt ||
      !originalHash
    ) {
      return false;
    }

    const hash = pbkdf2Sync(
      password,
      salt,
      iterations,
      PASSWORD_KEY_LENGTH,
      PASSWORD_DIGEST
    ).toString("hex");

    return safeTimingEqualHex(originalHash, hash);
  }

  return false;
}

export function needsPasswordRehash(storedHash: string) {
  const parts = storedHash.split(":");

  if (parts.length !== 4) return true;

  const [scheme, iterationsRaw] = parts;
  const iterations = Number(iterationsRaw);

  return (
    scheme !== CURRENT_PASSWORD_SCHEME ||
    !Number.isFinite(iterations) ||
    iterations < CURRENT_PASSWORD_ITERATIONS
  );
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(48).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * sessionTtlHours()
  );

  await prisma.session.deleteMany({
    where: {
      userId,
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  const staleActiveSessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: Math.max(0, maxActiveSessions() - 1),
    select: {
      id: true,
    },
  });

  if (staleActiveSessions.length) {
    await prisma.session.deleteMany({
      where: {
        id: {
          in: staleActiveSessions.map((session) => session.id),
        },
      },
    });
  }

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (
    session.user.platformStatus === "Banned" ||
    session.user.platformStatus === "Suspended"
  ) {
    await prisma.session.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    return null;
  }

  return session.user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function ensureStarterAlertRule(input: {
  userId: string;
  title: string;
  channel: string;
  trigger: string;
}) {
  const existing = await prisma.alertRule.findFirst({
    where: {
      userId: input.userId,
      title: input.title,
    },
  });

  if (existing) return existing;

  return prisma.alertRule.create({
    data: {
      userId: input.userId,
      title: input.title,
      channel: input.channel,
      trigger: input.trigger,
    },
  });
}

export async function seedStarterData(userId: string) {
  const starterWatchlist = [
    {
      ticker: "AAPL",
      name: "Apple Inc.",
      assetType: "Stock",
      price: "$194.12",
      move: "+1.8%",
      ma50: "$187.44",
      ma200: "$176.22",
      volume: "61.2M",
      rsi: "63",
      signal: "Momentum above 50D and 200D",
      notes: "Starter Slice watchlist item.",
    },
    {
      ticker: "NVDA",
      name: "NVIDIA Corporation",
      assetType: "Stock",
      price: "$121.88",
      move: "+3.4%",
      ma50: "$114.62",
      ma200: "$98.11",
      volume: "214.8M",
      rsi: "71",
      signal: "Strong AI demand headline cluster",
      notes: "Starter Slice watchlist item.",
    },
    {
      ticker: "MSFT",
      name: "Microsoft Corporation",
      assetType: "Stock",
      price: "$438.90",
      move: "-0.6%",
      ma50: "$431.70",
      ma200: "$410.29",
      volume: "29.5M",
      rsi: "55",
      signal: "Pullback while above long-term trend",
      notes: "Starter Slice watchlist item.",
    },
  ];

  for (const asset of starterWatchlist) {
    await prisma.watchAsset.upsert({
      where: {
        userId_ticker: {
          userId,
          ticker: asset.ticker,
        },
      },
      update: {},
      create: {
        userId,
        ...asset,
      },
    });
  }

  const starterAlertRules = [
    {
      userId,
      title: "Watchlist ticker receives critical news",
      channel: "Dashboard",
      trigger: "Critical score from Slice intelligence engine",
    },
    {
      userId,
      title: "Moving average crossover detected",
      channel: "Email",
      trigger: "50D / 200D market signal change",
    },
    {
      userId,
      title: "Private venture review reminder",
      channel: "Dashboard",
      trigger: "Monthly alternative investment review",
    },
  ];

  for (const rule of starterAlertRules) {
    await ensureStarterAlertRule(rule);
  }
}