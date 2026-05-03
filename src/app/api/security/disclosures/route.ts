import { NextResponse } from "next/server";
import {
  acceptAllDisclosures,
  acceptDisclosure,
  getDisclosureStatus,
} from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const disclosures = await getDisclosureStatus(user);

  return NextResponse.json({ disclosures });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    disclosureKey?: string;
    acceptAll?: boolean;
  };

  if (body.acceptAll) {
    const accepted = await acceptAllDisclosures(user);
    return NextResponse.json({ accepted });
  }

  if (!body.disclosureKey) {
    return NextResponse.json(
      { error: "Disclosure key is required." },
      { status: 400 }
    );
  }

  const accepted = await acceptDisclosure(user, body.disclosureKey);

  return NextResponse.json({ accepted });
}