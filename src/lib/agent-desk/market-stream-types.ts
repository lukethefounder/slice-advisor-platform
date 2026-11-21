/** Informational market observations. Every brokerage order separately obtains
 * and checks a fresh entitled quote directly with the broker. */
export type MarketStreamQuote = { symbol: string; bid: number; ask: number; mid: number; spreadBps: number; observedAt: string; receivedAt: string; ageMs: number; transportLagMs: number };
export type MarketStreamView = { version: 1; status: "connecting" | "live" | "stale" | "offline" | "error"; feed: "iex" | "sip" | null; checkedAt: string; lastMessageAt: string | null; quotes: MarketStreamQuote[]; message: string | null };
export type MarketStreamInput = { id: string; userId: string; firmId: string; revision: number; feed: "iex" | "sip"; status: "connecting" | "live" | "offline" | "error"; message?: string; quotes: Array<{ symbol: string; bid: number; ask: number; observedAt: string; receivedAt: string }> };
