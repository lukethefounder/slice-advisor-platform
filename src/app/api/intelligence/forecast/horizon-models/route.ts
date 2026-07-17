import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  getHorizonModelOverview,
  trainHorizonModelSuite,
} from "@/lib/intelligence-forecast/horizon-models";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type RequestBody = {
  action?:
    unknown;
};

export async function GET() {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status:
          401,
      },
    );
  }

  const overview =
    await getHorizonModelOverview(
      user.id,
    );

  return NextResponse.json(
    {
      ok:
        true,

      ...overview,
    },
    {
      status:
        200,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  request:
    Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status:
          401,
      },
    );
  }

  let body:
    RequestBody;

  try {
    body =
      (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body must contain valid JSON.",
      },
      {
        status:
          400,
      },
    );
  }

  if (
    body.action !==
    "train"
  ) {
    return NextResponse.json(
      {
        error:
          "The supported action is train.",
      },
      {
        status:
          400,
      },
    );
  }

  try {
    const result =
      await trainHorizonModelSuite(
        {
          userId:
            user.id,

          request,
        },
      );

    return NextResponse.json(
      {
        ok:
          true,

        ...result,

        autonomousTradingEnabled:
          false,

        automaticPromotionEnabled:
          false,
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Horizon-model training failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown training error.",
      },
      {
        status:
          409,
      },
    );
  }
}