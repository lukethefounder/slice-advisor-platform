import type { MarketRange } from "@/lib/market-evidence/contracts";
import { SECTION_TTLS, type Section, type SectionResponse } from "./contracts";
export type Resource<S extends Section = Section> = { request?: { section: Section; symbol: string; range: MarketRange }; value?: SectionResponse<S>; busy: boolean; error: string; receivedAt: number; retryAt: number; durationMs: number | null };
export const EMPTY_RESOURCE: Resource = { busy: false, error: "", receivedAt: 0, retryAt: 0, durationMs: null };
export const resourceKey = (section: Section, symbol: string, range: MarketRange) => `${section}:${symbol}:${section === "history" ? range : "snapshot"}`;
export function snapshotTime(r: SectionResponse): number {
  if (r.section === "quote") return Math.max(0, ...(r.data as import("@/lib/market-evidence/contracts").MarketQuote[]).map(q => Date.parse(q.observedAt) || 0));
  if (r.section === "history") return Date.parse((r.data as import("@/lib/market-evidence/contracts").MarketSeries).observedAt) || 0;
  return Math.max(0, ...r.receipts.map(p => Date.parse(p.retrievedAt) || 0));
}
export function shouldReplace(before: SectionResponse | undefined, after: SectionResponse): boolean {
  if (!before) return true;
  if (before.scope !== after.scope || resourceKey(before.section, before.symbol, before.range) !== resourceKey(after.section, after.symbol, after.range)) return false;
  const a = snapshotTime(before), b = snapshotTime(after);
  if (a !== b) return b > a;
  const receipt = (r: SectionResponse) => Math.max(0, ...r.receipts.map(p => Date.parse(p.retrievedAt) || 0));
  return receipt(after) >= receipt(before);
}
/** In-memory only, never localStorage. Session changes discard both results and pending reads. */
export class MarketViewCache {
  scope: string | null = null;
  entries = new Map<string, Resource>();
  private jobs = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  private listeners = new Set<() => void>();
  private epoch = 0;
  constructor(
    private request: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private notify() { for (const fn of this.listeners) fn(); }
  activate(scope: string | null) {
    if (this.scope === scope) return;
    this.epoch++; this.jobs.forEach(j => j.controller.abort()); this.jobs.clear(); this.entries.clear(); this.scope = scope; this.notify();
  }
  clear() { this.activate(null); }
  seed(scope: string, rows: SectionResponse[]) {
    if (this.scope !== scope) return;
    for (const row of rows) {
      if (row.scope !== scope || row.section === "options" || !row.data) continue;
      const key = resourceKey(row.section, row.symbol, row.range), prior = this.entries.get(key);
      if (!shouldReplace(prior?.value, row)) continue;
      const retrieved = Math.min(Date.now(), ...row.receipts.map(r => Date.parse(r.retrievedAt) || 0));
      this.entries.set(key, { ...EMPTY_RESOURCE, ...prior, value: row, receivedAt: retrieved });
    }
    this.trim(); this.notify();
  }
  private trim() {
    while (this.entries.size > 48) {
      const key = [...this.entries.keys()].find(k => !this.jobs.has(k)); if (!key) break; this.entries.delete(key);
    }
  }
  load(scope: string, section: Section, symbol: string, range: MarketRange, refresh = false, onUnauthorized: () => void = () => {}) {
    if (this.scope !== scope) return Promise.resolve();
    const key = resourceKey(section, symbol, range), existing = this.jobs.get(key);
    if (existing) return existing.promise;
    const before = this.entries.get(key) || EMPTY_RESOURCE;
    if (before.retryAt > Date.now() || (!refresh && before.value && Date.now() - before.receivedAt < SECTION_TTLS[section])) return Promise.resolve();
    const controller = new AbortController(), epoch = this.epoch;
    const job = { controller, promise: Promise.resolve() };
    this.jobs.set(key, job);
    this.entries.set(key, { ...before, request: { section, symbol, range }, busy: true, error: "" }); this.trim(); this.notify();
    job.promise = (async () => {
      const started = Date.now(), timer = setTimeout(() => controller.abort(), 50_000);
      try {
        const response = await this.request("/api/market-visuals/sections", { method: "POST", cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, symbol, range, confirmOptions: section === "options" }) });
        const p = await response.json() as Partial<SectionResponse> & { message?: string };
        if (epoch !== this.epoch) return;
        if (response.status === 401 || response.status === 403 || (response.ok && p.ok && p.scope !== scope)) { this.clear(); onUnauthorized(); return; }
        if (!response.ok || !p.ok) {
          const n = Number(response.headers.get("retry-after"));
          const seconds = [409,429].includes(response.status) ? Math.min(300, Math.max(10, Number.isFinite(n) && n > 0 ? n : 30)) : 15;
          this.entries.set(key, { ...(this.entries.get(key) || before), request: { section, symbol, range }, busy: false, error: p.message || "This section could not refresh. Its last successful snapshot is retained.", retryAt: Date.now() + seconds * 1000, durationMs: Date.now() - started }); return;
        }
        if (p.section !== section || p.symbol !== symbol || (section === "history" && p.range !== range) || p.data === undefined || !Array.isArray(p.receipts)) throw new Error("A mismatched response was rejected.");
        const value = p as SectionResponse;
        const newer = shouldReplace(this.entries.get(key)?.value, value);
        this.entries.set(key, { request: { section, symbol, range }, value: newer ? value : this.entries.get(key)?.value, busy: false, error: newer ? "" : "An older provider observation was ignored. The newer saved snapshot remains visible.", receivedAt: Date.now(), retryAt: 0, durationMs: Date.now() - started });
      } catch (error) {
        if (epoch !== this.epoch) return;
        this.entries.set(key, { ...(this.entries.get(key) || before), request: { section, symbol, range }, busy: false, error: controller.signal.aborted ? "The refresh timed out; the saved snapshot is still available." : error instanceof Error ? error.message : "Connection unavailable.", retryAt: Date.now() + 15_000, durationMs: Date.now() - started });
      } finally {
        clearTimeout(timer);
        if (this.jobs.get(key) === job) this.jobs.delete(key);
        if (epoch === this.epoch) this.notify();
      }
    })();
    return job.promise;
  }
}
