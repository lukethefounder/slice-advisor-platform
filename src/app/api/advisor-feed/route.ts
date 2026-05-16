import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOpportunityRadar } from "@/lib/opportunity-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SafeHeadlineDecision = {
  id?: string;
  title?: string;
  sourceName?: string;
  sourceTier?: string;
  url?: string | null;
  score?: number;
  urgency?: string;
  createdAt?: Date | string;
} | null;

type SafeSignalRecord = Record<string, unknown> & {
  headlineDecision?: SafeHeadlineDecision;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getText(record: Record<string, unknown>, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function getNullableText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getDateValue(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value instanceof Date) return value;
  if (typeof value === "string") return value;

  return null;
}

function safeSignalSourceUrl(signal: SafeSignalRecord) {
  const directSourceUrl = getNullableText(signal, "sourceUrl");
  return directSourceUrl ?? signal.headlineDecision?.url ?? null;
}

function safeSignalBriefing(signal: SafeSignalRecord) {
  const aiBriefing = getNullableText(signal, "aiBriefing");

  if (aiBriefing) return aiBriefing;

  const suggestedAction = getNullableText(signal, "suggestedAction");

  if (suggestedAction) return suggestedAction;

  const evidence = parseJson<string[]>(signal.evidenceJson, []);

  if (evidence.length) {
    return evidence.join("\n");
  }

  return getNullableText(signal, "summary");
}

function safeIssuerCredibility(signal: SafeSignalRecord) {
  const explicit = getNumber(signal, "issuerCredibilityScore", NaN);

  if (Number.isFinite(explicit)) return explicit;

  const confidence = getNumber(signal, "confidenceScore", 0);
  const composite = getNumber(signal, "compositeScore", 0);

  if (confidence || composite) {
    return Math.round(confidence * 0.6 + composite * 0.4);
  }

  return 0;
}

function safeEstimatedImpact(signal: SafeSignalRecord) {
  const explicit = getNumber(signal, "estimatedImpactScore", NaN);

  if (Number.isFinite(explicit)) return explicit;

  const portfolio = getNumber(signal, "portfolioRelevanceScore", 0);
  const opportunity = getNumber(signal, "opportunityScore", 0);
  const risk = getNumber(signal, "riskScore", 0);

  if (portfolio || opportunity || risk) {
    return Math.round(portfolio * 0.45 + Math.max(opportunity, risk) * 0.55);
  }

  return getNumber(signal, "compositeScore", 0);
}

function safeHeadlineDecision(signal: SafeSignalRecord) {
  const decision = signal.headlineDecision;

  if (!decision) return null;

  return {
    id: decision.id ?? null,
    title: decision.title ?? null,
    sourceName: decision.sourceName ?? null,
    sourceTier: decision.sourceTier ?? null,
    url: decision.url ?? null,
    score: decision.score ?? null,
    urgency: decision.urgency ?? null,
    createdAt: decision.createdAt ?? null,
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [radar, alerts, deliveries, latestRun] = await Promise.all([
      getOpportunityRadar(user.id),
      prisma.alertEvent.findMany({
        where: { userId: user.id },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.notificationDelivery.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.intelligenceRun.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const feedItems = radar.signals.slice(0, 20).map((signal) => {
      const safeSignal = signal as unknown as SafeSignalRecord;

      return {
        id: getText(safeSignal, "id"),
        kind: "OpportunitySignal",
        title: getText(safeSignal, "title"),
        summary: getNullableText(safeSignal, "summary"),
        sourceName: getText(safeSignal, "sourceName", "Slice Intelligence"),
        sourceUrl: safeSignalSourceUrl(safeSignal),
        aiBriefing: safeSignalBriefing(safeSignal),
        signalType: getText(safeSignal, "signalType", "Review"),
        priorityTier: getText(safeSignal, "priorityTier", "Medium"),
        compositeScore: getNumber(safeSignal, "compositeScore"),
        portfolioRelevanceScore: getNumber(safeSignal, "portfolioRelevanceScore"),
        opportunityScore: getNumber(safeSignal, "opportunityScore"),
        riskScore: getNumber(safeSignal, "riskScore"),
        confidenceScore: getNumber(safeSignal, "confidenceScore"),
        actionabilityScore: getNumber(safeSignal, "actionabilityScore"),
        issuerCredibilityScore: safeIssuerCredibility(safeSignal),
        estimatedImpactScore: safeEstimatedImpact(safeSignal),
        suggestedAction: getNullableText(safeSignal, "suggestedAction"),
        status: getText(safeSignal, "status", "Open"),
        createdAt: getDateValue(safeSignal, "createdAt"),
        headlineDecision: safeHeadlineDecision(safeSignal),
      };
    });

    return noStoreJson({
      radarStats: radar.stats,
      latestRun,
      feedItems,
      alerts,
      deliveries,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load advisor feed.",
      },
      { status: 500 }
    );
  }
}