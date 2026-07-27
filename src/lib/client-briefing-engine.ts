import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/integrations/email";
import { generateAiText } from "@/lib/integrations/ai";
import {
  decryptClientProfile,
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import { recordSecurityEvent } from "@/lib/security";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

type CreateBriefingInput = {
  user: CurrentUserShape;
  symbols: string[];
  holdingQuery?: string | null;
  briefingTitle?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  researchSummary?: string | null;
  advisorMessage?: string | null;
  tone?: string | null;
  includeAllMatchingClients?: boolean;
};

type SendApprovedInput = {
  user: CurrentUserShape;
  approvalId: string;
  approvalNotes?: string | null;
};

type SourceEvidence = {
  type: string;
  title: string;
  sourceName: string;
  sourceUrl: string | null;
  score: number;
  summary: string;
};

type MatchedClient = {
  client: any;
  holdings: any[];
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

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function cleanUrl(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return null;

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    return url.toString();
  } catch {
    return null;
  }
}

function normaliseSymbols(symbols: unknown) {
  if (Array.isArray(symbols)) {
    return Array.from(
      new Set(
        symbols
          .map((item) =>
            String(item ?? "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9.-]/g, "")
          )
          .filter(Boolean)
      )
    ).slice(0, 20);
  }

  return Array.from(
    new Set(
      String(symbols ?? "")
        .split(/[,;\s]+/)
        .map((item) =>
          item
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9.-]/g, "")
        )
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceDomain(url: string | null) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function shortList(items: string[], fallback = "None") {
  return items.length ? items.join(", ") : fallback;
}

function investmentGradeFromEvidence(evidence: SourceEvidence[]) {
  const topScore = Math.max(0, ...evidence.map((item) => item.score));

  if (topScore >= 95) {
    return {
      grade: "A+",
      label: "Highest-priority advisor review",
      explanation:
        "The source-backed signal is highly material and should be reviewed promptly by the advisor.",
    };
  }

  if (topScore >= 88) {
    return {
      grade: "A",
      label: "Strong advisor review item",
      explanation:
        "The available source evidence is strong enough to justify a timely client-aware review.",
    };
  }

  if (topScore >= 78) {
    return {
      grade: "B+",
      label: "Meaningful client communication candidate",
      explanation:
        "The signal is relevant and may warrant a calm, professional client update.",
    };
  }

  if (topScore >= 65) {
    return {
      grade: "B",
      label: "Monitor and communicate selectively",
      explanation:
        "The signal is useful but should be framed carefully and not overstated.",
    };
  }

  return {
    grade: "Review",
    label: "Advisor context item",
    explanation:
      "The signal should be treated as context unless the advisor determines it is client-facing.",
  };
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

async function gatherSourceEvidence(input: {
  userId: string;
  symbols: string[];
  holdingQuery?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  researchSummary?: string | null;
}) {
  const manualEvidence: SourceEvidence[] = [];

  if (input.sourceTitle || input.sourceUrl || input.researchSummary) {
    manualEvidence.push({
      type: "Advisor Supplied Source",
      title: cleanText(input.sourceTitle, "Advisor supplied research source"),
      sourceName: cleanText(input.sourceName, sourceDomain(input.sourceUrl ?? null) ?? "Advisor supplied source"),
      sourceUrl: cleanUrl(input.sourceUrl),
      score: 85,
      summary: cleanText(
        input.researchSummary,
        "Advisor supplied research context for this client briefing."
      ),
    });
  }

  const symbolConditions = input.symbols.flatMap((symbol) => [
    { ticker: symbol },
    { title: { contains: symbol } },
    { body: { contains: symbol } },
    { aiBriefing: { contains: symbol } },
  ]);

  const headlineConditions = input.symbols.flatMap((symbol) => [
    { title: { contains: symbol } },
    { summary: { contains: symbol } },
    { matchedTickersJson: { contains: symbol } },
  ]);

  const opportunityConditions = input.symbols.flatMap((symbol) => [
    { title: { contains: symbol } },
    { summary: { contains: symbol } },
    { tickersJson: { contains: symbol } },
    { evidenceJson: { contains: symbol } },
  ]);

  const researchConditions = input.symbols.flatMap((symbol) => [
    { ticker: symbol },
    { title: { contains: symbol } },
    { thesis: { contains: symbol } },
    { risks: { contains: symbol } },
  ]);

  const [alerts, headlines, opportunities, researchNotes] = await Promise.all([
    symbolConditions.length
      ? prisma.alertEvent.findMany({
          where: {
            userId: input.userId,
            OR: symbolConditions,
          },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 8,
        })
      : [],
    headlineConditions.length
      ? prisma.headlineDecision.findMany({
          where: {
            userId: input.userId,
            OR: headlineConditions,
          },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 8,
        })
      : [],
    opportunityConditions.length
      ? prisma.opportunitySignal.findMany({
          where: {
            userId: input.userId,
            OR: opportunityConditions,
          },
          orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
          take: 8,
        })
      : [],
    researchConditions.length
      ? prisma.researchNote.findMany({
          where: {
            userId: input.userId,
            OR: researchConditions,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
  ]);

  const storedEvidence: SourceEvidence[] = [
    ...alerts.map((item) => ({
      type: "Slice Alert",
      title: item.title,
      sourceName: item.source,
      sourceUrl: item.sourceUrl,
      score: item.score,
      summary: item.aiBriefing || item.body,
    })),
    ...headlines.map((item) => ({
      type: "Headline Decision",
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: item.url,
      score: item.score,
      summary: item.summary || item.action,
    })),
    ...opportunities.map((item) => ({
      type: "Opportunity Signal",
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: null,
      score: item.compositeScore,
      summary: item.summary || item.suggestedAction,
    })),
    ...researchNotes.map((item) => ({
      type: "Internal Research",
      title: item.title,
      sourceName: "Internal Research",
      sourceUrl: item.sourceLinks || null,
      score: item.conviction === "High" ? 85 : item.conviction === "Medium" ? 70 : 55,
      summary: `${item.thesis}${item.risks ? ` Risks: ${item.risks}` : ""}`,
    })),
  ];

  return [...manualEvidence, ...storedEvidence]
    .filter((item) => item.title || item.summary)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

async function findMatchingClients(input: {
  userId: string;
  symbols: string[];
  holdingQuery?: string | null;
}) {
  const rawClients = await prisma.clientProfile.findMany({
    where: {
      userId: input.userId,
      status: {
        not: "Archived",
      },
    },
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
    orderBy: { createdAt: "desc" },
  });

  const clients = rawClients.map(decryptClientProfile);
  const query = cleanText(input.holdingQuery).toLowerCase();
  const symbols = input.symbols.map((symbol) => symbol.toUpperCase());

  const matched: MatchedClient[] = [];

  for (const client of clients) {
    const holdings = Array.isArray(client.holdings) ? client.holdings : [];

    const matchingHoldings = holdings.filter((holding: any) => {
      const symbol = String(holding.symbol ?? "").toUpperCase();
      const assetName = String(holding.assetName ?? "").toLowerCase();
      const assetClass = String(holding.assetClass ?? "").toLowerCase();

      const symbolMatch = symbols.length ? symbols.includes(symbol) : false;
      const queryMatch = query
        ? assetName.includes(query) ||
          symbol.toLowerCase().includes(query) ||
          assetClass.includes(query)
        : false;

      return symbolMatch || queryMatch;
    });

    if (matchingHoldings.length) {
      matched.push({
        client,
        holdings: matchingHoldings,
      });
    }
  }

  return matched;
}

function buildDeterministicBriefing(input: {
  advisorName: string;
  clientName: string;
  symbols: string[];
  holdings: any[];
  evidence: SourceEvidence[];
  researchSummary: string | null;
  advisorMessage: string | null;
  tone: string;
}) {
  const grade = investmentGradeFromEvidence(input.evidence);
  const holdingsText = input.holdings
    .map((holding) => {
      const value = holding.value ? `, approximate value ${holding.value}` : "";
      const allocation = holding.allocationPct ? `, allocation ${holding.allocationPct}` : "";
      return `${holding.symbol} (${holding.assetName || "holding"}${value}${allocation})`;
    })
    .join("; ");

  const evidenceText = input.evidence.length
    ? input.evidence
        .slice(0, 4)
        .map((item, index) => {
          const url = item.sourceUrl ? ` Source link: ${item.sourceUrl}` : "";
          return `${index + 1}. ${item.title} — ${item.sourceName}. ${item.summary}${url}`;
        })
        .join("\n")
    : "No external source was attached. This briefing should be reviewed by the advisor before sending.";

  const advisorMessage = input.advisorMessage
    ? `\n\nAdvisor note:\n${input.advisorMessage}`
    : "";

  const subject = `A calm update on your ${shortList(input.symbols, "portfolio")} holding`;

  const body = [
    `Hello ${input.clientName},`,
    "",
    `I wanted to send a quick, clear update regarding your exposure to ${shortList(input.symbols, "a current portfolio holding")}.`,
    "",
    "The most important point is this: we are monitoring the situation, reviewing the relevant source material, and keeping your broader plan in mind. Market headlines can move quickly, but a thoughtful response is almost always better than a rushed reaction.",
    "",
    "Your related holding exposure:",
    holdingsText || "Your account has a related holding that matched this briefing criteria.",
    "",
    "Research context:",
    evidenceText,
    "",
    `Internal investment grade for advisor review: ${grade.grade} — ${grade.label}.`,
    grade.explanation,
    "",
    "What this means for you:",
    "At this stage, this should be viewed as a monitoring and review item, not a reason to make an immediate decision without considering your full financial plan, risk tolerance, tax picture, and time horizon.",
    "",
    "Next step:",
    "We will continue reviewing the available information and will reach out if we believe a portfolio action should be discussed.",
    advisorMessage,
    "",
    "As always, this message is intended to keep you informed and comfortable with the process. Please feel free to reply with any questions.",
    "",
    `Best,`,
    input.advisorName,
  ].join("\n");

  return {
    subject,
    body,
  };
}

async function polishBriefingWithAi(input: {
  advisorName: string;
  clientName: string;
  symbols: string[];
  holdings: any[];
  evidence: SourceEvidence[];
  deterministicSubject: string;
  deterministicBody: string;
  tone: string;
}) {
  const ai = await generateAiText({
    safetyIdentifier: input.advisorName,
    instructions: `
You are an expert wealth-management communications editor.

Rewrite the provided email into a polished, reassuring, professional client briefing.

Strict requirements:
- Perfect grammar.
- Professional wealth-management tone.
- Calm and confidence-building.
- Never promise investment outcomes.
- Never say "buy", "sell", or "guaranteed".
- Make it clear the advisor is monitoring the situation.
- Include the source context in plain English.
- Keep the email client-friendly, not overly technical.
- Preserve the meaning and compliance safeguards.
- Return only JSON with keys "subject" and "body".
`,
    prompt: JSON.stringify(
      {
        advisorName: input.advisorName,
        clientName: input.clientName,
        symbols: input.symbols,
        holdings: input.holdings,
        evidence: input.evidence,
        tone: input.tone,
        draft: {
          subject: input.deterministicSubject,
          body: input.deterministicBody,
        },
      },
      null,
      2
    ),
  });

  if (!ai.ok || !ai.text) {
    return {
      subject: input.deterministicSubject,
      body: input.deterministicBody,
      aiProvider: ai.provider,
      aiStatus: ai.status,
      aiError: ai.error ?? null,
      aiPolished: false,
    };
  }

  try {
    const parsed = JSON.parse(ai.text) as {
      subject?: string;
      body?: string;
    };

    return {
      subject: cleanText(parsed.subject, input.deterministicSubject),
      body: cleanText(parsed.body, input.deterministicBody),
      aiProvider: ai.provider,
      aiStatus: ai.status,
      aiError: ai.error ?? null,
      aiPolished: true,
    };
  } catch {
    return {
      subject: input.deterministicSubject,
      body: ai.text,
      aiProvider: ai.provider,
      aiStatus: ai.status,
      aiError: null,
      aiPolished: true,
    };
  }
}

function renderEmailHtml(input: {
  subject: string;
  body: string;
  clientName: string;
  symbols: string[];
  evidence: SourceEvidence[];
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

  const evidenceList = input.evidence
    .slice(0, 5)
    .map(
      (item) => `
        <li style="margin-bottom:10px;color:#475569;line-height:1.55;">
          <strong>${escapeHtml(item.title)}</strong><br />
          ${escapeHtml(item.sourceName)} · Score ${item.score}/100
          ${item.sourceUrl ? `<br /><a href="${escapeHtml(item.sourceUrl)}" style="color:#059669;">Open source</a>` : ""}
        </li>
      `
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:760px;margin:0 auto;padding:32px 18px;">
      <div style="border-radius:28px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,.08);overflow:hidden;">
        <div style="padding:26px 28px;background:linear-gradient(135deg,#022c22,#065f46,#111827);">
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a7f3d0;font-weight:800;">
            Advisor Briefing
          </div>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">
            ${escapeHtml(input.subject)}
          </h1>
          <div style="margin-top:12px;color:#a7f3d0;font-size:13px;">
            Related holding${input.symbols.length === 1 ? "" : "s"}: ${escapeHtml(shortList(input.symbols))}
          </div>
        </div>

        <div style="padding:28px;">
          ${paragraphs}

          ${
            evidenceList
              ? `
              <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:20px;">
                <h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Source and research context</h2>
                <ul style="margin:0;padding-left:18px;">
                  ${evidenceList}
                </ul>
              </div>
            `
              : ""
          }

          <div style="margin-top:24px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a3412;font-weight:800;">
              Important note
            </div>
            <p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.6;">
              This briefing is for informational purposes and advisor-client communication. It is not a guarantee, trade instruction, or standalone recommendation.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

export async function createClientBriefingPack(input: CreateBriefingInput) {
  const firmId = await resolveFirmId(input.user.id);
  const symbols = normaliseSymbols(input.symbols);
  const holdingQuery = cleanText(input.holdingQuery);
  const sourceUrl = cleanUrl(input.sourceUrl);
  const researchSummary = cleanText(input.researchSummary);
  const advisorMessage = cleanText(input.advisorMessage);
  const tone = cleanText(input.tone, "Calm, polished, professional, and reassuring");

  if (!symbols.length && !holdingQuery) {
    throw new Error("At least one stock/fund symbol or holding search term is required.");
  }

  const [matchedClients, evidence] = await Promise.all([
    findMatchingClients({
      userId: input.user.id,
      symbols,
      holdingQuery,
    }),
    gatherSourceEvidence({
      userId: input.user.id,
      symbols,
      holdingQuery,
      sourceTitle: input.sourceTitle,
      sourceUrl,
      sourceName: input.sourceName,
      researchSummary,
    }),
  ]);

  const eligibleClients = matchedClients.filter((item) => {
    const email = item.client.email ? decryptSensitiveText(item.client.email) : null;
    return Boolean(email);
  });

  if (!eligibleClients.length) {
    return {
      created: 0,
      approval: null,
      drafts: [],
      skipped: matchedClients.length,
      message:
        matchedClients.length > 0
          ? "Matching clients were found, but none had an email address available."
          : "No clients were found with matching holdings.",
    };
  }

  const drafts = [];

  for (const match of eligibleClients) {
    const clientName = match.client.fullName;
    const deterministic = buildDeterministicBriefing({
      advisorName: input.user.name,
      clientName,
      symbols,
      holdings: match.holdings,
      evidence,
      researchSummary: researchSummary || null,
      advisorMessage: advisorMessage || null,
      tone,
    });

    const polished = await polishBriefingWithAi({
      advisorName: input.user.name,
      clientName,
      symbols,
      holdings: match.holdings,
      evidence,
      deterministicSubject: deterministic.subject,
      deterministicBody: deterministic.body,
      tone,
    });

    const metadata = {
      briefingPackVersion: "client-holding-briefing-v1",
      clientId: match.client.id,
      symbols,
      holdingQuery,
      holdings: match.holdings.map((holding) => ({
        symbol: holding.symbol,
        assetName: holding.assetName,
        assetClass: holding.assetClass,
        value: holding.value,
        allocationPct: holding.allocationPct,
        riskLevel: holding.riskLevel,
      })),
      sourceEvidence: evidence,
      sourceUrl,
      sourceTitle: cleanText(input.sourceTitle),
      sourceName: cleanText(input.sourceName),
      researchSummary,
      advisorMessage,
      investmentGrade: investmentGradeFromEvidence(evidence),
      ai: {
        polished: polished.aiPolished,
        provider: polished.aiProvider,
        status: polished.aiStatus,
        error: polished.aiError,
      },
    };

    const draft = await prisma.clientCommunicationDraft.create({
      data: {
        userId: input.user.id,
        firmId,
        clientName,
        channel: "Email",
        audience: "Wealth Management Client",
        title: encryptSensitiveText(polished.subject) ?? polished.subject,
        body: encryptSensitiveText(polished.body) ?? polished.body,
        sourceSummaryJson: asJson(metadata),
        complianceNotesJson: asJson([
          "Advisor approval required before sending.",
          "Message is informational and should not promise outcomes.",
          "Advisor should confirm suitability, client context, and source accuracy.",
          "Do not send if the information is stale, misleading, or not relevant to the client.",
        ]),
        status: "Needs Advisor Approval",
        tone,
      },
    });

    await prisma.complianceProofTrail.upsert({
      where: {
        userId_dedupeKey: {
          userId: input.user.id,
          dedupeKey: `client-briefing-draft:${draft.id}`,
        },
      },
      update: {
        summary: `Client briefing draft created for advisor approval: ${clientName}.`,
        sourceTitle: cleanText(input.sourceTitle) || null,
        sourceUrl,
        clientId: match.client.id,
        clientName,
        aiReasoning:
          "Slice matched the client by holding, generated a polished client briefing, and required advisor approval before delivery.",
        evidenceJson: asJson(metadata),
        humanStatus: "Needs Review",
      },
      create: {
        userId: input.user.id,
        firmId,
        dedupeKey: `client-briefing-draft:${draft.id}`,
        actionType: "Client Briefing Email",
        subject: polished.subject,
        summary: `Client briefing draft created for advisor approval: ${clientName}.`,
        sourceType: "Client Holding Match",
        sourceId: draft.id,
        sourceTitle: cleanText(input.sourceTitle) || null,
        sourceUrl,
        clientId: match.client.id,
        clientName,
        aiReasoning:
          "Slice matched the client by holding, generated a polished client briefing, and required advisor approval before delivery.",
        humanStatus: "Needs Review",
        riskLevel: "Medium",
        evidenceJson: asJson(metadata),
        approvalJson: asJson({ status: "Pending" }),
      },
    });

    drafts.push({
      id: draft.id,
      clientId: match.client.id,
      clientName,
      subject: polished.subject,
      body: polished.body,
      status: draft.status,
      evidence,
      aiPolished: polished.aiPolished,
    });
  }

  const approval = await prisma.backendApprovalItem.create({
    data: {
      userId: input.user.id,
      firmId,
      title: `Approve client briefing emails: ${shortList(symbols, holdingQuery || "holding update")}`,
      actionType: "Client Briefing Email",
      riskLevel: "Medium",
      summary: `${drafts.length} client briefing email draft(s) are ready for advisor approval and delivery.`,
      payloadJson: asJson({
        draftIds: drafts.map((draft) => draft.id),
        symbols,
        holdingQuery,
        sourceUrl,
        sourceTitle: cleanText(input.sourceTitle),
        sourceName: cleanText(input.sourceName),
        researchSummary,
        advisorMessage,
        createdAt: new Date().toISOString(),
      }),
      requestedBy: input.user.email,
      status: "Pending",
    },
  });

  await recordSecurityEvent({
    userId: input.user.id,
    eventType: "client_briefing.pack_created",
    severity: "Medium",
    area: "Client Communication",
    title: "Client briefing email pack created",
    detail: `${drafts.length} client briefing draft(s) created and queued for advisor approval.`,
    metadata: {
      approvalId: approval.id,
      draftIds: drafts.map((draft) => draft.id),
      symbols,
      clientCount: drafts.length,
      sourceCount: evidence.length,
    },
  });

  return {
    created: drafts.length,
    approval,
    drafts,
    skipped: matchedClients.length - eligibleClients.length,
    message: `${drafts.length} client briefing email draft(s) created and queued for advisor approval.`,
  };
}

export async function listClientBriefingConsole(user: CurrentUserShape) {
  const [drafts, approvals] = await Promise.all([
    prisma.clientCommunicationDraft.findMany({
      where: {
        userId: user.id,
        channel: "Email",
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.backendApprovalItem.findMany({
      where: {
        userId: user.id,
        actionType: "Client Briefing Email",
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return {
    drafts: drafts.map((draft) => ({
      ...draft,
      title: decryptSensitiveText(draft.title),
      body: decryptSensitiveText(draft.body),
      sourceSummary: parseJson<Record<string, unknown>>(draft.sourceSummaryJson, {}),
      complianceNotes: parseJson<string[]>(draft.complianceNotesJson, []),
    })),
    approvals: approvals.map((approval) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
  };
}

export async function sendApprovedClientBriefings(input: SendApprovedInput) {
  const approval = await prisma.backendApprovalItem.findFirst({
    where: {
      id: input.approvalId,
      userId: input.user.id,
      actionType: "Client Briefing Email",
    },
  });

  if (!approval) {
    throw new Error("Approval item was not found.");
  }

  if (approval.status !== "Pending") {
    throw new Error(`This approval is already ${approval.status}.`);
  }

  const payload = parseJson<{ draftIds?: string[] }>(approval.payloadJson, {});
  const draftIds = Array.isArray(payload.draftIds) ? payload.draftIds.filter(Boolean) : [];

  if (!draftIds.length) {
    throw new Error("Approval item does not contain draft IDs.");
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      userId: input.user.id,
      id: {
        in: draftIds,
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

    const rawClient = clientId
      ? await prisma.clientProfile.findFirst({
          where: {
            id: clientId,
            userId: input.user.id,
          },
          include: {
            holdings: true,
          },
        })
      : null;

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

    const subject = decryptSensitiveText(draft.title) || "Advisor briefing";
    const body = decryptSensitiveText(draft.body) || "";
    const html = renderEmailHtml({
      subject,
      body,
      clientName: draft.clientName || client.fullName,
      symbols: metadata.symbols ?? [],
      evidence: metadata.sourceEvidence ?? [],
    });

    const result = await sendEmail({
      to: clientEmail,
      subject,
      text: body,
      html,
      idempotencyKey: `client-briefing-${draft.id}`,
    });

    await prisma.notificationDelivery.create({
      data: {
        userId: input.user.id,
        alertEventId: null,
        channel: "Email",
        destination: clientEmail,
        status: result.ok ? (result.status === "sent" ? "Delivered" : "Simulated") : "Failed",
        urgency: "Medium",
        score: 75,
        title: subject,
        body,
        reason: result.ok
          ? `Advisor-approved client briefing email ${result.status} via ${result.provider}.`
          : result.error ?? "Email delivery failed.",
        simulated: result.status !== "sent",
        deliveredAt: result.ok ? new Date() : null,
      },
    });

    await prisma.clientCommunicationDraft.update({
      where: { id: draft.id },
      data: {
        status: result.ok ? (result.status === "sent" ? "Sent" : "Simulated") : "Delivery Failed",
      },
    });

    await prisma.complianceProofTrail.upsert({
      where: {
        userId_dedupeKey: {
          userId: input.user.id,
          dedupeKey: `client-briefing-sent:${draft.id}`,
        },
      },
      update: {
        humanStatus: result.ok ? "Approved and Sent" : "Delivery Failed",
        approvalJson: asJson({
          approvalId: approval.id,
          approvedBy: input.user.email,
          decidedAt: new Date().toISOString(),
          deliveryStatus: result.status,
          deliveryProvider: result.provider,
          deliveryError: result.error ?? null,
        }),
      },
      create: {
        userId: input.user.id,
        firmId: draft.firmId,
        dedupeKey: `client-briefing-sent:${draft.id}`,
        actionType: "Client Briefing Email",
        subject,
        summary: `Advisor-approved client briefing sent to ${draft.clientName}.`,
        sourceType: "Client Communication Draft",
        sourceId: draft.id,
        sourceTitle: metadata.sourceTitle ?? null,
        sourceUrl: metadata.sourceUrl ?? null,
        clientId,
        clientName: draft.clientName,
        aiReasoning:
          "Advisor approved the client communication before delivery. Slice recorded source context, compliance notes, and delivery metadata.",
        humanStatus: result.ok ? "Approved and Sent" : "Delivery Failed",
        riskLevel: "Medium",
        evidenceJson: asJson(metadata),
        approvalJson: asJson({
          approvalId: approval.id,
          approvedBy: input.user.email,
          decidedAt: new Date().toISOString(),
          deliveryStatus: result.status,
          deliveryProvider: result.provider,
          deliveryError: result.error ?? null,
        }),
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
    eventType: "client_briefing.approved_and_sent",
    severity: "Medium",
    area: "Client Communication",
    title: "Client briefing approval processed",
    detail: `Advisor approved and processed ${drafts.length} client briefing email draft(s).`,
    metadata: {
      approvalId: approval.id,
      delivered,
      simulated,
      failed,
      draftIds,
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