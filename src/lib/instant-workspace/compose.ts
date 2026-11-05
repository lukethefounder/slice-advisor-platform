import type { MarketEvidence, PulsePreferences, Entitlement, MarketQuote, MarketSeries, MarketNews } from "@/lib/market-evidence/contracts";
import type { SectionResponse } from "@/lib/market-visuals/contracts";
import type { Resource } from "@/lib/market-visuals/view-cache";
export function workspaceRequests(p: PulsePreferences) {
  const requests: Array<{ section: "quote" | "history" | "news"; symbol: string }> = p.symbols.map(symbol => ({ section: "quote", symbol }));
  requests.push({ section: "history", symbol: p.primary });
  if (p.chart?.compareSymbol) requests.push({ section: "history", symbol: p.chart.compareSymbol });
  if (p.showNews) requests.push(...p.symbols.map(symbol => ({ section: "news" as const, symbol })));
  return requests;
}
export function composeWorkspaceEvidence(p: PulsePreferences | undefined, entitlement: Entitlement, rows: Resource[], preparedAt: string): MarketEvidence | null {
  if (!p) return null;
  const wanted = workspaceRequests(p);
  const selected = rows.filter(row => { const id = row.value || row.request; return id && wanted.some(w => w.section === id.section && w.symbol === id.symbol) && (id.section !== "history" || id.range === p.range); });
  const values = selected.flatMap(r => r.value ? [r.value] : []);
  if (!values.length) return null;
  const find = (section: string, symbol: string) => values.find(v => v.section === section && v.symbol === symbol);
  const receipts = values.flatMap(v => v.receipts);
  const uniqueNews = [...new Map(values.filter(v => v.section === "news").flatMap(v => v.data as MarketNews[]).map(n => [n.url, n])).values()];
  const latestReceipt = receipts.map(r => r.retrievedAt).filter(t => Number.isFinite(Date.parse(t))).sort().at(-1) || preparedAt;
  return { version: "slice-market-evidence-v1", evidenceId: `view:${values.map(v => v.snapshotId?.slice(0, 10) || v.preparedAt).join(":")}`, provider: "Alpha Vantage", preparedAt: latestReceipt, requestedSymbols: p.symbols, entitlement,
    quotes: values.filter(v => v.section === "quote").flatMap(v => v.data as MarketQuote[]),
    series: (find("history", p.primary)?.data as MarketSeries | undefined) || null,
    comparison: p.chart?.compareSymbol ? (find("history", p.chart.compareSymbol)?.data as MarketSeries | undefined) || null : null,
    comparisonRequested: p.chart?.compareSymbol || null,
    news: uniqueNews.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8), receipts,
    issues: selected.filter(r => r.error).map(r => ({ scope: `${(r.value || r.request)!.section}:${(r.value || r.request)!.symbol}`, code: "REFRESH_NOTICE", message: r.error })),
    snapshots: values.flatMap(v => v.snapshotId ? [{ section: v.section, symbol: v.symbol, snapshotId: v.snapshotId }] : []), delivery: receipts.every(r => r.cacheHit) ? "saved" : "refreshed",
    newsRequested: p.showNews, newsRetrieved: values.some(v => v.section === "news"), marketIsOpen: null };
}
export function seedResources(rows: SectionResponse[]): Resource[] { return rows.map(value => ({ value, busy: false, error: "", receivedAt: Math.min(Date.now(), ...value.receipts.map(r => Date.parse(r.retrievedAt) || 0)), retryAt: 0, durationMs: null })); }
