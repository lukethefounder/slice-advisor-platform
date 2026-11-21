import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getFounderMarketCredentials, listConnectedBrokerScopes } from "@/lib/agent-broker/service";
import { requireAgentDeskAccess } from "./access";
import { AgentDeskError, type DeskScope } from "./contracts";
import { decodeDeskEnvelope, encodeDeskEnvelope, readDeskRecord } from "./store";
import { marketStreamView, mergeMarketStream, validateMarketStreamInput, type SavedMarketStream } from "./market-stream-core";
import type { MarketStreamView } from "./market-stream-types";

export const AGENT_MARKET_EVENT = "SLICE_AGENT_DESK_MARKET_V1";
const key = (scope: DeskScope) => `agent-desk-market:${scope.firmId}`;
const connectionId = (scope: DeskScope) => createHash("sha256").update(JSON.stringify(scope)).digest("hex");
const equitySymbol = (value: string) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(value);
async function connectionFor(scope: DeskScope) {
  const credentials = await getFounderMarketCredentials(scope); if (!credentials) return null;
  const desk = await readDeskRecord(scope);
  const symbols = [...new Set([credentials.activePositionSymbol, desk.state.account.position?.symbol, desk.state.settings.symbol, ...credentials.allowedSymbols, ...desk.state.settings.policy.allowedSymbols, ...(desk.state.settings.scouting?.universe ?? [])].filter((value): value is string => Boolean(value) && equitySymbol(value!)))].slice(0, 30);
  return { id: connectionId(scope), ...scope, ...credentials, symbols };
}
/** This credential-bearing result is for the CRON-authenticated server worker
 * only. It must never be passed to a browser, model, board or audit event. */
export async function agentMarketWorkerConfiguration() {
  const scopes = await listConnectedBrokerScopes(100), connections = [];
  for (const scope of scopes) {
    try { const connection = await connectionFor(scope); if (connection) connections.push(connection); }
    catch { /* Invalid/revoked connections are removed; no secrets are logged. */ }
  }
  return { connections };
}
async function savedMarket(scope: DeskScope) {
  return prisma.backendPlatformEvent.findFirst({ where: { ...scope, eventKey: key(scope), eventType: AGENT_MARKET_EVENT }, select: { id: true, metadataJson: true } });
}
function decodeSaved(raw: string): SavedMarketStream {
  const saved = decodeDeskEnvelope(raw) as SavedMarketStream;
  if (saved?.version !== 1 || !Array.isArray(saved.quotes) || saved.quotes.length > 30 || !Number.isFinite(Date.parse(saved.checkedAt))) throw new AgentDeskError("MARKET_STORAGE_INVALID", "The market snapshot failed validation.", 503);
  return saved;
}
export async function ingestAgentMarket(value: unknown) {
  const input = validateMarketStreamInput(value), scope = { userId: input.userId, firmId: input.firmId };
  const connection = await connectionFor(scope);
  if (!connection || input.id !== connection.id || input.revision !== connection.revision || input.feed !== connection.feed) throw new AgentDeskError("MARKET_CONNECTION_CHANGED", "The worker connection was replaced or revoked.", 409);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await savedMarket(scope), saved = row ? decodeSaved(row.metadataJson) : null;
    const next = mergeMarketStream(saved, input, connection.symbols);
    // Recheck permission and credential generation immediately before a write.
    const latest = await getFounderMarketCredentials(scope);
    if (!latest || latest.revision !== connection.revision || latest.feed !== connection.feed) throw new AgentDeskError("MARKET_CONNECTION_CHANGED", "The worker connection was revoked.", 409);
    if (!row) {
      await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: key(scope) } }, update: {}, create: { ...scope, eventKey: key(scope), eventType: AGENT_MARKET_EVENT, area: "Intelligence", title: "Founder market stream", status: next.status, metadataJson: encodeDeskEnvelope(next) } });
      // Retry against the upsert winner; its newer quote is never overwritten.
      continue;
    }
    const changed = await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, ...scope, eventType: AGENT_MARKET_EVENT, metadataJson: row.metadataJson }, data: { metadataJson: encodeDeskEnvelope(next), status: next.status } });
    if (changed.count === 1) return { accepted: input.quotes.length };
  }
  throw new AgentDeskError("MARKET_SNAPSHOT_BUSY", "A newer market batch won this update. Retry the latest observations.", 409);
}
export async function readAgentMarket(scope: DeskScope): Promise<MarketStreamView> {
  await requireAgentDeskAccess(scope);
  const [credentials, row] = await Promise.all([getFounderMarketCredentials(scope), savedMarket(scope)]);
  const saved = row ? decodeSaved(row.metadataJson) : null;
  const compatible = credentials && saved && credentials.revision === saved.revision && credentials.feed === saved.feed;
  return marketStreamView(compatible ? saved : null);
}
