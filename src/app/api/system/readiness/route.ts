import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSystemReadiness } from "@/lib/system-tools";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const readiness = await getSystemReadiness(user.id);

  return NextResponse.json(readiness);
}