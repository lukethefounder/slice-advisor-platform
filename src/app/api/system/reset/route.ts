import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resetUserWorkspace } from "@/lib/system-tools";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await resetUserWorkspace(user.id, request);

  return NextResponse.json({
    ok: true,
    result,
  });
}