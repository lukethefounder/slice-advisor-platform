import { prisma } from "@/lib/prisma";

export const REQUIRED_DISCLOSURES = [
  {
    disclosureKey: "platform-not-legal-tax-or-investment-advice",
    title: "Platform Output Is Not Legal, Tax, or Investment Advice",
    version: "3.0",
    content:
      "Slice is workflow, research organization, reporting, communication-preparation, and advisor operating software. Slice does not independently provide legal, tax, accounting, brokerage, custody, suitability, fiduciary, or investment advice. All outputs must be reviewed by the responsible adviser, firm principal, compliance officer, or qualified professional before client-facing, investor-facing, or public use.",
  },
  {
    disclosureKey: "advisor-review-required",
    title: "Advisor Review Required Before Client-Facing Use",
    version: "3.0",
    content:
      "Client-facing recommendations, portfolio changes, investment explanations, suitability judgments, emails, reports, market commentary, or action plans must be reviewed and approved by the adviser or firm-designated reviewer before delivery. AI-generated or system-generated content is draft support only and should not be treated as a final recommendation.",
  },
  {
    disclosureKey: "ai-summary-limitations",
    title: "AI and Automated Summary Limitations",
    version: "3.0",
    content:
      "AI-generated summaries, rankings, scores, watchlist notes, report drafts, client explanations, and compliance summaries may be incomplete, delayed, inaccurate, biased, outdated, or unsuitable for a particular client. Human review is required before reliance, client delivery, investment decisions, trading, or compliance sign-off.",
  },
  {
    disclosureKey: "market-intelligence-not-advice",
    title: "Market Intelligence Is Not a Buy/Sell Recommendation",
    version: "3.0",
    content:
      "Slice may organize market data, news, watchlists, technical signals, research notes, and portfolio commentary. This information is not a guaranteed outcome, personalized recommendation, trade instruction, or automatic buy/sell signal. Advisers must verify data, client objectives, risk tolerance, liquidity needs, tax considerations, and suitability before acting.",
  },
  {
    disclosureKey: "data-delay-source-risk",
    title: "Data Delay, Source, and Calculation Risk",
    version: "3.0",
    content:
      "Market prices, research data, news, filings, analytics, third-party feeds, charts, and AI summaries may be delayed, unavailable, duplicated, incomplete, misclassified, or inaccurate. Any performance, ranking, allocation, or scenario calculation should be independently verified before external use.",
  },
  {
    disclosureKey: "alternative-investment-risk",
    title: "Alternative Investment and Illiquid Asset Risk",
    version: "3.0",
    content:
      "Crypto, venture capital, private startups, private placements, real estate, private credit, penny stocks, and other alternative or illiquid opportunities may involve substantial risk, volatility, loss of capital, valuation uncertainty, lack of liquidity, limited disclosure, and conflicts of interest. Slice does not approve or validate any such investment.",
  },
  {
    disclosureKey: "marketing-communications-review",
    title: "Marketing, Testimonial, Endorsement, and Performance Communication Review",
    version: "3.0",
    content:
      "Any advertisement, testimonial, endorsement, third-party rating, hypothetical performance, performance presentation, public communication, client communication, or investor-facing communication prepared in Slice must be reviewed under the firm's applicable SEC, FINRA, state, and internal marketing policies before use. Required disclosures, substantiation, approval, and recordkeeping remain the firm's responsibility.",
  },
  {
    disclosureKey: "privacy-confidentiality-reg-sp",
    title: "Privacy, Confidentiality, and Customer Information Protection",
    version: "3.0",
    content:
      "Slice may store account profile data, client notes, reports, communication drafts, audit records, settings, and workflow metadata. Firms are responsible for configuring privacy, access controls, incident response, vendor oversight, customer notices, and retention practices consistent with applicable privacy, cybersecurity, Regulation S-P, GLBA, state privacy, and firm policies.",
  },
  {
    disclosureKey: "books-records-retention",
    title: "Books, Records, and Retention Responsibility",
    version: "3.0",
    content:
      "Slice can help generate and display audit logs, disclosure acceptance records, reports, communication drafts, approval metadata, and workflow history. The firm remains responsible for determining which records are required books and records, retaining them for the required period and format, supervising communications, and exporting or archiving them under its written retention program.",
  },
  {
    disclosureKey: "no-custody-or-trading-authority",
    title: "No Custody, Trading Authority, or Client-Money Movement",
    version: "3.0",
    content:
      "Slice should not be treated as a custodian, broker-dealer, transfer agent, bank, payment processor, trading system, or discretionary portfolio manager unless separately licensed, contracted, and technically integrated under approved controls. Sensitive actions should remain approval-gated and should not move client funds or securities by default.",
  },
  {
    disclosureKey: "audit-trail-and-monitoring",
    title: "Audit Trail and Monitoring Disclosure",
    version: "3.0",
    content:
      "Slice records security settings updates, disclosure acceptances, security reviews, and other sensitive events when the relevant backend action calls the audit logging utility. Audit logs support compliance review but do not replace the firm's supervisory procedures, books-and-records archive, legal hold process, or regulator-ready retention system.",
  },
];

