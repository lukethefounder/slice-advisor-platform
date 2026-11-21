import type { DatasetManifest, StrategySpec } from "../strategy-lab/contracts";
import type { Readiness } from "../strategy-lab/readiness";
import { validateSpec } from "../strategy-lab/validation";

export type GuidedHistory = DatasetManifest & { cached?: boolean; reuseReason?: "verified-period" | "recent-import" };
export type GuidedProgress = { symbol: string; state: "loading" | "ready"; dataset?: GuidedHistory };
export type PreparedHistory = { inputKey: string; datasets: GuidedHistory[]; readiness: Readiness };
export type GuidedRequest = <T>(url: string, body: unknown, signal: AbortSignal) => Promise<T>;
export type GuidedStage = "history" | "validation" | "simulation";

function active(signal: AbortSignal, paused?: () => boolean) {
  signal.throwIfAborted();
  if (paused?.()) throw new DOMException("Preparation paused. Completed historical imports remain saved.", "AbortError");
}

/** Independent symbols share a bounded preparation queue. The calculation still
 * reads pinned, owner-scoped data and passes the engine's exact preflight. */
export async function prepareGuidedHistory(input: {
  spec: StrategySpec; signal: AbortSignal; request: GuidedRequest;
  paused?: () => boolean; onProgress?: (value: GuidedProgress) => void;
  onStage?: (stage: GuidedStage) => void; parallelism?: 1 | 2;
}): Promise<PreparedHistory> {
  const spec = validateSpec(input.spec);
  const symbols = [...new Set([...spec.symbols, spec.benchmark])];
  const collected = new Map<string, GuidedHistory>();
  let cursor = 0, failed = false, failure: unknown;
  input.onStage?.("history");
  async function worker() {
    while (cursor < symbols.length && !failed) {
      try {
        active(input.signal, input.paused);
        const symbol = symbols[cursor++];
        input.onProgress?.({ symbol, state: "loading" });
        const { dataset } = await input.request<{ dataset: GuidedHistory }>("/api/strategy-lab/datasets", { symbol, spec }, input.signal);
        active(input.signal);
        if (!dataset || dataset.symbol !== symbol || !dataset.id || dataset.provider !== "Alpha Vantage"
          || dataset.currency !== "USD" || !Number.isInteger(dataset.barCount) || dataset.barCount < 2
          || !/^[a-f0-9]{64}$/.test(dataset.sourceSha256)) throw new Error(`${symbol}: the returned history failed source validation.`);
        collected.set(symbol, dataset);
        input.onProgress?.({ symbol, state: "ready", dataset });
      } catch (error) { failed = true; failure = error; }
    }
  }
  // Finish both workers before allowing another operation after a failure.
  await Promise.all(Array.from({ length: Math.min(input.parallelism ?? 2, symbols.length) }, worker));
  if (failed) throw failure ?? new Error("Historical preparation could not complete.");
  active(input.signal, input.paused);
  const datasets = symbols.map(symbol => collected.get(symbol)!);
  input.onStage?.("validation");
  const { readiness } = await input.request<{ readiness: Readiness }>("/api/strategy-lab/readiness", { spec, datasetIds: datasets.map(d => d.id) }, input.signal);
  active(input.signal, input.paused);
  if (!readiness || typeof readiness.ok !== "boolean" || !Array.isArray(readiness.issues)) throw new Error("The historical coverage check returned an invalid response.");
  return { inputKey: JSON.stringify(spec), datasets, readiness };
}

export async function executeGuidedHistory(input: {
  spec: StrategySpec; prepared: PreparedHistory; signal: AbortSignal; request: GuidedRequest;
  onStage?: (stage: GuidedStage) => void;
}): Promise<{ runId: string; reused?: boolean }> {
  const spec = validateSpec(input.spec);
  active(input.signal);
  if (input.prepared.inputKey !== JSON.stringify(spec)) throw new Error("The test inputs changed. Verify the selected history again.");
  if (!input.prepared.readiness.ok) throw new Error(input.prepared.readiness.issues.map(issue => issue.message).join(" · ") || "Historical coverage needs review.");
  input.onStage?.("simulation");
  const result = await input.request<{ runId: string; reused?: boolean }>("/api/strategy-lab/runs", { spec, datasetIds: input.prepared.datasets.map(d => d.id) }, input.signal);
  active(input.signal);
  if (!result.runId || typeof result.runId !== "string") throw new Error("The response did not contain a saved result. Check Past results before submitting again.");
  return result;
}
