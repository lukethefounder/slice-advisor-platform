import "server-only";
import { createHash } from "node:crypto";
import { marketConfiguration } from "@/lib/market-evidence/configuration";
import type { MarketStorage } from "@/lib/market-evidence/provider";
import { createMarketReader } from "@/lib/market-evidence/transport";
import { parseNews, parseQuotes, parseSeries } from "@/lib/market-evidence/core";
import type { MarketReceipt } from "@/lib/market-evidence/contracts";
import { parseCompany, parseEarnings, parseOptions } from "./parse";
import { sectionPolicy } from "./section-policy";
import type { Section, SectionData, SectionRequest, SectionResponse } from "./contracts";

export async function loadMarketSection<S extends Section>(input: SectionRequest & { section: S }, storage: MarketStorage, signal: AbortSignal, force = false): Promise<SectionResponse<S>> {
  const started = Date.now(), config = marketConfiguration(), receipts: MarketReceipt[] = [];
  const spec = sectionPolicy(input, config.entitlement);
  const call = createMarketReader(config, storage, signal, receipts, force);
  const data = await call(spec.endpoint, spec.params, spec.ttlMs, raw => {
    switch (input.section) {
      case "quote": return parseQuotes(raw, [input.symbol], config.entitlement);
      case "history": return parseSeries(raw, input.symbol, input.range, config.entitlement);
      case "news": return parseNews(raw, [input.symbol]);
      case "fundamentals": return parseCompany(raw, input.symbol);
      case "earnings": return parseEarnings(raw, input.symbol);
      case "options": return parseOptions(raw, input.symbol);
    }
  }) as SectionData[S];
  // A view ID describes its normalized content and source. No provider credential is included.
  const stableData = JSON.stringify(data, (name, value: unknown) => name === "state" || name === "note" ? undefined : value);
  const snapshotId = createHash("sha256").update(JSON.stringify({ section: input.section, symbol: input.symbol, range: input.section === "history" ? input.range : null, raw: receipts.map(r => r.sha256), data: stableData })).digest("hex");
  return { ok: true, section: input.section, symbol: input.symbol, range: input.range, preparedAt: new Date().toISOString(), elapsedMs: Date.now() - started, receipts, data, snapshotId };
}
