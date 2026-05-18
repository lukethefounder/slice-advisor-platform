import { prisma } from "@/lib/prisma";
import { fetchFreeHeadlineBatch } from "@/lib/free-rss-sources";
import { sendEmail } from "@/lib/integrations/email";
import { generateAiText } from "@/lib/integrations/ai";
import {
  demoHeadlineBatch,
  triageHeadline,
  type TriageDecision,
  type TriageProfile,
} from "@/lib/news-triage";
import {
  ensureIntelligenceSettings,
  enforceStorageLimits,
  retentionDaysForDecision,
} from "@/lib/intelligence-settings";
import { ensureNotificationPreferences } from "@/lib/notification-engine";
import {
  buildInstitutionalResearchMemo,
  gradeInvestmentSignal,
  type ScanMode,
} from "@/lib/investment-grading-engine";

type AutonomousTriageOptions = {
  userId: string;
  triggeredBy?: "manual" | "cron" | "system";
  forceDemo?: boolean;
  autonomousEmail?: boolean;
  aiResearch?: boolean;
  noiseFloor?: number;
  alertFloor?: number;
  scanMode?: ScanMode;
};

type AutonomousTriageBatchOptions = {
  batchSize?: number;
  triggeredBy?: "cron" | "system";
  forceDemo?: boolean;
  autonomousEmail?: boolean;
  aiResearch?: boolean;
  scanMode?: ScanMode;
  targetUserId?: string | null;
};

type AdvisorUser = {
  id: string;
  name: string;
  email: string;
  platformStatus: string;
};

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniqueSymbols(symbols: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) =>
          String(symbol ?? "")
            .trim()
            .replace(/^\$/, "")
            .toUpperCase()
        )
        .filter(Boolean)
    )
  );
}

