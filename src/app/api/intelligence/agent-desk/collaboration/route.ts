import { randomUUID } from "node:crypto";
import { apiJson, withApiRoute, ApiError } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { databaseFailure } from "@/lib/data-readiness/core";
import { normalizeResearchSymbol } from "@/lib/intelligence/research-instrument";
import { AGENT_ROLES, AgentDeskError, type AgentRole, type DeskScope } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { appendAgentBoardMessage, markAgentBriefRead, readAgentCollaboration } from "@/lib/agent-desk/collaboration";
import { validArtifactId } from "@/lib/agent-desk/collaboration-storage";
import { readDeskCycle, readDeskRecord } from "@/lib/agent-desk/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const route = "/api/intelligence/agent-desk/collaboration";
const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown): never {
  const database = databaseFailure(error);
  if (database) throw new ApiError({ ...database, expose: true });
  if (error instanceof AgentDeskError || error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
  throw error;
}

function messageSymbol(value: unknown): string {
  if (typeof value !== "string" || value.length > 32 || !/^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/i.test(value.trim())) throw new AgentDeskError("INVALID_AGENT_SYMBOL", "Choose a valid stock or explicit index symbol.", 400);
  try { return normalizeResearchSymbol(value); }
  catch { throw new AgentDeskError("INVALID_AGENT_SYMBOL", "Choose a valid stock or explicit index symbol.", 400); }
}

async function founderMessage(scope: DeskScope, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !["action", "body", "to", "cycleId", "symbol"].includes(key)) || typeof body.body !== "string" || !body.body.trim() || body.body.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.body) || (body.to !== undefined && ![...AGENT_ROLES, "team"].includes(String(body.to))) || (body.cycleId !== undefined && !validArtifactId(body.cycleId)))
    throw new AgentDeskError("INVALID_FOUNDER_MESSAGE", "Send a message of 1–4,000 characters to the team or one agent, without extra command fields or identity overrides.", 400);
  const requestedSymbol = body.symbol === undefined ? null : messageSymbol(body.symbol);
  const receipt = typeof body.cycleId === "string" ? await readDeskCycle(scope, body.cycleId) : null;
  if (body.cycleId !== undefined && !receipt) throw new AgentDeskError("AGENT_CYCLE_NOT_FOUND", "This discussion cycle does not exist in your active workspace.", 404);
  if (receipt && requestedSymbol && requestedSymbol !== receipt.cycle.symbol) throw new AgentDeskError("AGENT_MESSAGE_SYMBOL_MISMATCH", "A discussion note must use the symbol of its selected cycle.", 400);
  const symbol = receipt?.cycle.symbol ?? requestedSymbol ?? (await readDeskRecord(scope)).state.settings.symbol;
  const id = `founder:${randomUUID()}`;
  // These notes are user context, never certified evidence or trading commands.
  // Identity, source attribution, timestamps, and references are server-bound.
  return appendAgentBoardMessage(scope, { id, cycleId: receipt?.cycle.id ?? id, symbol,
    from: "founder", to: (body.to ?? "team") as AgentRole | "team", phase: "challenge", round: 0,
    body: body.body.trim(), replyToIds: [], evidenceIds: [], createdAt: new Date().toISOString(),
    researchRunId: receipt?.cycle.researchRunId ?? null, sourceHash: receipt?.cycle.sourceHash ?? null, report: null });
}

export const GET = withApiRoute({ route }, async ({ request }) => {
  const scope = await connectedAccess(request);
  try {
    await requireAgentDeskAccess(scope);
    await requireResearchStorage(["BackendPlatformEvent"]);
    return apiJson({ ok: true, collaboration: await readAgentCollaboration(scope) }, { headers });
  } catch (error) { failure(error); }
});

export const POST = withApiRoute({ route }, async ({ request }) => {
  const scope = await connectedAccess(request, true);
  try {
    await requireAgentDeskAccess(scope);
    await requireResearchStorage(["BackendPlatformEvent"]);
    const body = await readResearchJson(request);
    if (body.action === "read-brief") {
      if (Object.keys(body).some(key => !["action", "id"].includes(key)) || !validArtifactId(body.id)) throw new AgentDeskError("INVALID_AGENT_BRIEF_COMMAND", "Supply only the personal brief identity to mark it read.", 400);
      await markAgentBriefRead(scope, body.id);
    } else if (body.action === "message") await founderMessage(scope, body);
    else throw new AgentDeskError("INVALID_AGENT_COLLABORATION_COMMAND", "Choose a founder note or personal brief acknowledgment.", 400);
    return apiJson({ ok: true, collaboration: await readAgentCollaboration(scope) }, { headers });
  } catch (error) { failure(error); }
});
