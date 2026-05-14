export type BackendQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  provider: string;
  isLive: boolean;
  note: string;
};

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

export async function fetchBackendQuote(symbol: string): Promise<BackendQuote> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cleanSymbol = symbol.trim().toUpperCase();

  if (!apiKey) {
    return {
      symbol: cleanSymbol,
      price: null,
      change: null,
      changePct: null,
      provider: "No live provider",
      isLive: false,
      note: "ALPHA_VANTAGE_API_KEY is missing.",
    };
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", cleanSymbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const payload = await response.json();
    const raw = payload?.["Global Quote"] ?? {};

    const price = Number(raw["05. price"]);
    const change = Number(raw["09. change"]);
    const changePct = Number(String(raw["10. change percent"] ?? "").replace("%", ""));

    if (!Number.isFinite(price)) {
      return {
        symbol: cleanSymbol,
        price: null,
        change: null,
        changePct: null,
        provider: "Alpha Vantage",
        isLive: false,
        note:
          payload?.Note ||
          payload?.Information ||
          payload?.["Error Message"] ||
          "Provider did not return a valid quote.",
      };
    }

    return {
      symbol: cleanSymbol,
      price: round(price),
      change: Number.isFinite(change) ? round(change) : null,
      changePct: Number.isFinite(changePct) ? round(changePct) : null,
      provider: "Alpha Vantage",
      isLive: true,
      note: "Live quote loaded.",
    };
  } catch {
    return {
      symbol: cleanSymbol,
      price: null,
      change: null,
      changePct: null,
      provider: "Alpha Vantage",
      isLive: false,
      note: "Quote fetch failed.",
    };
  }
}