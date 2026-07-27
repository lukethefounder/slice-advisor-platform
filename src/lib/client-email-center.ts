import { prisma } from "@/lib/prisma";
import { generateAiText } from "@/lib/integrations/ai";
import { sendEmail } from "@/lib/integrations/email";
import {
  decryptClientProfile,
  decryptClientProfiles,
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import { recordSecurityEvent } from "@/lib/security";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

type CreateAiDraftInput = {
  user: CurrentUserShape;
  clientIds?: string[];
  includeAllClients?: boolean;
  topic: string;
  purpose?: string | null;
  tone?: string | null;
  advisorInstructions?: string | null;
  callToAction?: string | null;
  researchContext?: string | null;
  draftDepth?: string | null;
  useOpenAiResearch?: boolean;
  queueForApproval?: boolean;
};

type CreateManualDraftInput = {
  user: CurrentUserShape;
  clientIds: string[];
  subject: string;
  body: string;
  tone?: string | null;
  queueForApproval?: boolean;
};

type UpdateDraftInput = {
  user: CurrentUserShape;
  draftId: string;
  subject: string;
  body: string;
  status?: string | null;
};

type PolishDraftInput = {
  user: CurrentUserShape;
  draftId: string;
  polishMode?: string | null;
  advisorInstructions?: string | null;
};

type QueueDraftsInput = {
  user: CurrentUserShape;
  draftIds: string[];
  approvalTitle?: string | null;
};

type ArchiveDraftsInput = {
  user: CurrentUserShape;
  draftIds: string[];
  restore?: boolean;
};

type SendApprovedDraftsInput = {
  user: CurrentUserShape;
  approvalId: string;
  approvalNotes?: string | null;
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

function parseAiJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    const first = value.indexOf("{");
    const last = value.lastIndexOf("}");

    if (first >= 0 && last > first) {
      try {
        return JSON.parse(value.slice(first, last + 1)) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/\u0000/g, "")
    .replace(/\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function cleanMultiline(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 14000);
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normaliseClientIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))
  ).slice(0, 250);
}

function normaliseDraftIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))
  ).slice(0, 250);
}

