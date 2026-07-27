import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function disabled() {
  const response = NextResponse.json(
    {
      error:
        "Temporary and demo login creation has been permanently disabled for Slice beta testing. Create a real advisor account or use a firm invitation.",
      betaAccess: true,
      temporaryLoginsEnabled: false,
    },
    { status: 410 },
  );

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}

export async function DELETE() {
  return disabled();
}