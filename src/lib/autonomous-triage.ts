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
};

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function uniqueSymbols(symbols: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => String(symbol ?? "").trim().replace(/^\$/, "").toUpperCase())
        .filter(Boolean)
    )
  );
}

function emailHtml(input: {
  title: string;
  memo: string;
  grade: string;
  finalScore: number;
  sourceUrl: string | null;
  sourceName: string;
}) {
  const escaped = input.memo
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#cbd5e1;line-height:1.65;font-size:14px;white-space:pre-wrap;">${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")}</p>`
    )
    .join("");

  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#050505;color:#f8fafc;padding:28px;">
    <div style="max-width:860px;margin:0 auto;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#111827;overflow:hidden;">
      <div style="padding:28px;background:linear-gradient(135deg,#450a0a,#991b1b,#111827);">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#fecaca;font-weight:800;">
          Slice Autonomous Investment Intelligence
        </div>
        <h1 style="margin:10px 0 0;color:#ffffff;font-size:25px;line-height:1.25;">
          ${input.title}
        </h1>
        <div style="margin-top:12px;color:#fecaca;font-size:13px;">
          Institutional Grade ${input.grade} · Score ${input.finalScore}/100
        </div>
      </div>

      <div style="padding:28px;">
        ${escaped}

        <div style="margin-top:22px;border-radius:18px;background:#020617;border:1px solid rgba(255,255,255,.1);padding:18px;">
          <h2 style="margin:0 0 8px;font-size:16px;color:#ffffff;">Source</h2>
          <p style="margin:0;color:#cbd5e1;line-height:1.65;">${input.sourceName}</p>
          ${
            input.sourceUrl
              ? `<p style="margin:14px 0 0;"><a href="${input.sourceUrl}" style="display:inline-block;background:#ffffff;color:#020617;text-decoration:none;border-radius:14px;padding:12px 16px;font-weight:800;">Open Source</a></p>`
              : ""
          }
        </div>

        <div style="margin-top:22px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a3412;font-weight:800;">
            Compliance note
          </div>
          <p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.6;">
            This alert is for advisor review and research purposes only. It is not a guarantee, trade instruction, or client-specific recommendation.
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function buildAiEnhancedMemo(input: {
  user: { id: string; name: string; email: string };
  decision: TriageDecision;
  deterministicMemo: string;
  aiResearch: boolean;
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
    instructions: `
You are Slice Intelligence, an institutional-grade U.S. investment research analyst.

Create a professional advisor-facing memo from the supplied deterministic memo.

Rules:
- Do not invent facts.
- Do not promise returns.
- Do not make a final buy/sell recommendation.
- Focus on U.S. investment relevance, source credibility, opportunity, downside risk, and advisor next steps.
- Keep it concise, polished, and useful.
- Preserve all compliance caution.
`,
    prompt: input.deterministicMemo,
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

async function emailAllowed(userId: string, score: number, urgency: string) {
  const preferences = await ensureNotificationPreferences(userId);
  const email = preferences.find((preference) => preference.channel === "Email");

  if (!email || !email.enabled || email.digestOnly) return false;
  if (score < email.minScore) return false;

  const rank: Record<string, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  return (rank[urgency] ?? 0) >= (rank[email.minUrgency] ?? 0);
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
  const profile = await buildTriageProfile(user.id);
  const scanMode = options.scanMode ?? "broad";

  const modeAdjustment =
    scanMode === "fast"
      ? { store: 4, alert: 4 }
      : scanMode === "deep"
        ? { store: -6, alert: -2 }
        : { store: 0, alert: 0 };

  const noiseFloor = clamp((options.noiseFloor ?? policy.minScoreToStore) + modeAdjustment.store, 0, 100);
  const alertFloor = clamp(Math.max(noiseFloor, (options.alertFloor ?? policy.minScoreToAlert) + modeAdjustment.alert), 0, 100);

  const enabledSources = sources.filter((source) => source.enabled);
  const sourceMap = new Map(enabledSources.map((source) => [source.sourceId, source]));

  const liveFetch = options.forceDemo
    ? { sourceResults: [], headlines: [], health: null }
    : await fetchFreeHeadlineBatch(enabledSources);

  const demoHeadlines = demoHeadlineBatch().filter((headline) => sourceMap.has(headline.sourceId));
  const rawHeadlines = liveFetch.headlines.length ? liveFetch.headlines : demoHeadlines;

  const runMode = options.forceDemo
    ? `demo-${scanMode}-institutional-scan`
    : liveFetch.headlines.length
      ? `live-${scanMode}-institutional-scan`
      : `fallback-demo-${scanMode}-institutional-scan`;

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

    const reasons = [
      ...decision.reasons,
      ...item.grade.reasons,
      ...item.grade.risks,
      `Institutional grade: ${item.grade.grade}.`,
      `Institutional action: ${item.grade.action}.`,
      `Scan mode: ${scanMode}.`,
      `Noise/store floor applied: ${noiseFloor}.`,
      `Email alert floor applied: ${alertFloor}.`,
      `AI research provider: ${memo.provider}.`,
      `AI research status: ${memo.status}.`,
    ];

    await prisma.headlineDecision.upsert({
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

    if (options.autonomousEmail === false) continue;

    const allowed = await emailAllowed(user.id, item.grade.finalScore, item.grade.urgency);

    if (!allowed) continue;

    const existingDelivery = await prisma.notificationDelivery.findFirst({
      where: {
        userId: user.id,
        alertEventId: alert.id,
        channel: "Email",
      },
    });

    if (existingDelivery) continue;

    const subject = `Slice Grade ${item.grade.grade}: ${decision.title.slice(0, 110)}`;

    const result = await sendEmail({
      to: user.email,
      subject,
      text: memo.memo,
      html: emailHtml({
        title: decision.title,
        memo: memo.memo,
        grade: item.grade.grade,
        finalScore: item.grade.finalScore,
        sourceUrl: decision.url,
        sourceName: decision.sourceName,
      }),
      idempotencyKey: `slice-institutional-alert-${user.id}-${decision.dedupeKey}`,
    });

    await prisma.notificationDelivery.create({
      data: {
        userId: user.id,
        alertEventId: alert.id,
        channel: "Email",
        destination: user.email,
        status: result.ok ? (result.status === "sent" ? "Delivered" : "Simulated") : "Failed",
        urgency: item.grade.urgency,
        score: item.grade.finalScore,
        title: subject,
        body: memo.memo,
        reason: result.ok
          ? `Institutional investment scan email ${result.status} via ${result.provider}.`
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
    sourceHealth: (liveFetch as any).health ?? null,
    sourceResults: liveFetch.sourceResults,
    alertEventsUpserted,
    aiBackedAlerts,
    deterministicBackedAlerts,
    email: {
      sent: emailSent,
      simulated: emailSimulated,
      failed: emailFailed,
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
    },
    orderBy: {
      createdAt: "asc",
    },
    take: clamp(options.batchSize ?? 10, 1, 50),
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
        aiBackedAlerts: 0,
      }
    ),
  };
}