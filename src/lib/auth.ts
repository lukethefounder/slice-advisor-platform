import { cookies } from "next/headers";
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "slice_session";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, originalHash] = storedHash.split(":");

  if (!salt || !originalHash) {
    return false;
  }

  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");

  const originalBuffer = Buffer.from(originalHash, "hex");
  const currentBuffer = Buffer.from(hash, "hex");

  if (originalBuffer.length !== currentBuffer.length) {
    return false;
  }

  return timingSafeEqual(originalBuffer, currentBuffer);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

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
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
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

  return session.user;
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

  await prisma.alertRule.createMany({
    data: [
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
    ],
  });
}