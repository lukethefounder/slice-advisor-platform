import type { DatasetManifest } from "./contracts";
import { blocksImportQueue } from "./import-errors";
export type ImportState = { symbol: string; state: "pending" | "loading" | "ready" | "cached" | "failed"; dataset?: DatasetManifest; code?: string; message?: string; retryAt?: string };
export class ImportRequestError extends Error {
  constructor(public code: string, message: string, public retryAfterSeconds = 0) { super(message); }
}
export async function researchPost<T>(path: string, body: unknown, timeoutMs = 88000, signal?: AbortSignal, request: typeof fetch = (input, init) => globalThis.fetch(input, init)): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(); signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ImportRequestError("INVALID_RESPONSE", "The research service returned an invalid response.");
    const value = payload as Record<string, unknown>;
    if (!response.ok) { const retry = Number(response.headers.get("retry-after") || value.retryAfterSeconds || 0); throw new ImportRequestError(typeof value.code === "string" ? value.code : `HTTP_${response.status}`, typeof value.error === "string" ? value.error : typeof value.message === "string" ? value.message : "Research request failed.", Number.isFinite(retry) ? Math.max(0, retry) : 0); }
    return payload as T;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
}
export async function importHistoryQueue(input: { symbols: string[]; force: boolean; cancelled: () => boolean; onState: (s: ImportState) => void;
  onDataset: (d: DatasetManifest) => void; request?: typeof fetch; signal?: AbortSignal }) {
  const symbols = [...new Set(input.symbols)]; let completed = 0, failed = 0, paused = false;
  for (const symbol of symbols) {
    if (input.cancelled() || input.signal?.aborted) { paused = true; break; }
    input.onState({ symbol, state: "loading" });
    try {
      const response = await researchPost<{ dataset: DatasetManifest & { cached?: boolean } }>("/api/strategy-lab/datasets", { symbol, force: input.force }, 88000, input.signal, input.request);
      const d = response.dataset;
      if (!d || d.symbol !== symbol || typeof d.id !== "string" || d.provider !== "Alpha Vantage" || d.currency !== "USD" || !Number.isInteger(d.barCount) || d.barCount < 2 || !/^[a-f0-9]{64}$/.test(d.sourceSha256))
        throw new ImportRequestError("INVALID_DATASET", "Import response failed its identity, source, or coverage contract.");
      input.onDataset(d); completed++;
      input.onState({ symbol, state: d.cached ? "cached" : "ready", dataset: d, message: d.cached ? "Verified saved version reused" : "New provider history saved" });
    } catch (error) {
      if (input.cancelled() || input.signal?.aborted) { paused = true; break; }
      const e = error instanceof ImportRequestError ? error : new ImportRequestError("IMPORT_FAILED", error instanceof Error && error.name === "AbortError" ? "Import timed out. Refresh saved versions before retrying; the server may have completed." : "The import did not complete. Completed versions remain saved.");
      failed++;
      input.onState({ symbol, state: "failed", code: e.code, message: e.message, ...(e.retryAfterSeconds ? { retryAt: new Date(Date.now() + e.retryAfterSeconds * 1000).toISOString() } : {}) });
      if (blocksImportQueue(e.code) || ["HTTP_401", "HTTP_403", "HTTP_429", "IMPORT_FAILED"].includes(e.code)) { paused = true; break; }
    }
  }
  return { completed, failed, paused };
}
