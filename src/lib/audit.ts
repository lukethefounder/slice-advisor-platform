import { prisma } from "@/lib/prisma";

export const REQUIRED_DISCLOSURES = [
  {
    disclosureKey: "market-intelligence-not-advice",
    title: "Market Intelligence Is Not Investment Advice",
    version: "1.0",
    content:
      "Slice provides market intelligence, workflow support, alerts, and research organization. It does not provide guaranteed outcomes or automatic buy/sell recommendations.",
  },
  {
    disclosureKey: "alternative-investment-risk",
    title: "Alternative Investment Risk Disclosure",
    version: "1.0",
    content:
      "Crypto, venture capital, private startups, and illiquid opportunities may involve substantial risk, volatility, loss of capital, limited liquidity, and uncertain valuations.",
  },
  {
    disclosureKey: "ai-summary-limitations",
    title: "AI and Automated Summary Limitations",
    version: "1.0",
    content:
      "Automated summaries and ranking logic may be incomplete, delayed, incorrect, or unsuitable for a user's circumstances. Human review is required before financial decisions.",
  },
  {
    disclosureKey: "data-delay-and-source-risk",
    title: "Data Delay and Source Risk Disclosure",
    version: "1.0",
    content:
      "Market information, headlines, filings, and alerts may be delayed, unavailable, duplicated, or inaccurate depending on source availability and system performance.",
  },
  {
    disclosureKey: "advisor-review-required",
    title: "Advisor Review Required for Client-Facing Use",
    version: "1.0",
    content:
      "Client-facing recommendations, portfolio changes, or suitability judgments should be reviewed by a qualified professional before being presented as advice.",
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

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      severity: input.severity ?? "Info",
      area: input.area ?? "General",
      title: input.title,
      detail: input.detail ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      ipAddress: forwardedFor,
      userAgent,
    },
  });
}

export async function ensureUserSecuritySetting(userId: string) {
  return prisma.userSecuritySetting.upsert({
    where: { userId },
    update: {},
    create: { userId },
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
        item.version === disclosure.version
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
  disclosureKey: string
) {
  const disclosure = REQUIRED_DISCLOSURES.find(
    (item) => item.disclosureKey === disclosureKey
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