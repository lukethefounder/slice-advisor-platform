import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  decideIntelligenceLaunch,
  getLaunchReadinessOverview,
  INTELLIGENCE_LAUNCH_MODES,
  recordRecoveryDrill,
  recordReleaseValidationEvidence,
  requestIntelligenceLaunch,
  runLaunchReadinessScan,
  type IntelligenceLaunchMode,
} from "@/lib/intelligence-forecast/launch-readiness";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type RequestBody = {
  action?: unknown;
  targetMode?: unknown;
  reason?: unknown;

  commitSha?: unknown;
  branch?: unknown;
  typecheckPassed?: unknown;
  buildPassed?: unknown;
  testsPassed?: unknown;
  dependencyAuditPassed?: unknown;
  secretScanPassed?: unknown;
  notes?: unknown;

  drillKey?: unknown;
  passed?: unknown;
  evidence?: unknown;

  approvalId?: unknown;
  decision?: unknown;
  confirmationPhrase?: unknown;
};

function cleanString(
  value: unknown,
  maximumLength: number,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maximumLength,
        )
    : "";
}

function parseLaunchMode(
  value: unknown,
): IntelligenceLaunchMode {
  const mode =
    cleanString(
      value,
      30,
    );

  return (
    INTELLIGENCE_LAUNCH_MODES as readonly string[]
  ).includes(
    mode,
  )
    ? mode as IntelligenceLaunchMode
    : "Production";
}

function responseHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",

    "X-Content-Type-Options":
      "nosniff",

    "Referrer-Policy":
      "no-referrer",

    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=()",
  };
}

export async function GET(
  request: Request,
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

        headers:
          responseHeaders(),
      },
    );
  }

  const url =
    new URL(
      request.url,
    );

  const targetMode =
    parseLaunchMode(
      url.searchParams.get(
        "target",
      ),
    );

  const overview =
    await getLaunchReadinessOverview({
      userId:
        user.id,

      targetMode,
    });

  return NextResponse.json(
    {
      ok:
        true,

      ...overview,
    },
    {
      status:
        200,

      headers:
        responseHeaders(),
    },
  );
}

export async function POST(
  request: Request,
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

        headers:
          responseHeaders(),
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

        headers:
          responseHeaders(),
      },
    );
  }

  const action =
    cleanString(
      body.action,
      100,
    );

  try {
    if (
      action ===
      "scan"
    ) {
      const result =
        await runLaunchReadinessScan({
          userId:
            user.id,

          targetMode:
            parseLaunchMode(
              body.targetMode,
            ),

          persist:
            true,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers:
            responseHeaders(),
        },
      );
    }

    if (
      action ===
      "record-validation"
    ) {
      const result =
        await recordReleaseValidationEvidence({
          userId:
            user.id,

          commitSha:
            cleanString(
              body.commitSha,
              100,
            ),

          branch:
            cleanString(
              body.branch,
              200,
            ),

          typecheckPassed:
            body.typecheckPassed ===
            true,

          buildPassed:
            body.buildPassed ===
            true,

          testsPassed:
            body.testsPassed ===
            true,

          dependencyAuditPassed:
            body.dependencyAuditPassed ===
            true,

          secretScanPassed:
            body.secretScanPassed ===
            true,

          notes:
            cleanString(
              body.notes,
              4_000,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers:
            responseHeaders(),
        },
      );
    }

    if (
      action ===
      "record-drill"
    ) {
      const result =
        await recordRecoveryDrill({
          userId:
            user.id,

          drillKey:
            cleanString(
              body.drillKey,
              100,
            ),

          passed:
            body.passed ===
            true,

          evidence:
            cleanString(
              body.evidence,
              8_000,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers:
            responseHeaders(),
        },
      );
    }

    if (
      action ===
      "request-launch"
    ) {
      const result =
        await requestIntelligenceLaunch({
          userId:
            user.id,

          targetMode:
            parseLaunchMode(
              body.targetMode,
            ),

          reason:
            cleanString(
              body.reason,
              4_000,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers:
            responseHeaders(),
        },
      );
    }

    if (
      action ===
      "decide-launch"
    ) {
      const decision =
        cleanString(
          body.decision,
          20,
        );

      if (
        decision !==
          "approve" &&
        decision !==
          "reject"
      ) {
        return NextResponse.json(
          {
            error:
              "decision must be approve or reject.",
          },
          {
            status:
              400,

            headers:
              responseHeaders(),
          },
        );
      }

      const result =
        await decideIntelligenceLaunch({
          userId:
            user.id,

          approvalId:
            cleanString(
              body.approvalId,
              100,
            ),

          decision,

          confirmationPhrase:
            cleanString(
              body.confirmationPhrase,
              200,
            ),

          notes:
            cleanString(
              body.notes,
              4_000,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers:
            responseHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        error:
          "Supported actions are scan, record-validation, record-drill, request-launch, and decide-launch.",
      },
      {
        status:
          400,

        headers:
          responseHeaders(),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Launch-control operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown launch-control error.",
      },
      {
        status:
          409,

        headers:
          responseHeaders(),
      },
    );
  }
}