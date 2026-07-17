import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  chatWithAdvisorBot,
  createAdvisorDayBrief,
  decideAdvisorApproval,
  getAdvisorBotOverview,
  saveAdvisorMemory,
  updateAdvisorBotProfile,
} from "@/lib/intelligence-forecast/advisor-bot";

import {
  completeIntelligenceOperation,
  guardErrorResponse,
  guardIntelligenceOperation,
  IntelligenceGuardError,
  type IntelligenceOperation,
  type OperationGuardTicket,
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

  message?:
    unknown;

  styleInstructions?:
    unknown;

  memoryWeight?:
    unknown;

  autonomyLevel?:
    unknown;

  decisionRules?:
    unknown;

  escalationRules?:
    unknown;

  memoryKey?:
    unknown;

  memoryValue?:
    unknown;

  confidenceScore?:
    unknown;

  evidence?:
    unknown;

  approvalId?:
    unknown;

  decision?:
    unknown;

  notes?:
    unknown;

  force?:
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

function stringArray(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is string =>
        typeof item ===
        "string",
    )
    .map(
      (item) =>
        item
          .trim()
          .slice(
            0,
            500,
          ),
    )
    .filter(
      Boolean,
    )
    .slice(
      0,
      25,
    );
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

function guardedOperation(
  action: string,
): IntelligenceOperation | null {
  if (
    action ===
    "chat"
  ) {
    return "advisor.chat";
  }

  if (
    action ===
    "generate-brief"
  ) {
    return "advisor.brief";
  }

  return null;
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
    await getAdvisorBotOverview(
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

  const operation =
    guardedOperation(
      action,
    );

  let ticket:
    OperationGuardTicket | null =
    null;

  try {
    if (operation) {
      ticket =
        await guardIntelligenceOperation({
          userId:
            user.id,

          operation,

          request,
        });
    }

    let payload:
      Record<string, unknown>;

    if (
      action ===
      "chat"
    ) {
      const result =
        await chatWithAdvisorBot({
          userId:
            user.id,

          message:
            cleanString(
              body.message,
              8_000,
            ),

          request,
        });

      payload = {
        result,
      };
    } else if (
      action ===
      "save-profile"
    ) {
      const profile =
        await updateAdvisorBotProfile({
          userId:
            user.id,

          styleInstructions:
            cleanString(
              body.styleInstructions,
              4_000,
            ),

          memoryWeight:
            Number(
              body.memoryWeight,
            ),

          autonomyLevel:
            cleanString(
              body.autonomyLevel,
              100,
            ),

          decisionRules:
            stringArray(
              body.decisionRules,
            ),

          escalationRules:
            stringArray(
              body.escalationRules,
            ),
        });

      payload = {
        profile,
      };
    } else if (
      action ===
      "save-memory"
    ) {
      const memory =
        await saveAdvisorMemory({
          userId:
            user.id,

          memoryKey:
            cleanString(
              body.memoryKey,
              120,
            ),

          memoryValue:
            cleanString(
              body.memoryValue,
              4_000,
            ),

          confidenceScore:
            Number(
              body.confidenceScore,
            ),

          evidence:
            Array.isArray(
              body.evidence,
            )
              ? body.evidence
              : [],
        });

      payload = {
        memory,
      };
    } else if (
      action ===
      "generate-brief"
    ) {
      const result =
        await createAdvisorDayBrief({
          userId:
            user.id,

          force:
            body.force ===
            true,

          request,
        });

      payload = {
        ...result,
      };
    } else if (
      action ===
      "decide-approval"
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
        await decideAdvisorApproval({
          userId:
            user.id,

          approvalId:
            cleanString(
              body.approvalId,
              100,
            ),

          decision,

          notes:
            cleanString(
              body.notes,
              2_000,
            ),

          request,
        });

      payload = {
        ...result,
      };
    } else {
      return NextResponse.json(
        {
          error:
            "Supported actions are chat, save-profile, save-memory, generate-brief, and decide-approval.",
        },
        {
          status:
            400,

          headers:
            responseHeaders(),
        },
      );
    }

    if (ticket) {
      await completeIntelligenceOperation({
        userId:
          user.id,

        ticket,

        success:
          true,

        detail:
          `${action} completed.`,

        request,
      }).catch(
        console.error,
      );
    }

    return NextResponse.json(
      {
        ok:
          true,

        action,

        ...payload,

        productionControl:
          ticket
            ? {
                requestId:
                  ticket.requestId,

                operation:
                  ticket.operation,

                estimatedCostUsd:
                  ticket.estimatedCostUsd,

                costIsEstimate:
                  true,
              }
            : null,
      },
      {
        status:
          200,

        headers:
          responseHeaders(),
      },
    );
  } catch (error) {
    if (
      error instanceof
      IntelligenceGuardError
    ) {
      const guarded =
        guardErrorResponse(
          error,
        );

      return NextResponse.json(
        guarded.body,
        {
          status:
            guarded.status,

          headers: {
            ...responseHeaders(),

            ...guarded.headers,
          },
        },
      );
    }

    if (ticket) {
      await completeIntelligenceOperation({
        userId:
          user.id,

        ticket,

        success:
          false,

        error,

        request,
      }).catch(
        console.error,
      );
    }

    return NextResponse.json(
      {
        error:
          "Slice Advisor operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown advisor-bot error.",
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