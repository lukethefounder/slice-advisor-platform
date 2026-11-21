"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import { boardInstrument, boardPlan, buildBoardSnapshot } from "./board-snapshot";
import { useMarketResources } from "./client";
import { useMarketRefresh } from "./use-market-refresh";

export function useBoardMarket(tvSymbol: string, selected: string[], ready: boolean, automatic: boolean) {
  const session = useWorkspaceSession();
  const [blocked, setBlocked] = useState(false), [now, setNow] = useState(() => Date.now());
  const scope = !blocked && session.user?.id && session.firm?.id ? `${session.user.id}:${session.firm.id}` : null;
  const denied = useCallback(() => setBlocked(true), []);
  const { get, load } = useMarketResources(scope, denied);
  const metricsKey = [...new Set(selected)].sort().join(",");
  const instrument = useMemo(() => {
    try { return { symbol: boardInstrument(tvSymbol), error: "" }; }
    catch (error) { return { symbol: "", error: error instanceof Error ? error.message : "Unsupported metric instrument." }; }
  }, [tvSymbol]);
  const plan = useMemo(() => instrument.symbol ? boardPlan(instrument.symbol, metricsKey.split(",")) : [], [instrument.symbol, metricsKey]);
  const identity = `${scope}:${tvSymbol}:${metricsKey}`;
  const refresh = useCallback(async (force = false) => {
    if (!scope || !ready || !navigator.onLine || document.visibilityState !== "visible") return;
    // Each resource publishes immediately on completion; history never holds up its quote.
    await Promise.allSettled(plan.map(row => load(row.section, row.symbol, row.range, force)));
    setNow(Date.now());
  }, [scope, ready, plan, load]);
  useEffect(() => { void refresh(); }, [refresh]);
  const resources = plan.map(row => get(row.section, row.symbol, row.range));
  const rows = resources.flatMap(row => row.value ? [row.value] : []);
  const snapshot = scope && ready && instrument.symbol && rows.length ? buildBoardSnapshot(instrument.symbol, tvSymbol, selected, rows, now) : null;
  const cadence = snapshot?.session === "end-of-day" ? 60_000 : snapshot?.session === "delayed" ? 60_000 : 15_000;
  useMarketRefresh(Boolean(scope && ready && automatic && instrument.symbol), identity, refresh, cadence);
  const errors = [...new Set(resources.map(row => row.error).filter(Boolean))];
  const busy = resources.some(row => row.busy);
  const message = blocked ? "Your access changed. Sign in again before loading private market evidence."
    : instrument.error || errors.join(" ") || snapshot?.summary || (session.loading ? "Opening your firm market connection…" : "Loading quote and selected metrics independently…");
  const status = instrument.error ? "chart only" : blocked || errors.length ? snapshot ? "retained" : "unavailable" : snapshot?.price != null ? snapshot.session : busy || !ready || session.loading ? "loading" : "partial";
  return { snapshot, status, message, busy, refresh, cadence };
}
