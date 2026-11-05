import "server-only";
import { workspaceRequests } from "./compose";
import { serverWorkspaceAccess } from "./access";
import { cacheOnly } from "./cache-only";
import { readHomeSummary } from "./home-summary";
import { marketStorage, readMarketHealth, readPreferences } from "@/lib/market-evidence/storage";
import { marketConfiguration } from "@/lib/market-evidence/configuration";
import { loadMarketSection } from "@/lib/market-visuals/service";
import { parseSection } from "@/lib/market-visuals/parse";
import type { SectionRequest, SectionResponse } from "@/lib/market-visuals/contracts";
import type { MarketRange } from "@/lib/market-evidence/contracts";
import type { StudioScope } from "@/lib/studio/request";
import type { TerminalSeed, WorkspaceSeed } from "./contracts";
async function limited<T>(work: Promise<T>, fallback: T, ms = 1800): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work.catch(() => fallback), new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]); }
  finally { clearTimeout(timer); }
}
export async function savedSections(scope: StudioScope, requests: SectionRequest[]): Promise<SectionResponse[]> {
  const storage = cacheOnly(marketStorage(scope)), signal = AbortSignal.timeout(1800);
  const key = `${scope.userId}:${scope.firmId}`;
  // No external calls: cold sources return empty and the client refreshes independently.
  const completed: SectionResponse[] = [];
  await limited(Promise.all(requests.filter(r => r.section !== "options").slice(0, 14).map(async r => {
    try { const result = await loadMarketSection(r, storage, signal); if (!signal.aborted) completed.push({ ...result, scope: key }); } catch { /* A cold section must not discard other saved sections. */ }
  })), []);
  return completed.slice();
}
export async function workspaceBootstrap(): Promise<WorkspaceSeed> {
  const { access, session } = await serverWorkspaceAccess();
  const seed: WorkspaceSeed = { session, scope: access ? `${access.userId}:${access.firmId}` : null, settings: null, summary: null, sections: [], preparedAt: new Date().toISOString(), notes: [] };
  if (!access) return seed;
  const summary = limited(readHomeSummary(access), null);
  const settings = limited(Promise.all([readPreferences(access), readMarketHealth(access)]), null);
  const found = await settings;
  if (found) {
    seed.settings = { ok: true, ...found[0], market: found[1] };
    const p = found[0].preferences;
    const requests: SectionRequest[] = workspaceRequests(p).map(r=>({...r,range:p.range,confirmOptions:false}));
    seed.sections = await savedSections(access, requests);
  } else seed.notes.push("Saved settings took too long to load; the browser will retry without changing them.");
  seed.summary = await summary;
  if (!seed.sections.length) seed.notes.push("First visit or expired cache: no provider observations were preloaded.");
  return seed;
}
export async function terminalBootstrap(query: Record<string, string | string[] | undefined>): Promise<TerminalSeed> {
  const { access } = await serverWorkspaceAccess(), config = marketConfiguration();
  const result: TerminalSeed = { session: null, sections: [], preparedAt: new Date().toISOString(), notes: [] };
  if (!access) return result;
  result.session = { ok: true, scope: `${access.userId}:${access.firmId}`, configured: Boolean(config.key && config.key.toLowerCase() !== "demo"), entitlement: config.entitlement };
  const saved=typeof query.symbol==="string"?null:await limited(readPreferences(access),null);
  const symbol = typeof query.symbol === "string" ? query.symbol : saved?.preferences.primary || "SPY";
  const range = typeof query.range === "string" ? query.range : query.interval && query.interval !== "daily" ? "1D" : saved?.preferences.range || "3M";
  result.defaultSymbol=symbol;result.defaultRange=range as MarketRange;
  try {
    const input = parseSection({ section: "quote", symbol, range });
    result.sections = await savedSections(access, ["quote", "history", "fundamentals", "earnings", "news"].map(section => parseSection({ section, symbol: input.symbol, range: input.range as MarketRange })));
  } catch { result.notes.push("The requested instrument or range was invalid; choose a supported selection."); }
  return result;
}
