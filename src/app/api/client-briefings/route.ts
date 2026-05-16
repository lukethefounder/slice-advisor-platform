import { getCurrentUser } from "@/lib/auth";
import {
  createClientBriefingPack,
  listClientBriefingConsole,
  sendApprovedClientBriefings,
} from "@/lib/client-briefing-engine";
import {
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readAction(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client briefing request.",
      },
      { status: 403 }
    )
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Communication",
    eventType: "client_briefing.console",
    title: "Client briefing console access",
    limit: 100,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const consoleData = await listClientBriefingConsole(user);
    return noStoreJson(consoleData);
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load client briefing console.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Communication",
    eventType: "client_briefing.action",
    title: "Client briefing action",
    limit: 40,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = readAction(body.action);

    if (action === "createDrafts") {
      const result = await createClientBriefingPack({
        user,
        symbols: Array.isArray(body.symbols)
          ? body.symbols
          : String(body.symbols ?? "").split(/[,;\s]+/),
        holdingQuery: body.holdingQuery,
        briefingTitle: body.briefingTitle,
        sourceTitle: body.sourceTitle,
        sourceUrl: body.sourceUrl,
        sourceName: body.sourceName,
        researchSummary: body.researchSummary,
        advisorMessage: body.advisorMessage,
        tone: body.tone,
        includeAllMatchingClients: body.includeAllMatchingClients !== false,
      });

      return noStoreJson(result);
    }

    if (action === "approveAndSend") {
      if (!body.approvalId || typeof body.approvalId !== "string") {
        return noStoreJson({ error: "approvalId is required." }, { status: 400 });
      }

      const result = await sendApprovedClientBriefings({
        user,
        approvalId: body.approvalId,
        approvalNotes: body.approvalNotes,
      });

      return noStoreJson(result);
    }

    return noStoreJson(
      {
        error: "Unsupported client briefing action.",
        supportedActions: ["createDrafts", "approveAndSend"],
      },
      { status: 400 }
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Client briefing action failed.",
      },
      { status: 500 }
    );
  }
}