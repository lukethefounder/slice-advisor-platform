import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nextDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

function nextDateString(daysFromNow: number) {
  return nextDate(daysFromNow).toISOString().slice(0, 10);
}

async function resolveFirmId(userId: string, requestedFirmId?: string | null) {
  if (requestedFirmId) {
    const membership = await prisma.firmMembership.findFirst({
      where: {
        userId,
        firmId: requestedFirmId,
        status: "Active",
      },
    });

    if (membership) return requestedFirmId;
  }

  const primaryMembership = await prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return primaryMembership?.firmId ?? null;
}

async function ensureModelClient(userId: string, clientName: string) {
  const existingClient = await prisma.clientProfile.findFirst({
    where: {
      userId,
      fullName: clientName,
    },
  });

  if (existingClient) return existingClient;

  return prisma.clientProfile.create({
    data: {
      userId,
      fullName: clientName,
      email: "client@example.com",
      householdName: clientName,
      clientType: "Private Client",
      riskProfile: "Balanced",
      liquidityNeeds: "Moderate",
      timeHorizon: "5-10 years",
      objective: "Long-term wealth growth with disciplined risk management",
      portfolioValue: "$1,250,000",
      status: "Active",
      notes: "Demo client created by Advisor OS adaptive intelligence.",
    },
  });
}

async function ensureFirmAgenda(user: CurrentUser, firmId: string | null) {
  if (!firmId) return null;

  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId: user.id,
      firmId,
      status: "Active",
    },
  });

  if (!membership) return null;

  return prisma.weeklyAgenda.upsert({
    where: {
      id: `${firmId}-${membership.id}-advisor-os-phase-3-agenda`,
    },
    update: {
      weekStart: nextDateString(1),
      title: "Advisor OS adaptive workflow agenda",
      focus:
        "Review adaptive recommendations, bot behavior, client communication preferences, source reliability changes, and compliance memory.",
      blockers:
        "External data feeds are simulated until live market/news integrations are connected.",
      status: "Open",
    },
    create: {
      id: `${firmId}-${membership.id}-advisor-os-phase-3-agenda`,
      firmId,
      membershipId: membership.id,
      weekStart: nextDateString(1),
      title: "Advisor OS adaptive workflow agenda",
      focus:
        "Review adaptive recommendations, bot behavior, client communication preferences, source reliability changes, and compliance memory.",
      blockers:
        "External data feeds are simulated until live market/news integrations are connected.",
      status: "Open",
    },
  });
}