function urgencyRank(urgency: string) {
  const normalized = urgency.toLowerCase();

  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;

  return 0;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailHtml(input: {
  advisorName: string;
  title: string;
  summary: string;
  memo: string;
  grade: string;
  action: string;
  urgency: string;
  finalScore: number;
  matchedTickers: string[];
  matchedAreas: string[];
  sourceUrl: string | null;
  sourceName: string;
  sourceTier: string;
  category: string;
  subcategory: string;
  scanMode: ScanMode;
}) {
  const memoHtml = input.memo
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#cbd5e1;line-height:1.65;font-size:14px;white-space:pre-wrap;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("");

  const tagHtml = [
    ...input.matchedTickers.map((ticker) => `$${ticker}`),
    ...input.matchedAreas,
  ]
    .slice(0, 14)
    .map(
      (tag) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 10px;color:#e5e7eb;background:rgba(255,255,255,.06);font-size:11px;font-weight:800;">${escapeHtml(
          tag
        )}</span>`
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#050505;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:900px;margin:0 auto;padding:28px 18px;">
      <div style="border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#111827;overflow:hidden;box-shadow:0 22px 70px rgba(127,29,29,.28);">
        <div style="padding:28px;background:linear-gradient(135deg,#450a0a,#991b1b,#111827);">
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#fecaca;font-weight:900;">
            Slice Autonomous Advisor Alert
          </div>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:25px;line-height:1.25;">
            ${escapeHtml(input.title)}
          </h1>
          <div style="margin-top:12px;color:#fecaca;font-size:13px;">
            Grade ${escapeHtml(input.grade)} · Score ${input.finalScore}/100 · ${escapeHtml(input.urgency)} urgency · ${escapeHtml(input.scanMode)} scan
          </div>
        </div>

        <div style="padding:26px 28px;border-bottom:1px solid rgba(255,255,255,.10);background:#020617;">
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
            <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;background:#0f172a;padding:16px;">
              <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;font-weight:900;">Action</div>
              <div style="margin-top:8px;color:#ffffff;font-size:16px;font-weight:900;">${escapeHtml(input.action)}</div>
            </div>
            <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;background:#0f172a;padding:16px;">
              <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;font-weight:900;">Source Tier</div>
              <div style="margin-top:8px;color:#ffffff;font-size:16px;font-weight:900;">${escapeHtml(input.sourceTier)}</div>
            </div>
            <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;background:#0f172a;padding:16px;">
              <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;font-weight:900;">Category</div>
              <div style="margin-top:8px;color:#ffffff;font-size:16px;font-weight:900;">${escapeHtml(input.category)}</div>
            </div>
          </div>
        </div>

        <div style="padding:28px;">
          <div style="margin-bottom:20px;border-radius:20px;background:#0f172a;border:1px solid rgba(255,255,255,.10);padding:18px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9;font-weight:900;">
              Why this cleared criteria
            </div>
            <p style="margin:10px 0 0;color:#dbeafe;line-height:1.65;font-size:14px;">
              ${escapeHtml(
                input.summary ||
                  "Slice detected a source-backed item that matched this advisor’s watchlists, portfolios, client holdings, research notes, or stated goals."
              )}
            </p>
            <div style="margin-top:14px;">
              ${
                tagHtml ||
                `<span style="color:#94a3b8;font-size:12px;">No explicit ticker/theme tags were found.</span>`
              }
            </div>
          </div>

          ${memoHtml}

          <div style="margin-top:22px;border-radius:18px;background:#020617;border:1px solid rgba(255,255,255,.1);padding:18px;">
            <h2 style="margin:0 0 8px;font-size:16px;color:#ffffff;">Source</h2>
            <p style="margin:0;color:#cbd5e1;line-height:1.65;">${escapeHtml(input.sourceName)} · ${escapeHtml(input.subcategory)}</p>
            ${
              input.sourceUrl
                ? `<p style="margin:14px 0 0;"><a href="${escapeHtml(
                    input.sourceUrl
                  )}" style="display:inline-block;background:#ffffff;color:#020617;text-decoration:none;border-radius:14px;padding:12px 16px;font-weight:900;">Open Source</a></p>`
                : `<p style="margin:14px 0 0;color:#94a3b8;">No source URL was available for this item.</p>`
            }
          </div>

          <div style="margin-top:22px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a3412;font-weight:900;">
              Advisor review required
            </div>
            <p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.6;">
              This alert is for advisor research and triage. It is not a guarantee, trade instruction, or client-specific recommendation. Verify source freshness, portfolio fit, client suitability, liquidity, tax impact, and compliance requirements before taking action.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function buildAiEnhancedMemo(input: {
  user: AdvisorUser;
  decision: TriageDecision;
  deterministicMemo: string;
  aiResearch: boolean;
  grade: ReturnType<typeof gradeInvestmentSignal>;
}) {
  if (!input.aiResearch) {
    return {
      memo: input.deterministicMemo,
      provider: "Deterministic",
      status: "completed",
      usedAi: false,
      error: null,
    };
  }

  const ai = await generateAiText({
    safetyIdentifier: input.user.email,
    speedMode: "fast",
    useCache: false,
    instructions: `
You are Slice Intelligence, an institutional-grade U.S. investment research analyst.

Create a professional advisor-facing memo from the supplied deterministic memo and grade record.

Rules:
- Do not invent facts.
- Do not promise returns.
- Do not make a final buy/sell recommendation.
- Focus on U.S. investment relevance, source credibility, opportunity, downside risk, urgency, and advisor next steps.
- Mention that this is for advisor review.
- Preserve compliance caution.
- Keep it concise, polished, and useful.
`,
    prompt: JSON.stringify(
      {
        deterministicMemo: input.deterministicMemo,
        grade: input.grade,
        headline: input.decision,
      },
      null,
      2
    ),
    fallbackText: input.deterministicMemo,
  });

  if (!ai.ok || !ai.text) {
    return {
      memo: input.deterministicMemo,
      provider: ai.provider,
      status: ai.status,
      usedAi: false,
      error: ai.error ?? null,
    };
  }

  return {
    memo: `${ai.text}\n\nInstitutional grading record:\n${input.deterministicMemo}`,
    provider: ai.provider,
    status: ai.status,
    usedAi: true,
    error: null,
  };
}

