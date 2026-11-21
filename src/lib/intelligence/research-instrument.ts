/** Research keeps index identity explicit; an index is never silently replaced by an ETF. */
export type ResearchInstrumentIdentity = {
  symbol: string;
  requestedSymbol: string;
  kind: "equity" | "index";
  providerSymbol: string | null;
  name: string;
  /** Specific index names only. Short, ambiguous ticker words are not news matches. */
  newsAliases: string[];
};

const INDICES: Record<string, { name: string; aliases: string[]; newsAliases: string[] }> = {
  SPX: {
    name: "S&P 500",
    aliases: ["^GSPC", "^SPX", "SP:SPX", "TVC:SPX"],
    newsAliases: ["S&P 500", "S&P500", "Standard & Poor’s 500", "Standard and Poor’s 500"],
  },
  NDX: {
    name: "Nasdaq 100",
    aliases: ["^NDX", "NASDAQ:NDX"],
    newsAliases: ["Nasdaq 100", "Nasdaq-100"],
  },
  DJI: {
    name: "Dow Jones Industrial Average",
    aliases: ["^DJI", "DJ:DJI", "TVC:DJI"],
    newsAliases: ["Dow Jones Industrial Average", "DJIA"],
  },
  COMP: {
    name: "Nasdaq Composite",
    aliases: ["^IXIC", "NASDAQ:IXIC", "NASDAQ:COMP"],
    newsAliases: ["Nasdaq Composite", "Nasdaq Composite Index"],
  },
  RUT: {
    name: "Russell 2000",
    aliases: ["^RUT", "TVC:RUT", "RUSSELL:RUT"],
    newsAliases: ["Russell 2000", "Russell 2000 Index"],
  },
  VIX: {
    name: "Cboe Volatility Index",
    aliases: ["^VIX", "TVC:VIX", "CBOE:VIX"],
    newsAliases: ["Cboe Volatility Index", "CBOE VIX", "VIX index"],
  },
};

export function resolveResearchInstrument(value: string): ResearchInstrumentIdentity {
  const requestedSymbol = String(value ?? "").trim().toUpperCase();
  if (!requestedSymbol || requestedSymbol.length > 32 || !/^[A-Z0-9.^:/-]+$/.test(requestedSymbol)) {
    throw new Error("Enter a valid stock symbol or an explicit index identifier such as INDEX:SPX.");
  }

  const alias = Object.entries(INDICES).find(([, index]) => index.aliases.includes(requestedSymbol));
  const symbol = alias ? `INDEX:${alias[0]}` : requestedSymbol;
  if (symbol.startsWith("INDEX:")) {
    const providerSymbol = symbol.slice(6);
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(providerSymbol)) {
      throw new Error("Enter an Alpha Vantage index code in the form INDEX:SPX.");
    }
    const known = INDICES[providerSymbol];
    return {
      symbol,
      requestedSymbol,
      kind: "index",
      providerSymbol,
      name: known?.name ?? `Index ${providerSymbol}`,
      newsAliases: [...(known?.newsAliases ?? [])],
    };
  }
  if (symbol.startsWith("^")) {
    // Unknown vendor aliases remain visibly unresolved, instead of becoming a stock ticker.
    return { symbol, requestedSymbol, kind: "index", providerSymbol: null, name: symbol, newsAliases: [] };
  }
  return { symbol, requestedSymbol, kind: "equity", providerSymbol: symbol, name: symbol, newsAliases: [] };
}

export function normalizeResearchSymbol(value: string) {
  return resolveResearchInstrument(value).symbol;
}
