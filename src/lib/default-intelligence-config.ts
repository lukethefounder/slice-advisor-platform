type SourceTier =
  | "official-regulatory"
  | "official-exchange"
  | "macro-source"
  | "market-news"
  | "crypto-source"
  | "venture-source"
  | "unknown";

type SourceSeed = {
  sourceId: string;
  name: string;
  description: string;
  sourceUrl: string | null;
  sourceTier: SourceTier;
  category: string;
  enabled?: boolean;
  minScoreToRetain?: number;
  minScoreToAlert?: number;
  maxItemsPerRun?: number;
  cooldownMinutes?: number;
  priority?: number;
};

const SOURCE_LIMIT = 200;

const TIER_DEFAULTS: Record<
  SourceTier,
  {
    minScoreToRetain: number;
    minScoreToAlert: number;
    maxItemsPerRun: number;
    cooldownMinutes: number;
    priority: number;
  }
> = {
  "official-regulatory": {
    minScoreToRetain: 42,
    minScoreToAlert: 78,
    maxItemsPerRun: 35,
    cooldownMinutes: 6,
    priority: 1,
  },
  "official-exchange": {
    minScoreToRetain: 40,
    minScoreToAlert: 76,
    maxItemsPerRun: 35,
    cooldownMinutes: 5,
    priority: 1,
  },
  "macro-source": {
    minScoreToRetain: 52,
    minScoreToAlert: 84,
    maxItemsPerRun: 30,
    cooldownMinutes: 12,
    priority: 3,
  },
  "market-news": {
    minScoreToRetain: 58,
    minScoreToAlert: 88,
    maxItemsPerRun: 28,
    cooldownMinutes: 12,
    priority: 5,
  },
  "crypto-source": {
    minScoreToRetain: 64,
    minScoreToAlert: 92,
    maxItemsPerRun: 25,
    cooldownMinutes: 18,
    priority: 7,
  },
  "venture-source": {
    minScoreToRetain: 64,
    minScoreToAlert: 92,
    maxItemsPerRun: 25,
    cooldownMinutes: 24,
    priority: 7,
  },
  unknown: {
    minScoreToRetain: 72,
    minScoreToAlert: 96,
    maxItemsPerRun: 18,
    cooldownMinutes: 20,
    priority: 9,
  },
};