function normaliseDraftStatus(value: string | null | undefined) {
  const clean = cleanText(value);

  const allowed = [
    "Draft",
    "Needs Advisor Approval",
    "Edited",
    "Archived",
    "Sent",
    "Simulated",
    "Delivery Failed",
  ];

  return allowed.includes(clean) ? clean : "Draft";
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emailAiModel(useResearchMode: boolean) {
  if (useResearchMode) {
    return (
      process.env.OPENAI_EMAIL_RESEARCH_MODEL ||
      process.env.OPENAI_FAST_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4.1-mini"
    );
  }

  return (
    process.env.OPENAI_EMAIL_MODEL ||
    process.env.OPENAI_FAST_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini"
  );
}

function emailAiTimeoutMs(useResearchMode: boolean) {
  if (useResearchMode) {
    return numberFromEnv(
      process.env.OPENAI_EMAIL_RESEARCH_TIMEOUT_MS ||
        process.env.OPENAI_QUALITY_TIMEOUT_MS,
      55000
    );
  }

  return numberFromEnv(
    process.env.OPENAI_EMAIL_TIMEOUT_MS ||
      process.env.OPENAI_FAST_TIMEOUT_MS ||
      process.env.OPENAI_BALANCED_TIMEOUT_MS,
    55000
  );
}

async function resolveFirmId(userId: string) {
  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return membership?.firmId ?? null;
}

function holdingSummary(holdings: any[]) {
  if (!holdings.length) return "No holdings currently stored.";

  return holdings
    .slice(0, 10)
    .map((holding) => {
      const pieces = [
        holding.symbol,
        holding.assetName,
        holding.assetClass,
        holding.value ? `value ${holding.value}` : null,
        holding.allocationPct ? `allocation ${holding.allocationPct}` : null,
        holding.riskLevel ? `risk ${holding.riskLevel}` : null,
      ].filter(Boolean);

      return pieces.join(" · ");
    })
    .join("\n");
}

function riskAndClientContext(client: any) {
  return [
    `Client name: ${client.fullName}`,
    client.householdName ? `Household: ${client.householdName}` : null,
    client.clientType ? `Client type: ${client.clientType}` : null,
    client.riskProfile ? `Risk profile: ${client.riskProfile}` : null,
    client.liquidityNeeds ? `Liquidity needs: ${client.liquidityNeeds}` : null,
    client.timeHorizon ? `Time horizon: ${client.timeHorizon}` : null,
    client.objective ? `Objective: ${client.objective}` : null,
    client.notes ? `Notes: ${client.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderEmailHtml(input: {
  subject: string;
  body: string;
  clientName: string;
}) {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const safe = escapeHtml(paragraph).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px;color:#334155;line-height:1.7;font-size:15px;">${safe}</p>`;
    })
    .join("");

  return `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:760px;margin:0 auto;padding:32px 18px;">
      <div style="border-radius:28px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,.08);overflow:hidden;">
        <div style="padding:26px 28px;background:linear-gradient(135deg,#022c22,#065f46,#111827);">
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a7f3d0;font-weight:800;">
            Advisor Communication
          </div>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">
            ${escapeHtml(input.subject)}
          </h1>
          <div style="margin-top:12px;color:#a7f3d0;font-size:13px;">
            Prepared for ${escapeHtml(input.clientName)}
          </div>
        </div>

        <div style="padding:28px;">
          ${paragraphs}

          <div style="margin-top:24px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a3412;font-weight:800;">
              Important note
            </div>
            <p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.6;">
              This message is intended for informational advisor-client communication. It is not a guarantee, trade instruction, or standalone recommendation.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function fallbackDraft(input: {
  advisorName: string;
  clientName: string;
  topic: string;
  purpose: string;
  callToAction: string;
  holdingsSummary: string;
  researchContext?: string;
}) {
  const subject =
    input.topic.length > 80 ? "A brief update from your advisor" : `A brief update: ${input.topic}`;

  const contextLine = input.researchContext
    ? `I also reviewed the following context while preparing this note: ${input.researchContext}`
    : "";

  const body = [
    `Hello ${input.clientName},`,
    "",
    `I wanted to send a clear update regarding ${input.topic}.`,
    "",
    input.purpose
      ? `The purpose of this note is to ${input.purpose}.`
      : "The purpose of this note is to keep you informed in a calm, clear, and useful way.",
    "",
    contextLine,
    "",
    "The most important point is that we are monitoring the relevant information while keeping your broader financial plan in mind. Headlines and market conditions can move quickly, but any decision should be reviewed in the context of your goals, time horizon, risk tolerance, liquidity needs, and overall plan.",
    "",
    input.holdingsSummary ? "Relevant portfolio context we have on file:" : "",
    input.holdingsSummary,
    "",
    input.callToAction
      ? input.callToAction
      : "There is no immediate action required from you at this moment. We will continue reviewing the situation and will reach out if a specific conversation or portfolio decision becomes appropriate.",
    "",
    "Please feel free to reply with any questions. We want you to feel informed, comfortable, and confident in the process.",
    "",
    "Best,",
    input.advisorName,
  ]
    .filter((line) => line !== "")
    .join("\n\n");

  return { subject, body };
}

function compactEmailPrompt(input: {
  advisorName: string;
  advisorEmail: string;
  clientName: string;
  topic: string;
  purpose: string;
  callToAction: string;
  tone: string;
  advisorInstructions: string;
  clientContext: string;
  holdingsSummary: string;
  researchContext: string;
  draftDepth: string;
}) {
  return JSON.stringify(
    {
      task: "Create one original advisor-client email draft. Do not use a template. Return strict JSON only.",
      output: {
        subject: "string",
        body: "string",
        strategy: "string",
        researchSummary: "string",
        sourceNotes: ["string"],
        complianceNotes: ["string"],
      },
      advisor: {
        name: input.advisorName,
        email: input.advisorEmail,
      },
      client: {
        name: input.clientName,
        context: input.clientContext,
        holdings: input.holdingsSummary,
      },
      request: {
        topic: input.topic,
        purpose: input.purpose,
        tone: input.tone,
        depth: input.draftDepth,
        instructions: input.advisorInstructions,
        researchContext: input.researchContext,
        callToAction: input.callToAction,
      },
      rules: [
        "Write from scratch in a polished advisor voice.",
        "Use plain English and keep the body concise, normally 180-350 words unless the requested depth requires more.",
        "Do not guarantee outcomes.",
        "Do not promise performance.",
        "Do not give tax or legal advice as a final conclusion.",
        "Do not instruct buy, sell, hold, rebalance, allocate, or liquidate unless the advisor explicitly supplied approved recommendation language.",
        "Do not invent client facts, performance figures, product details, testimonials, or unsupported statistics.",
        "Include advisor review/compliance notes.",
      ],
    },
    null,
    2
  );
}

async function draftEmailWithAi(input: {
  advisorName: string;
  advisorEmail: string;
  clientName: string;
  topic: string;
  purpose: string;
  callToAction: string;
  tone: string;
  advisorInstructions: string;
  clientContext: string;
  holdingsSummary: string;
  researchContext: string;
  draftDepth: string;
  useOpenAiResearch: boolean;
  fallbackSubject: string;
  fallbackBody: string;
}) {
  const useResearchMode = input.useOpenAiResearch === true;
  const model = emailAiModel(useResearchMode);
  const timeoutMs = emailAiTimeoutMs(useResearchMode);

  const ai = await generateAiText({
    safetyIdentifier: input.advisorEmail,
    speedMode: useResearchMode ? "quality" : "fast",
    model,
    timeoutMs,
    useCache: false,
    enableWebSearch: useResearchMode,
    instructions: `
You are a senior wealth-management communications strategist. Create concise, polished, original advisor-client emails. Return only strict JSON. Never use templates. Never provide unsupported recommendations, guarantees, or performance promises.
`,
    prompt: compactEmailPrompt(input),
    fallbackText: JSON.stringify({
      subject: input.fallbackSubject,
      body: input.fallbackBody,
      strategy:
        `Fallback draft used because OpenAI did not complete within ${timeoutMs}ms or returned an invalid response.`,
      researchSummary:
        "OpenAI did not complete for this request. Advisor should verify any facts and source context before sending.",
      sourceNotes: [
        `Model attempted: ${model}.`,
        `Timeout limit used: ${timeoutMs}ms.`,
        "Advisor should verify facts and source context before sending.",
      ],
      complianceNotes: [
        "Advisor review required before sending.",
        "No performance guarantee included.",
        "No trade instruction included.",
      ],
    }),
  });

  const parsed = parseAiJson<{
    subject?: string;
    body?: string;
    strategy?: string;
    researchSummary?: string;
    sourceNotes?: string[];
    complianceNotes?: string[];
  }>(ai.text || "", {
    subject: input.fallbackSubject,
    body: input.fallbackBody,
    strategy:
      "Fallback draft used because AI was unavailable or returned non-JSON output.",
    researchSummary:
      "AI research synthesis was unavailable. Advisor should confirm any facts before sending.",
    sourceNotes: [
      `Model attempted: ${model}.`,
      `Status: ${ai.status}.`,
      ai.error ? `Error: ${ai.error}` : "No source package generated.",
    ].filter(Boolean),
    complianceNotes: [
      "Advisor review required before sending.",
      "No performance guarantee included.",
      "No trading instruction included.",
    ],
  });

  return {
    subject: cleanText(parsed.subject, input.fallbackSubject),
    body: cleanMultiline(parsed.body, input.fallbackBody),
    strategy: cleanMultiline(parsed.strategy, "Original advisor email draft prepared for review."),
    researchSummary: cleanMultiline(
      parsed.researchSummary,
      "Research synthesis unavailable. Advisor should confirm any facts before sending."
    ),
    sourceNotes: Array.isArray(parsed.sourceNotes)
      ? parsed.sourceNotes.map((item) => cleanText(item)).filter(Boolean)
      : [],
    complianceNotes: Array.isArray(parsed.complianceNotes)
      ? parsed.complianceNotes.map((item) => cleanText(item)).filter(Boolean)
      : [
          "Advisor review required before sending.",
          "No performance guarantee included.",
          "No trading instruction included.",
        ],
    aiPolished: ai.ok,
    aiProvider: ai.provider,
    aiStatus: ai.status,
    aiError: ai.error ?? null,
    aiModel: ai.model ?? model,
    aiLatencyMs: ai.latencyMs ?? null,
    aiTimeoutMs: timeoutMs,
  };
}

async function getTargetClients(input: {
  userId: string;
  clientIds?: string[];
  includeAllClients?: boolean;
}) {
  if (!input.includeAllClients && !input.clientIds?.length) {
    return [];
  }

  const where =
    input.includeAllClients
      ? {
          userId: input.userId,
          status: {
            not: "Archived",
          },
        }
      : {
          userId: input.userId,
          id: {
            in: input.clientIds ?? [],
          },
          status: {
            not: "Archived",
          },
        };

  const rawClients = await prisma.clientProfile.findMany({
    where,
    include: {
      holdings: true,
      notesList: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { fullName: "asc" },
  });

  return decryptClientProfiles(rawClients);
}

function publicDraft(draft: any) {
  return {
    ...draft,
    title: decryptSensitiveText(draft.title),
    body: decryptSensitiveText(draft.body),
    sourceSummary: parseJson<Record<string, unknown>>(draft.sourceSummaryJson, {}),
    complianceNotes: parseJson<string[]>(draft.complianceNotesJson, []),
  };
}

export async function listClientEmailCenter(user: CurrentUserShape) {
  const [rawClients, drafts, approvals] = await Promise.all([
    prisma.clientProfile.findMany({
      where: {
        userId: user.id,
        status: {
          not: "Archived",
        },
      },
      include: {
        holdings: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.clientCommunicationDraft.findMany({
      where: {
        userId: user.id,
        channel: "Email",
      },
      orderBy: { updatedAt: "desc" },
      take: 150,
    }),
    prisma.backendApprovalItem.findMany({
      where: {
        userId: user.id,
        actionType: "Client Email Draft",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const clients = decryptClientProfiles(rawClients).map((client) => ({
    id: client.id,
    fullName: client.fullName,
    householdName: client.householdName,
    email: client.email ? decryptSensitiveText(client.email) : null,
    emailMissing: !client.email,
    clientType: client.clientType,
    riskProfile: client.riskProfile,
    status: client.status,
    holdings: Array.isArray(client.holdings)
      ? client.holdings.map((holding: any) => ({
          id: holding.id,
          symbol: holding.symbol,
          assetName: holding.assetName,
          assetClass: holding.assetClass,
          value: holding.value,
          allocationPct: holding.allocationPct,
          riskLevel: holding.riskLevel,
        }))
      : [],
  }));

  const publicDrafts = drafts.map(publicDraft);
  const activeDrafts = publicDrafts.filter((draft) => draft.status !== "Archived");
  const archivedDrafts = publicDrafts.filter((draft) => draft.status === "Archived");

  return {
    clients,
    metrics: {
      clientCount: clients.length,
      clientsWithEmail: clients.filter((client) => client.email).length,
      clientsMissingEmail: clients.filter((client) => !client.email).length,
      draftCount: activeDrafts.length,
      archivedDraftCount: archivedDrafts.length,
      pendingApprovalCount: approvals.filter((approval) => approval.status === "Pending").length,
      sentCount: publicDrafts.filter(
        (draft) => draft.status === "Sent" || draft.status === "Simulated"
      ).length,
    },
    drafts: activeDrafts,
    archivedDrafts,
    approvals: approvals.map((approval) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
  };
}

async function createScratchAiDraft(input: {
  user: CurrentUserShape;
  firmId: string | null;
  topic: string;
  purpose: string;
  tone: string;
  advisorInstructions: string;
  callToAction: string;
  researchContext: string;
  draftDepth: string;
  useOpenAiResearch: boolean;
  queueForApproval: boolean;
}) {
  const fallback = fallbackDraft({
    advisorName: input.user.name,
    clientName: "Client",
    topic: input.topic,
    purpose: input.purpose,
    callToAction: input.callToAction,
    holdingsSummary: "",
    researchContext: input.researchContext,
  });

  const aiDraft = await draftEmailWithAi({
    advisorName: input.user.name,
    advisorEmail: input.user.email,
    clientName: "Client",
    topic: input.topic,
    purpose: input.purpose,
    callToAction: input.callToAction,
    tone: input.tone,
    advisorInstructions: input.advisorInstructions,
    clientContext:
      "This is a scratch email draft. No specific client is assigned yet. Write it so the advisor can quickly adapt it for one or more recipients.",
    holdingsSummary: "No specific holdings attached because this is a scratch draft.",
    researchContext: input.researchContext,
    draftDepth: input.draftDepth,
    useOpenAiResearch: input.useOpenAiResearch,
    fallbackSubject: fallback.subject,
    fallbackBody: fallback.body,
  });

  const metadata = {
    scratchDraft: true,
    clientId: null,
    clientName: "Unassigned",
    topic: input.topic,
    purpose: input.purpose,
    tone: input.tone,
    advisorInstructions: input.advisorInstructions,
    callToAction: input.callToAction,
    researchContext: input.researchContext,
    draftDepth: input.draftDepth,
    useOpenAiResearch: input.useOpenAiResearch,
    ai: {
      polished: aiDraft.aiPolished,
      provider: aiDraft.aiProvider,
      status: aiDraft.aiStatus,
      error: aiDraft.aiError,
      strategy: aiDraft.strategy,
      researchSummary: aiDraft.researchSummary,
      sourceNotes: aiDraft.sourceNotes,
      model: aiDraft.aiModel,
      latencyMs: aiDraft.aiLatencyMs,
      timeoutMs: aiDraft.aiTimeoutMs,
    },
    createdBy: input.user.email,
    createdAt: new Date().toISOString(),
    editable: true,
    editHistory: [],
  };

  const draft = await prisma.clientCommunicationDraft.create({
    data: {
      userId: input.user.id,
      firmId: input.firmId,
      clientName: "Scratch Draft",
      channel: "Email",
      audience: "Advisor Draft",
      title: encryptSensitiveText(aiDraft.subject) ?? aiDraft.subject,
      body: encryptSensitiveText(aiDraft.body) ?? aiDraft.body,
      sourceSummaryJson: asJson(metadata),
      complianceNotesJson: asJson(
        Array.from(
          new Set([
            "Scratch draft. Assign or adapt to a client before sending.",
            "Advisor review is required before sending.",
            "No performance outcome is promised.",
            "No standalone buy/sell instruction is included.",
            ...aiDraft.complianceNotes,
          ])
        )
      ),
      status: input.queueForApproval ? "Needs Advisor Approval" : "Draft",
      tone: input.tone,
    },
  });

  return {
    id: draft.id,
    clientId: null,
    clientName: "Scratch Draft",
    email: null,
    subject: aiDraft.subject,
    body: aiDraft.body,
    status: draft.status,
    aiPolished: aiDraft.aiPolished,
    aiProvider: aiDraft.aiProvider,
    aiStatus: aiDraft.aiStatus,
    aiError: aiDraft.aiError,
  };
}

export async function createAiClientEmailDrafts(input: CreateAiDraftInput) {
  const firmId = await resolveFirmId(input.user.id);
  const clientIds = normaliseClientIds(input.clientIds);
  const topic = cleanText(input.topic);

  if (!topic) {
    throw new Error("Email topic or prompt is required.");
  }

  const purpose = cleanText(input.purpose, "keep the client informed and reassured");
  const tone = cleanText(
    input.tone,
    "Professional, calm, polished, and reassuring"
  );
  const advisorInstructions = cleanMultiline(input.advisorInstructions);
  const callToAction = cleanMultiline(input.callToAction);
  const researchContext = cleanMultiline(input.researchContext);
  const draftDepth = cleanText(input.draftDepth, "Concise advisor email draft");
  const useOpenAiResearch = input.useOpenAiResearch === true;
  const queueForApproval = input.queueForApproval === true;

  const clients = await getTargetClients({
    userId: input.user.id,
    clientIds,
    includeAllClients: input.includeAllClients,
  });

  const eligibleClients = clients.filter((client) => Boolean(client.email));
  const skippedMissingEmail = clients.length - eligibleClients.length;

  if (!clients.length && !input.includeAllClients && !clientIds.length) {
    const scratchDraft = await createScratchAiDraft({
      user: input.user,
      firmId,
      topic,
      purpose,
      tone,
      advisorInstructions,
      callToAction,
      researchContext,
      draftDepth,
      useOpenAiResearch,
      queueForApproval: false,
    });

    await recordSecurityEvent({
      userId: input.user.id,
      eventType: "client_email.scratch_ai_draft_created",
      severity: "Low",
      area: "Client Communication",
      title: "OpenAI scratch email draft created",
      detail:
        "An AI scratch email draft was created without assigned recipients.",
      metadata: {
        draftId: scratchDraft.id,
        topic,
        draftDepth,
        useOpenAiResearch,
        openAiStatus: scratchDraft.aiStatus,
        openAiProvider: scratchDraft.aiProvider,
        openAiError: scratchDraft.aiError,
      },
    });

    return {
      created: 1,
      skippedMissingEmail: 0,
      approval: null,
      drafts: [scratchDraft],
      message: scratchDraft.aiPolished
        ? "1 original OpenAI email draft created."
        : `1 scratch draft created using fallback. OpenAI did not complete for this request. Status: ${scratchDraft.aiStatus}. Provider: ${scratchDraft.aiProvider}.`,
    };
  }

  if (!eligibleClients.length) {
    return {
      created: 0,
      skippedMissingEmail,
      approval: null,
      drafts: [],
      message:
        clients.length > 0
          ? "Clients were found, but none had usable email addresses."
          : "No target clients were found.",
    };
  }

  const drafts = [];

  for (const client of eligibleClients) {
    const holdings = Array.isArray(client.holdings) ? client.holdings : [];
    const summary = holdingSummary(holdings);
    const clientContext = riskAndClientContext(client);

    const fallback = fallbackDraft({
      advisorName: input.user.name,
      clientName: client.fullName,
      topic,
      purpose,
      callToAction,
      holdingsSummary: summary,
      researchContext,
    });

    const aiDraft = await draftEmailWithAi({
      advisorName: input.user.name,
      advisorEmail: input.user.email,
      clientName: client.fullName,
      topic,
      purpose,
      callToAction,
      tone,
      advisorInstructions,
      clientContext,
      holdingsSummary: summary,
      researchContext,
      draftDepth,
      useOpenAiResearch,
      fallbackSubject: fallback.subject,
      fallbackBody: fallback.body,
    });

    const metadata = {
      scratchDraft: false,
      clientId: client.id,
      clientName: client.fullName,
      topic,
      purpose,
      tone,
      advisorInstructions,
      callToAction,
      researchContext,
      draftDepth,
      useOpenAiResearch,
      clientContext,
      holdings: holdings.map((holding: any) => ({
        symbol: holding.symbol,
        assetName: holding.assetName,
        assetClass: holding.assetClass,
        value: holding.value,
        allocationPct: holding.allocationPct,
        riskLevel: holding.riskLevel,
      })),
      ai: {
        polished: aiDraft.aiPolished,
        provider: aiDraft.aiProvider,
        status: aiDraft.aiStatus,
        error: aiDraft.aiError,
        strategy: aiDraft.strategy,
        researchSummary: aiDraft.researchSummary,
        sourceNotes: aiDraft.sourceNotes,
        model: aiDraft.aiModel,
        latencyMs: aiDraft.aiLatencyMs,
        timeoutMs: aiDraft.aiTimeoutMs,
      },
      createdBy: input.user.email,
      createdAt: new Date().toISOString(),
      editable: true,
      editHistory: [],
    };

    const complianceNotes = [
      "Advisor approval is required before sending.",
      "Email was generated for informational client communication.",
      "No performance outcome is promised.",
      "No standalone buy/sell instruction is included.",
      "Advisor should verify client suitability, context, and any cited facts before delivery.",
      "Draft may be manually edited before approval.",
      ...aiDraft.complianceNotes,
    ];

    const draft = await prisma.clientCommunicationDraft.create({
      data: {
        userId: input.user.id,
        firmId,
        clientName: client.fullName,
        channel: "Email",
        audience: "Wealth Management Client",
        title: encryptSensitiveText(aiDraft.subject) ?? aiDraft.subject,
        body: encryptSensitiveText(aiDraft.body) ?? aiDraft.body,
        sourceSummaryJson: asJson(metadata),
        complianceNotesJson: asJson(Array.from(new Set(complianceNotes))),
        status: queueForApproval ? "Needs Advisor Approval" : "Draft",
        tone,
      },
    });

    drafts.push({
      id: draft.id,
      clientId: client.id,
      clientName: client.fullName,
      email: decryptSensitiveText(client.email),
      subject: aiDraft.subject,
      body: aiDraft.body,
      status: draft.status,
      aiPolished: aiDraft.aiPolished,
      aiProvider: aiDraft.aiProvider,
      aiStatus: aiDraft.aiStatus,
      aiError: aiDraft.aiError,
    });
  }

  let approval = null;

  if (queueForApproval) {
    approval = await createApprovalForDrafts({
      user: input.user,
      firmId,
      draftIds: drafts.map((draft) => draft.id),
      title: `Approve OpenAI client email drafts: ${topic}`,
      summary: `${drafts.length} client email draft(s) are ready for advisor approval and sending.`,
      metadata: {
        topic,
        purpose,
        tone,
        draftDepth,
        useOpenAiResearch,
        createdAt: new Date().toISOString(),
      },
    });
  }

  await recordSecurityEvent({
    userId: input.user.id,
    eventType: "client_email.openai_drafts_created",
    severity: "Medium",
    area: "Client Communication",
    title: "OpenAI client email drafts created",
    detail: `${drafts.length} AI client email draft(s) created.`,
    metadata: {
      draftIds: drafts.map((draft) => draft.id),
      approvalId: approval?.id ?? null,
      topic,
      draftDepth,
      useOpenAiResearch,
      clientCount: drafts.length,
      skippedMissingEmail,
      aiStatuses: drafts.map((draft) => ({
        draftId: draft.id,
        clientName: draft.clientName,
        aiStatus: draft.aiStatus,
        aiProvider: draft.aiProvider,
        aiError: draft.aiError,
      })),
    },
  });

  return {
    created: drafts.length,
    skippedMissingEmail,
    approval,
    drafts,
    message: `${drafts.length} AI client email draft(s) created${
      queueForApproval ? " and queued for advisor approval" : ""
    }.`,
  };
}

export async function createManualClientEmailDrafts(input: CreateManualDraftInput) {
  const firmId = await resolveFirmId(input.user.id);
  const clientIds = normaliseClientIds(input.clientIds);
  const subject = cleanText(input.subject);
  const body = cleanMultiline(input.body);
  const tone = cleanText(input.tone, "Professional");
  const queueForApproval = input.queueForApproval === true;

  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Body is required.");

  if (!clientIds.length) {
    const draft = await prisma.clientCommunicationDraft.create({
      data: {
        userId: input.user.id,
        firmId,
        clientName: "Scratch Draft",
        channel: "Email",
        audience: "Advisor Draft",
        title: encryptSensitiveText(subject) ?? subject,
        body: encryptSensitiveText(body) ?? body,
        sourceSummaryJson: asJson({
          scratchDraft: true,
          clientId: null,
          clientName: "Unassigned",
          manualDraft: true,
          editable: true,
          editHistory: [],
          createdBy: input.user.email,
          createdAt: new Date().toISOString(),
        }),
        complianceNotesJson: asJson([
          "Scratch draft. Assign or adapt to a client before sending.",
          "Manual draft should be reviewed for grammar, suitability, and accuracy.",
        ]),
        status: "Draft",
        tone,
      },
    });

    return {
      created: 1,
      skippedMissingEmail: 0,
      approval: null,
      drafts: [
        {
          id: draft.id,
          clientId: null,
          clientName: "Scratch Draft",
          email: null,
          subject,
          body,
          status: draft.status,
        },
      ],
      message: "1 manual scratch email draft created.",
    };
  }

  const clients = await getTargetClients({
    userId: input.user.id,
    clientIds,
  });

  const eligibleClients = clients.filter((client) => Boolean(client.email));
  const drafts = [];

  for (const client of eligibleClients) {
    const draft = await prisma.clientCommunicationDraft.create({
      data: {
        userId: input.user.id,
        firmId,
        clientName: client.fullName,
        channel: "Email",
        audience: "Wealth Management Client",
        title: encryptSensitiveText(subject) ?? subject,
        body: encryptSensitiveText(body) ?? body,
        sourceSummaryJson: asJson({
          scratchDraft: false,
          clientId: client.id,
          clientName: client.fullName,
          manualDraft: true,
          editable: true,
          editHistory: [],
          createdBy: input.user.email,
          createdAt: new Date().toISOString(),
        }),
        complianceNotesJson: asJson([
          "Advisor approval is required before sending.",
          "Manual draft should be reviewed for grammar, suitability, and accuracy.",
          "Draft may be manually edited before approval.",
        ]),
        status: queueForApproval ? "Needs Advisor Approval" : "Draft",
        tone,
      },
    });

    drafts.push({
      id: draft.id,
      clientId: client.id,
      clientName: client.fullName,
      email: decryptSensitiveText(client.email),
      subject,
      body,
      status: draft.status,
    });
  }

  let approval = null;

  if (queueForApproval && drafts.length) {
    approval = await createApprovalForDrafts({
      user: input.user,
      firmId,
      draftIds: drafts.map((draft) => draft.id),
      title: `Approve client email drafts: ${subject}`,
      summary: `${drafts.length} client email draft(s) are ready for advisor approval and sending.`,
      metadata: {
        manualDraft: true,
        subject,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    created: drafts.length,
    skippedMissingEmail: clients.length - eligibleClients.length,
    approval,
    drafts,
    message: `${drafts.length} manual client email draft(s) created.`,
  };
}

async function createApprovalForDrafts(input: {
  user: CurrentUserShape;
  firmId: string | null;
  draftIds: string[];
  title: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.backendApprovalItem.create({
    data: {
      userId: input.user.id,
      firmId: input.firmId,
      title: input.title,
      actionType: "Client Email Draft",
      riskLevel: "Medium",
      summary: input.summary,
      payloadJson: asJson({
        draftIds: input.draftIds,
        ...(input.metadata ?? {}),
      }),
      requestedBy: input.user.email,
      status: "Pending",
    },
  });
}

export async function updateClientEmailDraft(input: UpdateDraftInput) {
  const draftId = cleanText(input.draftId);
  const subject = cleanText(input.subject);
  const body = cleanMultiline(input.body);
  const status = normaliseDraftStatus(input.status);

  if (!draftId) throw new Error("draftId is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Body is required.");

  const existing = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: draftId,
      userId: input.user.id,
      channel: "Email",
    },
  });

  if (!existing) throw new Error("Draft was not found.");

  if (existing.status === "Sent" || existing.status === "Simulated") {
    throw new Error("Sent drafts cannot be edited.");
  }

  const metadata = parseJson<Record<string, any>>(existing.sourceSummaryJson, {});
  const editHistory = Array.isArray(metadata.editHistory) ? metadata.editHistory : [];

  const updatedMetadata = {
    ...metadata,
    editable: true,
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: input.user.email,
    editHistory: [
      ...editHistory,
      {
        editedAt: new Date().toISOString(),
        editedBy: input.user.email,
        editType: "Manual edit",
      },
    ].slice(-30),
  };

  const updated = await prisma.clientCommunicationDraft.update({
    where: { id: existing.id },
    data: {
      title: encryptSensitiveText(subject) ?? subject,
      body: encryptSensitiveText(body) ?? body,
      status,
      sourceSummaryJson: asJson(updatedMetadata),
    },
  });

  return {
    draft: publicDraft(updated),
    message: "Draft updated.",
  };
}

export async function polishExistingClientEmailDraft(input: PolishDraftInput) {
  const draftId = cleanText(input.draftId);
  const polishMode = cleanText(input.polishMode, "Professional polish");
  const advisorInstructions = cleanMultiline(input.advisorInstructions);

  if (!draftId) throw new Error("draftId is required.");

  const existing = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: draftId,
      userId: input.user.id,
      channel: "Email",
    },
  });

  if (!existing) throw new Error("Draft was not found.");

  if (existing.status === "Sent" || existing.status === "Simulated") {
    throw new Error("Sent drafts cannot be polished.");
  }

  const currentSubject = decryptSensitiveText(existing.title) || "";
  const currentBody = decryptSensitiveText(existing.body) || "";
  const metadata = parseJson<Record<string, any>>(existing.sourceSummaryJson, {});
  const editHistory = Array.isArray(metadata.editHistory) ? metadata.editHistory : [];

  const ai = await generateAiText({
    safetyIdentifier: input.user.email,
    speedMode: "fast",
    model: process.env.OPENAI_EMAIL_MODEL || process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    timeoutMs: emailAiTimeoutMs(false),
    useCache: false,
    instructions: `
You are a senior wealth-management communications editor. Return only valid JSON with exactly these keys: "subject", "body", "strategy", "complianceNotes". Improve grammar, clarity, tone, and compliance safety. Do not add new facts.
`,
    prompt: JSON.stringify(
      {
        polishMode,
        advisorInstructions,
        currentDraft: {
          subject: currentSubject,
          body: currentBody,
        },
        draftMetadata: metadata,
      },
      null,
      2
    ),
    fallbackText: JSON.stringify({
      subject: currentSubject,
      body: currentBody,
      strategy: "AI polish unavailable. Existing draft preserved.",
      complianceNotes: [
        "Advisor review required before sending.",
        "No guarantee included.",
      ],
    }),
  });

  const parsed = parseAiJson<{
    subject?: string;
    body?: string;
    strategy?: string;
    complianceNotes?: string[];
  }>(ai.text || "", {
    subject: currentSubject,
    body: currentBody,
    strategy: "AI polish unavailable. Existing draft preserved.",
    complianceNotes: [
      "Advisor review required before sending.",
      "No guarantee included.",
    ],
  });

  const nextSubject = cleanText(parsed.subject, currentSubject);
  const nextBody = cleanMultiline(parsed.body, currentBody);

  const updatedMetadata = {
    ...metadata,
    editable: true,
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: input.user.email,
    aiPolish: {
      mode: polishMode,
      provider: ai.provider,
      status: ai.status,
      error: ai.error ?? null,
      strategy: cleanMultiline(parsed.strategy),
      polishedAt: new Date().toISOString(),
    },
    editHistory: [
      ...editHistory,
      {
        editedAt: new Date().toISOString(),
        editedBy: input.user.email,
        editType: `AI polish: ${polishMode}`,
      },
    ].slice(-30),
  };

  const updated = await prisma.clientCommunicationDraft.update({
    where: { id: existing.id },
    data: {
      title: encryptSensitiveText(nextSubject) ?? nextSubject,
      body: encryptSensitiveText(nextBody) ?? nextBody,
      status: existing.status === "Draft" ? "Edited" : existing.status,
      sourceSummaryJson: asJson(updatedMetadata),
      complianceNotesJson: asJson(
        Array.from(
          new Set([
            ...parseJson<string[]>(existing.complianceNotesJson, []),
            ...(Array.isArray(parsed.complianceNotes)
              ? parsed.complianceNotes.map((item) => cleanText(item)).filter(Boolean)
              : []),
          ])
        )
      ),
    },
  });

  return {
    draft: publicDraft(updated),
    ai: {
      ok: ai.ok,
      provider: ai.provider,
      status: ai.status,
      error: ai.error ?? null,
    },
    message: ai.ok ? "Draft polished with AI." : "AI polish unavailable. Existing draft preserved.",
  };
}

export async function queueClientEmailDraftsForApproval(input: QueueDraftsInput) {
  const draftIds = normaliseDraftIds(input.draftIds);

  if (!draftIds.length) {
    throw new Error("At least one draft is required.");
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      userId: input.user.id,
      id: {
        in: draftIds,
      },
      channel: "Email",
    },
  });

  const eligibleDrafts = drafts.filter(
    (draft) =>
      draft.status !== "Sent" &&
      draft.status !== "Simulated" &&
      draft.status !== "Archived"
  );

  if (!eligibleDrafts.length) {
    throw new Error("No editable drafts were found to queue for approval.");
  }

  const firmId = await resolveFirmId(input.user.id);

  const approval = await createApprovalForDrafts({
    user: input.user,
    firmId,
    draftIds: eligibleDrafts.map((draft) => draft.id),
    title: cleanText(input.approvalTitle, "Approve selected client email drafts"),
    summary: `${eligibleDrafts.length} selected client email draft(s) are ready for advisor approval and sending.`,
    metadata: {
      selectedDraftApproval: true,
      createdAt: new Date().toISOString(),
    },
  });

  await prisma.clientCommunicationDraft.updateMany({
    where: {
      id: {
        in: eligibleDrafts.map((draft) => draft.id),
      },
      userId: input.user.id,
    },
    data: {
      status: "Needs Advisor Approval",
    },
  });

  return {
    approval,
    queued: eligibleDrafts.length,
    message: `${eligibleDrafts.length} draft(s) queued for advisor approval.`,
  };
}

export async function archiveClientEmailDrafts(input: ArchiveDraftsInput) {
  const draftIds = normaliseDraftIds(input.draftIds);

  if (!draftIds.length) throw new Error("At least one draft is required.");

  const nextStatus = input.restore ? "Draft" : "Archived";

  const result = await prisma.clientCommunicationDraft.updateMany({
    where: {
      userId: input.user.id,
      id: {
        in: draftIds,
      },
      channel: "Email",
      status: {
        notIn: ["Sent", "Simulated"],
      },
    },
    data: {
      status: nextStatus,
    },
  });

  return {
    updated: result.count,
    message: `${result.count} draft(s) ${input.restore ? "restored" : "archived"}.`,
  };
}

export async function sendApprovedClientEmailDrafts(input: SendApprovedDraftsInput) {
  const approval = await prisma.backendApprovalItem.findFirst({
    where: {
      id: input.approvalId,
      userId: input.user.id,
      actionType: "Client Email Draft",
    },
  });

  if (!approval) {
    throw new Error("Approval item was not found.");
  }

  if (approval.status !== "Pending") {
    throw new Error(`This approval is already ${approval.status}.`);
  }

  const payload = parseJson<{ draftIds?: string[] }>(approval.payloadJson, {});
  const draftIds = Array.isArray(payload.draftIds)
    ? payload.draftIds.filter(Boolean)
    : [];

  if (!draftIds.length) {
    throw new Error("Approval item does not contain draft IDs.");
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      userId: input.user.id,
      id: {
        in: draftIds,
      },
      status: {
        not: "Archived",
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let delivered = 0;
  let simulated = 0;
  let failed = 0;
  const results = [];

  for (const draft of drafts) {
    const metadata = parseJson<any>(draft.sourceSummaryJson, {});
    const clientId = metadata.clientId;

    if (!clientId) {
      failed += 1;

      await prisma.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: { status: "Delivery Failed" },
      });

      results.push({
        draftId: draft.id,
        clientName: draft.clientName,
        status: "Failed",
        reason: "Scratch drafts must be assigned or adapted to a client before sending.",
      });

      continue;
    }

    const rawClient = await prisma.clientProfile.findFirst({
      where: {
        id: clientId,
        userId: input.user.id,
      },
    });

    if (!rawClient) {
      failed += 1;

      await prisma.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: { status: "Delivery Failed" },
      });

      results.push({
        draftId: draft.id,
        status: "Failed",
        reason: "Client record was not found.",
      });

      continue;
    }

    const client = decryptClientProfile(rawClient);
    const clientEmail = client.email ? decryptSensitiveText(client.email) : null;

    if (!clientEmail) {
      failed += 1;

      await prisma.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: { status: "Delivery Failed" },
      });

      results.push({
        draftId: draft.id,
        clientName: draft.clientName,
        status: "Failed",
        reason: "Client email is missing.",
      });

      continue;
    }

    const subject = decryptSensitiveText(draft.title) || "Advisor update";
    const body = decryptSensitiveText(draft.body) || "";
    const html = renderEmailHtml({
      subject,
      body,
      clientName: draft.clientName || client.fullName,
    });

    const result = await sendEmail({
      to: clientEmail,
      subject,
      text: body,
      html,
      idempotencyKey: `client-email-draft-${draft.id}`,
    });

    await prisma.notificationDelivery.create({
      data: {
        userId: input.user.id,
        alertEventId: null,
        channel: "Email",
        destination: clientEmail,
        status: result.ok
          ? result.status === "sent"
            ? "Delivered"
            : "Simulated"
          : "Failed",
        urgency: "Medium",
        score: 75,
        title: subject,
        body,
        reason: result.ok
          ? `Advisor-approved client email ${result.status} via ${result.provider}.`
          : result.error ?? "Email delivery failed.",
        simulated: result.status !== "sent",
        deliveredAt: result.ok ? new Date() : null,
      },
    });

    await prisma.clientCommunicationDraft.update({
      where: { id: draft.id },
      data: {
        status: result.ok
          ? result.status === "sent"
            ? "Sent"
            : "Simulated"
          : "Delivery Failed",
      },
    });

    if (result.ok && result.status === "sent") delivered += 1;
    else if (result.ok) simulated += 1;
    else failed += 1;

    results.push({
      draftId: draft.id,
      clientName: draft.clientName,
      status: result.status,
      provider: result.provider,
      error: result.error ?? null,
      diagnostics: result.diagnostics ?? null,
    });
  }

  await prisma.backendApprovalItem.update({
    where: { id: approval.id },
    data: {
      status: failed > 0 && delivered + simulated === 0 ? "Failed" : "Approved",
      approvedBy: input.user.email,
      approvalNotes: cleanText(input.approvalNotes),
      decidedAt: new Date(),
    },
  });

  await recordSecurityEvent({
    userId: input.user.id,
    eventType: "client_email.approved_and_sent",
    severity: "Medium",
    area: "Client Communication",
    title: "Client email approval processed",
    detail: `Advisor approved and processed ${drafts.length} client email draft(s).`,
    metadata: {
      approvalId: approval.id,
      delivered,
      simulated,
      failed,
      draftIds,
      results,
    },
  });

  return {
    approvalId: approval.id,
    delivered,
    simulated,
    failed,
    results,
  };
}