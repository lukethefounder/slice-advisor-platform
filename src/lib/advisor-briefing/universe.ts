export type AdvisorBriefUniverseStock = {
  symbol: string;
  name: string;
};

export type AdvisorBriefIndustryDefinition = {
  id: string;
  name: string;
  etfSymbol: string;
  description: string;
  newsTopics: string[];
  stocks: AdvisorBriefUniverseStock[];
  macroSensitivity: {
    growth: number;
    rateRelief: number;
    disinflation: number;
    energyStrength: number;
    consumerDemand: number;
  };
};

export const ADVISOR_BRIEF_INDUSTRIES: AdvisorBriefIndustryDefinition[] = [
  {
    id: "semiconductors",
    name: "Semiconductors",
    etfSymbol: "SOXX",
    description:
      "Chip designers, memory producers, foundries, and semiconductor-equipment companies exposed to AI infrastructure and electronics demand.",
    newsTopics: ["technology", "manufacturing"],
    stocks: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "AVGO", name: "Broadcom" },
      { symbol: "AMD", name: "Advanced Micro Devices" },
      { symbol: "QCOM", name: "Qualcomm" },
      { symbol: "MU", name: "Micron Technology" },
      { symbol: "AMAT", name: "Applied Materials" },
      { symbol: "LRCX", name: "Lam Research" },
      { symbol: "KLAC", name: "KLA" },
    ],
    macroSensitivity: {
      growth: 0.85,
      rateRelief: 0.65,
      disinflation: 0.4,
      energyStrength: -0.1,
      consumerDemand: 0.35,
    },
  },
  {
    id: "enterprise-software",
    name: "Cloud & Enterprise Software",
    etfSymbol: "IGV",
    description:
      "Cloud platforms, data infrastructure, enterprise automation, and subscription software with recurring-revenue economics.",
    newsTopics: ["technology", "financial_markets"],
    stocks: [
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "ORCL", name: "Oracle" },
      { symbol: "CRM", name: "Salesforce" },
      { symbol: "NOW", name: "ServiceNow" },
      { symbol: "ADBE", name: "Adobe" },
      { symbol: "PLTR", name: "Palantir Technologies" },
      { symbol: "SNOW", name: "Snowflake" },
      { symbol: "DDOG", name: "Datadog" },
    ],
    macroSensitivity: {
      growth: 0.7,
      rateRelief: 0.9,
      disinflation: 0.55,
      energyStrength: -0.05,
      consumerDemand: 0.2,
    },
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    etfSymbol: "CIBR",
    description:
      "Endpoint, identity, network, and cloud-security vendors supported by persistent enterprise security spending.",
    newsTopics: ["technology", "financial_markets"],
    stocks: [
      { symbol: "PANW", name: "Palo Alto Networks" },
      { symbol: "CRWD", name: "CrowdStrike" },
      { symbol: "FTNT", name: "Fortinet" },
      { symbol: "ZS", name: "Zscaler" },
      { symbol: "OKTA", name: "Okta" },
      { symbol: "CHKP", name: "Check Point Software" },
      { symbol: "GEN", name: "Gen Digital" },
      { symbol: "S", name: "SentinelOne" },
    ],
    macroSensitivity: {
      growth: 0.55,
      rateRelief: 0.85,
      disinflation: 0.5,
      energyStrength: 0,
      consumerDemand: 0.1,
    },
  },
  {
    id: "banks-capital-markets",
    name: "Banks & Capital Markets",
    etfSymbol: "KBE",
    description:
      "Banks, brokers, investment banks, and asset servicers driven by credit quality, capital-markets activity, and the rate environment.",
    newsTopics: ["finance", "financial_markets"],
    stocks: [
      { symbol: "JPM", name: "JPMorgan Chase" },
      { symbol: "BAC", name: "Bank of America" },
      { symbol: "WFC", name: "Wells Fargo" },
      { symbol: "GS", name: "Goldman Sachs" },
      { symbol: "MS", name: "Morgan Stanley" },
      { symbol: "C", name: "Citigroup" },
      { symbol: "SCHW", name: "Charles Schwab" },
      { symbol: "BK", name: "Bank of New York Mellon" },
    ],
    macroSensitivity: {
      growth: 0.85,
      rateRelief: -0.15,
      disinflation: 0.45,
      energyStrength: 0,
      consumerDemand: 0.5,
    },
  },
  {
    id: "aerospace-defense",
    name: "Aerospace & Defense",
    etfSymbol: "ITA",
    description:
      "Defense primes, commercial-aerospace suppliers, and mission-critical systems companies supported by government and airline spending.",
    newsTopics: ["manufacturing", "economy_macro"],
    stocks: [
      { symbol: "RTX", name: "RTX" },
      { symbol: "LMT", name: "Lockheed Martin" },
      { symbol: "NOC", name: "Northrop Grumman" },
      { symbol: "GD", name: "General Dynamics" },
      { symbol: "BA", name: "Boeing" },
      { symbol: "LHX", name: "L3Harris Technologies" },
      { symbol: "TDG", name: "TransDigm Group" },
      { symbol: "HWM", name: "Howmet Aerospace" },
    ],
    macroSensitivity: {
      growth: 0.5,
      rateRelief: 0.25,
      disinflation: 0.5,
      energyStrength: -0.2,
      consumerDemand: 0.1,
    },
  },
  {
    id: "biotechnology",
    name: "Biotechnology",
    etfSymbol: "XBI",
    description:
      "Drug developers and biotechnology platforms exposed to clinical readouts, regulatory decisions, capital costs, and merger activity.",
    newsTopics: ["life_sciences", "financial_markets"],
    stocks: [
      { symbol: "AMGN", name: "Amgen" },
      { symbol: "GILD", name: "Gilead Sciences" },
      { symbol: "VRTX", name: "Vertex Pharmaceuticals" },
      { symbol: "REGN", name: "Regeneron Pharmaceuticals" },
      { symbol: "MRNA", name: "Moderna" },
      { symbol: "BIIB", name: "Biogen" },
      { symbol: "ALNY", name: "Alnylam Pharmaceuticals" },
      { symbol: "ILMN", name: "Illumina" },
    ],
    macroSensitivity: {
      growth: 0.2,
      rateRelief: 0.9,
      disinflation: 0.35,
      energyStrength: 0,
      consumerDemand: 0.05,
    },
  },
  {
    id: "energy",
    name: "Energy Producers & Services",
    etfSymbol: "XLE",
    description:
      "Integrated producers, exploration companies, refiners, and oilfield-services providers driven by commodity prices and capital discipline.",
    newsTopics: ["energy_transportation", "economy_macro"],
    stocks: [
      { symbol: "XOM", name: "Exxon Mobil" },
      { symbol: "CVX", name: "Chevron" },
      { symbol: "COP", name: "ConocoPhillips" },
      { symbol: "EOG", name: "EOG Resources" },
      { symbol: "SLB", name: "SLB" },
      { symbol: "OXY", name: "Occidental Petroleum" },
      { symbol: "MPC", name: "Marathon Petroleum" },
      { symbol: "PSX", name: "Phillips 66" },
    ],
    macroSensitivity: {
      growth: 0.55,
      rateRelief: 0.05,
      disinflation: -0.4,
      energyStrength: 1,
      consumerDemand: 0.25,
    },
  },
  {
    id: "industrials-automation",
    name: "Industrials & Automation",
    etfSymbol: "XLI",
    description:
      "Capital goods, automation, machinery, electrical equipment, and industrial technology sensitive to orders and investment cycles.",
    newsTopics: ["manufacturing", "economy_macro"],
    stocks: [
      { symbol: "GE", name: "GE Aerospace" },
      { symbol: "HON", name: "Honeywell" },
      { symbol: "CAT", name: "Caterpillar" },
      { symbol: "DE", name: "Deere" },
      { symbol: "ETN", name: "Eaton" },
      { symbol: "EMR", name: "Emerson Electric" },
      { symbol: "PH", name: "Parker-Hannifin" },
      { symbol: "ROK", name: "Rockwell Automation" },
    ],
    macroSensitivity: {
      growth: 1,
      rateRelief: 0.35,
      disinflation: 0.55,
      energyStrength: -0.25,
      consumerDemand: 0.35,
    },
  },
  {
    id: "consumer-discretionary",
    name: "Consumer Platforms & Discretionary",
    etfSymbol: "XLY",
    description:
      "E-commerce, autos, home improvement, restaurants, travel, and discretionary retail exposed to household spending and financing conditions.",
    newsTopics: ["retail_wholesale", "economy_macro"],
    stocks: [
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "HD", name: "Home Depot" },
      { symbol: "MCD", name: "McDonald's" },
      { symbol: "BKNG", name: "Booking Holdings" },
      { symbol: "TJX", name: "TJX Companies" },
      { symbol: "LOW", name: "Lowe's" },
      { symbol: "SBUX", name: "Starbucks" },
    ],
    macroSensitivity: {
      growth: 0.8,
      rateRelief: 0.75,
      disinflation: 0.8,
      energyStrength: -0.35,
      consumerDemand: 1,
    },
  },
  {
    id: "healthcare-leaders",
    name: "Healthcare Leaders & Devices",
    etfSymbol: "XLV",
    description:
      "Large pharmaceuticals, managed care, life-science tools, medical devices, and surgical technology with defensive and innovation exposure.",
    newsTopics: ["life_sciences", "economy_macro"],
    stocks: [
      { symbol: "LLY", name: "Eli Lilly" },
      { symbol: "UNH", name: "UnitedHealth Group" },
      { symbol: "JNJ", name: "Johnson & Johnson" },
      { symbol: "ABBV", name: "AbbVie" },
      { symbol: "TMO", name: "Thermo Fisher Scientific" },
      { symbol: "BSX", name: "Boston Scientific" },
      { symbol: "ISRG", name: "Intuitive Surgical" },
      { symbol: "MDT", name: "Medtronic" },
    ],
    macroSensitivity: {
      growth: 0.3,
      rateRelief: 0.35,
      disinflation: 0.45,
      energyStrength: 0,
      consumerDemand: 0.1,
    },
  },
];

export const ADVISOR_BRIEF_ALL_SYMBOLS = Array.from(
  new Set(
    ADVISOR_BRIEF_INDUSTRIES.flatMap((industry) => [
      industry.etfSymbol,
      ...industry.stocks.map((stock) => stock.symbol),
    ]),
  ),
);