async function ensureAdvisorOsDefaults(userId: string, firmId: string | null) {
  const [
    nodeCount,
    twinCount,
    botCount,
    sourceCount,
    actionCount,
    vaultCount,
    communicationCount,
    meetingCount,
    playbookCount,
    pulseCount,
    ruleCount,
    memoryCount,
    clientPreferenceCount,
    botLearningCount,
    sourceSignalCount,
    feedbackCount,
    adaptiveRecommendationCount,
  ] = await Promise.all([
    prisma.advisorOperatingNode.count({ where: { userId } }),
    prisma.portfolioImpactTwin.count({ where: { userId } }),
    prisma.personalAdvisorBot.count({ where: { userId } }),
    prisma.sourceCredibilityProfile.count({ where: { userId } }),
    prisma.eventActionAutopilot.count({ where: { userId } }),
    prisma.complianceMemoryVaultItem.count({ where: { userId } }),
    prisma.clientCommunicationDraft.count({ where: { userId } }),
    prisma.meetingPrepPacket.count({ where: { userId } }),
    prisma.advisorPlaybook.count({ where: { userId } }),
    prisma.firmIntelligencePulse.count({ where: { userId } }),
    prisma.advisorWorkflowRule.count({ where: { userId } }),
    prisma.advisorAdaptiveMemory.count({ where: { userId } }),
    prisma.clientPreferenceProfile.count({ where: { userId } }),
    prisma.botLearningProfile.count({ where: { userId } }),
    prisma.sourceReliabilitySignal.count({ where: { userId } }),
    prisma.advisorFeedbackSignal.count({ where: { userId } }),
    prisma.adaptiveRecommendation.count({ where: { userId } }),
  ]);

  if (nodeCount === 0) {
    await prisma.advisorOperatingNode.createMany({
      data: [
        {
          userId,
          firmId,
          name: "News intake → credibility scoring",
          category: "Advisor Operating Graph",
          ownerName: "Source Sentinel Bot",
          status: "Active",
          confidenceScore: 88,
          riskScore: 18,
          dataJson: asJson({
            purpose:
              "Routes market events through credibility scoring before any advisor/client action is recommended.",
            systems: ["Source Credibility Engine", "Event-to-Action Autopilot"],
          }),
        },
        {
          userId,
          firmId,
          name: "Credibility → portfolio impact",
          category: "Advisor Operating Graph",
          ownerName: "Portfolio Twin Bot",
          status: "Active",
          confidenceScore: 83,
          riskScore: 24,
          dataJson: asJson({
            purpose:
              "Connects validated sources to client holdings, goals, and risk tolerance.",
            systems: ["Portfolio Impact Twin", "Client Profiles"],
          }),
        },
        {
          userId,
          firmId,
          name: "Workflow → adaptive memory",
          category: "Advisor Operating Graph",
          ownerName: "Adaptive Intelligence Layer",
          status: "Active",
          confidenceScore: 84,
          riskScore: 22,
          dataJson: asJson({
            purpose:
              "Learns from advisor feedback, source outcomes, client preferences, and automation results.",
            systems: [
              "Personal AI Bots",
              "Source Credibility Engine",
              "Firm-Wide Intelligence Layer",
            ],
          }),
        },
      ],
    });
  }

  if (twinCount === 0) {
    await prisma.portfolioImpactTwin.create({
      data: {
        userId,
        firmId,
        clientName: "Model Household",
        title: "Rate-sensitive portfolio stress test",
        eventTitle: "Rates move higher after hotter inflation print",
        scenarioType: "Macro Shock",
        shockPct: -4.2,
        totalBefore: 1250000,
        totalAfter: 1197500,
        impactAmount: -52500,
        impactPct: -4.2,
        affectedAssetsJson: asJson([
          "Long-duration bonds",
          "Rate-sensitive dividend equities",
          "REIT allocation",
        ]),
        actionsJson: asJson([
          "Review duration exposure before the next rebalance.",
          "Prepare client note explaining why short-term volatility does not automatically require a trade.",
          "Check whether the client has upcoming liquidity needs.",
        ]),
        summary:
          "The twin estimates a moderate drawdown concentrated in duration-sensitive assets. The highest-value advisor action is client education plus a targeted rebalance review.",
      },
    });
  }

  if (botCount === 0) {
    await prisma.personalAdvisorBot.createMany({
      data: [
        {
          userId,
          firmId,
          botName: "Client Preference Bot",
          ownerName: "Advisor",
          persona:
            "Remembers communication style, meeting cadence, household priorities, and preferred explanation level.",
          tone: "Warm, concise, and plain-English",
          coverageJson: asJson([
            "Client communication preferences",
            "Behavioral coaching cues",
            "Household-specific reminders",
          ]),
          tasksJson: asJson([
            "Prepare client-specific language before outreach.",
            "Flag when a message is too technical.",
            "Suggest the best channel and tone for each client.",
          ]),
          permissionsJson: asJson({
            canDraftMessages: true,
            canSendWithoutApproval: false,
            canUpdateTasks: true,
          }),
          lastRunSummary:
            "Prepared preference-aware communication guidance for the model household.",
        },
        {
          userId,
          firmId,
          botName: "Adaptive Workflow Bot",
          ownerName: "Operations",
          persona:
            "Learns which workflow recommendations the advisor approves, rejects, revises, or escalates.",
          tone: "Operational, concise, and approval-gated",
          coverageJson: asJson([
            "Advisor feedback",
            "Task routing",
            "Workflow memory",
            "Escalation behavior",
          ]),
          tasksJson: asJson([
            "Improve recommendations after feedback.",
            "Tune approval thresholds.",
            "Suggest the next best workflow action.",
          ]),
          permissionsJson: asJson({
            canLearnFromFeedback: true,
            canTuneRecommendations: true,
            canSendWithoutApproval: false,
          }),
          lastRunSummary:
            "Ready to learn from advisor feedback and workflow outcomes.",
        },
        {
          userId,
          firmId,
          botName: "Source Sentinel Bot",
          ownerName: "Research Desk",
          persona:
            "Skeptical source evaluator that updates source reliability based on actual advisor outcomes.",
          tone: "Skeptical but useful",
          coverageJson: asJson([
            "Source credibility scoring",
            "Reliability outcomes",
            "Issuer and media history",
          ]),
          tasksJson: asJson([
            "Score source reputation.",
            "Track reliability signals.",
            "Flag promotional or low-trust sources.",
          ]),
          permissionsJson: asJson({
            canAdjustSourceScores: true,
            canSuppressLowTrustSources: true,
          }),
          lastRunSummary:
            "Ready to update source scores based on feedback and outcomes.",
        },
      ],
    });
  }

  if (sourceCount === 0) {
    await prisma.sourceCredibilityProfile.createMany({
      data: [
        {
          userId,
          firmId,
          sourceName: "SEC EDGAR",
          domain: "sec.gov",
          sourceType: "Regulatory Filing",
          credibilityScore: 98,
          biasRisk: 5,
          transparencyScore: 96,
          historyJson: asJson([
            "Primary filing source.",
            "Best suited for official company disclosures.",
          ]),
          flagsJson: asJson(["Slow to interpret without AI summary"]),
          status: "Approved",
          lastReviewedAt: new Date(),
        },
        {
          userId,
          firmId,
          sourceName: "Major Financial Newswire",
          domain: "financial-newswire.example",
          sourceType: "News",
          credibilityScore: 86,
          biasRisk: 22,
          transparencyScore: 80,
          historyJson: asJson([
            "Good for speed and broad market coverage.",
            "Should be cross-checked for market-moving claims.",
          ]),
          flagsJson: asJson(["May prioritize speed over depth"]),
          status: "Approved",
          lastReviewedAt: new Date(),
        },
        {
          userId,
          firmId,
          sourceName: "Unverified Social Market Thread",
          domain: "social-rumor.example",
          sourceType: "Social",
          credibilityScore: 34,
          biasRisk: 82,
          transparencyScore: 25,
          historyJson: asJson([
            "Useful only as an early rumor signal.",
            "Never client-facing without confirmation.",
          ]),
          flagsJson: asJson([
            "Anonymous sourcing",
            "Potential promotional or manipulative content",
          ]),
          status: "Restricted",
          lastReviewedAt: new Date(),
        },
      ],
    });
  }

  if (actionCount === 0) {
    await prisma.eventActionAutopilot.create({
      data: {
        userId,
        firmId,
        eventTitle: "High-impact rate headline detected",
        sourceName: "Major Financial Newswire",
        sourceUrl: "https://financial-newswire.example/rates",
        sourceCredibilityScore: 86,
        impactScore: 82,
        urgency: "High",
        actionType: "Advisor Review",
        recommendedAction:
          "Review affected client portfolios, generate a rate-impact note, and prepare outreach for households with near-term liquidity needs.",
        assignedTo: "Lead Advisor",
        status: "Queued",
        rationaleJson: asJson([
          "Source credibility is above alert threshold.",
          "Event has likely impact on fixed income and rate-sensitive equity exposure.",
          "Client communication may reduce panic-driven decisions.",
        ]),
        guardrailsJson: asJson([
          "Do not imply guaranteed outcomes.",
          "Attach source link and AI briefing.",
          "Require advisor approval before sending client message.",
        ]),
      },
    });
  }

  if (vaultCount === 0) {
    await prisma.complianceMemoryVaultItem.create({
      data: {
        userId,
        firmId,
        clientName: "Model Household",
        subject: "Rate headline outreach rationale",
        category: "Client Communication",
        retentionTag: "Pre-send Review",
        sourceTitle: "High-impact rate headline detected",
        sourceUrl: "https://financial-newswire.example/rates",
        summary:
          "Stored rationale for why the advisor may send a calming, educational client note after rate-driven volatility.",
        riskLevel: "Medium",
        status: "Stored",
        evidenceJson: asJson([
          "Source credibility score: 86",
          "Impact score: 82",
          "Advisor approval required before delivery",
        ]),
        expiresAt: nextDate(365),
      },
    });
  }

  if (communicationCount === 0) {
    await prisma.clientCommunicationDraft.create({
      data: {
        userId,
        firmId,
        clientName: "Model Household",
        channel: "Email",
        audience: "Client",
        title: "Draft: What today’s rate news may mean for your portfolio",
        body:
          "Hi — we are monitoring today’s rate-related market move and reviewing whether it has any meaningful impact on your plan. The early read is that the move is concentrated in rate-sensitive areas, and we do not recommend reacting emotionally to one headline. We will follow up if your plan calls for any action.",
        sourceSummaryJson: asJson([
          "Primary source: Major Financial Newswire",
          "Credibility score: 86",
          "Portfolio twin impact estimate: -4.2%",
        ]),
        complianceNotesJson: asJson([
          "Avoid promissory language.",
          "Do not recommend a trade without suitability review.",
          "Keep source and rationale attached.",
        ]),
        status: "Needs Approval",
        tone: "Clear and reassuring",
      },
    });
  }

  if (meetingCount === 0) {
    await prisma.meetingPrepPacket.create({
      data: {
        userId,
        firmId,
        clientName: "Model Household",
        meetingTitle: "Quarterly portfolio review",
        meetingDate: nextDateString(7),
        objective:
          "Explain recent market volatility, confirm liquidity needs, and review whether current allocation still fits the plan.",
        briefingJson: asJson([
          "Client risk profile: Balanced",
          "Recent twin scenario: rate-sensitive drawdown estimate",
          "Open action: review duration exposure",
        ]),
        questionsJson: asJson([
          "Any major spending needs in the next 12 months?",
          "Has your comfort with volatility changed?",
          "Would you prefer a more defensive allocation review?",
        ]),
        openItemsJson: asJson([
          "Confirm taxable account liquidity.",
          "Review fixed income duration.",
          "Prepare plain-English rate volatility chart.",
        ]),
        followUpJson: asJson([
          "Send summary email after meeting.",
          "Store meeting notes in compliance vault.",
          "Create rebalance task if needed.",
        ]),
      },
    });
  }

  if (playbookCount === 0) {
    await prisma.advisorPlaybook.create({
      data: {
        userId,
        firmId,
        title: "High-credibility market shock response",
        playbookType: "Event Response",
        trigger:
          "Credibility score above 80 and portfolio impact score above 75.",
        description:
          "A source-backed process for converting market news into advisor review, portfolio impact checks, client communication drafts, task routing, compliance memory, and adaptive learning.",
        stepsJson: asJson([
          "Score source credibility.",
          "Run portfolio impact twin.",
          "Generate advisor action.",
          "Create firm task.",
          "Draft client communication.",
          "Store rationale in compliance vault.",
          "Capture advisor feedback.",
          "Update adaptive memory.",
        ]),
        escalationRulesJson: asJson([
          "Advisor approval required before client delivery.",
          "Escalate to principal if impact score exceeds 90.",
        ]),
      },
    });
  }

  if (pulseCount === 0) {
    await prisma.firmIntelligencePulse.create({
      data: {
        userId,
        firmId,
        title: "Firm-wide rate sensitivity pulse",
        category: "Portfolio Risk",
        summary:
          "Several model portfolios may be sensitive to a rate surprise. Recommended firm action is to review duration exposure and prepare client education language.",
        confidenceScore: 84,
        affectedClientsJson: asJson([
          "Model Household",
          "Balanced retirement households",
          "Income-oriented portfolios",
        ]),
        sourceItemsJson: asJson([
          {
            title: "High-impact rate headline detected",
            source: "Major Financial Newswire",
            credibilityScore: 86,
          },
        ]),
        actionsJson: asJson([
          "Review affected models.",
          "Prepare advisor briefing.",
          "Queue client communication drafts for review.",
        ]),
      },
    });
  }

  if (ruleCount === 0) {
    await prisma.advisorWorkflowRule.createMany({
      data: [
        {
          userId,
          firmId,
          title: "High credibility event → advisor workflow",
          ruleType: "Autopilot Routing",
          trigger:
            "Source credibility is at least 80 and event impact is at least 75.",
          minimumCredibilityScore: 80,
          minimumImpactScore: 75,
          actionTemplate:
            "Create firm task, meeting task, communication draft, briefing report, notification queue, vault record, and learning memory.",
          approvalRequired: true,
          channelsJson: asJson([
            "Firm Task Board",
            "Meeting Prep",
            "Briefing",
            "Draft Email",
            "Adaptive Memory",
          ]),
          guardrailsJson: asJson([
            "No automatic trade execution.",
            "No client delivery without advisor approval.",
            "Source link and rationale must remain attached.",
          ]),
        },
        {
          userId,
          firmId,
          title: "Advisor feedback → adaptive learning",
          ruleType: "Adaptive Learning",
          trigger:
            "Advisor approves, rejects, revises, or corrects a recommendation.",
          minimumCredibilityScore: 0,
          minimumImpactScore: 0,
          actionTemplate:
            "Update bot behavior, client preference memory, source reliability, and future recommendation rules.",
          approvalRequired: false,
          channelsJson: asJson([
            "Bot Learning",
            "Client Preferences",
            "Source Reliability",
            "Firm Learning Snapshot",
          ]),
          guardrailsJson: asJson([
            "Learning changes recommendations only; they do not send, trade, or approve automatically.",
            "Founder/advisor can reverse or override learned behavior.",
          ]),
        },
      ],
    });
  }

  if (memoryCount === 0) {
    await prisma.advisorAdaptiveMemory.createMany({
      data: [
        {
          userId,
          firmId,
          subjectType: "Advisor",
          subjectName: "Default Advisor",
          memoryKey: "preferred_response_style",
          memoryValue:
            "Prioritize concise, source-backed recommendations with clear next steps and approval gates.",
          confidenceScore: 78,
          evidenceJson: asJson([
            "Seeded from Advisor OS Phase 3 defaults.",
            "Aligned with advisor workflow automation.",
          ]),
        },
        {
          userId,
          firmId,
          subjectType: "Client",
          subjectName: "Model Household",
          memoryKey: "volatility_communication",
          memoryValue:
            "Use calm, plain-English explanations during market volatility. Avoid overly technical language unless requested.",
          confidenceScore: 74,
          evidenceJson: asJson([
            "Seeded from model client profile.",
            "Connected to rate-sensitive portfolio scenario.",
          ]),
        },
        {
          userId,
          firmId,
          subjectType: "Source",
          subjectName: "Major Financial Newswire",
          memoryKey: "source_usage",
          memoryValue:
            "Reliable enough for fast triage, but major market claims should be cross-checked before client communication.",
          confidenceScore: 82,
          evidenceJson: asJson([
            "Credibility score above 80.",
            "Known risk: speed may reduce depth.",
          ]),
        },
      ],
    });
  }

  if (clientPreferenceCount === 0) {
    await prisma.clientPreferenceProfile.create({
      data: {
        userId,
        firmId,
        clientName: "Model Household",
        communicationStyle: "Calm, simple, and reassuring",
        detailLevel: "Balanced",
        preferredChannel: "Email",
        meetingCadence: "Quarterly",
        volatilitySensitivity: 72,
        behavioralNotesJson: asJson([
          "Prefers context before recommendation.",
          "Responds well to plain-English summaries.",
          "May need reassurance during sharp market moves.",
        ]),
        doJson: asJson([
          "Explain what changed, why it matters, and what is being reviewed.",
          "Use short paragraphs and practical examples.",
          "Remind the client that the plan is built for volatility.",
        ]),
        dontJson: asJson([
          "Do not use alarmist language.",
          "Do not overload with technical jargon.",
          "Do not imply guaranteed outcomes.",
        ]),
        confidenceScore: 76,
        status: "Active",
      },
    });
  }

  if (botLearningCount === 0) {
    await prisma.botLearningProfile.createMany({
      data: [
        {
          userId,
          firmId,
          botName: "Client Preference Bot",
          styleInstructions:
            "Keep client messages warm, simple, and personalized. Use client preference memory before drafting.",
          decisionRulesJson: asJson([
            "If volatility sensitivity is above 65, use calming language first.",
            "If detail level is Balanced, summarize in three sections: what happened, what it may mean, what we are doing.",
          ]),
          escalationRulesJson: asJson([
            "Escalate if draft includes a trade recommendation.",
            "Escalate if client appears near retirement or has near-term liquidity needs.",
          ]),
          memoryWeight: 78,
          autonomyLevel: "Draft Only",
          successScore: 74,
          status: "Learning",
        },
        {
          userId,
          firmId,
          botName: "Source Sentinel Bot",
          styleInstructions:
            "Favor primary sources and high-transparency sources. Penalize anonymous, promotional, or single-source claims.",
          decisionRulesJson: asJson([
            "Increase trust if source is primary, regulatory, or historically accurate.",
            "Decrease trust if source is anonymous or promotional.",
            "Require cross-check for high-impact client communication.",
          ]),
          escalationRulesJson: asJson([
            "Escalate any low-trust source that still appears market-moving.",
            "Restrict client-facing usage if credibility is below 60.",
          ]),
          memoryWeight: 82,
          autonomyLevel: "Score and Flag",
          successScore: 79,
          status: "Learning",
        },
        {
          userId,
          firmId,
          botName: "Adaptive Workflow Bot",
          styleInstructions:
            "Route events into the smallest useful workflow package. Avoid creating unnecessary tasks unless impact and credibility justify it.",
          decisionRulesJson: asJson([
            "Create full workflow package if credibility >= 80 and impact >= 75.",
            "Create watch-only recommendation if impact is below 60.",
            "Always attach compliance memory for client-facing drafts.",
          ]),
          escalationRulesJson: asJson([
            "Require advisor approval before delivery.",
            "Escalate if action touches compliance, trading, or client suitability.",
          ]),
          memoryWeight: 75,
          autonomyLevel: "Workflow Creation With Approval",
          successScore: 73,
          status: "Learning",
        },
      ],
    });
  }

  if (sourceSignalCount === 0) {
    await prisma.sourceReliabilitySignal.create({
      data: {
        userId,
        firmId,
        sourceName: "Major Financial Newswire",
        domain: "financial-newswire.example",
        signalType: "Seed Outcome",
        outcome:
          "Useful for fast triage but should be paired with primary source review before client delivery.",
        reliabilityDelta: 2,
        notes:
          "Seeded reliability signal to begin adaptive source learning.",
        evidenceJson: asJson([
          "Used in rate sensitivity workflow.",
          "Credibility score remains above approved threshold.",
        ]),
      },
    });
  }

  if (feedbackCount === 0) {
    await prisma.advisorFeedbackSignal.create({
      data: {
        userId,
        firmId,
        targetType: "Communication Draft",
        rating: 1,
        feedback:
          "The draft should stay calm, avoid jargon, and make clear that the advisor is reviewing before recommending action.",
        actionTaken: "Learn",
      },
    });
  }

  if (adaptiveRecommendationCount === 0) {
    await prisma.adaptiveRecommendation.create({
      data: {
        userId,
        firmId,
        title: "Tune client communication by volatility sensitivity",
        category: "Client Personalization",
        recommendation:
          "For clients with higher volatility sensitivity, lead with reassurance and plan context before market details.",
        reasonJson: asJson([
          "Model Household has volatility sensitivity above 70.",
          "Advisor feedback prefers calm, plain-English drafts.",
          "Communication factory should use client memory before drafting.",
        ]),
        confidenceScore: 76,
        status: "Open",
      },
    });
  }
}