function makeSource(seed: SourceSeed) {
  const defaults = TIER_DEFAULTS[seed.sourceTier];

  return {
    enabled: seed.enabled ?? true,
    minScoreToRetain: seed.minScoreToRetain ?? defaults.minScoreToRetain,
    minScoreToAlert: seed.minScoreToAlert ?? defaults.minScoreToAlert,
    maxItemsPerRun: seed.maxItemsPerRun ?? defaults.maxItemsPerRun,
    cooldownMinutes: seed.cooldownMinutes ?? defaults.cooldownMinutes,
    priority: seed.priority ?? defaults.priority,
    ...seed,
  };
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

function googleNewsSource(input: {
  index: number;
  query: string;
  category: string;
  priority?: number;
  enabled?: boolean;
}) {
  const encoded = encodeURIComponent(`${input.query} when:7d`);

  return makeSource({
    sourceId: `open-web-${String(input.index + 1).padStart(3, "0")}-${slug(input.query)}`,
    name: `Open Web Scan · ${input.query}`,
    description:
      "Broad open-web intelligence feed. This source type is intentionally treated as lower trust until corroborated by stronger or multiple independent sources.",
    sourceUrl: `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`,
    sourceTier: "unknown",
    category: input.category,
    enabled: input.enabled ?? true,
    minScoreToRetain: 74,
    minScoreToAlert: 97,
    maxItemsPerRun: 16,
    cooldownMinutes: 20,
    priority: input.priority ?? 12,
  });
}

const OFFICIAL_AND_MARKET_SOURCES = [
  makeSource({
    sourceId: "sec-press-releases",
    name: "SEC Press Releases",
    description:
      "Official SEC press releases, enforcement actions, policy updates, market-regulatory announcements, and investor alerts.",
    sourceUrl: "https://www.sec.gov/news/pressreleases.rss",
    sourceTier: "official-regulatory",
    category: "Regulatory / Legal",
    priority: 1,
  }),
  makeSource({
    sourceId: "sec-structured-us-gaap",
    name: "SEC Structured Disclosure Feed",
    description:
      "Official SEC structured disclosure feed for XBRL submissions, accounting-related disclosures, and filing materials.",
    sourceUrl: "https://www.sec.gov/Archives/edgar/usgaap.rss.xml",
    sourceTier: "official-regulatory",
    category: "SEC Filings",
    priority: 1,
  }),
  makeSource({
    sourceId: "sec-investor-alerts",
    name: "SEC Investor Alerts",
    description:
      "SEC investor alerts and bulletins for scams, market structure, fraud warnings, and investor protection notices.",
    sourceUrl: "https://www.sec.gov/rss/investor/alerts.xml",
    sourceTier: "official-regulatory",
    category: "Regulatory / Legal",
    priority: 1,
  }),
  makeSource({
    sourceId: "nasdaq-trade-halts",
    name: "Nasdaq Trade Halts",
    description:
      "Nasdaq Trader feed for trading halts, resumptions, volatility pauses, and urgent exchange-level events.",
    sourceUrl: "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
    sourceTier: "official-exchange",
    category: "Exchange Alerts",
    priority: 1,
  }),
  makeSource({
    sourceId: "nasdaq-current-headlines",
    name: "Nasdaq Trader Current Headlines",
    description:
      "Nasdaq Trader current headline feed for exchange alerts, market-structure notices, and trading-related updates.",
    sourceUrl:
      "https://www.nasdaqtrader.com/rss.aspx?categorylist=0&feed=currentheadlines",
    sourceTier: "official-exchange",
    category: "Exchange Alerts",
    priority: 2,
  }),
  makeSource({
    sourceId: "finra-news",
    name: "FINRA News",
    description:
      "FINRA updates for brokerage supervision, enforcement, investor protection, and market conduct.",
    sourceUrl: "https://www.finra.org/media-center/newsreleases/rss.xml",
    sourceTier: "official-regulatory",
    category: "Regulatory / Legal",
    priority: 2,
  }),
  makeSource({
    sourceId: "cftc-press-releases",
    name: "CFTC Press Releases",
    description:
      "Commodity Futures Trading Commission releases for derivatives, enforcement, commodities, swaps, crypto, and market integrity.",
    sourceUrl: "https://www.cftc.gov/PressRoom/PressReleases/rss.xml",
    sourceTier: "official-regulatory",
    category: "Regulatory / Legal",
    priority: 2,
  }),
  makeSource({
    sourceId: "fdic-press-releases",
    name: "FDIC Press Releases",
    description:
      "FDIC updates for banking stability, supervision, deposit insurance, enforcement, and financial system risk.",
    sourceUrl: "https://www.fdic.gov/news/press-releases/rss.xml",
    sourceTier: "official-regulatory",
    category: "Banks / Financial Stability",
    priority: 2,
  }),
  makeSource({
    sourceId: "federal-reserve-all-press",
    name: "Federal Reserve Press Releases",
    description:
      "Federal Reserve official press releases covering policy, supervision, bank regulation, monetary policy, and system announcements.",
    sourceUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
    sourceTier: "macro-source",
    category: "Macro / Rates",
    priority: 2,
  }),
  makeSource({
    sourceId: "federal-reserve-monetary-policy",
    name: "Federal Reserve Monetary Policy",
    description:
      "Federal Reserve monetary policy updates, rate-sensitive statements, and central-bank communications.",
    sourceUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    sourceTier: "macro-source",
    category: "Macro / Rates",
    priority: 2,
  }),
  makeSource({
    sourceId: "federal-reserve-speeches",
    name: "Federal Reserve Speeches",
    description:
      "Federal Reserve speeches that may influence rate expectations, inflation outlook, policy positioning, and asset prices.",
    sourceUrl: "https://www.federalreserve.gov/feeds/speeches.xml",
    sourceTier: "macro-source",
    category: "Macro / Rates",
    minScoreToAlert: 88,
    priority: 3,
  }),
  makeSource({
    sourceId: "treasury-press-releases",
    name: "U.S. Treasury Press Releases",
    description:
      "U.S. Treasury releases related to fiscal policy, sanctions, debt issuance, financial stability, and market-sensitive government actions.",
    sourceUrl: "https://home.treasury.gov/rss/press-releases",
    sourceTier: "macro-source",
    category: "Macro / Fiscal Policy",
    priority: 3,
  }),
  makeSource({
    sourceId: "bls-all-news",
    name: "BLS News Releases",
    description:
      "Bureau of Labor Statistics releases for CPI, PPI, employment, wages, productivity, and labor-market reports.",
    sourceUrl: "https://www.bls.gov/feed/news_release/all.xml",
    sourceTier: "macro-source",
    category: "Macro / Labor and Inflation",
    priority: 3,
  }),
  makeSource({
    sourceId: "bea-news",
    name: "BEA News",
    description:
      "Bureau of Economic Analysis releases including GDP, personal income, consumer spending, trade, and corporate-profit data.",
    sourceUrl: "https://www.bea.gov/rss.xml",
    sourceTier: "macro-source",
    category: "Macro / Economic Data",
    priority: 3,
  }),
  makeSource({
    sourceId: "eia-today-in-energy",
    name: "EIA Today in Energy",
    description:
      "Energy Information Administration updates for oil, gas, electricity, renewables, inventories, and energy-market trends.",
    sourceUrl: "https://www.eia.gov/rss/todayinenergy.xml",
    sourceTier: "macro-source",
    category: "Commodities / Energy",
    priority: 4,
  }),
  makeSource({
    sourceId: "ecb-press-releases",
    name: "European Central Bank Press Releases",
    description:
      "ECB policy and market-sensitive releases that may affect global rates, currencies, and risk assets.",
    sourceUrl: "https://www.ecb.europa.eu/rss/press.html",
    sourceTier: "macro-source",
    category: "Global Macro / Rates",
    priority: 4,
  }),
  makeSource({
    sourceId: "bank-of-england-news",
    name: "Bank of England News",
    description:
      "Bank of England policy, supervision, financial stability, and macro communications.",
    sourceUrl: "https://www.bankofengland.co.uk/rss/news",
    sourceTier: "macro-source",
    category: "Global Macro / Rates",
    priority: 4,
  }),
  makeSource({
    sourceId: "bis-press-releases",
    name: "Bank for International Settlements",
    description:
      "BIS publications and releases for global banking, financial stability, central banks, and systemic risk.",
    sourceUrl: "https://www.bis.org/list/press_releases/index.rss",
    sourceTier: "macro-source",
    category: "Global Macro / Financial Stability",
    priority: 4,
  }),

  makeSource({
    sourceId: "marketwatch-top-stories",
    name: "MarketWatch Top Stories",
    description:
      "MarketWatch top stories for broad market, company, investor sentiment, macro, and sector movement context.",
    sourceUrl: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    sourceTier: "market-news",
    category: "Market News",
    priority: 5,
  }),
  makeSource({
    sourceId: "marketwatch-market-pulse",
    name: "MarketWatch Market Pulse",
    description:
      "MarketWatch market pulse feed for faster market-moving headlines and investor-facing updates.",
    sourceUrl: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse",
    sourceTier: "market-news",
    category: "Market News",
    priority: 5,
  }),
  makeSource({
    sourceId: "cnbc-top-news",
    name: "CNBC Top News",
    description:
      "CNBC top news feed for market, economy, company, sector, technology, and global business developments.",
    sourceUrl: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    sourceTier: "market-news",
    category: "Market News",
    priority: 5,
  }),
  makeSource({
    sourceId: "cnbc-markets",
    name: "CNBC Markets",
    description:
      "CNBC markets feed for equity markets, investor sentiment, rates, and fast-moving market headlines.",
    sourceUrl: "https://www.cnbc.com/id/15839135/device/rss/rss.html",
    sourceTier: "market-news",
    category: "Market News",
    priority: 5,
  }),
  makeSource({
    sourceId: "cnbc-earnings",
    name: "CNBC Earnings",
    description:
      "CNBC earnings-related coverage for corporate results, guidance, margin commentary, and market reactions.",
    sourceUrl: "https://www.cnbc.com/id/15839135/device/rss/rss.html",
    sourceTier: "market-news",
    category: "Earnings / Guidance",
    priority: 5,
  }),
  makeSource({
    sourceId: "yahoo-finance-news",
    name: "Yahoo Finance News",
    description:
      "Yahoo Finance market feed for equities, macro, business, and investor-facing market headlines.",
    sourceUrl: "https://finance.yahoo.com/news/rssindex",
    sourceTier: "market-news",
    category: "Market News",
    priority: 6,
  }),
  makeSource({
    sourceId: "investing-com-news",
    name: "Investing.com News",
    description:
      "Investing.com market news for macro, equity, commodity, currency, and global-market updates.",
    sourceUrl: "https://www.investing.com/rss/news.rss",
    sourceTier: "market-news",
    category: "Market News",
    priority: 6,
  }),
  makeSource({
    sourceId: "investing-com-stock-market-news",
    name: "Investing.com Stock Market News",
    description:
      "Investing.com stock market feed for equity-specific updates, sector movement, and company-related market news.",
    sourceUrl: "https://www.investing.com/rss/news_25.rss",
    sourceTier: "market-news",
    category: "Equities",
    priority: 6,
  }),
  makeSource({
    sourceId: "investing-com-economic-indicators",
    name: "Investing.com Economic Indicators",
    description:
      "Investing.com economic indicator feed for macro data, inflation, rates, labor, GDP, and market-sensitive releases.",
    sourceUrl: "https://www.investing.com/rss/news_95.rss",
    sourceTier: "macro-source",
    category: "Macro / Economic Data",
    priority: 6,
  }),
  makeSource({
    sourceId: "benzinga-feed",
    name: "Benzinga Market News",
    description:
      "Benzinga feed for market-moving headlines, analyst actions, earnings, sectors, and trading-related updates.",
    sourceUrl: "https://www.benzinga.com/feed",
    sourceTier: "market-news",
    category: "Market News",
    minScoreToRetain: 66,
    minScoreToAlert: 93,
    priority: 6,
  }),
  makeSource({
    sourceId: "nasdaq-markets-feed",
    name: "Nasdaq Markets Feed",
    description:
      "Nasdaq market feed for equity market commentary, ETFs, technology, and listed-company context.",
    sourceUrl: "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
    sourceTier: "market-news",
    category: "Equities",
    priority: 6,
  }),
  makeSource({
    sourceId: "thestreet-markets",
    name: "TheStreet Markets",
    description:
      "TheStreet market coverage for equities, analysts, market direction, macro context, and investing trends.",
    sourceUrl: "https://www.thestreet.com/.rss/full/",
    sourceTier: "market-news",
    category: "Market News",
    minScoreToRetain: 66,
    minScoreToAlert: 93,
    priority: 7,
  }),

  makeSource({
    sourceId: "coindesk-rss",
    name: "CoinDesk",
    description:
      "CoinDesk digital asset feed for Bitcoin, Ethereum, ETF flows, regulation, exchanges, stablecoins, and institutional crypto adoption.",
    sourceUrl: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    sourceTier: "crypto-source",
    category: "Crypto / Digital Assets",
    priority: 7,
  }),
  makeSource({
    sourceId: "cointelegraph-rss",
    name: "Cointelegraph",
    description:
      "Cointelegraph crypto feed for digital asset regulation, crypto markets, ETF trends, protocols, tokens, and blockchain infrastructure.",
    sourceUrl: "https://cointelegraph.com/rss",
    sourceTier: "crypto-source",
    category: "Crypto / Digital Assets",
    minScoreToRetain: 70,
    minScoreToAlert: 95,
    priority: 7,
  }),
  makeSource({
    sourceId: "decrypt-rss",
    name: "Decrypt",
    description:
      "Decrypt crypto and Web3 feed for digital asset policy, token markets, AI/crypto overlap, and consumer crypto adoption.",
    sourceUrl: "https://decrypt.co/feed",
    sourceTier: "crypto-source",
    category: "Crypto / Digital Assets",
    minScoreToRetain: 70,
    minScoreToAlert: 95,
    priority: 7,
  }),

  makeSource({
    sourceId: "techcrunch-startups",
    name: "TechCrunch Startups",
    description:
      "TechCrunch startup feed for venture-backed companies, funding rounds, AI tools, software infrastructure, and startup-market signals.",
    sourceUrl: "https://techcrunch.com/category/startups/feed/",
    sourceTier: "venture-source",
    category: "Private Markets / Venture",
    priority: 7,
  }),
  makeSource({
    sourceId: "techcrunch-venture",
    name: "TechCrunch Venture",
    description:
      "TechCrunch venture feed for venture capital, private market trends, early-stage funding, and startup financing activity.",
    sourceUrl: "https://techcrunch.com/category/venture/feed/",
    sourceTier: "venture-source",
    category: "Private Markets / Venture",
    priority: 7,
  }),
  makeSource({
    sourceId: "techcrunch-artificial-intelligence",
    name: "TechCrunch AI",
    description:
      "TechCrunch AI feed for artificial intelligence, model infrastructure, AI software, and emerging AI companies.",
    sourceUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    sourceTier: "venture-source",
    category: "AI / Technology",
    minScoreToRetain: 66,
    minScoreToAlert: 92,
    priority: 7,
  }),
  makeSource({
    sourceId: "venturebeat-ai",
    name: "VentureBeat AI",
    description:
      "VentureBeat AI feed for enterprise AI, AI infrastructure, model deployment, automation, and AI business trends.",
    sourceUrl: "https://venturebeat.com/category/ai/feed/",
    sourceTier: "venture-source",
    category: "AI / Technology",
    priority: 7,
  }),
  makeSource({
    sourceId: "venturebeat-business",
    name: "VentureBeat Business",
    description:
      "VentureBeat business feed for enterprise software, technology adoption, AI infrastructure, and business transformation.",
    sourceUrl: "https://venturebeat.com/category/business/feed/",
    sourceTier: "venture-source",
    category: "AI / Technology",
    priority: 7,
  }),
  makeSource({
    sourceId: "fierce-biotech",
    name: "Fierce Biotech",
    description:
      "Biotech feed for drug development, clinical trials, FDA-related biotech catalysts, and healthcare investment signals.",
    sourceUrl: "https://www.fiercebiotech.com/rss/xml",
    sourceTier: "market-news",
    category: "Healthcare / Biotech",
    minScoreToRetain: 66,
    minScoreToAlert: 92,
    priority: 7,
  }),
  makeSource({
    sourceId: "fierce-pharma",
    name: "Fierce Pharma",
    description:
      "Pharma feed for drug approvals, pipelines, litigation, commercial performance, and healthcare market intelligence.",
    sourceUrl: "https://www.fiercepharma.com/rss/xml",
    sourceTier: "market-news",
    category: "Healthcare / Pharma",
    minScoreToRetain: 66,
    minScoreToAlert: 92,
    priority: 7,
  }),
  makeSource({
    sourceId: "oilprice",
    name: "OilPrice",
    description:
      "Energy market feed for oil, gas, OPEC, commodities, energy transition, and geopolitical energy risks.",
    sourceUrl: "https://oilprice.com/rss/main",
    sourceTier: "market-news",
    category: "Commodities / Energy",
    minScoreToRetain: 66,
    minScoreToAlert: 92,
    priority: 7,
  }),
];

const OPEN_WEB_QUERIES = [
  ["S&P 500 earnings guidance", "Earnings / Guidance"],
  ["Nasdaq earnings guidance", "Earnings / Guidance"],
  ["Russell 2000 earnings guidance", "Earnings / Guidance"],
  ["public company cuts guidance", "Earnings / Guidance"],
  ["public company raises guidance", "Earnings / Guidance"],
  ["stock buyback announcement", "Corporate Actions"],
  ["special dividend announcement", "Corporate Actions"],
  ["activist investor public company", "Corporate Actions"],
  ["merger acquisition public company", "Corporate Actions"],
  ["strategic review public company", "Corporate Actions"],
  ["spinoff public company", "Corporate Actions"],
  ["secondary offering public company", "Corporate Actions"],
  ["stock downgrade analyst", "Analyst Actions"],
  ["stock upgrade analyst", "Analyst Actions"],
  ["price target raised stock", "Analyst Actions"],
  ["price target lowered stock", "Analyst Actions"],
  ["SEC investigation public company", "Regulatory / Legal"],
  ["SEC charges public company", "Regulatory / Legal"],
  ["accounting restatement public company", "Regulatory / Legal"],
  ["material weakness public company", "SEC Filings"],
  ["going concern public company", "SEC Filings"],
  ["form 8-K material agreement", "SEC Filings"],
  ["insider buying Form 4", "SEC Filings"],
  ["13D activist filing", "SEC Filings"],
  ["Nasdaq delisting notice", "Exchange Alerts"],
  ["NYSE delisting notice", "Exchange Alerts"],
  ["trading halt stock", "Exchange Alerts"],
  ["AI semiconductor demand", "AI / Technology"],
  ["AI data center capex", "AI / Technology"],
  ["GPU demand enterprise AI", "AI / Technology"],
  ["cloud earnings AI revenue", "AI / Technology"],
  ["cybersecurity breach public company", "Cybersecurity"],
  ["data breach public company", "Cybersecurity"],
  ["defense contract public company", "Industrials / Defense"],
  ["infrastructure spending public company", "Industrials / Infrastructure"],
  ["commercial real estate credit risk", "Real Estate / Credit"],
  ["regional bank credit risk", "Banks / Financial Stability"],
  ["bank deposit outflows", "Banks / Financial Stability"],
  ["credit spread widening", "Bonds / Credit Markets"],
  ["high yield default risk", "Bonds / Credit Markets"],
  ["investment grade spreads", "Bonds / Credit Markets"],
  ["Treasury yield spike", "Macro / Rates"],
  ["Federal Reserve rate cuts", "Macro / Rates"],
  ["Federal Reserve rate hikes", "Macro / Rates"],
  ["CPI inflation surprise", "Macro / Labor and Inflation"],
  ["PPI inflation surprise", "Macro / Labor and Inflation"],
  ["nonfarm payrolls market reaction", "Macro / Labor and Inflation"],
  ["GDP growth surprise", "Macro / Economic Data"],
  ["consumer spending slowdown", "Macro / Economic Data"],
  ["oil inventory surprise", "Commodities / Energy"],
  ["OPEC production cuts", "Commodities / Energy"],
  ["natural gas prices spike", "Commodities / Energy"],
  ["gold prices dollar yields", "Commodities / Metals"],
  ["copper demand China", "Commodities / Metals"],
  ["Bitcoin ETF flows", "Crypto / Digital Assets"],
  ["Ethereum ETF regulation", "Crypto / Digital Assets"],
  ["stablecoin regulation", "Crypto / Digital Assets"],
  ["crypto exchange enforcement", "Crypto / Digital Assets"],
  ["biotech FDA approval", "Healthcare / Biotech"],
  ["biotech clinical trial results", "Healthcare / Biotech"],
  ["pharma patent litigation", "Healthcare / Pharma"],
  ["Medicare drug pricing public company", "Healthcare / Pharma"],
  ["managed care earnings guidance", "Healthcare / Managed Care"],
  ["retail sales public company guidance", "Consumer / Retail"],
  ["consumer discretionary slowdown", "Consumer / Retail"],
  ["restaurant earnings guidance", "Consumer / Restaurants"],
  ["housing starts homebuilders", "Real Estate / Housing"],
  ["mortgage rates homebuilders", "Real Estate / Housing"],
  ["REIT dividend cut", "Real Estate / REITs"],
  ["utilities rate case", "Utilities"],
  ["renewable energy tax credit public company", "Utilities / Energy Transition"],
  ["electric vehicle demand slowdown", "Autos / EV"],
  ["automaker recall public company", "Autos / EV"],
  ["airline earnings guidance", "Industrials / Travel"],
  ["shipping rates supply chain", "Industrials / Logistics"],
  ["semiconductor export controls", "Semiconductors"],
  ["chip equipment earnings guidance", "Semiconductors"],
  ["software earnings guidance", "Software"],
  ["SaaS layoffs public company", "Software"],
  ["private equity acquisition public company", "Private Equity"],
  ["venture funding AI startup", "Private Markets / Venture"],
  ["IPO filing S-1", "IPO / New Listings"],
  ["SPAC merger public company", "IPO / New Listings"],
  ["ETF inflows sector", "ETF / Fund Flows"],
  ["ETF outflows sector", "ETF / Fund Flows"],
  ["municipal bond credit risk", "Municipal Bonds"],
  ["tax law changes investors", "Tax / Planning"],
  ["estate tax changes investors", "Tax / Planning"],
  ["retirement plan rule changes", "Retirement / Planning"],
  ["Department of Labor fiduciary rule", "Regulatory / Legal"],
  ["FINRA enforcement advisor", "Regulatory / Legal"],
  ["CFPB enforcement financial services", "Regulatory / Legal"],
  ["Treasury sanctions public company", "Macro / Fiscal Policy"],
  ["China stimulus markets", "Global Macro"],
  ["Europe recession risk markets", "Global Macro"],
  ["Japan rates yen markets", "Global Macro"],
  ["geopolitical risk oil markets", "Geopolitical Risk"],
  ["Russia sanctions public company", "Geopolitical Risk"],
  ["Middle East energy risk markets", "Geopolitical Risk"],
  ["insurance catastrophe losses public company", "Insurance"],
  ["reinsurance pricing public company", "Insurance"],
  ["payment processor outage public company", "Payments / Fintech"],
  ["fintech regulation public company", "Payments / Fintech"],
  ["bank merger acquisition", "Banks / M&A"],
  ["wealth management M&A", "Wealth Management Industry"],
  ["RIA acquisition", "Wealth Management Industry"],
  ["asset manager flows", "Asset Management"],
  ["brokerage platform outage", "Brokerage / Platforms"],
  ["money market fund flows", "Cash / Money Markets"],
  ["commercial paper market stress", "Cash / Money Markets"],
  ["supply chain disruption public company", "Supply Chain"],
  ["labor strike public company", "Labor / Operations"],
  ["union contract public company", "Labor / Operations"],
  ["class action lawsuit public company", "Legal / Litigation"],
  ["antitrust lawsuit public company", "Legal / Litigation"],
  ["product recall public company", "Product Risk"],
  ["short seller report public company", "Short Reports"],
  ["social media rumor stock", "Low Trust / Rumor Watch"],
  ["stock price prediction viral", "Low Trust / Rumor Watch"],
  ["penny stock promotion", "Noise Testing"],
  ["meme stock squeeze", "High Volatility"],
] as const;

const OPEN_WEB_SOURCES = OPEN_WEB_QUERIES.map(([query, category], index) =>
  googleNewsSource({
    index,
    query,
    category,
    priority: index < 50 ? 10 : index < 100 ? 11 : 12,
  })
);

const SYNTHETIC_VALIDATION_SOURCES = [
  makeSource({
    sourceId: "demo-sec",
    name: "Synthetic SEC Validation Feed",
    description:
      "Offline validation source used only when explicitly enabled for scanner testing. Kept disabled for production operation.",
    sourceUrl: null,
    sourceTier: "official-regulatory",
    category: "SEC Filings",
    enabled: false,
    priority: 98,
  }),
  makeSource({
    sourceId: "demo-exchange",
    name: "Synthetic Exchange Halt Validation Feed",
    description:
      "Offline validation source for trading-halt urgency logic. Kept disabled for production operation.",
    sourceUrl: null,
    sourceTier: "official-exchange",
    category: "Exchange Alerts",
    enabled: false,
    priority: 98,
  }),
  makeSource({
    sourceId: "demo-market",
    name: "Synthetic Market Validation Feed",
    description:
      "Offline validation source for company and sector matching. Kept disabled for production operation.",
    sourceUrl: null,
    sourceTier: "market-news",
    category: "Market News",
    enabled: false,
    priority: 99,
  }),
  makeSource({
    sourceId: "demo-noise",
    name: "Synthetic Noise Validation Feed",
    description:
      "Offline validation source used to confirm promotional and low-trust language is suppressed.",
    sourceUrl: null,
    sourceTier: "unknown",
    category: "Noise Testing",
    enabled: false,
    priority: 99,
  }),
];

export const DEFAULT_NEWS_SOURCES = [
  ...OFFICIAL_AND_MARKET_SOURCES,
  ...OPEN_WEB_SOURCES,
  ...SYNTHETIC_VALIDATION_SOURCES,
].slice(0, SOURCE_LIMIT);

export const DEFAULT_RETENTION_POLICY = {
  minScoreToStore: 55,
  minScoreToAlert: 86,
  maxRetainedPerRun: 120,
  maxRetainedDecisions: 1500,
  maxRetainedRuns: 120,
  maxAlertEvents: 1000,
  urgentRetentionDays: 75,
  reviewRetentionDays: 45,
  digestRetentionDays: 24,
  watchRetentionDays: 10,
  readAlertRetentionDays: 45,
};