import "server-only";
import { randomUUID } from "node:crypto";
import type { ChatRequest, StudioMessage } from "./contracts";
import type { StudioScope } from "./request";
import { planEvidence } from "./evidence-plan";
import { marketConfiguration } from "@/lib/market-evidence/configuration";
import { marketStorage } from "@/lib/market-evidence/storage";
import { safeMarketError } from "@/lib/market-evidence/transport";
import { loadMarketSection } from "@/lib/market-visuals/service";
import type { MarketEvidence, MarketNews, MarketQuote, MarketSeries } from "@/lib/market-evidence/contracts";
import type { Company, Earnings } from "@/lib/market-visuals/contracts";
import { analyzeLoadedSeries } from "@/lib/instant-workspace/chart-analysis";
export async function gatherStudioEvidence(scope: StudioScope, input: ChatRequest, previous: StudioMessage[], signal: AbortSignal, status: (s: string) => void): Promise<MarketEvidence | null> {
  const prior = [...previous].reverse().find(m => m.marketEvidence)?.marketEvidence?.requestedSymbols || [];
  const plan = planEvidence(input, prior);
  if (!plan.requested) return null;
  const config = marketConfiguration(), store = marketStorage(scope);
  const e: MarketEvidence = { version: "slice-market-evidence-v1", evidenceId: randomUUID(), preparedAt: new Date().toISOString(), provider: "Alpha Vantage", entitlement: config.entitlement, requestedSymbols: plan.symbols, quotes: [], series: null, news: [], receipts: [], snapshots: [], details: [], issues: [], delivery: "refreshed", newsRequested: plan.sections.includes("news"), newsRetrieved: false, marketIsOpen: null, retrievalNote: plan.note };
  if (!plan.symbols.length) { e.issues.push({ scope: "selection", code: "SYMBOL_NEEDED", message: plan.note }); return e; }
  // Round-robin sources so a multi-symbol question isn't silently biased toward its first ticker.
  const requests = plan.sections.flatMap(section => plan.symbols.map(symbol => ({ section, symbol, range: "3M" as const, confirmOptions: false })));
  const work = requests.slice(0, 8);
  if (work.length < requests.length) e.issues.push({ scope: "budget", code: "RETRIEVAL_CAP", message: "This turn is limited to eight section reads. Focus on one or two instruments for broader coverage." });
  status(`Checking ${work.length} market sections using the shared observation cache…`);
  await Promise.all(work.map(async r => {
    try {
      const value = await loadMarketSection(r, store, signal);
      e.receipts.push(...value.receipts); e.snapshots!.push({ symbol: r.symbol, section: r.section, snapshotId: value.snapshotId || "" });
      if (r.section === "quote") e.quotes.push(...value.data as MarketQuote[]);
      else if (r.section === "news") { e.news.push(...value.data as MarketNews[]); e.newsRetrieved = true; }
      else {
        let data: Record<string, unknown>;
        if (r.section === "history") {
          const s = value.data as MarketSeries, analysis = analyzeLoadedSeries(s);
          data = { first: s.bars[0], last: s.bars.at(-1), count: s.bars.length, observedAt: s.observedAt, note: s.note, basis: s.basis, changePct: analysis?.changePct ?? null, closingDrawdownPct: analysis?.drawdownPct ?? null, volatilityPct: analysis?.volatilityPct ?? null, volatilityDefinition: analysis?.volatilityLabel ?? null, simpleRsi14: analysis?.rsi14 ?? null };
        } else if (r.section === "earnings") data = { rows: (value.data as Earnings).rows.slice(0, 8), note: "Reported records retrieved today; original-release vintages are not established." };
        else { const c = value.data as Company; data = { name: c.name, sector: c.sector, industry: c.industry, currency: c.currency, exchange: c.exchange, latestQuarter: c.latestQuarter, description: c.description.slice(0, 1800), metrics: c.metrics, note: "Provider overview; retrieval time is not the financial reporting date." }; }
        e.details!.push({ section: r.section, symbol: r.symbol, snapshotId: value.snapshotId || "", receipts: value.receipts, data });
      }
    } catch (error) { const x = safeMarketError(error); e.issues.push({ scope: `${r.section}:${r.symbol}`, code: x.code, message: x.message }); }
  }));
  e.quotes.sort((a,b) => a.symbol.localeCompare(b.symbol));
  e.details!.sort((a,b) => `${a.section}:${a.symbol}`.localeCompare(`${b.section}:${b.symbol}`));
  e.news = [...new Map(e.news.map(n => [n.url,n])).values()].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0,8);
  return e;
}
export function evidenceOnlyText(e: MarketEvidence, reason: string): string {
  const lines = ["## Verified evidence summary", "AI generation did not complete. This is a direct summary of returned provider fields, not a model-generated answer.", `Connection notice: ${reason}`, ""];
  for (const q of e.quotes) lines.push(`- ${q.symbol}: ${q.price}; change ${q.changePct === null ? "unavailable" : q.changePct.toFixed(2) + "%"}; ${q.state}; ${q.priceKind}; observed ${q.observedAt}; source ${q.endpoint}.`);
  for (const d of e.details || []) lines.push(`- ${d.symbol}: ${d.section} records are available in the evidence card. Snapshot ${d.snapshotId.slice(0,16)}.`);
  for (const n of e.news) lines.push(`- ${n.title} — ${n.source}, published ${n.publishedAt}.`);
  if (e.issues.length) { lines.push("", "### Coverage to resolve"); for (const i of e.issues) lines.push(`- ${i.scope}: ${i.message}`); }
  lines.push("", "Review source times and the attached fields. Re-test the text connection before requesting an AI interpretation; no missing metric has been estimated.");
  return lines.join("\n");
}