async function createDemoAutopilotAction(user: CurrentUser, firmId: string | null) {
  return prisma.eventActionAutopilot.create({
    data: {
      userId: user.id,
      firmId,
      eventTitle: "Fresh market event requires advisor triage",
      sourceName: "Advisor OS Demo Source",
      sourceUrl: "https://example.com/source",
      sourceCredibilityScore: 82,
      impactScore: 79,
      urgency: "High",
      actionType: "Advisor Review",
      recommendedAction:
        "Review affected portfolios, attach source context, create a client-safe explanation, and store rationale before any outreach.",
      assignedTo: user.name,
      status: "Queued",
      rationaleJson: asJson([
        "Event is relevant to watched assets or model portfolios.",
        "Source is above minimum credibility threshold.",
        "Client-facing action requires advisor approval.",
      ]),
      guardrailsJson: asJson([
        "No automatic client sending.",
        "No trade execution.",
        "All source context must remain attached.",
      ]),
    },
  });
}

async function runPhase2WorkflowAutomation({
  user,
  firmId,
  actionId,
  clientName,
}: {
  user: CurrentUser;
  firmId: string | null;
  actionId?: string | null;
  clientName?: string | null;
}) {
  await ensureAdvisorOsDefaults(user.id, firmId);

  const client = await ensureModelClient(
    user.id,
    readText(clientName, "Model Household")
  );

  const targetAction =
    (actionId
      ? await prisma.eventActionAutopilot.findFirst({
          where: {
            id: actionId,
            userId: user.id,
          },
        })
      : null) ??
    (await prisma.eventActionAutopilot.findFirst({
      where: {
        userId: user.id,
        status: {
          notIn: ["Complete", "Routed"],
        },
      },
      orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
    })) ??
    (await createDemoAutopilotAction(user, firmId));

  const firmAgenda = await ensureFirmAgenda(user, firmId);

  const firmTask = firmAgenda
    ? await prisma.firmAgendaTask.create({
        data: {
          firmId: firmAgenda.firmId,
          agendaId: firmAgenda.id,
          title: `Advisor OS review: ${targetAction.eventTitle}`,
          detail:
            "Phase 2/3 automation created this task from a credible event. Review source, impact, client communication draft, briefing report, compliance vault record, and learning recommendations before any client-facing action.",
          status: "Open",
          priority: targetAction.urgency === "High" ? "High" : "Medium",
          dueDate: nextDateString(1),
        },
      })
    : null;

  const meetingTask = await prisma.meetingTask.create({
    data: {
      userId: user.id,
      clientId: client.id,
      title: `Review client impact: ${targetAction.eventTitle}`,
      description:
        "Created by Advisor OS. Review portfolio impact, communication draft, source credibility, compliance notes, and adaptive client preferences before outreach.",
      dueDate: nextDate(2),
      priority: targetAction.urgency === "High" ? "High" : "Medium",
      status: "Open",
    },
  });

  const clientPreference = await prisma.clientPreferenceProfile.findFirst({
    where: {
      userId: user.id,
      clientName: client.fullName,
    },
  });

  const draftTone =
    clientPreference?.communicationStyle ??
    "Clear, reassuring, and source-backed";

  const draft = await prisma.clientCommunicationDraft.create({
    data: {
      userId: user.id,
      firmId,
      clientName: client.fullName,
      channel: clientPreference?.preferredChannel ?? "Email",
      audience: "Client",
      title: `Draft: ${targetAction.eventTitle}`,
      body:
        "Hi — we are monitoring a market event that may be relevant to your portfolio. Our first step is to review the source, compare the event to your plan, and avoid reacting emotionally to a single headline. We will follow up with a specific recommendation only if the review shows action is warranted.",
      sourceSummaryJson: asJson([
        `Source: ${targetAction.sourceName}`,
        `Source credibility score: ${targetAction.sourceCredibilityScore}`,
        `Impact score: ${targetAction.impactScore}`,
        targetAction.sourceUrl
          ? `Source link: ${targetAction.sourceUrl}`
          : "No source link attached.",
      ]),
      complianceNotesJson: asJson([
        "Advisor approval required before delivery.",
        "No guarantee or promissory language.",
        "Do not include a trade recommendation unless suitability is documented.",
        "Client tone pulled from adaptive preference memory.",
      ]),
      status: "Needs Approval",
      tone: draftTone,
    },
  });

  const briefing = await prisma.briefingReport.create({
    data: {
      userId: user.id,
      clientId: client.id,
      title: `Advisor OS briefing: ${targetAction.eventTitle}`,
      audience: "Advisor",
      briefType: "Event Response",
      executiveSummary:
        "Advisor OS converted a credible event into a workflow package and applied adaptive client preference memory.",
      marketSummary: targetAction.recommendedAction,
      alertSummary:
        `Urgency: ${targetAction.urgency}. Source credibility: ${targetAction.sourceCredibilityScore}. Impact score: ${targetAction.impactScore}.`,
      portfolioSummary:
        "Review affected exposures before recommending any client action. The workflow is advisory-only and does not execute trades.",
      alternativeSummary:
        "No alternative investment action has been recommended by this automation run.",
      riskSummary:
        "Main risks: overreacting to one event, communicating without full context, and failing to retain source evidence.",
      actionItemsJson: asJson([
        "Review the generated firm task.",
        "Review the client communication draft.",
        "Review the compliance memory record.",
        "Confirm adaptive client tone before delivery.",
      ]),
      sourceItemsJson: asJson([
        {
          title: targetAction.eventTitle,
          source: targetAction.sourceName,
          url: targetAction.sourceUrl,
          credibilityScore: targetAction.sourceCredibilityScore,
          impactScore: targetAction.impactScore,
        },
      ]),
      status: "Generated",
    },
  });

  const vaultItem = await prisma.complianceMemoryVaultItem.create({
    data: {
      userId: user.id,
      firmId,
      clientName: client.fullName,
      subject: `Workflow rationale: ${targetAction.eventTitle}`,
      category: "Advisor Workflow Automation",
      retentionTag: "Adaptive Autopilot",
      sourceTitle: targetAction.eventTitle,
      sourceUrl: targetAction.sourceUrl,
      summary:
        "Advisor OS created a workflow package and applied adaptive client preferences while retaining source context, rationale, approval requirements, and generated record IDs.",
      riskLevel: targetAction.impactScore >= 85 ? "High" : "Medium",
      status: "Stored",
      evidenceJson: asJson([
        `Source: ${targetAction.sourceName}`,
        `Source credibility score: ${targetAction.sourceCredibilityScore}`,
        `Impact score: ${targetAction.impactScore}`,
        `Client communication style: ${draftTone}`,
        `Created firm task: ${firmTask?.id ?? "No firm task created"}`,
        `Created meeting task: ${meetingTask.id}`,
        `Created briefing: ${briefing.id}`,
        `Created draft: ${draft.id}`,
      ]),
      expiresAt: nextDate(365),
    },
  });

  const delivery = await prisma.notificationDelivery.create({
    data: {
      userId: user.id,
      channel: "Dashboard",
      destination: user.email,
      status: "Queued",
      urgency: targetAction.urgency,
      score: targetAction.impactScore,
      title: `Advisor OS queued workflow: ${targetAction.eventTitle}`,
      body:
        "A source-backed advisor workflow package is ready for review. Client delivery remains blocked until advisor approval.",
      reason: "Advisor OS adaptive workflow automation",
      simulated: true,
    },
  });

  await prisma.eventActionAutopilot.update({
    where: {
      id: targetAction.id,
    },
    data: {
      status: "Routed",
    },
  });

  const run = await prisma.advisorWorkflowAutomationRun.create({
    data: {
      userId: user.id,
      firmId,
      runType: "Adaptive Workflow Automation",
      status: "Complete",
      summary:
        "Converted one credible event into a firm task, client meeting task, briefing report, adaptive communication draft, compliance vault item, and simulated dashboard delivery.",
      sourceActionId: targetAction.id,
      createdFirmTaskId: firmTask?.id ?? null,
      createdMeetingTaskId: meetingTask.id,
      createdBriefingId: briefing.id,
      createdDraftId: draft.id,
      createdVaultItemId: vaultItem.id,
      createdNotificationId: delivery.id,
      metricsJson: asJson({
        sourceCredibilityScore: targetAction.sourceCredibilityScore,
        impactScore: targetAction.impactScore,
        createdRecords: firmTask ? 6 : 5,
        approvalRequired: true,
        adaptiveToneApplied: draftTone,
      }),
    },
  });

  await prisma.firmIntelligencePulse.create({
    data: {
      userId: user.id,
      firmId,
      title: `Adaptive workflow routed: ${targetAction.eventTitle}`,
      category: "Workflow Automation",
      summary:
        "Advisor OS routed a credible event and used adaptive client preference memory to tune the draft and briefing package.",
      confidenceScore: clampScore(
        (targetAction.sourceCredibilityScore + targetAction.impactScore) / 2
      ),
      affectedClientsJson: asJson([client.fullName]),
      sourceItemsJson: asJson([
        {
          title: targetAction.eventTitle,
          source: targetAction.sourceName,
          credibilityScore: targetAction.sourceCredibilityScore,
        },
      ]),
      actionsJson: asJson([
        "Review generated task.",
        "Review briefing report.",
        "Approve or revise client communication draft.",
        "Keep compliance vault record attached.",
        "Provide feedback so the system improves.",
      ]),
      status: "Active",
    },
  });

  return run;
}