async function emailDeliveryDecision(input: {
  userId: string;
  score: number;
  urgency: string;
}) {
  const preferences = await ensureNotificationPreferences(input.userId);
  const email = preferences.find((preference) => preference.channel === "Email");

  if (!email) {
    return {
      allowed: false,
      reason: "Email preference missing.",
    };
  }

  if (!email.enabled) {
    return {
      allowed: false,
      reason: "Advisor email alerts are disabled.",
    };
  }

  if (email.digestOnly) {
    return {
      allowed: false,
      reason: "Advisor email preference is digest-only.",
    };
  }

  if (input.score < email.minScore) {
    return {
      allowed: false,
      reason: `Score ${input.score} is below advisor email threshold ${email.minScore}.`,
    };
  }

  if (urgencyRank(input.urgency) < urgencyRank(email.minUrgency)) {
    return {
      allowed: false,
      reason: `Urgency ${input.urgency} is below advisor email threshold ${email.minUrgency}.`,
    };
  }

  return {
    allowed: true,
    reason: "Passed advisor email delivery criteria.",
  };
}

async function buildTriageProfile(userId: string): Promise<TriageProfile> {
  const [
    watchAssets,
    namedWatchlistItems,
    namedWatchlists,
    portfolioHoldings,
    ventures,
    goals,
    research,
    clients,
  ] = await Promise.all([
    prisma.watchAsset.findMany({ where: { userId } }),
    prisma.namedWatchlistItem.findMany({
      where: { userId, status: { not: "Archived" } },
      include: { watchlist: true },
    }),
    prisma.namedWatchlist.findMany({ where: { userId } }),
    prisma.investorHolding.findMany({ where: { userId } }),
    prisma.ventureProject.findMany({ where: { userId } }),
    prisma.investorGoal.findMany({ where: { userId } }),
    prisma.researchNote.findMany({ where: { userId } }),
    prisma.clientProfile.findMany({
      where: { userId },
      include: { holdings: true },
    }),
  ]);

  return {
    watchTickers: uniqueSymbols(watchAssets.map((asset) => asset.ticker)),
    namedWatchlistTickers: uniqueSymbols(namedWatchlistItems.map((item) => item.symbol)),
    namedWatchlistNames: namedWatchlists.flatMap((watchlist) => [
      watchlist.name,
      watchlist.focus,
      watchlist.description ?? "",
    ]),
    companyNames: watchAssets.map((asset) => asset.name),
    clientHoldingTickers: uniqueSymbols(
      clients.flatMap((client) => client.holdings.map((holding) => holding.symbol))
    ),
    portfolioHoldingTickers: uniqueSymbols(portfolioHoldings.map((holding) => holding.symbol)),
    ventureSectors: ventures.map((venture) => venture.sector),
    researchTickers: uniqueSymbols(research.map((note) => note.ticker)),
    goalThemes: goals.flatMap((goal) => [goal.goalType, goal.title, goal.notes ?? ""]),
  };
}

function buildDeliveryDedupeKey(input: {
  userId: string;
  decisionDedupeKey: string;
  grade: string;
}) {
  return `slice-alert:${input.userId}:${input.grade}:${input.decisionDedupeKey}`;
}

