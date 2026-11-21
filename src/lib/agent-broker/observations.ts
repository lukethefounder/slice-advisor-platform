import "server-only";
import { prisma } from "@/lib/prisma";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { appendAgentBoardMessage } from "@/lib/agent-desk/collaboration";
import type { BrokerFillObservation, BrokerOrder } from "./contracts";
import { brokerHash, decodeBrokerEnvelope, encodeBrokerEnvelope, readBrokerIntent, type BrokerIntent } from "./store";
import { object } from "./validation";
export const BROKER_FILL_EVENT = "SLICE_AGENT_DESK_BROKER_FILL_V1";

/** Broker-confirmed cumulative fill snapshots. Never add snapshots together as separate executions. */
export async function observeBrokerFills(scope: DeskScope, intent: BrokerIntent): Promise<void> {
  await requireAgentDeskAccess(scope);
  if (!intent.order) return;
  const entry = intent.side === "buy" ? intent : intent.entryIntentId ? (await readBrokerIntent(scope, intent.entryIntentId))?.intent : null;
  if (!entry?.order) return;
  const parent = intent.order;
  const fills: BrokerOrder[] = intent.side === "buy" ? [parent, ...parent.legs] : [parent];
  for (const fill of fills) {
    if (!(fill.filledQuantity > 0 && fill.filledAveragePrice && fill.filledAveragePrice > 0)) continue;
    const id = brokerHash(JSON.stringify([scope.userId, scope.firmId, intent.accountId, intent.mode, fill.id, fill.filledQuantity])).slice(0, 40);
    const completeExit = fill.side === "sell" && fill.status === "filled" && fill.filledQuantity === entry.order.filledQuantity;
    const entryPrice = entry.order.filledAveragePrice;
    const observation: BrokerFillObservation = { id, classification: intent.mode === "live" ? "broker-live" : "broker-paper", symbol: fill.symbol, side: fill.side,
      orderId: fill.id, clientOrderId: fill.clientOrderId, entryIntentId: entry.id, cycleId: intent.cycleId ?? entry.cycleId,
      cumulativeFilledQuantity: fill.filledQuantity, averageFillPrice: fill.filledAveragePrice, filledAt: fill.filledAt, observedAt: new Date().toISOString(),
      grossRealizedPnl: fill.side === "sell" && entryPrice && fill.filledQuantity <= entry.order.filledQuantity ? (fill.filledAveragePrice - entryPrice) * fill.filledQuantity : null,
      netRealizedPnl: null, feesKnown: false, closedPosition: completeExit,
      notes: "A broker-observed cumulative fill snapshot, not an order estimate. Fees and net P&L are unavailable until reconciled from broker activity statements. Partial snapshots of one order must not be summed. External account activity can require separate attribution review." };
    await requireAgentDeskAccess(scope);
    await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: `agent-broker-fill:${scope.firmId}:${id}` } }, update: {},
      create: { ...scope, eventKey: `agent-broker-fill:${scope.firmId}:${id}`, eventType: BROKER_FILL_EVENT, area: "Intelligence", title: `${intent.mode === "live" ? "Live" : "Broker paper"} observed fill · ${fill.symbol}`,
        status: fill.status, sourceType: "FounderBrokerFill", sourceId: fill.id, metadataJson: encodeBrokerEnvelope(scope, "fill", observation) } });
    await appendAgentBoardMessage(scope, { id: `broker-fill:${id}`, cycleId: observation.cycleId ?? `broker:${entry.id}`, symbol: fill.symbol, round: 0, phase: "execution", from: "system", to: "founder", replyToIds: [], evidenceIds: [],
      body: `${intent.mode === "live" ? "Live Alpaca" : "Alpaca paper"} confirmed ${fill.side.toUpperCase()} fill: ${fill.filledQuantity} cumulative shares of ${fill.symbol} at average $${fill.filledAveragePrice.toFixed(4)}. ${observation.grossRealizedPnl === null ? "Entry exposure is open; an accepted order is not counted as profit." : `Observed gross realized P&L for these shares: $${observation.grossRealizedPnl.toFixed(2)}; net P&L is not yet known because fees are not reconciled.`} Order ${fill.id}. This observation is separate from Slice's local paper simulation.`,
      createdAt: observation.observedAt, researchRunId: null, sourceHash: null });
  }
}
export async function readBrokerFillObservations(scope: DeskScope, limit = 20): Promise<BrokerFillObservation[]> {
  await requireAgentDeskAccess(scope);
  const rows = await prisma.backendPlatformEvent.findMany({ where: { ...scope, eventType: BROKER_FILL_EVENT }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.max(1, Math.min(100, Math.floor(limit))), select: { metadataJson: true } });
  return rows.flatMap(row => { const value = decodeBrokerEnvelope(scope, "fill", row.metadataJson); return object(value) && typeof value.id === "string" && Number.isFinite(value.cumulativeFilledQuantity) && Number.isFinite(value.averageFillPrice) ? [value as unknown as BrokerFillObservation] : []; });
}
