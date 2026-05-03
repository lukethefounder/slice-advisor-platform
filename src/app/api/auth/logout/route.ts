import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  hashSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  }

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());

  return response;
}