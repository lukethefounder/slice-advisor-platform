import { getCurrentUser } from "@/lib/auth";
import {
  archiveClientEmailDrafts,
  createAiClientEmailDrafts,
  createManualClientEmailDrafts,
  listClientEmailCenter,
  polishExistingClientEmailDraft,
  queueClientEmailDraftsForApproval,
  sendApprovedClientEmailDrafts,
  updateClientEmailDraft,
} from "@/lib/client-email-center";
import {
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import { getOpenAiRuntimeStatus } from "@/lib/integrations/ai";

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
        error: "Security policy blocked this client email request.",
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
    eventType: "client_email.console",
    title: "Client email center access",
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const result = await listClientEmailCenter(user);

    return noStoreJson({
      ...result,
      aiRuntime: getOpenAiRuntimeStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load client email center.",
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
    eventType: "client_email.action",
    title: "Client email center action",
    limit: 75,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = readAction(body.action);

    if (action === "createAiDrafts") {
      const result = await createAiClientEmailDrafts({
        user,
        clientIds: Array.isArray(body.clientIds) ? body.clientIds : [],
        includeAllClients: body.includeAllClients === true,
        topic: body.topic,
        purpose: body.purpose,
        tone: body.tone,
        advisorInstructions: body.advisorInstructions,
        callToAction: body.callToAction,
        researchContext: body.researchContext,
        draftDepth: body.draftDepth,
        useOpenAiResearch: body.useOpenAiResearch === true,
        queueForApproval: body.queueForApproval === true,
      });

      return noStoreJson(result);
    }

    if (action === "createManualDrafts") {
      const result = await createManualClientEmailDrafts({
        user,
        clientIds: Array.isArray(body.clientIds) ? body.clientIds : [],
        subject: body.subject,
        body: body.body,
        tone: body.tone,
        queueForApproval: body.queueForApproval === true,
      });

      return noStoreJson(result);
    }

    if (action === "updateDraft") {
      const result = await updateClientEmailDraft({
        user,
        draftId: body.draftId,
        subject: body.subject,
        body: body.body,
        status: body.status,
      });

      return noStoreJson(result);
    }

    if (action === "polishDraft") {
      const result = await polishExistingClientEmailDraft({
        user,
        draftId: body.draftId,
        polishMode: body.polishMode,
        advisorInstructions: body.advisorInstructions,
      });

      return noStoreJson(result);
    }

    if (action === "queueDraftsForApproval") {
      const result = await queueClientEmailDraftsForApproval({
        user,
        draftIds: Array.isArray(body.draftIds) ? body.draftIds : [],
        approvalTitle: body.approvalTitle,
      });

      return noStoreJson(result);
    }

    if (action === "archiveDrafts") {
      const result = await archiveClientEmailDrafts({
        user,
        draftIds: Array.isArray(body.draftIds) ? body.draftIds : [],
        restore: body.restore === true,
      });

      return noStoreJson(result);
    }

    if (action === "approveAndSend") {
      if (!body.approvalId || typeof body.approvalId !== "string") {
        return noStoreJson({ error: "approvalId is required." }, { status: 400 });
      }

      const result = await sendApprovedClientEmailDrafts({
        user,
        approvalId: body.approvalId,
        approvalNotes: body.approvalNotes,
      });

      return noStoreJson(result);
    }

    return noStoreJson(
      {
        error: "Unsupported client email action.",
        supportedActions: [
          "createAiDrafts",
          "createManualDrafts",
          "updateDraft",
          "polishDraft",
          "queueDraftsForApproval",
          "archiveDrafts",
          "approveAndSend",
        ],
      },
      { status: 400 }
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Client email action failed.",
      },
      { status: 500 }
    );
  }
}

export {};