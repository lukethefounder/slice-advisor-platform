/** Browser-safe contracts. API credentials are deliberately absent from every response. */
export type BrokerMode = "paper" | "live";
export type BrokerFeed = "iex" | "sip";
export type BrokerPolicy = {
  allowedSymbols: string[];
  maxOrderUsd: number;
  maxPositionPct: number;
  minCashPct: number;
  maxDailyLossPct: number;
  maxTradesPerDay: number;
  minResearchConfidence: number;
  minEvidenceCoverage: number;
  maxQuoteAgeSeconds: number;
  maxDecisionAgeSeconds: number;
  maxSpreadBps: number;
  maxPriceDriftBps: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldingMinutes: number;
  flattenBeforeCloseMinutes: number;
  feed: BrokerFeed;
};
export const DEFAULT_BROKER_POLICY: BrokerPolicy = {
  allowedSymbols: ["MSFT", "AAPL", "SPY"], maxOrderUsd: 500, maxPositionPct: 5,
  minCashPct: 80, maxDailyLossPct: 1, maxTradesPerDay: 4,
  minResearchConfidence: 60, minEvidenceCoverage: 60, maxQuoteAgeSeconds: 5,
  maxDecisionAgeSeconds: 180, maxSpreadBps: 20, maxPriceDriftBps: 30,
  stopLossPct: 1, takeProfitPct: 2, maxHoldingMinutes: 60,
  flattenBeforeCloseMinutes: 10, feed: "iex",
};
export type BrokerAccount = {
  id: string; numberMasked: string; status: string; currency: string;
  cash: number; equity: number; lastEquity: number; buyingPower: number;
  nonMarginableBuyingPower: number; tradingBlocked: boolean; accountBlocked: boolean;
  tradeSuspended: boolean; patternDayTrader: boolean; dayTradeCount: number;
};
export type BrokerPosition = {
  symbol: string; quantity: number; availableQuantity: number; side: "long" | "short";
  averageEntryPrice: number; currentPrice: number; marketValue: number; unrealizedPnl: number;
};
export type BrokerOrder = {
  id: string; clientOrderId: string; symbol: string; side: "buy" | "sell";
  type: string; orderClass: string; status: string; quantity: number;
  filledQuantity: number; filledAveragePrice: number | null;
  submittedAt: string | null; filledAt: string | null; updatedAt: string | null;
  limitPrice: number | null; stopPrice: number | null; legs: BrokerOrder[];
};
export type BrokerClock = { timestamp: string; isOpen: boolean; nextOpen: string; nextClose: string };
export type BrokerIntentStatus = "reserved" | "accepted" | "uncertain" | "filled" | "canceled" | "rejected";
export type BrokerIntentView = {
  id: string; cycleId: string | null; mode: BrokerMode; symbol: string; side: "buy" | "sell";
  quantity: number; status: BrokerIntentStatus; createdAt: string; updatedAt: string;
  clientOrderId: string; order: BrokerOrder | null; message: string;
};
export type BrokerFillObservation = {
  id: string; classification: "broker-paper" | "broker-live"; symbol: string; side: "buy" | "sell";
  orderId: string; clientOrderId: string; entryIntentId: string; cycleId: string | null;
  cumulativeFilledQuantity: number; averageFillPrice: number; filledAt: string | null; observedAt: string;
  grossRealizedPnl: number | null; netRealizedPnl: null; feesKnown: false;
  closedPosition: boolean; notes: string;
};
export type BrokerView = {
  version: 1; provider: "alpaca"; revision: number; mode: BrokerMode;
  encryptionConfigured: boolean; liveServerEnabled: boolean; connected: boolean;
  credentialsHint: string | null; connectedAt: string | null; lastCheckedAt: string | null;
  controls: { enabled: boolean; autonomous: boolean; paused: boolean };
  policy: BrokerPolicy; account: BrokerAccount | null; positions: BrokerPosition[];
  orders: BrokerOrder[]; clock: BrokerClock | null;
  activePositionSymbol: string | null; pendingIntent: BrokerIntentView | null;
  recentIntents: BrokerIntentView[]; recentFills: BrokerFillObservation[]; lastError: string | null; updatedAt: string;
  readiness: { canEnable: boolean; reasons: string[]; liveRequiresSip: true };
  limitations: string[];
};
export type BrokerCommand =
  | { action: "connect"; revision: number; mode: BrokerMode; apiKey: string; apiSecret: string }
  | { action: "settings"; revision: number; policy: BrokerPolicy }
  | { action: "enable-paper"; revision: number; autonomous: boolean; acknowledgement: "ENABLE PAPER TRADING" }
  | { action: "enable-live"; revision: number; autonomous: boolean; acknowledgement: "ENABLE LIVE TRADING" }
  | { action: "refresh" | "reconcile" | "pause" | "disconnect"; revision: number }
  | { action: "approve"; revision: number; cycleId: string };
export type BrokerSubmission = {
  status: "noop" | "blocked" | "pending" | "accepted" | "uncertain";
  code: string; message: string; intent: BrokerIntentView | null;
};
export class AgentBrokerError extends Error {
  constructor(public code: string, message: string, public status = 409) {
    super(message); this.name = "AgentBrokerError";
  }
}