async function upsertOpportunitySignal(input: {
  userId: string;
  headlineDecisionId: string;
  decision: TriageDecision;
  grade: ReturnType<typeof gradeInvestmentSignal>;
  memo: string;
  scanMode: ScanMode;
}) {
  const existing = await prisma.opportunitySignal.findFirst({
    where: {
      userId: input.userId,
      headlineDecisionId: input.headlineDecisionId,
    },
  });

  const riskScore = clamp(
    input.grade.factorScores.riskPenalty +
      input.grade.factorScores.noisePenalty +
      Math.round((100 - input.grade.factorScores.sourceTrust) * 0.2),
    0,
    100
  );

  const categories = [
    input.decision.category,
    input.decision.subcategory,
    input.decision.importanceTier,
    input.grade.grade,
    input.grade.urgency,
    input.grade.action,
    `scan:${input.scanMode}`,
  ].filter(Boolean);

  const evidence = [
    {
      sourceName: input.decision.sourceName,
      sourceTier: input.decision.sourceTier,
      url: input.decision.url,
      title: input.decision.title,
      summary: input.decision.summary,
      reasons: input.grade.reasons,
      risks: input.grade.risks,
      nextActions: input.grade.nextActions,
      memo: input.memo,
      finalScore: input.grade.finalScore,
      confidenceScore: input.grade.confidenceScore,
      scanMode: input.scanMode,
    },
  ];

  const data = {
    headlineDecisionId: input.headlineDecisionId,
    title: input.decision.title,
    summary: input.decision.summary || input.memo.slice(0, 600),
    sourceName: input.decision.sourceName,
    signalType: input.decision.category || "Market Intelligence",
    priorityTier: input.grade.urgency,
    portfolioRelevanceScore: input.grade.factorScores.portfolioExposureFit,
    opportunityScore: input.grade.finalScore,
    riskScore,
    confidenceScore: input.grade.confidenceScore,
    actionabilityScore: input.grade.factorScores.immediacy,
    compositeScore: input.grade.finalScore,
    tickersJson: safeJson(input.decision.matchedTickers),
    categoriesJson: safeJson(categories),
    evidenceJson: safeJson(evidence),
    suggestedAction: input.grade.action,
    advisorNotes: input.memo,
    status: "Open",
  };

  if (existing) {
    return prisma.opportunitySignal.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return prisma.opportunitySignal.create({
    data: {
      userId: input.userId,
      ...data,
    },
  });
}

export async function runAutonomousTriageForUser(options: AutonomousTriageOptions) {
  const startedAt = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: {
      id: true,
      name: true,
      email: true,
      platformStatus: true,
    },
  });

  if (!user || user.platformStatus !== "Active") {
    return {
      skipped: true,
      userId: options.userId,
      reason: "User missing or inactive.",
    };
  }

  const { policy, sources } = await ensureIntelligenceSettings(user.id);
  await ensureNotificationPreferences(user.id);

  const profile = await buildTriageProfile(user.id);
  const scanMode = options.scanMode ?? "broad";

  const modeAdjustment =
    scanMode === "fast"
      ? { store: 5, alert: 5 }
      : scanMode === "deep"
        ? { store: -7, alert: -3 }
        : { store: 0, alert: 0 };

  const noiseFloor = clamp(
    (options.noiseFloor ?? policy.minScoreToStore) + modeAdjustment.store,
    0,
    100
  );

  const alertFloor = clamp(
    Math.max(noiseFloor, (options.alertFloor ?? policy.minScoreToAlert) + modeAdjustment.alert),
    0,
    100
  );

  const enabledSources = sources.filter((source) => source.enabled);
  const sourceMap = new Map(enabledSources.map((source) => [source.sourceId, source]));

  const liveFetch = options.forceDemo
    ? { sourceResults: [], headlines: [], health: null }
    : await fetchFreeHeadlineBatch(enabledSources);

  const demoHeadlines = demoHeadlineBatch().filter((headline) =>
    sourceMap.has(headline.sourceId)
  );

  const rawHeadlines = liveFetch.headlines.length ? liveFetch.headlines : demoHeadlines;

  const runMode = options.forceDemo
    ? `demo-${scanMode}-advisor-autonomous-scan`
    : liveFetch.headlines.length
      ? `live-${scanMode}-advisor-autonomous-scan`
      : `fallback-demo-${scanMode}-advisor-autonomous-scan`;

  await prisma.headlineDecision.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lt: new Date() },
    },
  });

  const evaluated = rawHeadlines
    .map((headline) => {
      const source = sourceMap.get(headline.sourceId);
      const baseDecision = triageHeadline(headline, profile);

      const grade = gradeInvestmentSignal({
        decision: baseDecision,
        profile,
        scanMode,
        alertFloor,
      });

      const decision: TriageDecision = {
        ...baseDecision,
        score: grade.finalScore,
        urgency: grade.urgency,
        shouldAlert: grade.emailEligible,
      };

      const sourceRetainFloor = source?.minScoreToRetain ?? policy.minScoreToStore;
      const sourceAlertFloor = source?.minScoreToAlert ?? policy.minScoreToAlert;

      const minScoreToRetain = Math.max(noiseFloor, sourceRetainFloor);
      const minScoreToAlert = Math.max(alertFloor, sourceAlertFloor);

      const shouldPersistByPolicy =
        decision.shouldPersist &&
        grade.grade !== "Suppress" &&
        grade.finalScore >= minScoreToRetain;

      const shouldAlertByPolicy =
        shouldPersistByPolicy &&
        grade.emailEligible &&
        grade.finalScore >= minScoreToAlert;

      return {
        source,
        baseDecision,
        decision,
        grade,
        minScoreToRetain,
        minScoreToAlert,
        shouldPersistByPolicy,
        shouldAlertByPolicy,
      };
    })
    .sort((a, b) => b.grade.finalScore - a.grade.finalScore);

  const retained = evaluated
    .filter((item) => item.shouldPersistByPolicy)
    .slice(0, policy.maxRetainedPerRun);

  const alertCandidates = retained.filter((item) => item.shouldAlertByPolicy);

  let alertEventsUpserted = 0;
  let emailSent = 0;
  let emailSimulated = 0;
  let emailFailed = 0;
  let emailSuppressed = 0;
  let emailSkippedDuplicate = 0;
  let aiBackedAlerts = 0;
  let deterministicBackedAlerts = 0;

  for (const item of retained) {
    const decision = item.decision;
    const retentionDays = retentionDaysForDecision(policy, decision);

    const institutionalMemo = buildInstitutionalResearchMemo({
      decision,
      grade: item.grade,
    });

    const memo = item.shouldAlertByPolicy
      ? await buildAiEnhancedMemo({
          user,
          decision,
          deterministicMemo: institutionalMemo,
          aiResearch: options.aiResearch !== false,
          grade: item.grade,
        })
      : {
          memo: institutionalMemo,
          provider: "Deterministic",
          status: "completed",
          usedAi: false,
          error: null,
        };

    if (memo.usedAi) aiBackedAlerts += 1;
    else if (item.shouldAlertByPolicy) deterministicBackedAlerts += 1;

    const deliveryDecision = item.shouldAlertByPolicy
      ? await emailDeliveryDecision({
          userId: user.id,
          score: item.grade.finalScore,
          urgency: item.grade.urgency,
        })
      : {
          allowed: false,
          reason: "Did not clear alert policy.",
        };

    const reasons = [
      ...decision.reasons,
      ...item.grade.reasons,
      ...item.grade.risks,
      `Institutional grade: ${item.grade.grade}.`,
      `Institutional action: ${item.grade.action}.`,
      `Scan mode: ${scanMode}.`,
      `Noise/store floor applied: ${noiseFloor}.`,
      `Email alert floor applied: ${alertFloor}.`,
      `Advisor email delivery decision: ${deliveryDecision.reason}.`,
      `AI research provider: ${memo.provider}.`,
      `AI research status: ${memo.status}.`,
      memo.error ? `AI research fallback reason: ${memo.error}.` : null,
    ].filter(Boolean);

    const headlineDecision = await prisma.headlineDecision.upsert({
      where: {
        userId_dedupeKey: {
          userId: user.id,
          dedupeKey: decision.dedupeKey,
        },
      },
      update: {
        score: item.grade.finalScore,
        materialityScore: decision.materialityScore,
        relevanceScore: decision.relevanceScore,
        trustScore: decision.trustScore,
        importanceTier: decision.importanceTier,
        action: item.grade.action,
        urgency: item.grade.urgency,
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(reasons),
        channelsJson: safeJson(item.shouldAlertByPolicy ? ["Dashboard", "Email"] : decision.channels),
        expiresAt: addDays(retentionDays),
      },
      create: {
        userId: user.id,
        dedupeKey: decision.dedupeKey,
        title: decision.title,
        summary: decision.summary,
        sourceName: decision.sourceName,
        sourceTier: decision.sourceTier,
        url: decision.url,
        category: decision.category,
        subcategory: decision.subcategory,
        importanceTier: decision.importanceTier,
        action: item.grade.action,
        urgency: item.grade.urgency,
        score: item.grade.finalScore,
        materialityScore: decision.materialityScore,
        relevanceScore: decision.relevanceScore,
        trustScore: decision.trustScore,
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(reasons),
        channelsJson: safeJson(item.shouldAlertByPolicy ? ["Dashboard", "Email"] : decision.channels),
        expiresAt: addDays(retentionDays),
      },
    });

    if (!item.shouldAlertByPolicy) continue;

    const alert = await prisma.alertEvent.upsert({
      where: {
        userId_dedupeKey: {
          userId: user.id,
          dedupeKey: `institutional-scan:${decision.dedupeKey}`,
        },
      },
      update: {
        title: `[Grade ${item.grade.grade}] ${decision.title}`,
        body: decision.summary || "Slice detected a source-backed U.S. investment intelligence item.",
        source: decision.sourceName,
        ticker: decision.matchedTickers[0] ?? null,
        urgency: item.grade.urgency,
        score: item.grade.finalScore,
        channel: "Dashboard + Autonomous Advisor Email",
        status: "Unread",
        readAt: null,
        sourceUrl: decision.url,
        aiBriefing: memo.memo,
      },
      create: {
        userId: user.id,
        dedupeKey: `institutional-scan:${decision.dedupeKey}`,
        title: `[Grade ${item.grade.grade}] ${decision.title}`,
        body: decision.summary || "Slice detected a source-backed U.S. investment intelligence item.",
        source: decision.sourceName,
        ticker: decision.matchedTickers[0] ?? null,
        urgency: item.grade.urgency,
        score: item.grade.finalScore,
        channel: "Dashboard + Autonomous Advisor Email",
        status: "Unread",
        sourceUrl: decision.url,
        aiBriefing: memo.memo,
      },
    });

    alertEventsUpserted += 1;

    await upsertOpportunitySignal({
      userId: user.id,
      headlineDecisionId: headlineDecision.id,
      decision,
      grade: item.grade,
      memo: memo.memo,
      scanMode,
    }).catch(() => null);

    if (options.autonomousEmail === false) continue;

    if (!deliveryDecision.allowed) {
      emailSuppressed += 1;

      await prisma.notificationDelivery.create({
        data: {
          userId: user.id,
          alertEventId: alert.id,
          channel: "Email",
          destination: user.email,
          status: "Suppressed",
          urgency: item.grade.urgency,
          score: item.grade.finalScore,
          title: `Slice Grade ${item.grade.grade}: ${decision.title.slice(0, 110)}`,
          body: memo.memo,
          reason: deliveryDecision.reason,
          simulated: true,
          deliveredAt: null,
        },
      });

      continue;
    }

    const existingDelivery = await prisma.notificationDelivery.findFirst({
      where: {
        userId: user.id,
        alertEventId: alert.id,
        channel: "Email",
        status: {
          in: ["Delivered", "Simulated", "Queued"],
        },
      },
    });

    if (existingDelivery) {
      emailSkippedDuplicate += 1;
      continue;
    }

    const subject = `Slice ${item.grade.urgency} Alert · Grade ${item.grade.grade} · ${decision.title.slice(0, 90)}`;
    const deliveryDedupeKey = buildDeliveryDedupeKey({
      userId: user.id,
      decisionDedupeKey: decision.dedupeKey,
      grade: item.grade.grade,
    });

    const result = await sendEmail({
      to: user.email,
      subject,
      text: `${memo.memo}\n\nSource: ${decision.sourceName}${decision.url ? `\n${decision.url}` : ""}`,
      html: emailHtml({
        advisorName: user.name,
        title: decision.title,
        summary: decision.summary ?? "",
        memo: memo.memo,
        grade: item.grade.grade,
        action: item.grade.action,
        urgency: item.grade.urgency,
        finalScore: item.grade.finalScore,
        matchedTickers: decision.matchedTickers,
        matchedAreas: decision.matchedAreas,
        sourceUrl: decision.url,
        sourceName: decision.sourceName,
        sourceTier: decision.sourceTier,
        category: decision.category,
        subcategory: decision.subcategory,
        scanMode,
      }),
      idempotencyKey: deliveryDedupeKey,
    });

    await prisma.notificationDelivery.create({
      data: {
        userId: user.id,
        alertEventId: alert.id,
        channel: "Email",
        destination: user.email,
        status: result.ok
          ? result.status === "sent"
            ? "Delivered"
            : "Simulated"
          : "Failed",
        urgency: item.grade.urgency,
        score: item.grade.finalScore,
        title: subject,
        body: memo.memo,
        reason: result.ok
          ? `Autonomous advisor alert email ${result.status} via ${result.provider}.`
          : result.error ?? "Email failed.",
        simulated: result.status !== "sent",
        deliveredAt: result.ok ? new Date() : null,
      },
    });

    if (result.ok && result.status === "sent") emailSent += 1;
    else if (result.ok) emailSimulated += 1;
    else emailFailed += 1;
  }

  for (const source of enabledSources) {
    await prisma.newsSourceConfig.update({
      where: {
        userId_sourceId: {
          userId: user.id,
          sourceId: source.sourceId,
        },
      },
      data: {
        lastRunAt: new Date(),
      },
    });
  }

  await enforceStorageLimits(user.id, policy);

  const run = await prisma.intelligenceRun.create({
    data: {
      userId: user.id,
      mode: runMode,
      scannedCount: rawHeadlines.length,
      retainedCount: retained.length,
      alertCount: alertCandidates.length,
      digestCount: retained.filter((item) => item.grade.action === "ADD_TO_DIGEST").length,
      discardedCount: evaluated.length - retained.length,
      durationMs: Date.now() - startedAt,
    },
  });

  return {
    skipped: false,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    run,
    mode: runMode,
    scanMode,
    scanned: rawHeadlines.length,
    retained: retained.length,
    alerts: alertCandidates.length,
    discarded: evaluated.length - retained.length,
    noiseFloor,
    alertFloor,
    sourceHealth: liveFetch.health ?? null,
    sourceResults: liveFetch.sourceResults ?? [],
    alertEventsUpserted,
    aiBackedAlerts,
    deterministicBackedAlerts,
    email: {
      sent: emailSent,
      simulated: emailSimulated,
      failed: emailFailed,
      suppressed: emailSuppressed,
      skippedDuplicate: emailSkippedDuplicate,
    },
    criteria: {
      watchTickers: profile.watchTickers.length,
      namedWatchlistTickers: profile.namedWatchlistTickers.length,
      clientHoldingTickers: profile.clientHoldingTickers.length,
      portfolioHoldingTickers: profile.portfolioHoldingTickers.length,
      researchTickers: profile.researchTickers.length,
      goalThemes: profile.goalThemes.length,
    },
    decisions: retained.map((item, index) => ({
      rank: index + 1,
      institutionalGrade: item.grade,
      finalScore: item.grade.finalScore,
      shouldAlertByPolicy: item.shouldAlertByPolicy,
      shouldPersistByPolicy: item.shouldPersistByPolicy,
      minScoreToRetain: item.minScoreToRetain,
      minScoreToAlert: item.minScoreToAlert,
      ...item.decision,
      urgency: item.grade.urgency,
    })),
  };
}

