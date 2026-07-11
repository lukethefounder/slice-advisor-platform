"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Tab = "news" | "technicals" | "sentiment";
type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type Importance = "Critical" | "High" | "Medium" | "Experimental";
type DataSpeed = "Delayed" | "Near Real-Time" | "Real-Time";
type ProviderStatus = "Connected" | "Ready" | "Demo" | "Needs Key";
type SentimentModel = "Core Slice" | "Growth Discovery" | "Risk-Controlled" | "Contrarian Opportunity" | "Index Builder";
type TechnicalStrategy = "Undervalued Growth" | "Momentum Confirmation" | "Low-Volatility Quality" | "Turnaround Watch" | "Quality Compounding";
type RiskStandard = "Conservative" | "Balanced" | "Aggressive Growth";

type PublicSource = {
  name: string;
  category: string;
  cadence: string;
  access: "Public" | "RSS" | "API" | "Filing" | "Public Web" | "Calendar";
  importance: Importance;
  useCase: string;
};

type PaidIntegration = {
  name: string;
  category: string;
  accessType: "Advisor Login" | "API Key" | "OAuth" | "File Import" | "Broker API";
  setup: "One-click OAuth" | "Secure API Vault" | "Advisor Login" | "File Upload";
  dataValue: string;
  idealUse: string;
  complianceNote: string;
};

type IntegrationConnection = {
  connected: boolean;
  accountLabel: string;
  credentialReference: string;
  scanEnabled: boolean;
  scanIntervalMinutes: number;
  connectedAt: string;
  lastCheckedAt: string;
  tokenStatus: "Healthy" | "Expiring Soon" | "Needs Reconnect" | "Demo";
  health: "Healthy" | "Needs Review" | "Disconnected";
};

type AlphaVantageData = {
  symbol: string;
  updatedAt: string;
  error?: string;
  quote?: {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
  };
  overview?: {
    name?: string;
    sector?: string;
    marketCap?: number;
    peRatio?: number;
    pegRatio?: number;
    profitMargin?: number;
    operatingMargin?: number;
    returnOnEquity?: number;
    quarterlyRevenueGrowthYOY?: number;
    quarterlyEarningsGrowthYOY?: number;
    analystTargetPrice?: number;
    beta?: number;
  };
  technicals?: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    volatility20?: number;
    momentum30?: number;
    drawdownFromHigh?: number;
    volumeTrend?: number;
    trendScore?: number;
    momentumScore?: number;
    riskScore?: number;
    volumeScore?: number;
  };
  news?: {
    averageSentiment?: number;
    relevanceWeightedSentiment?: number;
    articleCount?: number;
    latestTitle?: string;
  };
};

type IndexOption = {
  name: string;
  symbol: string;
  members: number;
  speed: DataSpeed;
  description: string;
  bestFor: string;
};

type DataProvider = {
  name: string;
  access: "Free Tier" | "Paid API" | "Advisor Subscription" | "Broker API";
  speed: DataSpeed;
  status: ProviderStatus;
  productionReady: boolean;
  useCase: string;
};

type TechnicalWeightKey =
  | "valuation"
  | "growth"
  | "quality"
  | "trend"
  | "momentum"
  | "volume"
  | "breadth"
  | "riskControl"
  | "catalyst"
  | "sentimentShift"
  | "marginOfSafety"
  | "moat"
  | "relativeStrength"
  | "liquidity"
  | "earningsRevision"
  | "macroAlignment"
  | "environmentalAlignment"
  | "regulatoryRisk";

type CriteriaKey =
  | "undervalued"
  | "growth"
  | "quality"
  | "uptrend"
  | "momentum"
  | "volume"
  | "breadth"
  | "lowRisk"
  | "catalyst"
  | "sentiment"
  | "moat"
  | "safety"
  | "liquidity"
  | "revisions"
  | "macro"
  | "environmental"
  | "regulatory";

type TechnicalSignal = {
  key: TechnicalWeightKey;
  name: string;
  status: "Bullish" | "Neutral" | "Caution" | "Bearish";
  reading: string;
  explanation: string;
  decisionUse: string;
};

type Opportunity = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  valuation: number;
  growth: number;
  quality: number;
  trend: number;
  momentum: number;
  volume: number;
  breadth: number;
  riskControl: number;
  catalyst: number;
  sentimentShift: number;
  marginOfSafety: number;
  moat: number;
  relativeStrength: number;
  liquidity: number;
  earningsRevision: number;
  macroAlignment: number;
  environmentalAlignment: number;
  regulatoryRisk: number;
  thesis: string;
};

type RankedOpportunity = Opportunity & {
  score: number;
  label: string;
  alertReason: string;
};

type ScoreBreakdown = {
  newsSentiment: number;
  sourceCredibility: number;
  narrativeVelocity: number;
  technicalTrend: number;
  technicalBreadth: number;
  valuationDislocation: number;
  growthDurability: number;
  qualityDurability: number;
  marginOfSafety: number;
  moatStrength: number;
  volatilityControl: number;
  liquidityQuality: number;
  earningsRevisionStrength: number;
  macroAlignment: number;
  environmentalAlignment: number;
  regulatoryRiskControl: number;
  supplyChainResilience: number;
  contradictionPenalty: number;
  advisorPrivateEdge: number;
  composite: number;
  confidence: number;
};

type ScoreComponent = {
  key: keyof Omit<ScoreBreakdown, "composite" | "confidence">;
  label: string;
  category: "News" | "Technicals" | "Valuation" | "Quality" | "Risk" | "Macro" | "Environmental" | "Private Edge";
  visibleReasoning: string;
  positiveDriver: string;
  riskDriver: string;
  upgradeTrigger: string;
  downgradeTrigger: string;
  factorStudyNote: string;
};

type Scenario = {
  name: string;
  probability: number;
  tone: Tone;
  explanation: string;
  trigger: string;
};

type NewsEvent = {
  id: string;
  title: string;
  source: string;
  tickers: string[];
  urgency: Importance;
  sentiment: "Positive" | "Neutral" | "Negative";
  confidence: number;
  desirability: number;
  price: number;
  reason: string;
};

type QueuedAlert = {
  id: string;
  type: "News" | "Technicals" | "Sentiment";
  title: string;
  destination: string;
  createdAt: string;
  status: "Queued" | "Sent" | "Simulated" | "Failed";
  detail: string;
};

const CONNECTION_STORAGE_KEY = "slice-intelligence-connections-v12";
const ALERT_STORAGE_KEY = "slice-intelligence-alerts-v12";
const SETTINGS_STORAGE_KEY = "slice-intelligence-settings-v12";

const inputClass =
  "rounded-2xl border border-red-400/12 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/15";

const softButtonClass =
  "rounded-2xl border border-red-400/18 bg-red-500/[0.055] px-4 py-3 text-sm font-black text-red-100 shadow-lg shadow-red-950/10 transition hover:bg-red-500/10";

const redButtonClass =
  "rounded-2xl bg-gradient-to-r from-red-500 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/20 transition hover:brightness-110 disabled:opacity-50";

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/25 bg-red-500/10 text-red-100",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-100",
};

const publicSources: PublicSource[] = [
  { name: "SEC EDGAR", category: "SEC / Filings", cadence: "Constant filing watch", access: "Filing", importance: "Critical", useCase: "8-K, 10-Q, 10-K, S-1, proxy, ownership, and material event detection." },
  { name: "SEC Company Facts API", category: "SEC / Filings", cadence: "Daily structured refresh", access: "API", importance: "Critical", useCase: "Structured official fundamentals for valuation, quality, and growth scoring." },
  { name: "SEC Insider Transactions", category: "SEC / Filings", cadence: "Constant filing watch", access: "Filing", importance: "High", useCase: "Form 4 activity, insider buying/selling, and management confidence signals." },
  { name: "FINRA Public Data", category: "SEC / Filings", cadence: "Daily watch", access: "Public", importance: "High", useCase: "Short interest context, market structure information, and public regulatory data where available." },
  { name: "Federal Reserve", category: "Macro / Rates", cadence: "Release and speech watch", access: "Public", importance: "Critical", useCase: "Rate policy, liquidity, banking stress, inflation commentary, and market regime context." },
  { name: "FRED", category: "Macro / Rates", cadence: "Daily data refresh", access: "API", importance: "High", useCase: "Yield curves, credit spreads, inflation, unemployment, liquidity, and cycle indicators." },
  { name: "BLS", category: "Macro / Rates", cadence: "Release calendar", access: "Public", importance: "High", useCase: "CPI, PPI, jobs, wage data, and labor-market surprise detection." },
  { name: "BEA", category: "Macro / Rates", cadence: "Release calendar", access: "Public", importance: "High", useCase: "GDP, PCE, corporate profits, and macro growth trend confirmation." },
  { name: "U.S. Treasury", category: "Macro / Rates", cadence: "Daily monitoring", access: "Public", importance: "High", useCase: "Treasury yields, issuance, cash balance, curve movement, and debt market stress." },
  { name: "CME FedWatch Public View", category: "Macro / Rates", cadence: "Daily probability watch", access: "Public Web", importance: "Medium", useCase: "Market-implied rate probability context for equity and factor sensitivity." },
  { name: "Yahoo Finance", category: "Market News", cadence: "Headline watch", access: "Public Web", importance: "High", useCase: "Broad public headlines, ticker-level news, and retail-accessible narratives." },
  { name: "Nasdaq Public News", category: "Market News", cadence: "Ticker watch", access: "Public Web", importance: "High", useCase: "Company news, market updates, and exchange-level event awareness." },
  { name: "MarketWatch Public", category: "Market News", cadence: "Headline watch", access: "Public Web", importance: "Medium", useCase: "Market recaps, company headlines, and broad investor narrative tracking." },
  { name: "CNBC Public", category: "Market News", cadence: "Headline watch", access: "Public Web", importance: "Medium", useCase: "Breaking market narratives and widely consumed investor stories." },
  { name: "Google News Public Search", category: "Market News", cadence: "Topic watch", access: "Public Web", importance: "Medium", useCase: "Cross-source discovery for ticker, sector, and macro narratives." },
  { name: "PR Newswire", category: "Company Direct", cadence: "Constant press watch", access: "Public Web", importance: "High", useCase: "Company press releases, product launches, acquisitions, partnerships, and guidance updates." },
  { name: "Business Wire", category: "Company Direct", cadence: "Constant press watch", access: "Public Web", importance: "High", useCase: "Company announcements, earnings releases, and corporate event detection." },
  { name: "GlobeNewswire", category: "Company Direct", cadence: "Constant press watch", access: "Public Web", importance: "Medium", useCase: "Company announcements, smaller-cap press releases, and catalyst detection." },
  { name: "Company Investor Relations Pages", category: "Company Direct", cadence: "Daily crawl", access: "Public Web", importance: "Critical", useCase: "Direct company source for presentations, earnings materials, investor days, and guidance." },
  { name: "Earnings Call Calendars", category: "Earnings / Events", cadence: "Daily refresh", access: "Calendar", importance: "High", useCase: "Upcoming earnings, catalyst timing, surprise windows, and event-risk planning." },
  { name: "ETF Issuer Holdings Pages", category: "ETF / Fund / Index", cadence: "Daily refresh", access: "Public Web", importance: "Medium", useCase: "ETF constituent changes, fund flows, exposure mapping, and crowding clues." },
  { name: "Index Methodology Pages", category: "ETF / Fund / Index", cadence: "Weekly watch", access: "Public Web", importance: "Medium", useCase: "Index construction rules, rebalancing, inclusion criteria, and methodology changes." },
  { name: "ETF.com Public Data", category: "ETF / Fund / Index", cadence: "Daily watch", access: "Public Web", importance: "Medium", useCase: "ETF exposure, fund themes, and public flow-related context." },
  { name: "Reddit Public Finance Communities", category: "Public Sentiment", cadence: "Topic watch", access: "Public Web", importance: "Medium", useCase: "Retail attention, narrative acceleration, and crowd concentration." },
  { name: "Stocktwits Public Pages", category: "Public Sentiment", cadence: "Ticker watch", access: "Public Web", importance: "Medium", useCase: "Ticker-specific retail tone and short-term sentiment bursts." },
  { name: "YouTube Finance Channels", category: "Public Sentiment", cadence: "Topic watch", access: "Public Web", importance: "Medium", useCase: "Retail narrative formation, influencer attention, and viral stock stories." },
  { name: "Public X / Social Trends", category: "Public Sentiment", cadence: "Topic watch", access: "Public Web", importance: "Experimental", useCase: "Fast sentiment shifts and viral ticker attention where public data is available." },
  { name: "Wikipedia Pageview Trend", category: "Public Sentiment", cadence: "Daily watch", access: "API", importance: "Experimental", useCase: "Attention proxy for company, product, or market theme interest." },
  { name: "Public Substack Finance Posts", category: "Independent Research", cadence: "Topic watch", access: "Public Web", importance: "Medium", useCase: "Independent research narratives, long-form market theses, and niche analyst views." },
  { name: "Industry Trade Publications", category: "Independent Research", cadence: "Sector watch", access: "Public Web", importance: "High", useCase: "Early sector-level changes not yet priced into broad market commentary." },
  { name: "Patent and Product Release Feeds", category: "Independent Research", cadence: "Weekly watch", access: "Public Web", importance: "Medium", useCase: "Innovation signals, product cycles, and competitive edge detection." },
  { name: "Public Academic Research Feeds", category: "Independent Research", cadence: "Weekly watch", access: "Public Web", importance: "Medium", useCase: "Research and innovation signals that may affect long-duration growth themes." },
];