async function runPhase3AdaptiveLearning({
  user,
  firmId,
}: {
  user: CurrentUser;
  firmId: string | null;
}) {
  await ensureAdvisorOsDefaults(user.id, firmId);

  const [
    unprocessedFeedback,
    sourceSignals,
    clientPreferences,
    botProfiles,
    recentRuns,
  ] = await Promise.all([
    prisma.advisorFeedbackSignal.findMany({
      where: {
        userId: user.id,
        processedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    }),
    prisma.sourceReliabilitySignal.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    }),
    prisma.clientPreferenceProfile.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 10,
    }),
    prisma.botLearningProfile.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 10,
    }),
    prisma.advisorWorkflowAutomationRun.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  const positiveFeedbackCount = unprocessedFeedback.filter(
    (item) => item.rating > 0
  ).length;
  const correctionFeedbackCount = unprocessedFeedback.filter(
    (item) => item.rating < 0
  ).length;

  const averageFeedbackScore = unprocessedFeedback.length
    ? unprocessedFeedback.reduce((sum, item) => sum + item.rating, 0) /
      unprocessedFeedback.length
    : 0;

  const totalReliabilityDelta = sourceSignals.reduce(
    (sum, item) => sum + item.reliabilityDelta,
    0
  );

  const adaptiveScore = clampScore(
    70 +
      positiveFeedbackCount * 4 -
      correctionFeedbackCount * 2 +
      Math.min(recentRuns.length, 5) * 2 +
      Math.min(totalReliabilityDelta, 10)
  );

  await prisma.botLearningProfile.updateMany({
    where: {
      userId: user.id,
      botName: {
        in: ["Client Preference Bot", "Adaptive Workflow Bot"],
      },
    },
    data: {
      successScore: clampScore(
        74 + positiveFeedbackCount * 3 - correctionFeedbackCount * 2
      ),
      status: "Learning",
    },
  });

  await prisma.clientPreferenceProfile.updateMany({
    where: {
      userId: user.id,
      clientName: "Model Household",
    },
    data: {
      communicationStyle:
        correctionFeedbackCount > positiveFeedbackCount
          ? "Even more concise, calm, and plain-English"
          : "Calm, simple, and reassuring",
      confidenceScore: clampScore(76 + positiveFeedbackCount * 3),
    },
  });

  const sourceProfile = await prisma.sourceCredibilityProfile.findFirst({
    where: {
      userId: user.id,
      domain: "financial-newswire.example",
    },
  });

  if (sourceProfile) {
    await prisma.sourceCredibilityProfile.update({
      where: {
        id: sourceProfile.id,
      },
      data: {
        credibilityScore: clampScore(
          sourceProfile.credibilityScore + Math.max(-8, Math.min(8, totalReliabilityDelta))
        ),
        lastReviewedAt: new Date(),
        historyJson: asJson([
          ...parseJson<string[]>(sourceProfile.historyJson, []),
          `Adaptive learning cycle updated reliability by ${totalReliabilityDelta}.`,
        ]),
      },
    });
  }

  await prisma.advisorAdaptiveMemory.upsert({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: user.id,
        subjectType: "Advisor",
        subjectName: user.name,
        memoryKey: "latest_learning_cycle",
      },
    },
    update: {
      memoryValue:
        correctionFeedbackCount > positiveFeedbackCount
          ? "Advisor corrections indicate future recommendations should be more conservative, shorter, and more explicitly approval-gated."
          : "Advisor feedback indicates current tone and workflow routing are useful; continue source-backed, approval-gated recommendations.",
      confidenceScore: adaptiveScore,
      evidenceJson: asJson([
        `Positive feedback signals: ${positiveFeedbackCount}`,
        `Correction signals: ${correctionFeedbackCount}`,
        `Recent automation runs analyzed: ${recentRuns.length}`,
        `Total source reliability delta: ${totalReliabilityDelta}`,
      ]),
      lastAppliedAt: new Date(),
    },
    create: {
      userId: user.id,
      firmId,
      subjectType: "Advisor",
      subjectName: user.name,
      memoryKey: "latest_learning_cycle",
      memoryValue:
        "Advisor OS has started learning from feedback, source signals, workflow outcomes, and client preferences.",
      confidenceScore: adaptiveScore,
      evidenceJson: asJson([
        `Positive feedback signals: ${positiveFeedbackCount}`,
        `Correction signals: ${correctionFeedbackCount}`,
        `Recent automation runs analyzed: ${recentRuns.length}`,
        `Total source reliability delta: ${totalReliabilityDelta}`,
      ]),
      lastAppliedAt: new Date(),
    },
  });

  await prisma.adaptiveRecommendation.create({
    data: {
      userId: user.id,
      firmId,
      title:
        correctionFeedbackCount > positiveFeedbackCount
          ? "Reduce automation assertiveness"
          : "Continue approval-gated adaptive routing",
      category: "Adaptive Intelligence",
      recommendation:
        correctionFeedbackCount > positiveFeedbackCount
          ? "Use shorter drafts, add stronger source caveats, and route more items to advisor review before creating client-facing material."
          : "Continue using credible events to generate workflow packages, but preserve advisor approval before delivery or trade-related recommendations.",
      reasonJson: asJson([
        `Average feedback score: ${averageFeedbackScore.toFixed(2)}`,
        `Positive feedback: ${positiveFeedbackCount}`,
        `Corrections: ${correctionFeedbackCount}`,
        `Recent workflow runs: ${recentRuns.length}`,
      ]),
      confidenceScore: adaptiveScore,
      status: "Open",
    },
  });

  const snapshot = await prisma.firmLearningSnapshot.create({
    data: {
      userId: user.id,
      firmId,
      title: "Phase 3 adaptive learning snapshot",
      summary:
        "Advisor OS analyzed feedback, source reliability, bot behavior, client style preferences, and workflow outcomes to update future recommendations.",
      score: adaptiveScore,
      memoryJson: asJson([
        {
          subject: user.name,
          memory:
            correctionFeedbackCount > positiveFeedbackCount
              ? "Prefer conservative, shorter, approval-heavy recommendations."
              : "Current approval-gated workflow style is useful.",
        },
      ]),
      sourceReliabilityJson: asJson(
        sourceSignals.slice(0, 5).map((signal) => ({
          sourceName: signal.sourceName,
          domain: signal.domain,
          outcome: signal.outcome,
          reliabilityDelta: signal.reliabilityDelta,
        }))
      ),
      botUpdatesJson: asJson(
        botProfiles.slice(0, 5).map((bot) => ({
          botName: bot.botName,
          successScore: bot.successScore,
          autonomyLevel: bot.autonomyLevel,
        }))
      ),
      clientStyleJson: asJson(
        clientPreferences.slice(0, 5).map((client) => ({
          clientName: client.clientName,
          communicationStyle: client.communicationStyle,
          detailLevel: client.detailLevel,
          preferredChannel: client.preferredChannel,
        }))
      ),
      recommendationsJson: asJson([
        "Keep source context attached to every client-facing item.",
        "Keep delivery approval-gated.",
        "Use client preference memory before drafting.",
        "Use advisor feedback to tune future bot behavior.",
      ]),
    },
  });

  await prisma.advisorFeedbackSignal.updateMany({
    where: {
      userId: user.id,
      processedAt: null,
    },
    data: {
      processedAt: new Date(),
    },
  });

  await prisma.firmIntelligencePulse.create({
    data: {
      userId: user.id,
      firmId,
      title: "Adaptive intelligence cycle complete",
      category: "Adaptive Learning",
      summary:
        "Advisor OS completed a learning cycle and updated bot behavior, source reliability, client preferences, adaptive memory, and future recommendation guidance.",
      confidenceScore: adaptiveScore,
      affectedClientsJson: asJson(["Model Household"]),
      sourceItemsJson: asJson([
        {
          title: "Phase 3 adaptive learning snapshot",
          source: "Advisor OS",
          credibilityScore: adaptiveScore,
        },
      ]),
      actionsJson: asJson([
        "Review new adaptive recommendation.",
        "Confirm bot behavior remains approval-gated.",
        "Provide feedback on future drafts so the platform keeps improving.",
      ]),
      status: "Active",
    },
  });

  await prisma.complianceMemoryVaultItem.create({
    data: {
      userId: user.id,
      firmId,
      clientName: null,
      subject: "Adaptive learning cycle evidence",
      category: "Adaptive Intelligence",
      retentionTag: "Learning Audit",
      sourceTitle: snapshot.title,
      summary:
        "Stored evidence of an adaptive learning cycle. Learning adjusts recommendations only and does not approve, send, trade, or bypass compliance review.",
      riskLevel: "Low",
      status: "Stored",
      evidenceJson: asJson([
        `Learning snapshot ID: ${snapshot.id}`,
        `Adaptive score: ${adaptiveScore}`,
        `Feedback signals processed: ${unprocessedFeedback.length}`,
        `Source reliability signals reviewed: ${sourceSignals.length}`,
      ]),
      expiresAt: nextDate(365),
    },
  });

  return snapshot;
}