export async function runAutonomousTriageBatch(options: AutonomousTriageBatchOptions = {}) {
  const startedAt = Date.now();

  const users = await prisma.user.findMany({
    where: {
      platformStatus: "Active",
      ...(options.targetUserId ? { id: options.targetUserId } : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
    take: clamp(options.batchSize ?? 25, 1, 75),
  });

  const results = [];

  for (const user of users) {
    results.push(
      await runAutonomousTriageForUser({
        userId: user.id,
        triggeredBy: options.triggeredBy ?? "cron",
        forceDemo: options.forceDemo,
        autonomousEmail: options.autonomousEmail,
        aiResearch: options.aiResearch,
        scanMode: options.scanMode ?? "broad",
      }).catch((error) => ({
        skipped: true,
        userId: user.id,
        reason: error instanceof Error ? error.message : "Autonomous triage failed.",
      }))
    );
  }

  return {
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    scannedUsers: users.length,
    results,
    totals: results.reduce(
      (acc, result: any) => {
        if (result.skipped) {
          acc.skipped += 1;
          return acc;
        }

        acc.scanned += result.scanned ?? 0;
        acc.retained += result.retained ?? 0;
        acc.alerts += result.alerts ?? 0;
        acc.emailSent += result.email?.sent ?? 0;
        acc.emailSimulated += result.email?.simulated ?? 0;
        acc.emailFailed += result.email?.failed ?? 0;
        acc.emailSuppressed += result.email?.suppressed ?? 0;
        acc.emailSkippedDuplicate += result.email?.skippedDuplicate ?? 0;
        acc.aiBackedAlerts += result.aiBackedAlerts ?? 0;
        return acc;
      },
      {
        skipped: 0,
        scanned: 0,
        retained: 0,
        alerts: 0,
        emailSent: 0,
        emailSimulated: 0,
        emailFailed: 0,
        emailSuppressed: 0,
        emailSkippedDuplicate: 0,
        aiBackedAlerts: 0,
      }
    ),
  };
}