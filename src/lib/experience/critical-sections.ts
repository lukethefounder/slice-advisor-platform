import type { SectionRequest } from "@/lib/market-visuals/contracts";
/** Cache-only server preload; no provider request or TTL changes. Other tabs load on demand. */
export function initialMarketSections(view: unknown, input: SectionRequest): SectionRequest[] {
  const selected = typeof view === "string" ? view : "market";
  const nativeIndex = input.symbol.startsWith("INDEX:");
  const sections: SectionRequest["section"][] = ["quote"];
  if (["market", "technicals", "compare", "pine"].includes(selected) ||
      !["forecast", "fundamentals", "earnings", "news", "options", "data"].includes(selected)) sections.push("history");
  else if (!nativeIndex && ["fundamentals", "earnings", "news"].includes(selected)) sections.push(selected as SectionRequest["section"]);
  return sections.map(section => ({ ...input, section, confirmOptions: false }));
}
