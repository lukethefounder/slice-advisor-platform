import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const assets = await prisma.watchAsset.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    assets,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    ticker?: string;
    name?: string;
    assetType?: string;
    notes?: string;
  };

  const ticker = body.ticker?.trim().toUpperCase();
  const name = body.name?.trim();

  if (!ticker || !name) {
    return NextResponse.json(
      { error: "Ticker and name are required." },
      { status: 400 }
    );
  }

  try {
    const asset = await prisma.watchAsset.create({
      data: {
        userId: user.id,
        ticker,
        name,
        assetType: body.assetType?.trim() || "Stock",
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({
      asset,
    });
  } catch {
    return NextResponse.json(
      { error: "This ticker is already in your watchlist." },
      { status: 409 }
    );
  }
}