async function loadAdvisorOs(user: CurrentUser, requestedFirmId?: string | null) {
  const firmId = await resolveFirmId(user.id, requestedFirmId);
  await ensureAdvisorOsDefaults(user.id, firmId);

  const scopedWhere = firmId
    ? {
        userId: user.id,
        OR: [{ firmId }, { firmId: null }],
      }
    : {
        userId: user.id,
      };

  const [
    nodes,
    twins,
    bots,
    sources,
    autopilotActions,
    vaultItems,
    communicationDrafts,
    meetingPackets,
    playbooks,
    firmPulses,
    workflowRules,
    automationRuns,
    adaptiveMemories,
    clientPreferenceProfiles,
    botLearningProfiles,
    sourceReliabilitySignals,
    advisorFeedbackSignals,
    adaptiveRecommendations,
    firmLearningSnapshots,
  ] = await Promise.all([
    prisma.advisorOperatingNode.findMany({
      where: scopedWhere,
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    }),
    prisma.portfolioImpactTwin.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.personalAdvisorBot.findMany({
      where: scopedWhere,
      orderBy: [{ status: "asc" }, { botName: "asc" }],
    }),
    prisma.sourceCredibilityProfile.findMany({
      where: scopedWhere,
      orderBy: [{ credibilityScore: "desc" }, { sourceName: "asc" }],
    }),
    prisma.eventActionAutopilot.findMany({
      where: scopedWhere,
      orderBy: [{ status: "asc" }, { impactScore: "desc" }],
      take: 20,
    }),
    prisma.complianceMemoryVaultItem.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.clientCommunicationDraft.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.meetingPrepPacket.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.advisorPlaybook.findMany({
      where: scopedWhere,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.firmIntelligencePulse.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.advisorWorkflowRule.findMany({
      where: scopedWhere,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.advisorWorkflowAutomationRun.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.advisorAdaptiveMemory.findMany({
      where: scopedWhere,
      orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
      take: 30,
    }),
    prisma.clientPreferenceProfile.findMany({
      where: scopedWhere,
      orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prisma.botLearningProfile.findMany({
      where: scopedWhere,
      orderBy: [{ successScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prisma.sourceReliabilitySignal.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.advisorFeedbackSignal.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.adaptiveRecommendation.findMany({
      where: scopedWhere,
      orderBy: [{ status: "asc" }, { confidenceScore: "desc" }],
      take: 30,
    }),
    prisma.firmLearningSnapshot.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const averageCredibility = sources.length
    ? Math.round(
        sources.reduce((sum, source) => sum + source.credibilityScore, 0) /
          sources.length
      )
    : 0;

  const averageBotSuccess = botLearningProfiles.length
    ? Math.round(
        botLearningProfiles.reduce((sum, bot) => sum + bot.successScore, 0) /
          botLearningProfiles.length
      )
    : 0;

  const averageMemoryConfidence = adaptiveMemories.length
    ? Math.round(
        adaptiveMemories.reduce((sum, memory) => sum + memory.confidenceScore, 0) /
          adaptiveMemories.length
      )
    : 0;

  const unprocessedFeedbackCount = advisorFeedbackSignals.filter(
    (signal) => !signal.processedAt
  ).length;

  const queuedActions = autopilotActions.filter(
    (action) => !["Complete", "Routed"].includes(action.status)
  ).length;

  const approvedDrafts = communicationDrafts.filter(
    (draft) => draft.status === "Approved" || draft.status === "Simulated Sent"
  ).length;

  const readinessScore = clampScore(
    68 +
      Math.min(automationRuns.length, 5) * 2 +
      Math.min(firmLearningSnapshots.length, 5) * 4 +
      Math.min(adaptiveMemories.length, 8) * 2 +
      Math.min(botLearningProfiles.length, 5) * 2 +
      Math.min(clientPreferenceProfiles.length, 5) * 2
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    firmId,
    readinessScore,
    phaseRoadmap: [
      {
        phase: "Phase 1",
        title: "Advisor OS Foundation",
        status: "Complete",
        summary:
          "Operating graph, AI bot matrix, source credibility, impact twin, autopilot queue, compliance memory, communication drafts, meeting prep, playbooks, and firm intelligence pulse.",
      },
      {
        phase: "Phase 2",
        title: "Workflow Automation",
        status: "Complete",
        summary:
          "Credible events route into firm tasks, meeting tasks, briefings, client communication drafts, compliance vault records, and simulated delivery queues.",
      },
      {
        phase: "Phase 3",
        title: "Adaptive Intelligence",
        status: "Live",
        summary:
          "Advisor OS now learns from advisor feedback, client preferences, bot outcomes, source reliability signals, and firm workflow results.",
      },
    ],
    counts: {
      operatingNodeCount: nodes.length,
      impactTwinCount: twins.length,
      personalBotCount: bots.length,
      sourceProfileCount: sources.length,
      autopilotActionCount: autopilotActions.length,
      queuedAutopilotActionCount: queuedActions,
      vaultItemCount: vaultItems.length,
      communicationDraftCount: communicationDrafts.length,
      approvedCommunicationDraftCount: approvedDrafts,
      meetingPrepCount: meetingPackets.length,
      playbookCount: playbooks.length,
      firmPulseCount: firmPulses.length,
      workflowRuleCount: workflowRules.length,
      automationRunCount: automationRuns.length,
      adaptiveMemoryCount: adaptiveMemories.length,
      clientPreferenceProfileCount: clientPreferenceProfiles.length,
      botLearningProfileCount: botLearningProfiles.length,
      sourceReliabilitySignalCount: sourceReliabilitySignals.length,
      advisorFeedbackSignalCount: advisorFeedbackSignals.length,
      unprocessedFeedbackCount,
      adaptiveRecommendationCount: adaptiveRecommendations.length,
      firmLearningSnapshotCount: firmLearningSnapshots.length,
      averageCredibility,
      averageBotSuccess,
      averageMemoryConfidence,
    },
    operatingGraph: {
      nodes: nodes.map((node) => ({
        ...node,
        data: parseJson<Record<string, unknown>>(node.dataJson, {}),
      })),
      edges: [
        {
          from: "News intake",
          to: "Source Credibility Engine",
          label: "Verifies source quality",
        },
        {
          from: "Source Credibility Engine",
          to: "Portfolio Impact Twin",
          label: "Only credible events become scenarios",
        },
        {
          from: "Portfolio Impact Twin",
          to: "Event-to-Action Autopilot",
          label: "Impact becomes advisor action",
        },
        {
          from: "Event-to-Action Autopilot",
          to: "Workflow Automation",
          label: "Creates tasks, briefings, drafts, vault records, and delivery queues",
        },
        {
          from: "Advisor Feedback",
          to: "Adaptive Intelligence Layer",
          label: "Tunes future bot behavior, source scoring, and client language",
        },
        {
          from: "Adaptive Intelligence Layer",
          to: "Firm-Wide Intelligence Layer",
          label: "Turns outcomes into reusable firm knowledge",
        },
      ],
    },
    twins: twins.map((twin) => ({
      ...twin,
      affectedAssets: parseJson<string[]>(twin.affectedAssetsJson, []),
      actions: parseJson<string[]>(twin.actionsJson, []),
    })),
    bots: bots.map((bot) => ({
      ...bot,
      coverage: parseJson<string[]>(bot.coverageJson, []),
      tasks: parseJson<string[]>(bot.tasksJson, []),
      permissions: parseJson<Record<string, unknown>>(bot.permissionsJson, {}),
    })),
    sources: sources.map((source) => ({
      ...source,
      history: parseJson<string[]>(source.historyJson, []),
      flags: parseJson<string[]>(source.flagsJson, []),
    })),
    autopilotActions: autopilotActions.map((action) => ({
      ...action,
      rationale: parseJson<string[]>(action.rationaleJson, []),
      guardrails: parseJson<string[]>(action.guardrailsJson, []),
    })),
    vaultItems: vaultItems.map((item) => ({
      ...item,
      evidence: parseJson<string[]>(item.evidenceJson, []),
    })),
    communicationDrafts: communicationDrafts.map((draft) => ({
      ...draft,
      sourceSummary: parseJson<string[]>(draft.sourceSummaryJson, []),
      complianceNotes: parseJson<string[]>(draft.complianceNotesJson, []),
    })),
    meetingPackets: meetingPackets.map((packet) => ({
      ...packet,
      briefing: parseJson<string[]>(packet.briefingJson, []),
      questions: parseJson<string[]>(packet.questionsJson, []),
      openItems: parseJson<string[]>(packet.openItemsJson, []),
      followUp: parseJson<string[]>(packet.followUpJson, []),
    })),
    playbooks: playbooks.map((playbook) => ({
      ...playbook,
      steps: parseJson<string[]>(playbook.stepsJson, []),
      escalationRules: parseJson<string[]>(
        playbook.escalationRulesJson,
        []
      ),
    })),
    firmPulses: firmPulses.map((pulse) => ({
      ...pulse,
      affectedClients: parseJson<string[]>(pulse.affectedClientsJson, []),
      sourceItems: parseJson<
        Array<{ title: string; source: string; credibilityScore: number }>
      >(pulse.sourceItemsJson, []),
      actions: parseJson<string[]>(pulse.actionsJson, []),
    })),
    workflowRules: workflowRules.map((rule) => ({
      ...rule,
      channels: parseJson<string[]>(rule.channelsJson, []),
      guardrails: parseJson<string[]>(rule.guardrailsJson, []),
    })),
    automationRuns: automationRuns.map((run) => ({
      ...run,
      metrics: parseJson<Record<string, unknown>>(run.metricsJson, {}),
    })),
    adaptiveMemories: adaptiveMemories.map((memory) => ({
      ...memory,
      evidence: parseJson<string[]>(memory.evidenceJson, []),
    })),
    clientPreferenceProfiles: clientPreferenceProfiles.map((profile) => ({
      ...profile,
      behavioralNotes: parseJson<string[]>(profile.behavioralNotesJson, []),
      doList: parseJson<string[]>(profile.doJson, []),
      dontList: parseJson<string[]>(profile.dontJson, []),
    })),
    botLearningProfiles: botLearningProfiles.map((profile) => ({
      ...profile,
      decisionRules: parseJson<string[]>(profile.decisionRulesJson, []),
      escalationRules: parseJson<string[]>(profile.escalationRulesJson, []),
    })),
    sourceReliabilitySignals: sourceReliabilitySignals.map((signal) => ({
      ...signal,
      evidence: parseJson<string[]>(signal.evidenceJson, []),
    })),
    advisorFeedbackSignals,
    adaptiveRecommendations: adaptiveRecommendations.map((recommendation) => ({
      ...recommendation,
      reasons: parseJson<string[]>(recommendation.reasonJson, []),
    })),
    firmLearningSnapshots: firmLearningSnapshots.map((snapshot) => ({
      ...snapshot,
      memory: parseJson<Array<Record<string, unknown>>>(snapshot.memoryJson, []),
      sourceReliability: parseJson<Array<Record<string, unknown>>>(
        snapshot.sourceReliabilityJson,
        []
      ),
      botUpdates: parseJson<Array<Record<string, unknown>>>(
        snapshot.botUpdatesJson,
        []
      ),
      clientStyle: parseJson<Array<Record<string, unknown>>>(
        snapshot.clientStyleJson,
        []
      ),
      recommendations: parseJson<string[]>(snapshot.recommendationsJson, []),
    })),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedFirmId = url.searchParams.get("firmId");

  return NextResponse.json(await loadAdvisorOs(user, requestedFirmId));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);
  const firmId = await resolveFirmId(
    user.id,
    typeof body.firmId === "string" ? body.firmId : null
  );

  if (action === "refreshDefaults") {
    await ensureAdvisorOsDefaults(user.id, firmId);
  }

  if (action === "runPhase2WorkflowAutomation") {
    await runPhase2WorkflowAutomation({
      user,
      firmId,
      actionId: typeof body.actionId === "string" ? body.actionId : null,
      clientName: typeof body.clientName === "string" ? body.clientName : null,
    });
  }

  if (action === "runPhase3AdaptiveLearning") {
    await runPhase3AdaptiveLearning({
      user,
      firmId,
    });
  }

  if (action === "createAutopilotDemo") {
    await createDemoAutopilotAction(user, firmId);
  }

  if (action === "addPositiveFeedback") {
    await prisma.advisorFeedbackSignal.create({
      data: {
        userId: user.id,
        firmId,
        targetType: readText(body.targetType, "Advisor OS Recommendation"),
        targetId: typeof body.targetId === "string" ? body.targetId : null,
        rating: 1,
        feedback:
          "This recommendation was useful. Keep the same approval-gated, source-backed style.",
        actionTaken: "Learn",
      },
    });
  }

  if (action === "addCorrectionFeedback") {
    await prisma.advisorFeedbackSignal.create({
      data: {
        userId: user.id,
        firmId,
        targetType: readText(body.targetType, "Advisor OS Recommendation"),
        targetId: typeof body.targetId === "string" ? body.targetId : null,
        rating: -1,
        feedback:
          "This recommendation needs to be more conservative, shorter, and clearer about advisor approval before client delivery.",
        actionTaken: "Correct",
      },
    });
  }

  if (action === "improveSourceReliability") {
    const sourceName = readText(body.sourceName, "Major Financial Newswire");
    const domain = readText(body.domain, "financial-newswire.example");

    await prisma.sourceReliabilitySignal.create({
      data: {
        userId: user.id,
        firmId,
        sourceName,
        domain,
        signalType: "Advisor Outcome",
        outcome:
          "Advisor confirmed the source was useful for triage after cross-checking the event context.",
        reliabilityDelta: 3,
        notes:
          "Positive reliability signal created from Advisor OS Phase 3.",
        evidenceJson: asJson([
          "Advisor marked source useful.",
          "Source retained approval-gated workflow usage.",
        ]),
      },
    });

    await prisma.sourceCredibilityProfile.upsert({
      where: {
        userId_domain: {
          userId: user.id,
          domain,
        },
      },
      update: {
        credibilityScore: 89,
        status: "Approved",
        lastReviewedAt: new Date(),
      },
      create: {
        userId: user.id,
        firmId,
        sourceName,
        domain,
        sourceType: "News",
        credibilityScore: 89,
        biasRisk: 22,
        transparencyScore: 80,
        historyJson: asJson([
          "Created by Phase 3 adaptive source reliability signal.",
        ]),
        flagsJson: asJson(["Continue cross-checking before client delivery."]),
        status: "Approved",
        lastReviewedAt: new Date(),
      },
    });
  }

  if (action === "applyBotTuning") {
    await prisma.botLearningProfile.upsert({
      where: {
        userId_botName: {
          userId: user.id,
          botName: "Adaptive Workflow Bot",
        },
      },
      update: {
        styleInstructions:
          "Use shorter recommendations, clearer approval gates, and client preference memory before drafting.",
        memoryWeight: 84,
        autonomyLevel: "Workflow Creation With Advisor Approval",
        successScore: 82,
        status: "Learning",
      },
      create: {
        userId: user.id,
        firmId,
        botName: "Adaptive Workflow Bot",
        styleInstructions:
          "Use shorter recommendations, clearer approval gates, and client preference memory before drafting.",
        decisionRulesJson: asJson([
          "Create full workflow package if credibility >= 80 and impact >= 75.",
          "Use client preference profile before drafting communication.",
        ]),
        escalationRulesJson: asJson([
          "Require advisor approval before delivery.",
          "Escalate any trade or suitability language.",
        ]),
        memoryWeight: 84,
        autonomyLevel: "Workflow Creation With Advisor Approval",
        successScore: 82,
        status: "Learning",
      },
    });

    await prisma.adaptiveRecommendation.create({
      data: {
        userId: user.id,
        firmId,
        title: "Bot tuning applied",
        category: "Bot Learning",
        recommendation:
          "Adaptive Workflow Bot now prioritizes shorter recommendations, stronger approval gates, and client preference memory.",
        reasonJson: asJson([
          "Advisor requested Phase 3 adaptive intelligence.",
          "Bot tuning improves future workflow recommendations.",
        ]),
        confidenceScore: 82,
        status: "Open",
      },
    });
  }

  if (action === "approveRecommendation") {
    const recommendationId = readText(body.recommendationId);

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required." },
        { status: 400 }
      );
    }

    await prisma.adaptiveRecommendation.updateMany({
      where: {
        id: recommendationId,
        userId: user.id,
      },
      data: {
        status: "Approved",
      },
    });

    await prisma.advisorFeedbackSignal.create({
      data: {
        userId: user.id,
        firmId,
        targetType: "Adaptive Recommendation",
        targetId: recommendationId,
        rating: 1,
        feedback:
          "Advisor approved this adaptive recommendation.",
        actionTaken: "Learn",
      },
    });
  }

  if (action === "dismissRecommendation") {
    const recommendationId = readText(body.recommendationId);

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required." },
        { status: 400 }
      );
    }

    await prisma.adaptiveRecommendation.updateMany({
      where: {
        id: recommendationId,
        userId: user.id,
      },
      data: {
        status: "Dismissed",
      },
    });

    await prisma.advisorFeedbackSignal.create({
      data: {
        userId: user.id,
        firmId,
        targetType: "Adaptive Recommendation",
        targetId: recommendationId,
        rating: -1,
        feedback:
          "Advisor dismissed this adaptive recommendation.",
        actionTaken: "Correct",
      },
    });
  }

  return NextResponse.json(await loadAdvisorOs(user, firmId));
}