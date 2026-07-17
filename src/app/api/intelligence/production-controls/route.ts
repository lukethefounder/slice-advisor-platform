import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  createIntelligenceIncident,
  ensureProductionSecurityBaselines,
  getProductionControlOverview,
  runProductionHealthScan,
  setIntelligenceCircuitState,
  resolveIntelligenceIncident,
  updateIntelligenceBudgetPolicy,
} from "@/lib/intelligence-forecast/production-controls";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type RequestBody = {
  action?:
    unknown;

  dailyEstimatedCostLimitUsd?:
    unknown;

  warningPercent?:
    unknown;

  hardStopEnabled?:
    unknown;

  service?:
    unknown;

  reason?:
    unknown;

  minutes?:
    unknown;

  title?:
    unknown;

  summary?:
    unknown;

  severity?:
    unknown;

  sourceType?:
    unknown;

  sourceId?:
    unknown;

  incidentId?:
    unknown;

  resolution?:
    unknown;
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

function responseHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",

    "X-Content-Type-Options":
      "nosniff",
  };
}

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

        headers:
          responseHeaders(),
      },
    );
  }

  const overview =
    await getProductionControlOverview(
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
      "bootstrap"
    ) {
      const result =
        await ensureProductionSecurityBaselines(
          user.id,
        );

      return NextResponse.json(
        {
          ok:
            true,

          action,

          result,
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
      "scan"
    ) {
      const result =
        await runProductionHealthScan({
          userId:
            user.id,

          persist:
            true,

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          result,
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
      "update-budget"
    ) {
      const result =
        await updateIntelligenceBudgetPolicy({
          userId:
            user.id,

          dailyEstimatedCostLimitUsd:
            Number(
              body.dailyEstimatedCostLimitUsd,
            ),

          warningPercent:
            Number(
              body.warningPercent,
            ),

          hardStopEnabled:
            body.hardStopEnabled !==
            false,

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
        "open-circuit" ||
      action ===
        "close-circuit"
    ) {
      const result =
        await setIntelligenceCircuitState({
          userId:
            user.id,

          service:
            cleanString(
              body.service,
              100,
            ),

          state:
            action ===
            "open-circuit"
              ? "Open"
              : "Closed",

          reason:
            cleanString(
              body.reason,
              2_000,
            ),

          minutes:
            Number(
              body.minutes,
            ),

          automatic:
            false,

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
      "create-incident"
    ) {
      const severity =
        cleanString(
          body.severity,
          20,
        );

      const incident =
        await createIntelligenceIncident({
          userId:
            user.id,

          title:
            cleanString(
              body.title,
              300,
            ),

          summary:
            cleanString(
              body.summary,
              4_000,
            ),

          severity:
            severity ===
            "Critical"
              ? "Critical"
              : severity ===
                  "Info"
                ? "Info"
                : "Warning",

          sourceType:
            cleanString(
              body.sourceType,
              100,
            ),

          sourceId:
            cleanString(
              body.sourceId,
              200,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          incident,
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
      "resolve-incident"
    ) {
      const incident =
        await resolveIntelligenceIncident({
          userId:
            user.id,

          incidentId:
            cleanString(
              body.incidentId,
              100,
            ),

          resolution:
            cleanString(
              body.resolution,
              4_000,
            ),

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          incident,
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
          "Supported actions are bootstrap, scan, update-budget, open-circuit, close-circuit, create-incident, and resolve-incident.",
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
          "Production-control operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown production-control error.",
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