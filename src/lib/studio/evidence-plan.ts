import type { ChatRequest } from "./contracts";
export type EvidenceSection = "quote" | "history" | "news" | "fundamentals" | "earnings";
export type EvidencePlan = { symbols: string[]; sections: EvidenceSection[]; requested: boolean; note: string; };
const ACRONYMS = new Set(["AI","API","USD","USA","US","UK","CEO","CFO","GDP","CPI","EPS","PE","RSI","SMA","EMA","ETF","ETFS","SEC","JSON","CSV","PDF","HTML","SQL","HTTP","HTTPS","MACD","EBITDA","ROE","ROA","YOY","TTM","P","E","I","WHAT","HOW","WHY","SHOW","TELL","PLEASE","HELP","EXPLAIN","ABOUT","COMPARE","ANALYZE","ANALYSE","SUMMARIZE","SUMMARY","TODAY","LATEST","PRICE","STOCK","MARKET","DATA","THE","THIS","THAT","AND","FOR","FROM","WITH","IS","ARE","DO","CAN","MY","ALL","NEWS","RISK","SECURITY"]);
const FINANCIAL = /\b(price|quote|stock|shares?|market|ticker|valuation|earnings?|revenue|margin|dividend|company|financial|trend|chart|volatility|momentum|headline|portfolio|investment|benchmark|etf|return|risk|technical|moving average|news)\b/i;
export function planEvidence(input: Pick<ChatRequest, "prompt" | "market" | "evidenceMode">, previousSymbols: string[] = []): EvidencePlan {
  if (input.evidenceMode === "off") return { symbols: [], sections: [], requested: false, note: "Market evidence is disabled for this message." };
  if (input.evidenceMode === "selected" && !input.market) return { symbols: [], sections: [], requested: false, note: "No manual market selection was attached." };
  const prompt = input.prompt;
  const explicit = [...prompt.matchAll(/(?:\$|\b(?:NASDAQ|NYSE|AMEX):)([A-Z][A-Z0-9.-]{0,11})\b/g)].map(m => m[1]);
  const capitalized = [...prompt.matchAll(/\b[A-Z][A-Z0-9.-]{1,7}\b/g)].map(m => m[0]).filter(s => !ACRONYMS.has(s));
  const selected = input.market?.symbols || [];
  const chosen = selected.length ? selected : explicit.length ? explicit : capitalized.length ? capitalized : FINANCIAL.test(prompt) ? previousSymbols : [];
  const symbols = [...new Set(chosen)].filter(s => /^[A-Z][A-Z0-9.-]{0,15}$/.test(s)).slice(0, 3);
  const requested = Boolean(input.market || explicit.length || capitalized.length || FINANCIAL.test(prompt));
  if (!symbols.length) return { symbols: [], sections: [], requested, note: requested ? "No exact ticker was selected or unambiguously identified. Explain the concept and ask for a ticker instead of guessing a company's identity." : "No current market lookup is needed for this general question." };
  const sections: EvidenceSection[] = ["quote"];
  if (/\b(earning|earnings|eps|results|surprise)\b/i.test(prompt)) sections.push("earnings");
  if (/valuation|fundamental|margin|revenue|dividend|capitalization|company|business|price.to.book|\bp\/e\b|\bpe ratio\b|profit|balance.sheet/i.test(prompt)) sections.push("fundamentals");
  if (/history|historical|chart|trend|volatility|momentum|performance|technical|moving.average|return|drawdown/i.test(prompt)) sections.push("history");
  if (input.market?.news || /\b(news|headlines?|catalyst|happened|why|today|latest)\b/i.test(prompt)) sections.push("news");
  return { symbols, sections, requested: true, note: selected.length ? "Using the user's selected symbols." : explicit.length || capitalized.length ? "Using exact ticker text in the question; provider identity checks still apply." : "Reusing only the instrument selection from the conversation. All observations are retrieved again." };
}