const paidIntegrations: PaidIntegration[] = [
  { name: "Bloomberg", category: "Terminal / Market Data", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Premium news, terminal-level market data, institutional context, analyst coverage, and macro data.", idealUse: "Advisor-authorized premium intelligence layer.", complianceNote: "Requires advisor subscription and permitted use." },
  { name: "FactSet", category: "Institutional Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Estimates, fundamentals, ownership, institutional datasets, screening, and portfolio analytics.", idealUse: "Institutional-grade data enrichment.", complianceNote: "Requires licensed API terms." },
  { name: "LSEG / Refinitiv", category: "Institutional Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Market news, estimates, fundamentals, event data, and global market datasets.", idealUse: "High-credibility financial data validation.", complianceNote: "Requires licensed API terms." },
  { name: "Morningstar", category: "Research", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Ratings, fund data, analyst reports, portfolio tools, and investment research.", idealUse: "Advisor research workflow and fund analysis.", complianceNote: "Requires advisor subscription and permitted use." },
  { name: "TradingView", category: "Technicals", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Advanced chart layouts, alerts, indicators, and market screens.", idealUse: "Advisor charting and visual technical workflow.", complianceNote: "Respect chart/data licensing." },
  { name: "Koyfin", category: "Analytics", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Macro dashboards, market analytics, charting, fundamentals, and data visualization.", idealUse: "Investment dashboard enrichment.", complianceNote: "Requires advisor subscription and permitted use." },
  { name: "Wall Street Journal", category: "Premium News", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Subscription news, company coverage, macro reporting, and business commentary.", idealUse: "Premium narrative validation.", complianceNote: "No scraping without permission." },
  { name: "Financial Times", category: "Premium News", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Global macro, policy, international business, and institutional-grade news.", idealUse: "Global market context.", complianceNote: "No scraping without permission." },
  { name: "Barron's", category: "Premium News", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Stock commentary, sector views, market analysis, and portfolio ideas.", idealUse: "Advisor-facing stock narrative review.", complianceNote: "No scraping without permission." },
  { name: "Seeking Alpha", category: "Research / Sentiment", accessType: "Advisor Login", setup: "Advisor Login", dataValue: "Articles, factor grades, transcripts, ratings, and crowd/analyst commentary.", idealUse: "Crowd plus analyst sentiment comparison.", complianceNote: "Requires advisor subscription and permitted use." },
  { name: "Alpha Vantage", category: "Real-Time Market Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Quotes, fundamentals, technicals, daily prices, and news sentiment through the Alpha Vantage API.", idealUse: "Core market-data layer for Slice technical and sentiment scoring.", complianceNote: "Requires ALPHA_VANTAGE_API_KEY in the environment." },
  { name: "Polygon.io", category: "Real-Time Market Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Real-time and historical equity, option, index, and market data depending on plan.", idealUse: "Production real-time technical engine.", complianceNote: "Requires licensed market data." },
  { name: "IEX Cloud", category: "Market Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Equity data, fundamentals, news, and market data APIs depending on plan.", idealUse: "Market data and fundamentals connector.", complianceNote: "Requires licensed market data." },
  { name: "Twelve Data", category: "Market Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Equity, forex, crypto, fundamentals, and technical indicator APIs.", idealUse: "Indicator and multi-asset technical feed.", complianceNote: "Requires licensed API terms." },
  { name: "Finnhub", category: "Market Data / News", accessType: "API Key", setup: "Secure API Vault", dataValue: "Market data, company news, sentiment, earnings, transcripts, and fundamentals.", idealUse: "News plus quote integration.", complianceNote: "Requires licensed API terms." },
  { name: "Tiingo", category: "Market Data", accessType: "API Key", setup: "Secure API Vault", dataValue: "Equity price data, fundamentals, crypto, and news datasets depending on plan.", idealUse: "Affordable market data feed.", complianceNote: "Requires licensed API terms." },
  { name: "Alpaca Market Data", category: "Broker API", accessType: "Broker API", setup: "Secure API Vault", dataValue: "Market data, brokerage, and trading infrastructure depending on account permissions.", idealUse: "Advisor-approved data and future execution infrastructure.", complianceNote: "Trading workflows require strict permissioning." },
  { name: "Interactive Brokers", category: "Broker API", accessType: "Broker API", setup: "One-click OAuth", dataValue: "Brokerage connectivity, account data, market data, and future execution workflows.", idealUse: "Advisor-supervised brokerage integration.", complianceNote: "Requires strict advisor/client authorization." },
  { name: "Advisor Excel / CSV Upload", category: "Internal Data", accessType: "File Import", setup: "File Upload", dataValue: "Private advisor models, holdings, watchlists, notes, rankings, and client exposure files.", idealUse: "Private Slice edge layer.", complianceNote: "Must protect client data and firm IP." },
];

const indexOptions: IndexOption[] = [
  { name: "S&P 500", symbol: "SPX", members: 500, speed: "Real-Time", description: "Large-cap U.S. equity universe for broad technical breadth and sentiment monitoring.", bestFor: "Core U.S. equity intelligence and large-cap opportunity discovery." },
  { name: "Nasdaq-100", symbol: "NDX", members: 100, speed: "Real-Time", description: "Technology-heavy universe for AI, software, semiconductors, cloud, and mega-cap growth leadership.", bestFor: "Growth leadership, AI exposure, and technology momentum." },
  { name: "Russell 2000", symbol: "RUT", members: 2000, speed: "Near Real-Time", description: "Small-cap universe for domestic cyclicals, credit sensitivity, liquidity stress, and recovery candidates.", bestFor: "Undervalued small-cap recovery and breadth reversal screening." },
  { name: "Dow Jones Industrial Average", symbol: "DJI", members: 30, speed: "Real-Time", description: "Concentrated blue-chip universe for mature business quality and macro sensitivity.", bestFor: "Blue-chip quality and conservative large-cap monitoring." },
  { name: "S&P MidCap 400", symbol: "MID", members: 400, speed: "Near Real-Time", description: "Mid-cap universe for growth-to-quality transitions and overlooked operating leverage.", bestFor: "Mid-cap quality, valuation gaps, and acquisition candidates." },
  { name: "Custom Advisor Watchlist", symbol: "CUSTOM", members: 0, speed: "Real-Time", description: "Advisor-defined universe from client holdings, firm models, internal research, or proprietary screens.", bestFor: "Firm-specific watchlists, client portfolios, and proprietary Slice models." },
];

const dataProviders: DataProvider[] = [
  { name: "Alpha Vantage", access: "Paid API", speed: "Near Real-Time", status: "Ready", productionReady: true, useCase: "Quotes, fundamentals, daily technicals, and news sentiment using ALPHA_VANTAGE_API_KEY." },
  { name: "Polygon.io", access: "Paid API", speed: "Real-Time", status: "Ready", productionReady: true, useCase: "Production real-time equities, indices, options, and historical market data." },
  { name: "Alpaca Market Data", access: "Broker API", speed: "Real-Time", status: "Ready", productionReady: true, useCase: "Market data and future trading infrastructure with proper permissions." },
  { name: "Interactive Brokers", access: "Broker API", speed: "Real-Time", status: "Ready", productionReady: true, useCase: "Brokerage, market data, account data, and advisor-approved infrastructure." },
  { name: "IEX Cloud", access: "Paid API", speed: "Near Real-Time", status: "Ready", productionReady: true, useCase: "Equities, fundamentals, company data, and news depending on plan." },
  { name: "Yahoo Finance Public", access: "Free Tier", speed: "Delayed", status: "Demo", productionReady: false, useCase: "Demo-level quotes, headlines, and broad public market context." },
];

const technicalSignals: TechnicalSignal[] = [
  { key: "valuation", name: "Valuation Dislocation", status: "Bullish", reading: "P/E, PEG, FCF yield, target-price gap, peer discount", explanation: "Looks for stocks priced below their own history, peer group, and growth-adjusted fair value.", decisionUse: "Flags potentially mispriced securities before the broader market reprices them." },
  { key: "growth", name: "Growth Durability", status: "Bullish", reading: "Revenue growth, EPS revisions, margin expansion, reinvestment quality", explanation: "Finds companies with growth that looks durable rather than one-time or cyclical.", decisionUse: "Separates cheap value traps from discounted compounders." },
  { key: "quality", name: "Quality Durability", status: "Bullish", reading: "Margins, ROE, FCF conversion, balance sheet strength", explanation: "Rewards businesses with durable operating quality and stable financial strength.", decisionUse: "Prevents over-ranking fragile growth companies." },
  { key: "trend", name: "Primary Trend", status: "Bullish", reading: "Price vs. 20/50/200-day moving averages", explanation: "Confirms whether the market is beginning to reward the thesis.", decisionUse: "Prevents buying solely because a stock looks cheap." },
  { key: "momentum", name: "Momentum Confirmation", status: "Neutral", reading: "RSI, 30-day momentum, rate of change, relative strength", explanation: "Identifies whether the stock is improving faster than its benchmark.", decisionUse: "Highlights leadership before obvious consensus." },
  { key: "volume", name: "Volume Accumulation", status: "Neutral", reading: "Volume thrust, accumulation/distribution, up-volume vs. down-volume", explanation: "Detects whether institutional or informed buying may be appearing.", decisionUse: "Confirms whether price movement has participation behind it." },
  { key: "breadth", name: "Technical Breadth", status: "Neutral", reading: "% above 50-day and 200-day averages inside the selected index", explanation: "Determines whether the broader universe supports risk-taking.", decisionUse: "Avoids isolated setups when the full index is deteriorating." },
  { key: "riskControl", name: "Risk Control", status: "Caution", reading: "Beta, ATR, drawdown, support fragility, downside gaps", explanation: "Reduces confidence when downside risk is structurally elevated.", decisionUse: "Controls position sizing and helps avoid unstable setups." },
  { key: "catalyst", name: "Catalyst Alignment", status: "Bullish", reading: "Earnings, guidance, buybacks, product events, macro tailwinds", explanation: "Scores whether there is a plausible reason for undervaluation to close.", decisionUse: "Prioritizes stocks with a reason for the market to care soon." },
  { key: "sentimentShift", name: "Sentiment Shift", status: "Bullish", reading: "News sentiment, source credibility, public attention, analyst tone", explanation: "Detects whether public and premium sentiment is changing in the stock’s favor.", decisionUse: "Links news behavior to technical setup quality." },
  { key: "marginOfSafety", name: "Margin of Safety", status: "Bullish", reading: "Intrinsic value gap, FCF yield support, downside buffer", explanation: "Adds discipline so the system does not chase high-growth names without valuation protection.", decisionUse: "Improves long-term survivability." },
  { key: "moat", name: "Moat Strength", status: "Bullish", reading: "Brand, switching cost, network effect, scale, regulatory advantage", explanation: "Rewards durable businesses with defendable long-term economics.", decisionUse: "Pushes toward compounding quality instead of short-term noise." },
  { key: "relativeStrength", name: "Relative Strength", status: "Bullish", reading: "Stock vs. sector, index, peers, and factor basket", explanation: "Measures whether the company is gaining leadership against its opportunity set.", decisionUse: "Prevents buying weak names in strong indexes." },
  { key: "liquidity", name: "Liquidity Quality", status: "Neutral", reading: "Spread, volume depth, participation, slippage risk", explanation: "Scores whether the opportunity is practical to trade and monitor at scale.", decisionUse: "Reduces false positives from thin or disorderly securities." },
  { key: "earningsRevision", name: "Earnings Revision Strength", status: "Bullish", reading: "Estimate direction, surprise trend, margin revisions, guidance", explanation: "Measures whether analyst and company expectations are improving.", decisionUse: "Helps separate true growth from stale narratives." },
  { key: "macroAlignment", name: "Macro Alignment", status: "Neutral", reading: "Rates, inflation, liquidity, cycle, sector sensitivity", explanation: "Measures whether the macro backdrop supports the security’s factor exposure.", decisionUse: "Prevents buying a strong company into a hostile macro regime." },
  { key: "environmentalAlignment", name: "Environmental Alignment", status: "Neutral", reading: "Energy intensity, regulatory exposure, transition risk, climate sensitivity", explanation: "Accounts for environmental risks that can affect multiples, costs, regulation, and long-term capital access.", decisionUse: "Avoids hidden environmental liabilities and identifies transition beneficiaries." },
  { key: "regulatoryRisk", name: "Regulatory Risk Control", status: "Caution", reading: "Sector regulation, antitrust, policy pressure, reimbursement, capital rules", explanation: "Measures whether law, policy, or regulation can materially change the investment path.", decisionUse: "Prevents overconfidence in sectors with unstable rule sets." },
];

const opportunities: Opportunity[] = [
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", price: 514.22, valuation: 68, growth: 89, quality: 91, trend: 82, momentum: 79, volume: 72, breadth: 76, riskControl: 78, catalyst: 84, sentimentShift: 76, marginOfSafety: 62, moat: 94, relativeStrength: 87, liquidity: 93, earningsRevision: 83, macroAlignment: 79, environmentalAlignment: 76, regulatoryRisk: 66, thesis: "Quality growth leadership with durable AI/cloud narrative and improving technical confirmation." },
  { symbol: "GOOGL", name: "Alphabet", sector: "Communication Services", price: 196.11, valuation: 78, growth: 82, quality: 84, trend: 74, momentum: 73, volume: 69, breadth: 71, riskControl: 76, catalyst: 77, sentimentShift: 72, marginOfSafety: 75, moat: 88, relativeStrength: 76, liquidity: 91, earningsRevision: 77, macroAlignment: 74, environmentalAlignment: 73, regulatoryRisk: 58, thesis: "Potential undervaluation versus earnings power if AI and advertising sentiment continues improving." },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary", price: 224.87, valuation: 72, growth: 84, quality: 80, trend: 75, momentum: 74, volume: 70, breadth: 73, riskControl: 70, catalyst: 81, sentimentShift: 74, marginOfSafety: 67, moat: 86, relativeStrength: 78, liquidity: 92, earningsRevision: 80, macroAlignment: 72, environmentalAlignment: 70, regulatoryRisk: 65, thesis: "Operating leverage and cloud recovery create favorable upside if margins keep expanding." },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", price: 161.4, valuation: 61, growth: 81, quality: 74, trend: 79, momentum: 83, volume: 78, breadth: 72, riskControl: 58, catalyst: 86, sentimentShift: 83, marginOfSafety: 54, moat: 73, relativeStrength: 84, liquidity: 86, earningsRevision: 82, macroAlignment: 75, environmentalAlignment: 69, regulatoryRisk: 72, thesis: "Growth potential is high, but valuation and volatility require stronger risk controls." },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", price: 296.52, valuation: 69, growth: 66, quality: 83, trend: 70, momentum: 67, volume: 65, breadth: 66, riskControl: 78, catalyst: 62, sentimentShift: 64, marginOfSafety: 72, moat: 82, relativeStrength: 69, liquidity: 94, earningsRevision: 68, macroAlignment: 67, environmentalAlignment: 63, regulatoryRisk: 61, thesis: "Quality financial franchise with macro and credit-cycle sensitivity." },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", price: 322.78, valuation: 74, growth: 70, quality: 77, trend: 62, momentum: 58, volume: 61, breadth: 59, riskControl: 63, catalyst: 66, sentimentShift: 54, marginOfSafety: 76, moat: 78, relativeStrength: 56, liquidity: 84, earningsRevision: 60, macroAlignment: 69, environmentalAlignment: 72, regulatoryRisk: 45, thesis: "Potential value recovery candidate, but sentiment and technical confirmation remain weak." },
];

const defaultCriteria: Record<CriteriaKey, boolean> = {
  undervalued: true,
  growth: true,
  quality: true,
  uptrend: true,
  momentum: false,
  volume: false,
  breadth: false,
  lowRisk: true,
  catalyst: true,
  sentiment: false,
  moat: true,
  safety: true,
  liquidity: false,
  revisions: true,
  macro: false,
  environmental: false,
  regulatory: false,
};

const criteriaOptions: Array<{ key: CriteriaKey; label: string; helper: string; field: keyof Opportunity; min: number }> = [
  { key: "undervalued", label: "Undervalued", helper: "Valuation above 70", field: "valuation", min: 70 },
  { key: "growth", label: "Growth", helper: "Growth above 75", field: "growth", min: 75 },
  { key: "quality", label: "Quality", helper: "Quality above 75", field: "quality", min: 75 },
  { key: "uptrend", label: "Uptrend", helper: "Trend above 70", field: "trend", min: 70 },
  { key: "momentum", label: "Momentum", helper: "Momentum above 70", field: "momentum", min: 70 },
  { key: "volume", label: "Volume", helper: "Volume above 70", field: "volume", min: 70 },
  { key: "breadth", label: "Breadth", helper: "Breadth above 70", field: "breadth", min: 70 },
  { key: "lowRisk", label: "Risk Control", helper: "Risk control above 70", field: "riskControl", min: 70 },
  { key: "catalyst", label: "Catalyst", helper: "Catalyst above 70", field: "catalyst", min: 70 },
  { key: "sentiment", label: "Sentiment Shift", helper: "Sentiment shift above 70", field: "sentimentShift", min: 70 },
  { key: "moat", label: "Moat", helper: "Moat above 75", field: "moat", min: 75 },
  { key: "safety", label: "Safety", helper: "Margin of safety above 65", field: "marginOfSafety", min: 65 },
  { key: "liquidity", label: "Liquidity", helper: "Liquidity above 75", field: "liquidity", min: 75 },
  { key: "revisions", label: "Revisions", helper: "Earnings revisions above 70", field: "earningsRevision", min: 70 },
  { key: "macro", label: "Macro", helper: "Macro alignment above 65", field: "macroAlignment", min: 65 },
  { key: "environmental", label: "Environmental", helper: "Environmental alignment above 65", field: "environmentalAlignment", min: 65 },
  { key: "regulatory", label: "Regulatory", helper: "Regulatory risk control above 60", field: "regulatoryRisk", min: 60 },
];

const scoreComponents: ScoreComponent[] = [
  { key: "newsSentiment", label: "News Sentiment", category: "News", visibleReasoning: "Measures whether the current news environment is helpful, neutral, or harmful.", positiveDriver: "Improves when credible sources repeatedly confirm positive catalysts.", riskDriver: "Weakens when negative stories repeat or conflict with fundamentals.", upgradeTrigger: "High-quality sources confirm better guidance, demand, margins, or product traction.", downgradeTrigger: "Official filings, earnings, or premium sources contradict the positive narrative.", factorStudyNote: "In the factor-study layer, news matters most when confirmed by source quality and technical follow-through." },
  { key: "sourceCredibility", label: "Source Credibility", category: "News", visibleReasoning: "Ranks how trustworthy the evidence behind the story appears to be.", positiveDriver: "Highest when filings, company-direct evidence, and licensed data confirm the same narrative.", riskDriver: "Lowest when social chatter drives the move without primary-source support.", upgradeTrigger: "A filing, earnings call, investor deck, or institutional feed confirms the story.", downgradeTrigger: "The story is speculative, unsourced, or contradicted by official evidence.", factorStudyNote: "Source credibility acts as a gatekeeper: weak evidence limits the final score even when sentiment looks strong." },
  { key: "narrativeVelocity", label: "Narrative Velocity", category: "News", visibleReasoning: "Measures whether the narrative is improving or deteriorating faster than normal.", positiveDriver: "Improves when sentiment accelerates without becoming euphoric or crowded.", riskDriver: "Weakens when attention spikes without evidence or rapidly deteriorates.", upgradeTrigger: "Positive coverage broadens across official, institutional, and public sources.", downgradeTrigger: "Narrative acceleration becomes hype-driven, crowded, or unsupported.", factorStudyNote: "Narrative velocity is useful early, but the model penalizes hype when valuation or trend quality disagrees." },
  { key: "technicalTrend", label: "Technical Trend", category: "Technicals", visibleReasoning: "Measures whether price action confirms the investment thesis.", positiveDriver: "Improves when price, trend, momentum, and volume confirm each other.", riskDriver: "Weakens when the stock breaks support or loses relative strength.", upgradeTrigger: "Breakout above key levels with strong volume and breadth confirmation.", downgradeTrigger: "Failure at resistance, breakdown below support, or deteriorating momentum.", factorStudyNote: "Trend is confirmation, not a standalone thesis. The score rewards alignment, not chasing." },
  { key: "technicalBreadth", label: "Technical Breadth", category: "Technicals", visibleReasoning: "Checks whether the broader index, sector, and peers support the move.", positiveDriver: "Improves when the company is supported by sector and index participation.", riskDriver: "Weakens when the stock is isolated while peers deteriorate.", upgradeTrigger: "More peers and index constituents confirm above important moving averages.", downgradeTrigger: "Sector breadth rolls over or leadership narrows too aggressively.", factorStudyNote: "Breadth reduces false positives by penalizing isolated breakouts." },
  { key: "valuationDislocation", label: "Valuation Dislocation", category: "Valuation", visibleReasoning: "Measures whether the stock appears mispriced relative to quality and growth.", positiveDriver: "Improves when valuation is discounted while fundamentals remain strong.", riskDriver: "Weakens when cheapness reflects real business deterioration.", upgradeTrigger: "Fundamentals improve while valuation remains below quality-adjusted norms.", downgradeTrigger: "Multiples expand faster than earnings quality or growth.", factorStudyNote: "Valuation dislocation works best when paired with revision strength and durable quality." },
  { key: "growthDurability", label: "Growth Durability", category: "Valuation", visibleReasoning: "Measures whether growth appears durable, recurring, and profitable.", positiveDriver: "Improves with revenue runway, margin expansion, and positive revisions.", riskDriver: "Weakens when growth is cyclical, one-time, or margin-destructive.", upgradeTrigger: "Revenue, margins, guidance, and forward estimates improve together.", downgradeTrigger: "Growth slows, revisions turn negative, or margins compress.", factorStudyNote: "Growth durability is weighted more heavily for long-duration compounding candidates." },
  { key: "qualityDurability", label: "Quality Durability", category: "Quality", visibleReasoning: "Measures balance sheet strength, cash flow quality, and operating consistency.", positiveDriver: "Improves when free cash flow, margins, and returns on capital are durable.", riskDriver: "Weakens when leverage, margin pressure, or earnings quality deteriorates.", upgradeTrigger: "Cash conversion, margin durability, and balance sheet strength improve.", downgradeTrigger: "Debt stress, weak cash flow, or deteriorating margin quality.", factorStudyNote: "Quality durability reduces drawdown risk and identifies businesses with staying power." },
  { key: "marginOfSafety", label: "Margin of Safety", category: "Quality", visibleReasoning: "Measures whether price leaves room for error relative to fundamental strength.", positiveDriver: "Improves when valuation offers downside buffer without business deterioration.", riskDriver: "Weakens when the stock requires perfection to justify the price.", upgradeTrigger: "Price weakens while fundamentals remain strong, or fundamentals improve without overpricing.", downgradeTrigger: "Price outruns improvement in earnings, moat, or cash flow.", factorStudyNote: "Margin of safety is treated as a survivability factor, especially under conservative standards." },
  { key: "moatStrength", label: "Moat Strength", category: "Quality", visibleReasoning: "Measures durable business edge: brand, scale, switching cost, network effect, or regulatory advantage.", positiveDriver: "Improves when the company protects pricing power and long-term returns.", riskDriver: "Weakens when competition erodes margins, retention, or share.", upgradeTrigger: "Margins, retention, share, and reinvestment economics improve.", downgradeTrigger: "Competitive pressure weakens pricing power or retention.", factorStudyNote: "Moat strength is one of the highest-value long-duration quality factors." },
  { key: "volatilityControl", label: "Volatility Control", category: "Risk", visibleReasoning: "Measures whether the setup has manageable downside behavior.", positiveDriver: "Improves when support is stable and volatility compresses constructively.", riskDriver: "Weakens when drawdowns, gaps, or ATR expand against the thesis.", upgradeTrigger: "The stock builds support and downside volatility falls.", downgradeTrigger: "Support breaks or downside gaps increase.", factorStudyNote: "Volatility control helps avoid attractive-looking names that behave poorly." },
  { key: "liquidityQuality", label: "Liquidity Quality", category: "Risk", visibleReasoning: "Measures whether the idea is practical to monitor and trade at scale.", positiveDriver: "Improves with deep liquidity, tight spreads, and orderly volume.", riskDriver: "Weakens when thin liquidity creates slippage or false signals.", upgradeTrigger: "Consistent volume depth and tighter spreads support the move.", downgradeTrigger: "Liquidity dries up or price action becomes disorderly.", factorStudyNote: "Liquidity quality is an implementation filter for advisor-grade use." },
  { key: "earningsRevisionStrength", label: "Earnings Revision Strength", category: "Valuation", visibleReasoning: "Measures whether expectations are moving in the company’s favor.", positiveDriver: "Improves with positive estimate revisions and guidance strength.", riskDriver: "Weakens when estimates fall or earnings quality becomes questionable.", upgradeTrigger: "Forward estimates, margins, and management commentary improve.", downgradeTrigger: "Analyst revisions or guidance move lower.", factorStudyNote: "Revision strength is one of the strongest growth-confirmation factors." },
  { key: "macroAlignment", label: "Macro Alignment", category: "Macro", visibleReasoning: "Measures whether rates, liquidity, inflation, and cycle conditions support the setup.", positiveDriver: "Improves when the macro backdrop supports the company’s factor exposure.", riskDriver: "Weakens when rates, liquidity, or cycle pressure work against the stock.", upgradeTrigger: "Macro conditions become supportive for the company’s sector and factor profile.", downgradeTrigger: "Rates, liquidity, or inflation conditions move against the thesis.", factorStudyNote: "Macro alignment explains why strong companies can temporarily underperform." },
  { key: "environmentalAlignment", label: "Environmental Alignment", category: "Environmental", visibleReasoning: "Measures environmental and transition risks that can affect valuation, costs, regulation, and capital access.", positiveDriver: "Improves when the business benefits from energy efficiency, transition demand, or lower environmental liabilities.", riskDriver: "Weakens when environmental exposure creates cost, regulatory, or reputational pressure.", upgradeTrigger: "Lower environmental liabilities, cleaner operations, or transition tailwinds improve.", downgradeTrigger: "Energy intensity, litigation, policy, or transition risk increases.", factorStudyNote: "Environmental exposure is treated as a long-horizon multiple and risk modifier, not a moral label." },
  { key: "regulatoryRiskControl", label: "Regulatory Risk Control", category: "Risk", visibleReasoning: "Measures whether legal, policy, antitrust, reimbursement, or capital rules can alter the thesis.", positiveDriver: "Improves when rule risk is stable, disclosed, and manageable.", riskDriver: "Weakens when policy pressure can materially change economics.", upgradeTrigger: "Regulatory clarity improves or worst-case policy outcomes fade.", downgradeTrigger: "New investigations, rate caps, antitrust pressure, or reimbursement risk increases.", factorStudyNote: "Regulatory risk is a scenario modifier because it can change expected returns abruptly." },
  { key: "supplyChainResilience", label: "Supply Chain Resilience", category: "Risk", visibleReasoning: "Measures whether input costs, supplier concentration, logistics, or geopolitical exposure can disrupt growth.", positiveDriver: "Improves when supply, input costs, and geography are diversified.", riskDriver: "Weakens when a company is exposed to fragile suppliers or geopolitical chokepoints.", upgradeTrigger: "Supplier diversity, inventory discipline, or input-cost relief improves.", downgradeTrigger: "Supplier concentration, logistics friction, or geopolitical risk rises.", factorStudyNote: "Supply-chain resilience is included because disruption often shows up before earnings revisions fully reflect it." },
  { key: "contradictionPenalty", label: "Contradiction Penalty", category: "Risk", visibleReasoning: "Penalizes disagreement between news, technicals, valuation, quality, and price action.", positiveDriver: "Penalty stays low when the evidence stack is aligned.", riskDriver: "Penalty rises when headlines, price action, and fundamentals disagree.", upgradeTrigger: "News, technical confirmation, valuation, and quality converge.", downgradeTrigger: "Positive narrative conflicts with weak technicals or official evidence.", factorStudyNote: "Contradiction penalty is the anti-hype mechanism." },
  { key: "advisorPrivateEdge", label: "Advisor Private Edge", category: "Private Edge", visibleReasoning: "Represents permissioned firm-specific context such as watchlists, research notes, holdings, and client relevance.", positiveDriver: "Improves when internal advisor research supports public and technical evidence.", riskDriver: "Weakens when internal research conflicts with public excitement.", upgradeTrigger: "Advisor conviction, client relevance, and model context align.", downgradeTrigger: "Internal research or portfolio context contradicts the public signal.", factorStudyNote: "Private advisor context is intended to make Slice differentiated, not merely another public-data score." },
];

function clamp(value: number) {
  if (Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function scoreFromText(input: string, salt: number) {
  const clean = input.trim().toUpperCase() || "SLICE";
  const raw = clean.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1 + salt), 0);
  return 42 + (raw % 52);
}

function scoreHigherIsBetter(value: number, low: number, high: number) {
  return clamp(((value - low) / (high - low)) * 100);
}

function scoreLowerIsBetter(value: number, low: number, high: number) {
  return clamp(100 - ((value - low) / (high - low)) * 100);
}

function sectorEnvironmentalProxy(sector?: string) {
  const clean = String(sector ?? "").toLowerCase();
  if (clean.includes("technology")) return 76;
  if (clean.includes("communication")) return 73;
  if (clean.includes("health")) return 72;
  if (clean.includes("financial")) return 63;
  if (clean.includes("energy")) return 45;
  if (clean.includes("industrial")) return 57;
  if (clean.includes("consumer")) return 68;
  return 62;
}

function sectorRegulatoryProxy(sector?: string) {
  const clean = String(sector ?? "").toLowerCase();
  if (clean.includes("health")) return 45;
  if (clean.includes("communication")) return 58;
  if (clean.includes("financial")) return 61;
  if (clean.includes("technology")) return 66;
  if (clean.includes("energy")) return 52;
  return 68;
}

function buildScore(
  ticker: string,
  horizon: string,
  model: SentimentModel,
  provider: string,
  index: string,
  refreshSeed: number,
  liveData?: AlphaVantageData | null,
): ScoreBreakdown {
  const base = `${ticker}-${horizon}-${model}-${provider}-${index}-${refreshSeed}`;
  const overview = liveData?.overview;
  const technicals = liveData?.technicals;
  const quote = liveData?.quote;
  const news = liveData?.news;

  const alphaNews = news?.relevanceWeightedSentiment != null ? clamp(50 + news.relevanceWeightedSentiment * 50) : scoreFromText(base, 1);
  const alphaCredibility = news?.articleCount ? clamp(58 + Math.min(news.articleCount, 30) * 1.2) : scoreFromText(base, 2);
  const alphaVelocity = quote?.changePercent != null ? clamp(50 + quote.changePercent * 2.7) : scoreFromText(base, 3);

  const technicalTrend = technicals?.trendScore ?? scoreFromText(base, 4);
  const technicalBreadth = scoreFromText(`${base}-breadth`, 5);
  const valuationDislocation =
    overview?.peRatio || overview?.pegRatio || overview?.analystTargetPrice
      ? clamp(
          scoreLowerIsBetter(safeNumber(overview.peRatio, 25), 8, 45) * 0.32 +
            scoreLowerIsBetter(safeNumber(overview.pegRatio, 2.5), 0.5, 4) * 0.28 +
            scoreHigherIsBetter(((safeNumber(overview.analystTargetPrice, quote?.price ?? 0) - safeNumber(quote?.price, 1)) / Math.max(safeNumber(quote?.price, 1), 1)) * 100, -15, 35) * 0.4,
        )
      : scoreFromText(base, 6);

  const growthDurability =
    overview?.quarterlyRevenueGrowthYOY || overview?.quarterlyEarningsGrowthYOY
      ? clamp(
          scoreHigherIsBetter(safeNumber(overview.quarterlyRevenueGrowthYOY, 0) * 100, -10, 35) * 0.45 +
            scoreHigherIsBetter(safeNumber(overview.quarterlyEarningsGrowthYOY, 0) * 100, -15, 45) * 0.55,
        )
      : scoreFromText(base, 7);

  const qualityDurability =
    overview?.profitMargin || overview?.operatingMargin || overview?.returnOnEquity
      ? clamp(
          scoreHigherIsBetter(safeNumber(overview.profitMargin, 0) * 100, 0, 35) * 0.35 +
            scoreHigherIsBetter(safeNumber(overview.operatingMargin, 0) * 100, 0, 40) * 0.3 +
            scoreHigherIsBetter(safeNumber(overview.returnOnEquity, 0) * 100, 0, 45) * 0.35,
        )
      : scoreFromText(base, 8);

  const marginOfSafety =
    quote?.price && overview?.analystTargetPrice
      ? clamp(
          scoreHigherIsBetter(((overview.analystTargetPrice - quote.price) / quote.price) * 100, -20, 40) * 0.55 +
            valuationDislocation * 0.45,
        )
      : scoreFromText(base, 9);

  const moatStrength = clamp(
    qualityDurability * 0.35 +
      growthDurability * 0.2 +
      scoreFromText(`${base}-moat-proxy`, 10) * 0.25 +
      sectorEnvironmentalProxy(overview?.sector) * 0.08 +
      sectorRegulatoryProxy(overview?.sector) * 0.12,
  );

  const volatilityControl = technicals?.riskScore ?? (overview?.beta ? scoreLowerIsBetter(overview.beta, 0.6, 2.3) : scoreFromText(base, 11));
  const liquidityQuality = quote?.volume ? scoreHigherIsBetter(Math.log10(Math.max(quote.volume, 1)), 4.5, 8.5) : scoreFromText(base, 12);
  const earningsRevisionStrength = clamp(growthDurability * 0.55 + scoreFromText(`${base}-revision-proxy`, 13) * 0.45);
  const macroAlignment = scoreFromText(`${base}-macro`, 14);
  const environmentalAlignment = clamp(sectorEnvironmentalProxy(overview?.sector) * 0.55 + scoreFromText(`${base}-environment`, 15) * 0.45);
  const regulatoryRiskControl = clamp(sectorRegulatoryProxy(overview?.sector) * 0.6 + scoreFromText(`${base}-regulatory`, 16) * 0.4);
  const supplyChainResilience = clamp(scoreFromText(`${base}-supply`, 17) * 0.45 + qualityDurability * 0.25 + regulatoryRiskControl * 0.15 + environmentalAlignment * 0.15);
  const advisorPrivateEdge = scoreFromText(`${base}-private-edge`, 18);

  const contradictionPenalty = clamp(
    Math.abs(alphaNews - technicalTrend) * 0.28 +
      Math.abs(valuationDislocation - growthDurability) * 0.2 +
      Math.abs(qualityDurability - volatilityControl) * 0.18 +
      Math.max(0, 50 - alphaCredibility) * 0.2 +
      Math.max(0, 55 - liquidityQuality) * 0.14,
  );

  const modelMultipliers: Record<SentimentModel, Record<string, number>> = {
    "Core Slice": {
      newsSentiment: 0.07,
      sourceCredibility: 0.08,
      narrativeVelocity: 0.05,
      technicalTrend: 0.08,
      technicalBreadth: 0.06,
      valuationDislocation: 0.08,
      growthDurability: 0.08,
      qualityDurability: 0.08,
      marginOfSafety: 0.07,
      moatStrength: 0.08,
      volatilityControl: 0.07,
      liquidityQuality: 0.04,
      earningsRevisionStrength: 0.07,
      macroAlignment: 0.05,
      environmentalAlignment: 0.04,
      regulatoryRiskControl: 0.05,
      supplyChainResilience: 0.04,
      advisorPrivateEdge: 0.08,
      contradictionPenalty: 0.08,
    },
    "Growth Discovery": {
      newsSentiment: 0.08,
      sourceCredibility: 0.06,
      narrativeVelocity: 0.08,
      technicalTrend: 0.09,
      technicalBreadth: 0.05,
      valuationDislocation: 0.05,
      growthDurability: 0.16,
      qualityDurability: 0.07,
      marginOfSafety: 0.05,
      moatStrength: 0.06,
      volatilityControl: 0.05,
      liquidityQuality: 0.04,
      earningsRevisionStrength: 0.12,
      macroAlignment: 0.05,
      environmentalAlignment: 0.03,
      regulatoryRiskControl: 0.04,
      supplyChainResilience: 0.04,
      advisorPrivateEdge: 0.08,
      contradictionPenalty: 0.07,
    },
    "Risk-Controlled": {
      newsSentiment: 0.06,
      sourceCredibility: 0.09,
      narrativeVelocity: 0.04,
      technicalTrend: 0.07,
      technicalBreadth: 0.09,
      valuationDislocation: 0.06,
      growthDurability: 0.06,
      qualityDurability: 0.1,
      marginOfSafety: 0.1,
      moatStrength: 0.09,
      volatilityControl: 0.13,
      liquidityQuality: 0.07,
      earningsRevisionStrength: 0.05,
      macroAlignment: 0.07,
      environmentalAlignment: 0.05,
      regulatoryRiskControl: 0.07,
      supplyChainResilience: 0.06,
      advisorPrivateEdge: 0.06,
      contradictionPenalty: 0.1,
    },
    "Contrarian Opportunity": {
      newsSentiment: 0.05,
      sourceCredibility: 0.08,
      narrativeVelocity: 0.05,
      technicalTrend: 0.07,
      technicalBreadth: 0.05,
      valuationDislocation: 0.17,
      growthDurability: 0.07,
      qualityDurability: 0.08,
      marginOfSafety: 0.14,
      moatStrength: 0.07,
      volatilityControl: 0.06,
      liquidityQuality: 0.04,
      earningsRevisionStrength: 0.06,
      macroAlignment: 0.05,
      environmentalAlignment: 0.04,
      regulatoryRiskControl: 0.05,
      supplyChainResilience: 0.04,
      advisorPrivateEdge: 0.08,
      contradictionPenalty: 0.08,
    },
    "Index Builder": {
      newsSentiment: 0.06,
      sourceCredibility: 0.09,
      narrativeVelocity: 0.04,
      technicalTrend: 0.08,
      technicalBreadth: 0.12,
      valuationDislocation: 0.06,
      growthDurability: 0.07,
      qualityDurability: 0.09,
      marginOfSafety: 0.08,
      moatStrength: 0.09,
      volatilityControl: 0.1,
      liquidityQuality: 0.07,
      earningsRevisionStrength: 0.06,
      macroAlignment: 0.07,
      environmentalAlignment: 0.05,
      regulatoryRiskControl: 0.06,
      supplyChainResilience: 0.05,
      advisorPrivateEdge: 0.05,
      contradictionPenalty: 0.08,
    },
  };

  const weights = modelMultipliers[model];

  const composite = clamp(
    alphaNews * weights.newsSentiment +
      alphaCredibility * weights.sourceCredibility +
      alphaVelocity * weights.narrativeVelocity +
      technicalTrend * weights.technicalTrend +
      technicalBreadth * weights.technicalBreadth +
      valuationDislocation * weights.valuationDislocation +
      growthDurability * weights.growthDurability +
      qualityDurability * weights.qualityDurability +
      marginOfSafety * weights.marginOfSafety +
      moatStrength * weights.moatStrength +
      volatilityControl * weights.volatilityControl +
      liquidityQuality * weights.liquidityQuality +
      earningsRevisionStrength * weights.earningsRevisionStrength +
      macroAlignment * weights.macroAlignment +
      environmentalAlignment * weights.environmentalAlignment +
      regulatoryRiskControl * weights.regulatoryRiskControl +
      supplyChainResilience * weights.supplyChainResilience +
      advisorPrivateEdge * weights.advisorPrivateEdge -
      contradictionPenalty * weights.contradictionPenalty,
  );

  const confidence = clamp(
    alphaCredibility * 0.16 +
      technicalBreadth * 0.09 +
      qualityDurability * 0.1 +
      marginOfSafety * 0.09 +
      moatStrength * 0.09 +
      volatilityControl * 0.09 +
      liquidityQuality * 0.08 +
      earningsRevisionStrength * 0.08 +
      macroAlignment * 0.06 +
      environmentalAlignment * 0.04 +
      regulatoryRiskControl * 0.05 +
      supplyChainResilience * 0.04 +
      advisorPrivateEdge * 0.05 +
      Math.max(0, 100 - contradictionPenalty) * 0.08,
  );

  return {
    newsSentiment: alphaNews,
    sourceCredibility: alphaCredibility,
    narrativeVelocity: alphaVelocity,
    technicalTrend,
    technicalBreadth,
    valuationDislocation,
    growthDurability,
    qualityDurability,
    marginOfSafety,
    moatStrength,
    volatilityControl,
    liquidityQuality,
    earningsRevisionStrength,
    macroAlignment,
    environmentalAlignment,
    regulatoryRiskControl,
    supplyChainResilience,
    contradictionPenalty,
    advisorPrivateEdge,
    composite,
    confidence,
  };
}

function buildScenarios(score: ScoreBreakdown): Scenario[] {
  const bull = clamp(score.composite * 0.32 + score.growthDurability * 0.12 + score.technicalTrend * 0.11 + score.newsSentiment * 0.06 + score.moatStrength * 0.1 + score.marginOfSafety * 0.06 + score.earningsRevisionStrength * 0.08 + score.advisorPrivateEdge * 0.06 + score.supplyChainResilience * 0.04 + score.environmentalAlignment * 0.05);
  const bear = clamp((100 - score.volatilityControl) * 0.22 + score.contradictionPenalty * 0.25 + (100 - score.technicalBreadth) * 0.14 + (100 - score.sourceCredibility) * 0.1 + (100 - score.marginOfSafety) * 0.1 + (100 - score.liquidityQuality) * 0.08 + (100 - score.regulatoryRiskControl) * 0.06 + (100 - score.supplyChainResilience) * 0.05);
  const base = clamp(100 - Math.round((bull + bear) / 2));
  const reRating = clamp(score.valuationDislocation * 0.24 + score.earningsRevisionStrength * 0.2 + score.technicalTrend * 0.18 + score.sourceCredibility * 0.13 + score.narrativeVelocity * 0.1 + score.moatStrength * 0.1 + score.marginOfSafety * 0.05);
  const valueTrap = clamp((100 - score.growthDurability) * 0.2 + (100 - score.qualityDurability) * 0.2 + score.contradictionPenalty * 0.22 + (100 - score.technicalTrend) * 0.18 + (100 - score.regulatoryRiskControl) * 0.1 + (100 - score.supplyChainResilience) * 0.1);

  return [
    { name: "Bull Case", probability: Math.max(5, Math.min(90, bull)), tone: "green", explanation: "Positive path if news, quality, moat, revisions, technicals, environmental/regulatory resilience, and advisor context align.", trigger: "Upgrade if price confirms with volume, revisions rise, and source credibility remains strong." },
    { name: "Base Case", probability: Math.max(5, Math.min(80, base)), tone: "cyan", explanation: "Balanced path if the company remains constructive but not yet decisive enough for high-conviction status.", trigger: "Hold review if thesis stays intact but breadth, trend, or valuation are not yet compelling." },
    { name: "Bear Case", probability: Math.max(5, Math.min(82, bear)), tone: "red", explanation: "Downside path if contradiction, volatility, weak breadth, poor liquidity, environmental risk, or regulatory risk overwhelms the setup.", trigger: "Downgrade if support fails, source credibility weakens, or official evidence contradicts the thesis." },
    { name: "Re-Rating Path", probability: Math.max(5, Math.min(84, reRating)), tone: "purple", explanation: "The market may re-rate the company if valuation dislocation closes while earnings revisions improve.", trigger: "Upgrade if estimates move higher and the stock confirms above prior resistance." },
    { name: "Value Trap Path", probability: Math.max(5, Math.min(84, valueTrap)), tone: "amber", explanation: "The company may look cheap but remain weak if growth, quality, regulation, and technical confirmation fail.", trigger: "Downgrade if valuation appears cheap while revisions, trend, and quality continue weakening." },
  ];
}

function buildNewsEvents(ticker: string, refreshSeed: number, liveData?: AlphaVantageData | null): NewsEvent[] {
  const cleanTicker = ticker.trim().toUpperCase() || "MSFT";
  const baseScore = liveData?.news?.relevanceWeightedSentiment != null ? clamp(50 + liveData.news.relevanceWeightedSentiment * 50) : scoreFromText(`${cleanTicker}-${refreshSeed}`, 23);
  const price = liveData?.quote?.price ?? 80 + scoreFromText(`${cleanTicker}-price-${refreshSeed}`, 30) * 5.15;

  return [
    {
      id: `news-${cleanTicker}-velocity`,
      title: `${cleanTicker} narrative velocity changed across public and advisor-approved sources`,
      source: liveData?.news?.latestTitle ? "Alpha Vantage + Slice News Scanner" : "Slice News Scanner",
      tickers: [cleanTicker],
      urgency: baseScore > 75 ? "High" : "Medium",
      sentiment: baseScore > 70 ? "Positive" : baseScore < 45 ? "Negative" : "Neutral",
      confidence: clamp(baseScore),
      desirability: clamp(baseScore + 4),
      price: Number(price.toFixed(2)),
      reason: liveData?.news?.latestTitle
        ? `Latest Alpha Vantage sentiment input: ${liveData.news.latestTitle}`
        : "Multiple source categories are pointing to narrative movement versus the trailing baseline.",
    },
    {
      id: `news-${cleanTicker}-official`,
      title: "Filings and company-direct sources remain the highest credibility inputs",
      source: "Official Evidence Layer",
      tickers: [cleanTicker],
      urgency: "Critical",
      sentiment: "Neutral",
      confidence: 91,
      desirability: 66,
      price: Number((price * 0.98).toFixed(2)),
      reason: "The score gives primary evidence more weight than public commentary or social attention.",
    },
    {
      id: `news-${cleanTicker}-confirmation`,
      title: "Technical confirmation is required before positive news receives full score credit",
      source: "Contradiction Engine",
      tickers: [cleanTicker],
      urgency: "High",
      sentiment: "Neutral",
      confidence: 84,
      desirability: 72,
      price: Number((price * 1.04).toFixed(2)),
      reason: "Positive news receives a penalty if price, breadth, volume, or trend confirmation is weak.",
    },
  ];
}

function normalizeTechnicalScore(opportunity: Opportunity, strategy: TechnicalStrategy, liveData?: AlphaVantageData | null) {
  const strategyWeights: Record<TechnicalStrategy, Record<TechnicalWeightKey, number>> = {
    "Undervalued Growth": {
      valuation: 14,
      growth: 13,
      quality: 9,
      trend: 8,
      momentum: 6,
      volume: 5,
      breadth: 5,
      riskControl: 6,
      catalyst: 7,
      sentimentShift: 5,
      marginOfSafety: 11,
      moat: 7,
      relativeStrength: 6,
      liquidity: 4,
      earningsRevision: 8,
      macroAlignment: 4,
      environmentalAlignment: 3,
      regulatoryRisk: 4,
    },
    "Momentum Confirmation": {
      valuation: 5,
      growth: 7,
      quality: 6,
      trend: 15,
      momentum: 15,
      volume: 12,
      breadth: 7,
      riskControl: 5,
      catalyst: 5,
      sentimentShift: 9,
      marginOfSafety: 3,
      moat: 4,
      relativeStrength: 14,
      liquidity: 6,
      earningsRevision: 6,
      macroAlignment: 4,
      environmentalAlignment: 2,
      regulatoryRisk: 3,
    },
    "Low-Volatility Quality": {
      valuation: 7,
      growth: 7,
      quality: 15,
      trend: 6,
      momentum: 4,
      volume: 4,
      breadth: 8,
      riskControl: 16,
      catalyst: 4,
      sentimentShift: 4,
      marginOfSafety: 12,
      moat: 14,
      relativeStrength: 5,
      liquidity: 7,
      earningsRevision: 5,
      macroAlignment: 6,
      environmentalAlignment: 5,
      regulatoryRisk: 6,
    },
    "Turnaround Watch": {
      valuation: 17,
      growth: 7,
      quality: 6,
      trend: 7,
      momentum: 9,
      volume: 11,
      breadth: 5,
      riskControl: 5,
      catalyst: 14,
      sentimentShift: 13,
      marginOfSafety: 11,
      moat: 5,
      relativeStrength: 8,
      liquidity: 5,
      earningsRevision: 8,
      macroAlignment: 4,
      environmentalAlignment: 3,
      regulatoryRisk: 5,
    },
    "Quality Compounding": {
      valuation: 10,
      growth: 9,
      quality: 18,
      trend: 5,
      momentum: 3,
      volume: 3,
      breadth: 5,
      riskControl: 12,
      catalyst: 4,
      sentimentShift: 3,
      marginOfSafety: 16,
      moat: 22,
      relativeStrength: 5,
      liquidity: 7,
      earningsRevision: 7,
      macroAlignment: 7,
      environmentalAlignment: 6,
      regulatoryRisk: 6,
    },
  };

  const weights = strategyWeights[strategy];
  const totalWeight = Object.values(weights).reduce((sum, item) => sum + item, 0);

  const liveTrend = liveData?.technicals?.trendScore ?? opportunity.trend;
  const liveMomentum = liveData?.technicals?.momentumScore ?? opportunity.momentum;
  const liveVolume = liveData?.technicals?.volumeScore ?? opportunity.volume;
  const liveRisk = liveData?.technicals?.riskScore ?? opportunity.riskControl;
  const livePrice = liveData?.quote?.price ?? opportunity.price;

  const raw =
    opportunity.valuation * weights.valuation +
    opportunity.growth * weights.growth +
    opportunity.quality * weights.quality +
    liveTrend * weights.trend +
    liveMomentum * weights.momentum +
    liveVolume * weights.volume +
    opportunity.breadth * weights.breadth +
    liveRisk * weights.riskControl +
    opportunity.catalyst * weights.catalyst +
    opportunity.sentimentShift * weights.sentimentShift +
    opportunity.marginOfSafety * weights.marginOfSafety +
    opportunity.moat * weights.moat +
    opportunity.relativeStrength * weights.relativeStrength +
    opportunity.liquidity * weights.liquidity +
    opportunity.earningsRevision * weights.earningsRevision +
    opportunity.macroAlignment * weights.macroAlignment +
    opportunity.environmentalAlignment * weights.environmentalAlignment +
    opportunity.regulatoryRisk * weights.regulatoryRisk;

  return {
    score: clamp(raw / totalWeight),
    price: Number(livePrice.toFixed(2)),
    trend: liveTrend,
    momentum: liveMomentum,
    volume: liveVolume,
    riskControl: liveRisk,
  };
}

function scoreLabel(score: number) {
  if (score >= 90) return "Elite compounding candidate";
  if (score >= 82) return "High-conviction review";
  if (score >= 74) return "Desirable setup";
  if (score >= 64) return "Watchlist positive";
  if (score >= 50) return "Neutral";
  return "Weak / avoid";
}

function investmentGradeLabel(score: number, confidence: number, standard: RiskStandard, threshold: number, confidenceThreshold: number, contradiction: number, moat: number, safety: number, environmental: number, regulatory: number) {
  const requiredScore = standard === "Conservative" ? threshold + 5 : standard === "Aggressive Growth" ? threshold - 4 : threshold;
  const requiredConfidence = standard === "Conservative" ? confidenceThreshold + 5 : standard === "Aggressive Growth" ? confidenceThreshold - 3 : confidenceThreshold;
  const maxContradiction = standard === "Conservative" ? 32 : standard === "Aggressive Growth" ? 52 : 42;
  const minMoat = standard === "Conservative" ? 72 : standard === "Aggressive Growth" ? 55 : 64;
  const minSafety = standard === "Conservative" ? 68 : standard === "Aggressive Growth" ? 48 : 58;
  const minEnvironmental = standard === "Conservative" ? 58 : standard === "Aggressive Growth" ? 42 : 50;
  const minRegulatory = standard === "Conservative" ? 58 : standard === "Aggressive Growth" ? 42 : 50;

  if (
    score >= requiredScore &&
    confidence >= requiredConfidence &&
    contradiction <= maxContradiction &&
    moat >= minMoat &&
    safety >= minSafety &&
    environmental >= minEnvironmental &&
    regulatory >= minRegulatory
  ) {
    return "Investment Grade";
  }

  if (score >= requiredScore - 5 && confidence >= requiredConfidence - 8) return "Near Investment Grade";
  return "Not Investment Grade";
}

function toneForScore(score: number): Tone {
  if (score >= 80) return "green";
  if (score >= 65) return "cyan";
  if (score >= 50) return "amber";
  return "red";
}

function statusTone(status: TechnicalSignal["status"] | string): Tone {
  if (status === "Bullish") return "green";
  if (status === "Neutral") return "cyan";
  if (status === "Caution") return "amber";
  if (status === "Bearish") return "red";
  return "slate";
}

function importanceTone(importance: Importance): Tone {
  if (importance === "Critical") return "red";
  if (importance === "High") return "green";
  if (importance === "Medium") return "cyan";
  return "amber";
}

function speedTone(speed: DataSpeed): Tone {
  if (speed === "Real-Time") return "green";
  if (speed === "Near Real-Time") return "cyan";
  return "amber";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClasses[tone])}>
      {children}
    </span>
  );
}

function Panel({ children, tone = "slate", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  const glow: Record<Tone, string> = {
    red: "from-red-500/10",
    green: "from-emerald-500/10",
    amber: "from-amber-500/10",
    purple: "from-purple-500/10",
    cyan: "from-cyan-500/8",
    blue: "from-blue-500/8",
    slate: "from-slate-500/6",
  };

  return (
    <section className={cx("relative overflow-hidden rounded-[2rem] border border-red-400/10 bg-black/40 p-5 shadow-xl shadow-red-950/8 backdrop-blur-xl", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b via-red-500/[0.018] to-transparent", glow[tone])} />
      <div className="relative">{children}</div>
    </section>
  );
}

function Metric({ label, value, helper, tone = "slate" }: { label: string; value: string | number; helper?: string; tone?: Tone }) {
  return (
    <Panel tone={tone} className="p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-3xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
    </Panel>
  );
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: Tone }) {
  const colors: Record<Tone, string> = {
    red: "from-red-500 to-red-900",
    green: "from-emerald-400 to-red-900",
    amber: "from-amber-400 to-red-900",
    purple: "from-purple-400 to-red-900",
    cyan: "from-cyan-400 to-red-900",
    blue: "from-blue-400 to-red-900",
    slate: "from-slate-400 to-red-900",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={cx("h-full rounded-full bg-gradient-to-r", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>("news");

  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceCategory, setSourceCategory] = useState("All");
  const [integrationQuery, setIntegrationQuery] = useState("");
  const [integrationCategory, setIntegrationCategory] = useState("All");
  const [activeIntegration, setActiveIntegration] = useState("Alpha Vantage");
  const [connectionAccount, setConnectionAccount] = useState("");
  const [credentialReference, setCredentialReference] = useState("");
  const [activeSourceInterval, setActiveSourceInterval] = useState("15");
  const [connections, setConnections] = useState<Record<string, IntegrationConnection>>({});
  const [hydrated, setHydrated] = useState(false);

  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [globalScanIntervalMinutes, setGlobalScanIntervalMinutes] = useState("15");
  const [scanCount, setScanCount] = useState(0);
  const [lastAutoScan, setLastAutoScan] = useState<Date | null>(null);

  const [selectedIndexSymbol, setSelectedIndexSymbol] = useState(indexOptions[0].symbol);
  const [dataProviderName, setDataProviderName] = useState("Alpha Vantage");
  const [technicalHorizon, setTechnicalHorizon] = useState("30 days");
  const [technicalStrategy, setTechnicalStrategy] = useState<TechnicalStrategy>("Undervalued Growth");
  const [minComposite, setMinComposite] = useState("70");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [customIndexName, setCustomIndexName] = useState("");
  const [customIndexSymbols, setCustomIndexSymbols] = useState("");
  const [criteria, setCriteria] = useState<Record<CriteriaKey, boolean>>(defaultCriteria);

  const [ticker, setTicker] = useState("MSFT");
  const [sentimentHorizon, setSentimentHorizon] = useState("30 days");
  const [sentimentModel, setSentimentModel] = useState<SentimentModel>("Core Slice");
  const [riskStandard, setRiskStandard] = useState<RiskStandard>("Balanced");
  const [investmentGradeThreshold, setInvestmentGradeThreshold] = useState("75");
  const [confidenceThreshold, setConfidenceThreshold] = useState("70");
  const [refreshSeed, setRefreshSeed] = useState(1);
  const [now, setNow] = useState(() => new Date());

  const [alphaData, setAlphaData] = useState<AlphaVantageData | null>(null);
  const [alphaLoading, setAlphaLoading] = useState(false);
  const [alphaMessage, setAlphaMessage] = useState("");

  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [alertEmail, setAlertEmail] = useState("");
  const [newsAlertThreshold, setNewsAlertThreshold] = useState("75");
  const [technicalAlertThreshold, setTechnicalAlertThreshold] = useState("75");
  const [sentimentAlertThreshold, setSentimentAlertThreshold] = useState("75");
  const [priceAlertThreshold, setPriceAlertThreshold] = useState("100");
  const [queuedAlerts, setQueuedAlerts] = useState<QueuedAlert[]>([]);
  const queuedAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const rawConnections = localStorage.getItem(CONNECTION_STORAGE_KEY);
      const rawAlerts = localStorage.getItem(ALERT_STORAGE_KEY);
      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (rawConnections) setConnections(JSON.parse(rawConnections) as Record<string, IntegrationConnection>);
      if (rawAlerts) setQueuedAlerts(JSON.parse(rawAlerts) as QueuedAlert[]);
      if (rawSettings) {
        const settings = JSON.parse(rawSettings) as {
          autoScanEnabled?: boolean;
          globalScanIntervalMinutes?: string;
          alertEmail?: string;
          newsAlertThreshold?: string;
          technicalAlertThreshold?: string;
          sentimentAlertThreshold?: string;
          priceAlertThreshold?: string;
        };

        setAutoScanEnabled(settings.autoScanEnabled ?? true);
        setGlobalScanIntervalMinutes(settings.globalScanIntervalMinutes ?? "15");
        setAlertEmail(settings.alertEmail ?? "");
        setNewsAlertThreshold(settings.newsAlertThreshold ?? "75");
        setTechnicalAlertThreshold(settings.technicalAlertThreshold ?? "75");
        setSentimentAlertThreshold(settings.sentimentAlertThreshold ?? "75");
        setPriceAlertThreshold(settings.priceAlertThreshold ?? "100");
      }
    } catch {
      setConnections({});
      setQueuedAlerts([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connections));
  }, [connections, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(queuedAlerts));
  }, [queuedAlerts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        autoScanEnabled,
        globalScanIntervalMinutes,
        alertEmail,
        newsAlertThreshold,
        technicalAlertThreshold,
        sentimentAlertThreshold,
        priceAlertThreshold,
      }),
    );
  }, [autoScanEnabled, globalScanIntervalMinutes, alertEmail, newsAlertThreshold, technicalAlertThreshold, sentimentAlertThreshold, priceAlertThreshold, hydrated]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!autoScanEnabled) return;

    const minutes = Math.max(1, Number(globalScanIntervalMinutes || 15));
    const interval = window.setInterval(() => {
      void runManualScan();
    }, minutes * 60 * 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScanEnabled, globalScanIntervalMinutes, ticker, dataProviderName]);

  const selectedIndex = useMemo(
    () => indexOptions.find((index) => index.symbol === selectedIndexSymbol) ?? indexOptions[0],
    [selectedIndexSymbol],
  );

  const selectedProvider = useMemo(
    () => dataProviders.find((provider) => provider.name === dataProviderName) ?? dataProviders[0],
    [dataProviderName],
  );

  const filteredSources = useMemo(() => {
    const query = sourceQuery.toLowerCase().trim();

    return publicSources.filter((source) => {
      const matchesCategory = sourceCategory === "All" || source.category === sourceCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        source.name.toLowerCase().includes(query) ||
        source.category.toLowerCase().includes(query) ||
        source.access.toLowerCase().includes(query) ||
        source.importance.toLowerCase().includes(query) ||
        source.useCase.toLowerCase().includes(query) ||
        source.cadence.toLowerCase().includes(query)
      );
    });
  }, [sourceQuery, sourceCategory]);

  const filteredIntegrations = useMemo(() => {
    const query = integrationQuery.toLowerCase().trim();

    return paidIntegrations.filter((integration) => {
      const matchesCategory = integrationCategory === "All" || integration.category === integrationCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        integration.name.toLowerCase().includes(query) ||
        integration.category.toLowerCase().includes(query) ||
        integration.accessType.toLowerCase().includes(query) ||
        integration.setup.toLowerCase().includes(query) ||
        integration.dataValue.toLowerCase().includes(query) ||
        integration.idealUse.toLowerCase().includes(query) ||
        integration.complianceNote.toLowerCase().includes(query)
      );
    });
  }, [integrationQuery, integrationCategory]);

  const activeIntegrationItem = paidIntegrations.find((item) => item.name === activeIntegration) ?? paidIntegrations[0];
  const activeConnection = connections[activeIntegrationItem.name];

  const sectorOptions = useMemo(() => ["All", ...Array.from(new Set(opportunities.map((item) => item.sector))).sort()], []);

  const rankedOpportunities = useMemo<RankedOpportunity[]>(() => {
    return opportunities
      .map((opportunity) => {
        const live = opportunity.symbol === ticker.toUpperCase() ? alphaData : null;
        const technicalResult = normalizeTechnicalScore(opportunity, technicalStrategy, live);
        const score = technicalResult.score;
        const alertReason =
          score >= 85
            ? "Elite desirable setup: quality, moat, margin of safety, technical confirmation, revisions, environmental/regulatory alignment, and catalyst strength are aligned."
            : score >= 75
              ? "Potentially desirable setup: opportunity deserves advisor review."
              : "Monitor only: signal is not yet strong enough for high-conviction review.";

        return {
          ...opportunity,
          price: technicalResult.price,
          trend: technicalResult.trend,
          momentum: technicalResult.momentum,
          volume: technicalResult.volume,
          riskControl: technicalResult.riskControl,
          score,
          label: scoreLabel(score),
          alertReason,
        };
      })
      .filter((opportunity) => opportunity.score >= Number(minComposite || 0))
      .filter((opportunity) => sectorFilter === "All" || opportunity.sector === sectorFilter)
      .filter((opportunity) =>
        criteriaOptions.every((item) => {
          if (!criteria[item.key]) return true;
          return Number(opportunity[item.field]) >= item.min;
        }),
      )
      .sort((a, b) => b.score - a.score);
  }, [technicalStrategy, minComposite, sectorFilter, criteria, ticker, alphaData]);

  const score = useMemo(
    () => buildScore(ticker, sentimentHorizon, sentimentModel, dataProviderName, selectedIndexSymbol, refreshSeed, alphaData),
    [ticker, sentimentHorizon, sentimentModel, dataProviderName, selectedIndexSymbol, refreshSeed, alphaData],
  );

  const scenarios = useMemo(() => buildScenarios(score), [score]);
  const newsEvents = useMemo(() => buildNewsEvents(ticker, refreshSeed, alphaData), [ticker, refreshSeed, alphaData]);
  const connectedCount = Object.values(connections).filter((item) => item.connected).length;
  const realTimeReady = selectedProvider.speed === "Real-Time" || selectedProvider.name === "Alpha Vantage";

  const investmentGradeStatus = investmentGradeLabel(
    score.composite,
    score.confidence,
    riskStandard,
    Number(investmentGradeThreshold || 0),
    Number(confidenceThreshold || 0),
    score.contradictionPenalty,
    score.moatStrength,
    score.marginOfSafety,
    score.environmentalAlignment,
    score.regulatoryRiskControl,
  );

  const selectedTickerPrice = alphaData?.quote?.price ?? opportunities.find((item) => item.symbol === ticker.toUpperCase())?.price ?? newsEvents[0]?.price ?? 0;

  const desirableNewsEvents = useMemo(
    () =>
      newsEvents.filter(
        (event) =>
          event.desirability >= Number(newsAlertThreshold || 0) &&
          event.price >= Number(priceAlertThreshold || 0),
      ),
    [newsEvents, newsAlertThreshold, priceAlertThreshold],
  );

  const desirableTechnicalEvents = useMemo(
    () =>
      rankedOpportunities.filter(
        (item) =>
          item.score >= Number(technicalAlertThreshold || 0) &&
          item.price >= Number(priceAlertThreshold || 0),
      ),
    [rankedOpportunities, technicalAlertThreshold, priceAlertThreshold],
  );

  async function loadAlphaVantageData(symbol: string) {
    const cleanSymbol = symbol.trim().toUpperCase() || "MSFT";
    setAlphaLoading(true);
    setAlphaMessage("");

    try {
      const response = await fetch(`/api/intelligence/alpha-vantage?symbol=${encodeURIComponent(cleanSymbol)}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as AlphaVantageData;

      if (!response.ok) {
        setAlphaMessage(payload.error || "Alpha Vantage request failed.");
        setAlphaData(payload);
        return payload;
      }

      setAlphaData(payload);
      setAlphaMessage(payload.error || `Alpha Vantage refreshed for ${cleanSymbol}.`);
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach Alpha Vantage route.";
      setAlphaMessage(message);
      return null;
    } finally {
      setAlphaLoading(false);
    }
  }

  async function sendEmailAlert(alert: QueuedAlert) {
    try {
      const response = await fetch("/api/intelligence/email-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "send-intelligence-alert",
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) throw new Error("Email route failed.");

      const result = await response.json();

      setQueuedAlerts((current) =>
        current.map((item) =>
          item.id === alert.id
            ? {
                ...item,
                status: result.sent ? "Sent" : "Simulated",
                detail: result.message ?? item.detail,
              }
            : item,
        ),
      );
    } catch {
      setQueuedAlerts((current) =>
        current.map((item) =>
          item.id === alert.id
            ? {
                ...item,
                status: "Simulated",
                detail: "Email API route is not connected yet. Alert is queued in demo mode.",
              }
            : item,
        ),
      );
    }
  }

  function queueEmailAlert(type: "News" | "Technicals" | "Sentiment", id: string, title: string, detail: string) {
    const destination = alertEmail.trim() || "advisor@email.com";
    const uniqueId = `${type}-${id}-${destination}`;

    if (queuedAlertIds.current.has(uniqueId)) return;

    queuedAlertIds.current.add(uniqueId);

    const alert: QueuedAlert = {
      id: uniqueId,
      type,
      title,
      destination,
      createdAt: new Date().toISOString(),
      status: "Queued",
      detail,
    };

    setQueuedAlerts((current) => [alert, ...current]);
    void sendEmailAlert(alert);
  }

  function runAlertScan() {
    desirableNewsEvents.forEach((event) => {
      queueEmailAlert(
        "News",
        event.id,
        event.title,
        `${event.tickers.join(", ")} | Price ${event.price} | Desirability ${event.desirability} | ${event.reason}`,
      );
    });

    desirableTechnicalEvents.forEach((event) => {
      queueEmailAlert(
        "Technicals",
        event.symbol,
        `${event.symbol} flagged as desirable: ${event.label}`,
        `${event.symbol} | Price ${event.price} | Technical Score ${event.score} | ${event.alertReason}`,
      );
    });

    if (score.composite >= Number(sentimentAlertThreshold || 0) && selectedTickerPrice >= Number(priceAlertThreshold || 0)) {
      queueEmailAlert(
        "Sentiment",
        `${ticker}-${sentimentModel}-${sentimentHorizon}`,
        `${ticker} Slice Sentiment Score crossed ${score.composite}`,
        `${ticker} | Price ${selectedTickerPrice} | Sentiment Score ${score.composite} | Confidence ${score.confidence} | Investment Grade Standard: ${investmentGradeStatus}`,
      );
    }
  }

  async function runManualScan() {
    await loadAlphaVantageData(ticker);
    setRefreshSeed((current) => current + 1);
    setScanCount((current) => current + 1);
    setLastAutoScan(new Date());
    window.setTimeout(runAlertScan, 150);
  }

  function connectActiveIntegration() {
    const nowIso = new Date().toISOString();

    setConnections((current) => ({
      ...current,
      [activeIntegrationItem.name]: {
        connected: true,
        accountLabel: connectionAccount.trim() || `${activeIntegrationItem.name} advisor account`,
        credentialReference: credentialReference.trim() || `${activeIntegrationItem.setup} credential stored`,
        scanEnabled: true,
        scanIntervalMinutes: Math.max(1, Number(activeSourceInterval || 15)),
        connectedAt: current[activeIntegrationItem.name]?.connectedAt ?? nowIso,
        lastCheckedAt: nowIso,
        tokenStatus: activeIntegrationItem.name === "Alpha Vantage" ? "Healthy" : "Demo",
        health: "Healthy",
      },
    }));

    if (activeIntegrationItem.name === "Alpha Vantage") {
      void loadAlphaVantageData(ticker);
    }
  }

  function disconnectActiveIntegration() {
    setConnections((current) => ({
      ...current,
      [activeIntegrationItem.name]: {
        ...(current[activeIntegrationItem.name] ?? {
          accountLabel: activeIntegrationItem.name,
          credentialReference: "",
          scanEnabled: false,
          scanIntervalMinutes: 15,
          connectedAt: new Date().toISOString(),
          lastCheckedAt: new Date().toISOString(),
          tokenStatus: "Demo" as const,
          health: "Disconnected" as const,
        }),
        connected: false,
        health: "Disconnected",
        tokenStatus: "Needs Reconnect",
      },
    }));
  }

  function testActiveIntegration() {
    setConnections((current) => {
      if (!current[activeIntegrationItem.name]) return current;

      return {
        ...current,
        [activeIntegrationItem.name]: {
          ...current[activeIntegrationItem.name],
          lastCheckedAt: new Date().toISOString(),
          tokenStatus: "Healthy",
          health: "Healthy",
        },
      };
    });

    if (activeIntegrationItem.name === "Alpha Vantage") {
      void loadAlphaVantageData(ticker);
    }
  }

  function updateConnectionInterval(minutes: string) {
    setActiveSourceInterval(minutes);

    setConnections((current) => {
      if (!current[activeIntegrationItem.name]) return current;

      return {
        ...current,
        [activeIntegrationItem.name]: {
          ...current[activeIntegrationItem.name],
          scanIntervalMinutes: Math.max(1, Number(minutes || 15)),
        },
      };
    });
  }

  useEffect(() => {
    if (!emailAlertsEnabled) return;
    runAlertScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailAlertsEnabled, refreshSeed]);

  useEffect(() => {
    void loadAlphaVantageData(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.20),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.055),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(127,29,29,0.06),_transparent_46%),linear-gradient(135deg,_#020617,_#08090f,_#100707,_#150808)] p-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-18%] h-[42rem] w-[42rem] rounded-full bg-red-700/[0.06] blur-3xl" />
        <div className="absolute right-[-14%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-red-500/[0.035] blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-orange-500/[0.02] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.016)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.75rem] border border-red-400/10 bg-black/68 p-6 shadow-2xl shadow-red-950/14 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-red-600/[0.07] via-red-500/[0.016] to-transparent" />

          <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Slice Intelligence V12</Pill>
                <Pill tone="green">Alpha Vantage Active</Pill>
                <Pill tone="purple">Autonomous Scans</Pill>
                <Pill tone="cyan">Factor Study Logic</Pill>
                <Pill tone={realTimeReady ? "green" : "amber"}>{selectedProvider.speed}</Pill>
              </div>

              <h1 className="mt-4 max-w-7xl text-4xl font-black tracking-tight md:text-6xl">
                Autonomous intelligence with Alpha Vantage data, maintained source connections, and deeper factor scoring.
              </h1>

              <p className="mt-3 max-w-6xl text-sm leading-7 text-slate-400">
                This version uses the Alpha Vantage backend route for quotes, fundamentals, technical inputs, and news sentiment.
                It improves autonomous scans, simplifies source connection maintenance, expands technical criteria, and adds
                environmental, regulatory, supply-chain, liquidity, revision, moat, and margin-of-safety logic to the proprietary score.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/workspace" prefetch={false} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-red-950/20">
                ← Workspace
              </Link>
              <div className="rounded-2xl border border-red-400/10 bg-red-500/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-100">
                Live clock: {now.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric label="Connected Sources" value={connectedCount} helper={`${paidIntegrations.length} available`} tone="purple" />
            <Metric label="Auto Scanner" value={autoScanEnabled ? "On" : "Off"} helper={`Every ${globalScanIntervalMinutes}m`} tone={autoScanEnabled ? "green" : "slate"} />
            <Metric label="Alpha Vantage" value={alphaData?.quote?.price ? `$${alphaData.quote.price}` : alphaLoading ? "Loading" : "Ready"} helper={alphaMessage || ticker} tone={alphaData?.error ? "amber" : "green"} />
            <Metric label="Provider" value={selectedProvider.name} helper={selectedProvider.speed} tone={speedTone(selectedProvider.speed)} />
            <Metric label="Investment Grade" value={investmentGradeStatus} helper={`${score.composite}/${score.confidence}`} tone={investmentGradeStatus === "Investment Grade" ? "green" : investmentGradeStatus === "Near Investment Grade" ? "amber" : "red"} />
            <Metric label="Slice Score" value={score.composite} helper={scoreLabel(score.composite)} tone={toneForScore(score.composite)} />
          </div>

          <div className="relative mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm leading-6 text-amber-100">
            Alpha Vantage usage requires <span className="font-black">ALPHA_VANTAGE_API_KEY</span> in your environment.
            Real subscription login persistence requires production OAuth/API-token storage, encryption, refresh tokens, provider-specific compliance,
            and backend workers. This page now includes the frontend workflow and server route needed to start using Alpha Vantage.
          </div>
        </header>

        <Panel tone="amber">
          <SectionHeader
            eyebrow="Autonomous Scanner"
            title="Continuous scan schedule and automatic alerts"
            description="Set the scan interval, run manual scans, and automatically send alerts when news, technical, or sentiment thresholds are crossed."
            action={<Pill tone={emailAlertsEnabled ? "green" : "slate"}>{emailAlertsEnabled ? "Alerts On" : "Alerts Off"}</Pill>}
          />

          <div className="mt-5 grid gap-3 xl:grid-cols-[1.05fr_0.45fr_0.45fr_0.45fr_0.45fr_0.45fr_0.45fr]">
            <input value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} placeholder="Advisor alert email" className={inputClass} />
            <input value={globalScanIntervalMinutes} onChange={(event) => setGlobalScanIntervalMinutes(event.target.value)} placeholder="Scan minutes" className={inputClass} />
            <input value={newsAlertThreshold} onChange={(event) => setNewsAlertThreshold(event.target.value)} placeholder="News score" className={inputClass} />
            <input value={technicalAlertThreshold} onChange={(event) => setTechnicalAlertThreshold(event.target.value)} placeholder="Technical score" className={inputClass} />
            <input value={sentimentAlertThreshold} onChange={(event) => setSentimentAlertThreshold(event.target.value)} placeholder="Sentiment score" className={inputClass} />
            <input value={priceAlertThreshold} onChange={(event) => setPriceAlertThreshold(event.target.value)} placeholder="Min price" className={inputClass} />
            <button type="button" onClick={() => setEmailAlertsEnabled((current) => !current)} className={emailAlertsEnabled ? softButtonClass : redButtonClass}>
              {emailAlertsEnabled ? "Disable" : "Enable"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void runManualScan()} className={redButtonClass}>Run Scan Now</button>
            <button type="button" onClick={() => setAutoScanEnabled((current) => !current)} className={softButtonClass}>
              {autoScanEnabled ? "Pause Auto Scan" : "Start Auto Scan"}
            </button>
            <button type="button" onClick={runAlertScan} className={softButtonClass}>Run Alert Scan</button>
            <button type="button" onClick={() => { setQueuedAlerts([]); queuedAlertIds.current.clear(); }} className={softButtonClass}>Clear Queue</button>
          </div>

          {queuedAlerts.length ? (
            <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {queuedAlerts.slice(0, 8).map((alert) => (
                <article key={alert.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.045] p-3">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={alert.type === "News" ? "red" : alert.type === "Technicals" ? "purple" : "green"}>{alert.type}</Pill>
                    <Pill tone={alert.status === "Sent" ? "green" : alert.status === "Failed" ? "red" : "amber"}>{alert.status}</Pill>
                  </div>
                  <div className="mt-3 text-sm font-black text-white">{alert.title}</div>
                  <div className="mt-1 text-xs text-slate-500">To: {alert.destination}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{alert.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-red-400/12 p-5 text-center text-sm font-bold text-slate-500">
              No alerts queued yet. Run a scan or lower thresholds to test the workflow.
            </div>
          )}
        </Panel>

        <div className="grid gap-2 rounded-[1.5rem] border border-red-400/10 bg-black/50 p-2 md:grid-cols-3">
          {[
            ["news", "News", "Persistent source setup", "red"],
            ["technicals", "Technicals", "Criteria-based screening", "purple"],
            ["sentiment", "Sentiment Score", "Advanced factor reasoning", "green"],
          ].map(([key, label, helper, tone]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as Tab)}
              className={cx(
                "rounded-2xl px-4 py-4 text-left transition",
                activeTab === key
                  ? "bg-gradient-to-r from-white via-red-50 to-red-100 text-slate-950 shadow-lg shadow-red-950/15"
                  : "bg-white/5 text-white hover:bg-red-500/[0.04]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black">{label}</div>
                <span className={cx("h-2 w-2 rounded-full", tone === "red" ? "bg-red-500" : tone === "purple" ? "bg-purple-400" : "bg-emerald-400")} />
              </div>
              <div className="mt-1 text-[10px] font-bold text-slate-500">{helper}</div>
            </button>
          ))}
        </div>

        {activeTab === "news" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_580px]">
            <div className="grid gap-5">
              <Panel tone="red">
                <SectionHeader
                  eyebrow="News Intelligence"
                  title="Scanned sources and event detection"
                  description="News scoring uses public sources, maintained subscription connections, Alpha Vantage news sentiment, and source credibility logic."
                  action={<button type="button" onClick={() => void runManualScan()} className={redButtonClass}>Run Intelligence Refresh</button>}
                />

                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                  <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search SEC, macro, sentiment, filings, IR, news..." className={inputClass} />
                  <select value={sourceCategory} onChange={(event) => setSourceCategory(event.target.value)} className={inputClass}>
                    {["All", ...Array.from(new Set(publicSources.map((source) => source.category))).sort()].map((category) => <option key={category}>{category}</option>)}
                  </select>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredSources.map((source) => (
                    <article key={source.name} className="rounded-2xl border border-red-400/10 bg-gradient-to-br from-red-500/[0.03] via-black/25 to-black/38 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-white">{source.name}</div>
                          <div className="mt-1 text-xs font-bold text-red-100/70">{source.category} · {source.access}</div>
                        </div>
                        <Pill tone={importanceTone(source.importance)}>{source.importance}</Pill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{source.useCase}</p>
                      <div className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-100/70">{source.cadence}</div>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel tone="amber">
                <SectionHeader
                  eyebrow="News Flags"
                  title="Email-triggering news events"
                  description="Any event above your news score threshold and minimum price threshold can be routed to email."
                  action={<Pill tone="amber">{desirableNewsEvents.length} eligible</Pill>}
                />

                <div className="mt-5 grid gap-3">
                  {newsEvents.map((event) => (
                    <article key={event.id} className="rounded-2xl border border-red-400/10 bg-black/35 p-4">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={importanceTone(event.urgency)}>{event.urgency}</Pill>
                        <Pill tone={event.sentiment === "Positive" ? "green" : event.sentiment === "Negative" ? "red" : "cyan"}>{event.sentiment}</Pill>
                        <Pill tone={toneForScore(event.confidence)}>{event.confidence}% confidence</Pill>
                        <Pill tone={toneForScore(event.desirability)}>{event.desirability}% desirable</Pill>
                        <Pill tone="blue">${event.price}</Pill>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-white">{event.title}</h3>
                      <div className="mt-1 text-xs font-bold text-slate-500">{event.source} · {event.tickers.join(", ")}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{event.reason}</p>
                      <button type="button" onClick={() => queueEmailAlert("News", event.id, event.title, `${event.tickers.join(", ")} | Price ${event.price} | Desirability ${event.desirability} | ${event.reason}`)} className={cx("mt-4", softButtonClass)}>
                        Queue Email Alert
                      </button>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid gap-5">
              <Panel tone="purple">
                <SectionHeader
                  eyebrow="Third-Party Connection Center"
                  title="Connect, maintain, test, and scan paid sources"
                  description="Connections persist locally for demo continuity. Alpha Vantage is wired into the backend route and uses ALPHA_VANTAGE_API_KEY."
                  action={<Pill tone="purple">{connectedCount} connected</Pill>}
                />

                <div className="mt-5 grid gap-3">
                  <input value={integrationQuery} onChange={(event) => setIntegrationQuery(event.target.value)} placeholder="Search Alpha Vantage, Bloomberg, FactSet, TradingView..." className={inputClass} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={integrationCategory} onChange={(event) => setIntegrationCategory(event.target.value)} className={inputClass}>
                      {["All", ...Array.from(new Set(paidIntegrations.map((integration) => integration.category))).sort()].map((category) => <option key={category}>{category}</option>)}
                    </select>

                    <select value={activeIntegration} onChange={(event) => setActiveIntegration(event.target.value)} className={inputClass}>
                      {filteredIntegrations.map((integration) => <option key={integration.name}>{integration.name}</option>)}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-4">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="purple">{activeIntegrationItem.setup}</Pill>
                      <Pill tone={activeConnection?.connected ? "green" : "slate"}>{activeConnection?.connected ? "Connected" : "Not Connected"}</Pill>
                      <Pill tone={activeConnection?.health === "Healthy" ? "green" : activeConnection?.health === "Needs Review" ? "amber" : "slate"}>{activeConnection?.health ?? "No Health Check"}</Pill>
                      <Pill tone={activeConnection?.tokenStatus === "Healthy" ? "green" : activeConnection?.tokenStatus === "Expiring Soon" ? "amber" : "slate"}>{activeConnection?.tokenStatus ?? "No Token"}</Pill>
                    </div>

                    <h3 className="mt-3 text-2xl font-black text-white">{activeIntegrationItem.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{activeIntegrationItem.dataValue}</p>
                    <p className="mt-2 text-xs leading-5 text-purple-100/80">{activeIntegrationItem.idealUse}</p>
                    <p className="mt-2 text-[11px] leading-5 text-amber-100/70">{activeIntegrationItem.complianceNote}</p>

                    <div className="mt-4 grid gap-3">
                      <input value={connectionAccount} onChange={(event) => setConnectionAccount(event.target.value)} placeholder="Account label or advisor email" className={inputClass} />
                      <input value={credentialReference} onChange={(event) => setCredentialReference(event.target.value)} placeholder="Credential nickname only, not raw password" className={inputClass} />
                      <input value={activeSourceInterval} onChange={(event) => updateConnectionInterval(event.target.value)} placeholder="Source scan interval in minutes" className={inputClass} />
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-4">
                      <button type="button" onClick={connectActiveIntegration} className={redButtonClass}>Connect + Maintain</button>
                      <button type="button" onClick={testActiveIntegration} className={softButtonClass}>Test Connection</button>
                      <button type="button" onClick={disconnectActiveIntegration} className={softButtonClass}>Disconnect</button>
                      <button type="button" onClick={() => void loadAlphaVantageData(ticker)} className={softButtonClass}>Refresh Alpha</button>
                    </div>

                    {activeConnection ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                        <span className="font-black text-white">Maintained connection:</span> {activeConnection.accountLabel} ·
                        scan every {activeConnection.scanIntervalMinutes}m · last checked {new Date(activeConnection.lastCheckedAt).toLocaleString()}
                      </div>
                    ) : null}

                    {alphaMessage ? (
                      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-3 text-xs leading-5 text-amber-100">
                        {alphaMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                    {filteredIntegrations.map((integration) => {
                      const connection = connections[integration.name];

                      return (
                        <button
                          key={integration.name}
                          type="button"
                          onClick={() => setActiveIntegration(integration.name)}
                          className={cx("rounded-2xl border p-4 text-left transition hover:bg-white/[0.06]", activeIntegration === integration.name ? "border-purple-400/40 bg-purple-500/10" : "border-red-400/10 bg-black/30")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-black text-white">{integration.name}</div>
                              <div className="mt-1 text-xs font-bold text-slate-500">{integration.category} · {integration.accessType}</div>
                              {connection?.connected ? <div className="mt-2 text-xs text-emerald-200">Maintained · every {connection.scanIntervalMinutes}m</div> : null}
                            </div>
                            <Pill tone={connection?.connected ? "green" : "slate"}>{connection?.connected ? "Connected" : integration.setup}</Pill>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            </div>
          </section>
        ) : null}

        {activeTab === "technicals" ? (
          <section className="grid gap-5 xl:grid-cols-[500px_minmax(0,1fr)]">
            <Panel tone="red">
              <SectionHeader
                eyebrow="Advanced Technical Engine"
                title="Criteria-driven opportunity discovery"
                description="Use Alpha Vantage plus Slice criteria to screen the selected index for specific investable setups."
              />

              <div className="mt-5 grid gap-3">
                <select value={selectedIndexSymbol} onChange={(event) => setSelectedIndexSymbol(event.target.value)} className={inputClass}>
                  {indexOptions.map((index) => <option key={index.symbol} value={index.symbol}>{index.name}</option>)}
                </select>

                <select value={dataProviderName} onChange={(event) => setDataProviderName(event.target.value)} className={inputClass}>
                  {dataProviders.map((provider) => <option key={provider.name}>{provider.name}</option>)}
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={technicalHorizon} onChange={(event) => setTechnicalHorizon(event.target.value)} className={inputClass}>
                    <option>Intraday</option>
                    <option>7 days</option>
                    <option>30 days</option>
                    <option>90 days</option>
                    <option>6 months</option>
                    <option>1 year</option>
                  </select>

                  <select value={technicalStrategy} onChange={(event) => setTechnicalStrategy(event.target.value as TechnicalStrategy)} className={inputClass}>
                    <option>Undervalued Growth</option>
                    <option>Momentum Confirmation</option>
                    <option>Low-Volatility Quality</option>
                    <option>Turnaround Watch</option>
                    <option>Quality Compounding</option>
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className={inputClass}>
                    {sectorOptions.map((sector) => <option key={sector}>{sector}</option>)}
                  </select>
                  <input value={minComposite} onChange={(event) => setMinComposite(event.target.value)} placeholder="Minimum composite score" className={inputClass} />
                </div>

                <div className="rounded-2xl border border-red-400/10 bg-gradient-to-br from-red-500/[0.03] via-black/35 to-black/50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="red">{selectedIndex.symbol}</Pill>
                    <Pill tone="cyan">{selectedIndex.members || "Custom"} securities</Pill>
                    <Pill tone={speedTone(selectedProvider.speed)}>{selectedProvider.speed}</Pill>
                    <Pill tone={selectedProvider.productionReady ? "green" : "amber"}>{selectedProvider.productionReady ? "Production-feed ready" : "Demo-feed only"}</Pill>
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-white">{selectedIndex.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{selectedIndex.description}</p>
                  <p className="mt-3 text-xs leading-5 text-red-100/80">Best for: {selectedIndex.bestFor}</p>
                  <p className="mt-2 text-xs leading-5 text-cyan-100/80">Provider: {selectedProvider.name} · {selectedProvider.access} · {selectedProvider.useCase}</p>
                </div>

                {selectedIndex.symbol === "CUSTOM" ? (
                  <div className="grid gap-3 rounded-2xl border border-red-400/10 bg-red-500/[0.03] p-4">
                    <input value={customIndexName} onChange={(event) => setCustomIndexName(event.target.value)} placeholder="Custom index name" className={inputClass} />
                    <textarea value={customIndexSymbols} onChange={(event) => setCustomIndexSymbols(event.target.value)} placeholder="Symbols, separated by commas or lines" className={cx(inputClass, "min-h-28")} />
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Alpha Trend" value={alphaData?.technicals?.trendScore ?? "—"} helper={alphaData?.symbol ?? ticker} tone="green" />
                  <Metric label="Alpha RSI" value={alphaData?.technicals?.rsi14 ?? "—"} helper="RSI 14" tone="cyan" />
                  <Metric label="Eligible Alerts" value={desirableTechnicalEvents.length} helper="Score + price" tone="amber" />
                  <Metric label="Candidates" value={rankedOpportunities.length} helper="After criteria" tone="purple" />
                </div>
              </div>
            </Panel>

            <div className="grid gap-5">
              <Panel tone="purple">
                <SectionHeader
                  eyebrow="Screening Criteria"
                  title="Choose the stock requirements"
                  description="Make the technical screen easier to use by selecting the exact conditions a stock must pass."
                  action={<button type="button" onClick={() => setCriteria(defaultCriteria)} className={softButtonClass}>Reset Criteria</button>}
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {criteriaOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCriteria((current) => ({ ...current, [item.key]: !current[item.key] }))}
                      className={cx("rounded-2xl border p-4 text-left transition hover:bg-white/[0.06]", criteria[item.key] ? "border-emerald-500/25 bg-emerald-500/10" : "border-white/10 bg-black/30")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-white">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</div>
                        </div>
                        <Pill tone={criteria[item.key] ? "green" : "slate"}>{criteria[item.key] ? "On" : "Off"}</Pill>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel tone="blue">
                <SectionHeader
                  eyebrow="Opportunity Monitor"
                  title="Index stocks that match selected criteria"
                  description="A candidate must pass the selected criteria, score threshold, and optional alert thresholds."
                  action={<Pill tone="blue">{rankedOpportunities.length} candidates</Pill>}
                />

                <div className="mt-5 overflow-hidden rounded-2xl border border-red-400/10">
                  <div className="grid grid-cols-[0.55fr_1fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_1.5fr] gap-2 bg-red-500/[0.035] p-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <div>Symbol</div>
                    <div>Name</div>
                    <div>Price</div>
                    <div>Moat</div>
                    <div>Safety</div>
                    <div>ESG</div>
                    <div>Reg.</div>
                    <div>Risk</div>
                    <div>Score</div>
                    <div>Thesis</div>
                  </div>

                  {rankedOpportunities.map((item) => (
                    <div key={item.symbol} className="grid grid-cols-[0.55fr_1fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_0.65fr_1.5fr] gap-2 border-t border-red-400/10 p-3 text-sm">
                      <div className="font-black text-white">{item.symbol}</div>
                      <div className="text-slate-300">{item.name}</div>
                      <div className="text-blue-200">${item.price}</div>
                      <div className="text-emerald-200">{item.moat}</div>
                      <div className="text-cyan-200">{item.marginOfSafety}</div>
                      <div className="text-green-200">{item.environmentalAlignment}</div>
                      <div className="text-purple-200">{item.regulatoryRisk}</div>
                      <div className="text-amber-200">{item.riskControl}</div>
                      <div className="font-black text-red-200">{item.score}</div>
                      <div className="text-slate-400">
                        {item.thesis}
                        <button
                          type="button"
                          onClick={() => queueEmailAlert("Technicals", item.symbol, `${item.symbol} flagged as desirable: ${item.label}`, `${item.symbol} | Price ${item.price} | Technical Score ${item.score} | ${item.alertReason}`)}
                          className="mt-2 block rounded-xl border border-red-400/15 bg-red-500/[0.045] px-3 py-2 text-xs font-black text-red-100"
                        >
                          Queue Email Alert
                        </button>
                      </div>
                    </div>
                  ))}

                  {!rankedOpportunities.length ? (
                    <div className="border-t border-red-400/10 p-8 text-center text-sm font-bold text-slate-500">
                      No candidates match the current index, strategy, score, sector, and criteria filters.
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel tone="slate">
                <SectionHeader
                  eyebrow="Signal Stack"
                  title="Technical methodology library"
                  description="This is the expanded technical reasoning layer behind the stock screen."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {technicalSignals.map((signal) => (
                    <article key={signal.name} className="rounded-2xl border border-red-400/10 bg-black/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-white">{signal.name}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{signal.reading}</div>
                        </div>
                        <Pill tone={statusTone(signal.status)}>{signal.status}</Pill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{signal.explanation}</p>
                      <p className="mt-2 text-xs leading-5 text-red-100/70">{signal.decisionUse}</p>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
          </section>
        ) : null}

        {activeTab === "sentiment" ? (
          <section className="grid gap-5 xl:grid-cols-[520px_minmax(0,1fr)]">
            <Panel tone={toneForScore(score.composite)}>
              <SectionHeader
                eyebrow="Slice Sentiment Score"
                title="Advanced factor reasoning, formula hidden"
                description="The proprietary formula remains hidden. Users see standards, reasoning, factor behavior, and investment-grade status."
              />

              <div className="mt-5 grid gap-3">
                <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder="Ticker" className={inputClass} />

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={sentimentHorizon} onChange={(event) => setSentimentHorizon(event.target.value)} className={inputClass}>
                    <option>Intraday</option>
                    <option>7 days</option>
                    <option>30 days</option>
                    <option>90 days</option>
                    <option>6 months</option>
                    <option>1 year</option>
                  </select>

                  <select value={sentimentModel} onChange={(event) => setSentimentModel(event.target.value as SentimentModel)} className={inputClass}>
                    <option>Core Slice</option>
                    <option>Growth Discovery</option>
                    <option>Risk-Controlled</option>
                    <option>Contrarian Opportunity</option>
                    <option>Index Builder</option>
                  </select>
                </div>

                <select value={riskStandard} onChange={(event) => setRiskStandard(event.target.value as RiskStandard)} className={inputClass}>
                  <option>Conservative</option>
                  <option>Balanced</option>
                  <option>Aggressive Growth</option>
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  <input value={investmentGradeThreshold} onChange={(event) => setInvestmentGradeThreshold(event.target.value)} placeholder="Investment grade score threshold" className={inputClass} />
                  <input value={confidenceThreshold} onChange={(event) => setConfidenceThreshold(event.target.value)} placeholder="Minimum confidence threshold" className={inputClass} />
                </div>

                <button type="button" onClick={() => void runManualScan()} className={redButtonClass}>
                  Refresh Score + Alpha Vantage Data
                </button>

                <div className="rounded-[2rem] border border-red-400/10 bg-gradient-to-br from-red-500/[0.04] via-black/45 to-black/65 p-6 text-center">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Composite Score</div>
                  <div className="mt-3 text-7xl font-black text-white">{score.composite}</div>
                  <div className="mt-2 text-lg font-black text-red-200">{scoreLabel(score.composite)}</div>
                  <div className="mt-3"><ProgressBar value={score.composite} tone={toneForScore(score.composite)} /></div>
                  <div className="mt-4 flex justify-center">
                    <Pill tone={investmentGradeStatus === "Investment Grade" ? "green" : investmentGradeStatus === "Near Investment Grade" ? "amber" : "red"}>{investmentGradeStatus}</Pill>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {ticker || "Ticker"} · {sentimentHorizon} · {sentimentModel} · {riskStandard} · {selectedIndex.symbol}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Confidence" value={score.confidence} helper="Evidence strength" tone={toneForScore(score.confidence)} />
                  <Metric label="Environmental" value={score.environmentalAlignment} helper="Transition and liability risk" tone={toneForScore(score.environmentalAlignment)} />
                  <Metric label="Regulatory" value={score.regulatoryRiskControl} helper="Policy risk control" tone={toneForScore(score.regulatoryRiskControl)} />
                  <Metric label="Supply Chain" value={score.supplyChainResilience} helper="Operational resilience" tone={toneForScore(score.supplyChainResilience)} />
                </div>
              </div>
            </Panel>

            <div className="grid gap-5">
              <Panel tone="green">
                <SectionHeader
                  eyebrow="Reasoning Layer"
                  title="Why the company gets this score"
                  description="The user sees factor reasoning, upgrade triggers, downgrade triggers, and factor-study notes without seeing the proprietary formula."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {scoreComponents.map((component) => {
                    const value = score[component.key];

                    return (
                      <article key={component.key} className="rounded-2xl border border-red-400/10 bg-black/35 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black text-white">{component.label}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">{component.category}</div>
                          </div>
                          <Pill tone={component.key === "contradictionPenalty" ? "red" : toneForScore(Number(value))}>{value}</Pill>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-400">{component.visibleReasoning}</p>

                        <div className="mt-3 grid gap-2">
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
                            <span className="font-black">Positive driver:</span> {component.positiveDriver}
                          </div>
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                            <span className="font-black">Risk driver:</span> {component.riskDriver}
                          </div>
                          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100">
                            <span className="font-black">Upgrade trigger:</span> {component.upgradeTrigger}
                          </div>
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                            <span className="font-black">Factor-study note:</span> {component.factorStudyNote}
                          </div>
                        </div>

                        <div className="mt-3">
                          <ProgressBar value={Number(value)} tone={component.key === "contradictionPenalty" ? "red" : toneForScore(Number(value))} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Panel>

              <Panel tone="blue">
                <SectionHeader
                  eyebrow="Scenario Engine"
                  title="Major pathways considered"
                  description="The score considers bull, base, bear, re-rating, and value-trap pathways."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {scenarios.map((scenario) => (
                    <article key={scenario.name} className={cx("rounded-2xl border p-5", toneClasses[scenario.tone])}>
                      <div className="text-sm font-black text-white">{scenario.name}</div>
                      <div className="mt-3 text-5xl font-black text-white">{scenario.probability}%</div>
                      <div className="mt-3"><ProgressBar value={scenario.probability} tone={scenario.tone} /></div>
                      <p className="mt-4 text-sm leading-6 text-slate-200">{scenario.explanation}</p>
                      <p className="mt-3 text-xs leading-5 text-slate-300"><span className="font-black">Trigger:</span> {scenario.trigger}</p>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel tone="amber">
                <SectionHeader
                  eyebrow="Algorithm Guardrails"
                  title="Most advanced version so far"
                  description="Slice reveals reasoning, standards, and factor behavior, not the formula."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    "Alpha Vantage quote, overview, technicals, and news sentiment now feed the score when available.",
                    "Environmental alignment, regulatory risk, supply-chain resilience, liquidity, revisions, moat, and margin of safety are included.",
                    "The user can adjust investment-grade standards without seeing proprietary weights.",
                    "Technical screens are criteria-driven so advisors can filter a full index by exact standards.",
                    "The scanner can run continuously while the page is open and queue automatic email alerts.",
                    "Production background scanning should later move into a server worker, queue, or cron job.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-red-400/10 bg-red-500/[0.04] p-4 text-sm font-bold leading-6 text-red-100">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}