export function buildAdvisorOpportunityBriefing(input: {
  title: string;
  summary?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  signalType: string;
  priorityTier: string;
  tickers: string[];
  categories: string[];
  portfolioRelevanceScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  issuerCredibilityScore: number;
  estimatedImpactScore: number;
}) {
  const tickers = input.tickers.length
    ? input.tickers.join(", ")
    : "the affected exposure";

  const categories = input.categories.length
    ? input.categories.slice(0, 4).join(", ")
    : "general market intelligence";

  const opening =
    input.signalType === "Protect"
      ? `This appears to be a protection-oriented alert for ${tickers}.`
      : input.signalType === "Opportunity"
        ? `This appears to be a potential opportunity catalyst for ${tickers}.`
        : input.signalType === "High-Risk Opportunity"
          ? `This appears to be a high-risk opportunity signal for ${tickers}.`
          : `This item appears to warrant advisor review for ${tickers}.`;

  const impact =
    input.estimatedImpactScore >= 80
      ? "Estimated portfolio impact is high because the item appears material and connected to existing exposure."
      : input.estimatedImpactScore >= 60
        ? "Estimated portfolio impact is moderate because the item has meaningful relevance but should be confirmed before action."
        : "Estimated portfolio impact is limited or uncertain based on current stored exposure.";

  const credibility =
    input.issuerCredibilityScore >= 80
      ? "Source credibility is strong based on source tier, issuer type, and retained evidence."
      : input.issuerCredibilityScore >= 60
        ? "Source credibility is moderate and should be cross-checked before client-facing use."
        : "Source credibility is limited, so this should be treated as preliminary intelligence.";

  const advisorAction =
    input.signalType === "Protect"
      ? "Advisor action: review downside exposure, concentration, affected clients, and whether any client communication is warranted."
      : input.signalType.includes("Opportunity")
        ? "Advisor action: compare the catalyst against thesis, valuation, suitability, client objectives, and risk tolerance before taking any action."
        : "Advisor action: store for review, monitor follow-up sources, and do not escalate unless additional evidence appears.";

  return [
    opening,
    input.summary ? `Summary: ${input.summary}` : "",
    `Category focus: ${categories}.`,
    impact,
    credibility,
    `Opportunity score: ${input.opportunityScore}/100. Risk score: ${input.riskScore}/100. Confidence score: ${input.confidenceScore}/100. Actionability score: ${input.actionabilityScore}/100.`,
    advisorAction,
    "Disclosure: this is market intelligence and workflow support, not a buy/sell recommendation.",
  ]
    .filter(Boolean)
    .join(" ");
}