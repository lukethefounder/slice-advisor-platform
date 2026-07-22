import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export const CLIENT_PORTAL_SESSION_COOKIE = "slice_client_portal_session";

function portalSessionHours() {
  const parsed = Number(process.env.CLIENT_PORTAL_SESSION_HOURS);

  if (!Number.isFinite(parsed)) return 12;

  return Math.max(1, Math.min(24 * 30, Math.round(parsed)));
}

export function hashClientPortalToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPortalInviteCode(value: string) {
  return hashClientPortalToken(value.trim());
}

export async function createClientPortalSession(clientId: string) {
  const token = randomBytes(48).toString("base64url");
  const tokenHash = hashClientPortalToken(token);
  const expiresAt = new Date(
    Date.now() + portalSessionHours() * 60 * 60 * 1000,
  );

  await db.clientPortalSession.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { clientId }],
    },
  });

  await db.clientPortalSession.create({
    data: {
      clientId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function clientPortalCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export function clearClientPortalCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  };
}

export async function getCurrentClientPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_PORTAL_SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await db.clientPortalSession.findFirst({
    where: {
      tokenHash: hashClientPortalToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!session) return null;

  const client = await db.clientProfile.findFirst({
    where: {
      id: session.clientId,
      portalEnabled: true,
    },
  });

  if (!client) return null;

  return {
    session,
    client,
  };
}