export async function recordAuditLog(input: {
  userId: string;
  eventType: string;
  severity?: "Info" | "Warning" | "Critical";
  area?: string;
  title: string;
  detail?: string;
  metadata?: unknown;
  request?: Request;
}) {
  const userAgent = input.request?.headers.get("user-agent") ?? null;
  const forwardedFor = input.request?.headers.get("x-forwarded-for") ?? null;
  const realIp = input.request?.headers.get("x-real-ip") ?? null;

  const metadata =
    typeof input.metadata === "object" && input.metadata !== null
      ? {
          ...(input.metadata as Record<string, unknown>),
          regulatoryEvidence: {
            recordedAt: new Date().toISOString(),
            eventType: input.eventType,
            area: input.area ?? "General",
            severity: input.severity ?? "Info",
            userAgentCaptured: Boolean(userAgent),
            ipCaptured: Boolean(forwardedFor || realIp),
            retentionClass: "Compliance review record",
            reviewRequired:
              input.severity === "Critical" ||
              input.severity === "Warning" ||
              input.area === "Compliance" ||
              input.area === "Security",
          },
        }
      : {
          rawMetadata: input.metadata ?? {},
          regulatoryEvidence: {
            recordedAt: new Date().toISOString(),
            eventType: input.eventType,
            area: input.area ?? "General",
            severity: input.severity ?? "Info",
            userAgentCaptured: Boolean(userAgent),
            ipCaptured: Boolean(forwardedFor || realIp),
            retentionClass: "Compliance review record",
            reviewRequired:
              input.severity === "Critical" ||
              input.severity === "Warning" ||
              input.area === "Compliance" ||
              input.area === "Security",
          },
        };

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      severity: input.severity ?? "Info",
      area: input.area ?? "General",
      title: input.title,
      detail: input.detail ?? null,
      metadataJson: JSON.stringify(metadata),
      ipAddress: forwardedFor || realIp,
      userAgent,
    },
  });
}

export async function ensureUserSecuritySetting(userId: string) {
  return prisma.userSecuritySetting.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      mfaEnabled: false,
      requireReauthForSensitiveActions: true,
      alertOnNewLogin: true,
      advisorModeEnabled: false,
      sessionTimeoutMinutes: 43200,
    },
  });
}

export async function getDisclosureStatus(user: {
  id: string;
  name: string;
  email: string;
}) {
  const acceptances = await prisma.disclosureAcceptance.findMany({
    where: { userId: user.id },
  });

  return REQUIRED_DISCLOSURES.map((disclosure) => {
    const accepted = acceptances.find(
      (item) =>
        item.disclosureKey === disclosure.disclosureKey &&
        item.version === disclosure.version,
    );

    return {
      ...disclosure,
      accepted: Boolean(accepted),
      acceptedAt: accepted?.acceptedAt ?? null,
    };
  });
}

export async function acceptDisclosure(
  user: {
    id: string;
    name: string;
    email: string;
  },
  disclosureKey: string,
) {
  const disclosure = REQUIRED_DISCLOSURES.find(
    (item) => item.disclosureKey === disclosureKey,
  );

  if (!disclosure) {
    throw new Error("Disclosure not found.");
  }

  const acceptance = await prisma.disclosureAcceptance.upsert({
    where: {
      userId_disclosureKey_version: {
        userId: user.id,
        disclosureKey: disclosure.disclosureKey,
        version: disclosure.version,
      },
    },
    update: {},
    create: {
      userId: user.id,
      disclosureKey: disclosure.disclosureKey,
      title: disclosure.title,
      version: disclosure.version,
      acceptedByName: user.name,
      acceptedByEmail: user.email,
      contentSnapshot: disclosure.content,
    },
  });

  await recordAuditLog({
    userId: user.id,
    eventType: "DISCLOSURE_ACCEPTED",
    severity: "Info",
    area: "Compliance",
    title: `Accepted disclosure: ${disclosure.title}`,
    detail: disclosure.content,
    metadata: {
      disclosureKey: disclosure.disclosureKey,
      version: disclosure.version,
      acceptedByName: user.name,
      acceptedByEmail: user.email,
      contentSnapshotStored: true,
      officialRecordPurpose:
        "Versioned disclosure acceptance evidence for compliance review, audit trail, and books-and-records support.",
    },
  });

  return acceptance;
}

export async function acceptAllDisclosures(user: {
  id: string;
  name: string;
  email: string;
}) {
  const accepted = [];

  for (const disclosure of REQUIRED_DISCLOSURES) {
    const item = await acceptDisclosure(user, disclosure.disclosureKey);
    accepted.push(item);
  }

  return accepted;
}