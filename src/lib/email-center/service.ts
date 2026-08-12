import "server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  getAccessContextForUser,
  hasFirmPermission,
  clientScopeWhere,
  type AccessContext,
} from "@/lib/access-control";
import { ApiError } from "@/lib/api-route";
import {
  enqueueBackgroundJob,
  getBackgroundJob,
  listBackgroundJobs,
  requestBackgroundJobCancellation,
  requestBackgroundJobWake,
  retryBackgroundJob,
} from "@/lib/background-jobs/queue";
import { cleanEmail } from "@/lib/client-data-security";
import {
  type EmailAiGenerationPayload,
  type EmailArchiveDetail,
  type EmailArchiveItem,
  type EmailArchivePayload,
  type EmailApprovalDraftSnapshot,
  type EmailApprovalPayload,
  type EmailApprovalView,
  type EmailBrandingPreference,
  type EmailCenterPayload,
  type EmailCenterUser,
  type EmailClientOption,
  type EmailDeliveryAttempt,
  type EmailDeliveryPayload,
  type EmailDeliveryView,
  type EmailDraftDetail,
  type EmailDraftMetadata,
  type EmailDraftProgressPayload,
  type EmailDraftSummary,
  type EmailGenerationSpeed,
  type EmailJobView,
  type EmailPortfolioBand,
  type EmailPromptPlan,
} from "@/lib/email-center/contracts";
import {
  appendStoredEmailVersion,
  cleanEmailBody,
  cleanEmailSubject,
  cleanEmailTone,
  createDefaultEmailDraftMetadata,
  defaultEmailBranding,
  createStoredEmailVersion,
  decryptEmailText,
  emailAddressHash,
  emailContentHash,
  emailHtml,
  encryptEmailText,
  maskEmailAddress,
  normalizeEmailBranding,
  normalizeEmailDraftStatus,
  publicEmailDraftVersion,
  readEmailComplianceNotes,
  readEmailDraftMetadata,
  safeEmailError,
  writeEmailComplianceNotes,
  writeEmailDraftMetadata,
  type ClientCommunicationDraftRow,
} from "@/lib/email-center/storage";
import { decryptSensitiveText } from "@/lib/data-vault";
import {
  buildImmediateEmailDraft,
  compileEmailPrompt,
} from "@/lib/email-center/prompt";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security";

const MAX_CLIENT_OPTIONS = 250;
const MAX_DRAFTS = 200;
const MAX_APPROVALS = 100;
const MAX_DELIVERIES = 150;
const DEFAULT_ARCHIVE_PAGE_SIZE = 40;
const MAX_ARCHIVE_PAGE_SIZE = 100;
const MAX_EMAIL_JOBS = 100;
const MAX_BATCH_DRAFTS = 50;
const MAX_AI_CLIENTS = 25;
const MAX_BULK_WITHOUT_SUPERVISOR = 10;
const MAX_SCHEDULE_FUTURE_MS = 366 * 24 * 60 * 60_000;
const QUEUED_GENERATION_WAKE_DELAY_MS = 3_000;
const QUICK_GENERATION_STALL_MS = 135_000;
const RESEARCHED_GENERATION_STALL_MS = 240_000;
const MISSING_GENERATION_JOB_STALL_MS = 20_000;

const EMAIL_BRANDING_SUBJECT_TYPE = "EmailCenterBranding";
const EMAIL_BRANDING_SUBJECT_NAME = "Client Email Branding";
const EMAIL_BRANDING_MEMORY_KEY = "default";
const DELETABLE_DRAFT_STATUSES = new Set([
  "Draft",
  "Edited",
  "Generation Failed",
  "Cancelled",
  "Archived",
]);

const clientOptionSelect = {
  id: true,
  fullName: true,
  householdName: true,
  email: true,
  clientType: true,
  riskProfile: true,
  portfolioValue: true,
  status: true,
  assignedAdvisorMembershipId: true,
  holdings: {
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 25,
    select: {
      symbol: true,
      assetName: true,
      assetClass: true,
      value: true,
      allocationPct: true,
      riskLevel: true,
    },
  },
} as const;

type ClientOptionRow = {
  id: string;
  fullName: string;
  householdName: string | null;
  email: string | null;
  clientType: string;
  riskProfile: string;
  portfolioValue: string | null;
  status: string;
  assignedAdvisorMembershipId: string | null;
  holdings: Array<{
    symbol: string;
    assetName: string;
    assetClass: string;
    value: string | null;
    allocationPct: string | null;
    riskLevel: string;
  }>;
};

const draftSelect = {
  id: true,
  userId: true,
  firmId: true,
  clientName: true,
  channel: true,
  audience: true,
  title: true,
  body: true,
  sourceSummaryJson: true,
  complianceNotesJson: true,
  status: true,
  tone: true,
  createdAt: true,
  updatedAt: true,
} as const;

const approvalSelect = {
  id: true,
  userId: true,
  firmId: true,
  title: true,
  actionType: true,
  riskLevel: true,
  summary: true,
  payloadJson: true,
  requestedBy: true,
  approvedBy: true,
  approvalNotes: true,
  status: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const deliverySelect = {
  id: true,
  userId: true,
  firmId: true,
  channel: true,
  destination: true,
  title: true,
  body: true,
  payloadJson: true,
  provider: true,
  status: true,
  urgency: true,
  score: true,
  approvalRequired: true,
  approvedAt: true,
  sentAt: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

type EmailCenterContext = {
  user: EmailCenterUser;
  access: AccessContext;
  firmId: string;
  membershipId: string | null;
  canViewFirm: boolean;
  canApproveBulk: boolean;
  canDeleteDrafts: boolean;
};

type DraftRow = ClientCommunicationDraftRow;

type ApprovalRow = {
  id: string;
  userId: string;
  firmId: string | null;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  payloadJson: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  status: string;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeliveryRow = {
  id: string;
  userId: string;
  firmId: string | null;
  channel: string;
  destination: string | null;
  title: string;
  body: string;
  payloadJson: string;
  provider: string | null;
  status: string;
  urgency: string;
  score: number;
  approvalRequired: boolean;
  approvedAt: Date | null;
  sentAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseApprovalPayload(value: string | null | undefined): EmailApprovalPayload | null {
  const parsed = parseJsonObject(value);

  if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.drafts)) return null;

  const drafts: EmailApprovalDraftSnapshot[] = [];

  for (const item of parsed.drafts.slice(0, MAX_BATCH_DRAFTS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Partial<EmailApprovalDraftSnapshot>;

    if (!record.draftId || !record.contentHash || !record.recipientEmailHash) continue;

    drafts.push({
      draftId: String(record.draftId),
      ownerUserId: String(record.ownerUserId ?? ""),
      clientId: record.clientId ? String(record.clientId) : null,
      clientName: record.clientName ? String(record.clientName).slice(0, 300) : null,
      recipientEmailMasked: record.recipientEmailMasked
        ? String(record.recipientEmailMasked).slice(0, 320)
        : null,
      recipientEmailHash: String(record.recipientEmailHash),
      revision: Math.max(1, Number(record.revision) || 1),
      contentHash: String(record.contentHash),
    });
  }

  return {
    schemaVersion: 2,
    drafts,
    requestedAt: String(parsed.requestedAt ?? ""),
  };
}

export function parseEmailDeliveryPayload(
  value: string | null | undefined,
): EmailDeliveryPayload | null {
  const parsed = parseJsonObject(value);

  if (parsed.schemaVersion !== 2 || parsed.kind !== "client-email") return null;

  const draftId = String(parsed.draftId ?? "").trim();
  const clientId = String(parsed.clientId ?? "").trim();
  const approvalId = String(parsed.approvalId ?? "").trim();

  if (!draftId || !clientId || !approvalId) return null;

  const attemptHistory: EmailDeliveryAttempt[] = Array.isArray(parsed.attemptHistory)
    ? parsed.attemptHistory
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .slice(-12)
        .map((item) => {
          const record = item as Partial<EmailDeliveryAttempt>;
          return {
            attempt: Math.max(1, Number(record.attempt) || 1),
            status: String(record.status ?? "Unknown").slice(0, 80),
            provider: record.provider ? String(record.provider).slice(0, 160) : null,
            providerId: record.providerId
              ? String(record.providerId).slice(0, 300)
              : null,
            requestId: record.requestId ? String(record.requestId).slice(0, 300) : null,
            errorCode: record.errorCode ? String(record.errorCode).slice(0, 160) : null,
            error: record.error ? String(record.error).slice(0, 1_000) : null,
            at: String(record.at ?? new Date().toISOString()),
          };
        })
    : [];

  return {
    schemaVersion: 2,
    kind: "client-email",
    draftId,
    draftRevision: Math.max(1, Number(parsed.draftRevision) || 1),
    contentHash: String(parsed.contentHash ?? ""),
    clientId,
    clientName: String(parsed.clientName ?? "Client").slice(0, 300),
    recipientEmailHash: String(parsed.recipientEmailHash ?? ""),
    htmlEncrypted: String(parsed.htmlEncrypted ?? ""),
    scheduledAt: String(parsed.scheduledAt ?? ""),
    requestedByUserId: String(parsed.requestedByUserId ?? ""),
    requestedByName: String(parsed.requestedByName ?? "").slice(0, 300),
    approvalId,
    jobId: parsed.jobId ? String(parsed.jobId) : null,
    providerId: parsed.providerId ? String(parsed.providerId).slice(0, 300) : null,
    attemptHistory,
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeIds(value: unknown, maximum = MAX_BATCH_DRAFTS) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  ).slice(0, maximum);
}

function dateFrom(value: unknown) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

type EmailArchiveCursor = {
  updatedAt: string;
  id: string;
};

function archivePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_ARCHIVE_PAGE_SIZE;
  return Math.max(10, Math.min(MAX_ARCHIVE_PAGE_SIZE, Math.round(parsed)));
}

function encodeArchiveCursor(row: Pick<DeliveryRow, "id" | "updatedAt">) {
  return Buffer.from(
    JSON.stringify({
      updatedAt: row.updatedAt.toISOString(),
      id: row.id,
    } satisfies EmailArchiveCursor),
  ).toString("base64url");
}

function decodeArchiveCursor(value: unknown): EmailArchiveCursor | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<EmailArchiveCursor>;
    const updatedAt = String(parsed.updatedAt ?? "");
    const id = String(parsed.id ?? "").trim();

    if (!id || !dateFrom(updatedAt)) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function emailAddressFromEncrypted(value: string | null | undefined) {
  if (!value) return null;
  return cleanEmail(decryptSensitiveText(value));
}

function accessibleClientEmail(value: string | null | undefined) {
  if (!value) return null;
  return cleanEmail(decryptSensitiveText(value));
}

async function requireEmailCenterContext(input: {
  userId: string;
  firmId?: string | null;
}): Promise<EmailCenterContext> {
  const access = await getAccessContextForUser({
    userId: input.userId,
    firmId: input.firmId,
  });

  if (!access) {
    throw new ApiError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
      expose: true,
    });
  }

  if (!access.firm) {
    throw new ApiError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
      expose: true,
    });
  }

  if (!hasFirmPermission(access, "clients.manage")) {
    throw new ApiError({
      status: 403,
      code: "EMAIL_PERMISSION_DENIED",
      message: "Client communication access is required.",
      expose: true,
    });
  }

  return {
    user: {
      id: access.user.id,
      name: access.user.name,
      email: access.user.email,
    },
    access,
    firmId: access.firm.id,
    membershipId: access.membership?.id ?? null,
    canViewFirm:
      access.isFounder || hasFirmPermission(access, "clients.supervise"),
    canApproveBulk:
      access.isFounder || hasFirmPermission(access, "clients.supervise"),
    canDeleteDrafts: true,
  };
}

export async function getEmailCenterContextForJob(input: {
  userId: string;
  firmId: string | null;
}) {
  return requireEmailCenterContext({
    userId: input.userId,
    firmId: input.firmId,
  });
}


function defaultBrandingForContext(context: EmailCenterContext) {
  return defaultEmailBranding({
    advisorName: context.user.name,
    advisorEmail: context.user.email,
    firmName: context.access.firm?.name ?? "Wealth Management Team",
  });
}

async function loadEmailBrandingPreference(context: EmailCenterContext) {
  const fallback = defaultBrandingForContext(context);
  const record = await prisma.advisorAdaptiveMemory.findUnique({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: context.user.id,
        subjectType: EMAIL_BRANDING_SUBJECT_TYPE,
        subjectName: EMAIL_BRANDING_SUBJECT_NAME,
        memoryKey: EMAIL_BRANDING_MEMORY_KEY,
      },
    },
    select: {
      memoryValue: true,
    },
  });

  return normalizeEmailBranding(
    record ? parseJsonObject(record.memoryValue) : null,
    fallback,
  );
}

export async function saveClientEmailBranding(input: {
  user: EmailCenterUser;
  request?: Request;
  branding: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const branding = normalizeEmailBranding(input.branding, {
    ...defaultBrandingForContext(context),
    updatedAt: new Date().toISOString(),
  });
  const stored = {
    ...branding,
    updatedAt: new Date().toISOString(),
  } satisfies EmailBrandingPreference;

  await prisma.advisorAdaptiveMemory.upsert({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: context.user.id,
        subjectType: EMAIL_BRANDING_SUBJECT_TYPE,
        subjectName: EMAIL_BRANDING_SUBJECT_NAME,
        memoryKey: EMAIL_BRANDING_MEMORY_KEY,
      },
    },
    update: {
      firmId: context.firmId,
      memoryValue: JSON.stringify(stored),
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured client email branding and signature",
      ]),
      lastAppliedAt: new Date(),
    },
    create: {
      userId: context.user.id,
      firmId: context.firmId,
      subjectType: EMAIL_BRANDING_SUBJECT_TYPE,
      subjectName: EMAIL_BRANDING_SUBJECT_NAME,
      memoryKey: EMAIL_BRANDING_MEMORY_KEY,
      memoryValue: JSON.stringify(stored),
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured client email branding and signature",
      ]),
      lastAppliedAt: new Date(),
    },
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.branding_updated",
    title: "Client email branding updated",
    detail:
      "The advisor updated the default Slice email logo, firm identity, or signature settings.",
    metadata: {
      hasFirmLogo: Boolean(stored.firmLogoUrl),
      showSliceBrand: stored.showSliceBrand,
      signatureCompany: stored.signature.company,
    },
  });

  return {
    ok: true,
    branding: stored,
  };
}

function draftCanBeDeleted(status: string, metadata: EmailDraftMetadata) {
  return (
    DELETABLE_DRAFT_STATUSES.has(status) &&
    !metadata.approval.approvalId &&
    !metadata.delivery.deliveryId &&
    !["Queued", "Processing"].includes(metadata.generation.status)
  );
}

function parseFinancialNumber(value: string | null | undefined) {
  let decrypted = value ?? "";

  try {
    decrypted = decryptSensitiveText(value) ?? value ?? "";
  } catch {
    decrypted = value ?? "";
  }

  const normalized = String(decrypted)
    .trim()
    .replace(/,/g, "")
    .replace(/[$%]/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  if (!normalized) return null;

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*([kmb])?$/i);
  if (!match) {
    const direct = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(direct) ? direct : null;
  }

  const amount = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "b" ? 1_000_000_000 : suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  const result = amount * multiplier;
  return Number.isFinite(result) ? result : null;
}

function portfolioBandFor(value: number | null): EmailPortfolioBand {
  if (value === null || value < 0) return "Unknown";
  if (value < 250_000) return "Under $250K";
  if (value < 1_000_000) return "$250K–$1M";
  if (value < 5_000_000) return "$1M–$5M";
  return "$5M+";
}

function portfolioValueLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Portfolio value unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function clientOptionFromRow(
  client: ClientOptionRow,
  email = accessibleClientEmail(client.email),
): EmailClientOption {
  const holdings = client.holdings
    .map((holding) => ({
      symbol: holding.symbol.trim().toUpperCase(),
      assetName: holding.assetName,
      assetClass: holding.assetClass,
      valueNumber: parseFinancialNumber(holding.value),
      allocationPctNumber: parseFinancialNumber(holding.allocationPct),
      riskLevel: holding.riskLevel,
    }))
    .filter((holding) => Boolean(holding.symbol))
    .sort((left, right) =>
      (right.valueNumber ?? -1) - (left.valueNumber ?? -1) ||
      left.symbol.localeCompare(right.symbol),
    )
    .slice(0, 25);

  const explicitPortfolioValue = parseFinancialNumber(client.portfolioValue);
  const holdingTotal = holdings.reduce(
    (total, holding) => total + Math.max(0, holding.valueNumber ?? 0),
    0,
  );
  const portfolioValue =
    explicitPortfolioValue !== null
      ? Math.max(0, explicitPortfolioValue)
      : holdingTotal > 0
        ? holdingTotal
        : null;

  return {
    id: client.id,
    fullName: client.fullName,
    householdName: client.householdName,
    email,
    emailMissing: !email,
    clientType: client.clientType,
    riskProfile: client.riskProfile,
    status: client.status,
    assignedAdvisorMembershipId: client.assignedAdvisorMembershipId,
    portfolioValueNumber: portfolioValue,
    portfolioValueLabel: portfolioValueLabel(portfolioValue),
    portfolioBand: portfolioBandFor(portfolioValue),
    holdingSymbols: Array.from(new Set(holdings.map((holding) => holding.symbol))).slice(0, 25),
    holdings,
  };
}

function clientWhere(context: EmailCenterContext) {
  return clientScopeWhere(context.access);
}

function draftScopeWhere(context: EmailCenterContext, scope: "mine" | "firm") {
  return scope === "firm" && context.canViewFirm
    ? { firmId: context.firmId }
    : { firmId: context.firmId, userId: context.user.id };
}

function approvalScopeWhere(context: EmailCenterContext, scope: "mine" | "firm") {
  return scope === "firm" && context.canViewFirm
    ? { firmId: context.firmId }
    : { firmId: context.firmId, userId: context.user.id };
}

function ownerNameMap(users: Array<{ id: string; name: string; email: string }>) {
  return new Map(
    users.map((user) => [user.id, user.name || user.email || "Advisor"]),
  );
}

async function loadClientOptions(context: EmailCenterContext): Promise<EmailClientOption[]> {
  const rows = await prisma.clientProfile.findMany({
    where: clientWhere(context),
    select: clientOptionSelect,
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    take: MAX_CLIENT_OPTIONS,
  });

  return rows.map((client) => clientOptionFromRow(client));
}

function recipientForDraft(
  row: DraftRow,
  metadata: EmailDraftMetadata,
  clientById: Map<string, EmailClientOption>,
  clientByName: Map<string, EmailClientOption>,
) {
  const client = metadata.recipient.clientId
    ? clientById.get(metadata.recipient.clientId)
    : row.clientName
      ? clientByName.get(row.clientName.toLowerCase())
      : undefined;

  const metadataEmail = emailAddressFromEncrypted(metadata.recipient.emailEncrypted);
  const email = client?.email ?? metadataEmail;

  return {
    clientId: client?.id ?? metadata.recipient.clientId,
    clientName: client?.fullName ?? metadata.recipient.clientName ?? row.clientName,
    email,
    emailHash: emailAddressHash(email),
  };
}

function publicGeneration(metadata: EmailDraftMetadata) {
  return {
    ...metadata.generation,
    sources: metadata.generation.sources.slice(0, 20),
  };
}

function draftSummary(input: {
  row: DraftRow;
  ownerName: string;
  clientById: Map<string, EmailClientOption>;
  clientByName: Map<string, EmailClientOption>;
}): EmailDraftSummary {
  const metadata = readEmailDraftMetadata(input.row);
  const subject = decryptEmailText(input.row.title);
  const body = decryptEmailText(input.row.body);
  const recipient = recipientForDraft(
    input.row,
    metadata,
    input.clientById,
    input.clientByName,
  );

  const status = normalizeEmailDraftStatus(input.row.status);

  return {
    id: input.row.id,
    ownerUserId: input.row.userId,
    ownerName: input.ownerName,
    clientId: recipient.clientId,
    clientName: recipient.clientName,
    recipientEmail: recipient.email,
    recipientMissing: !recipient.email,
    subject,
    bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 240),
    status,
    tone: cleanEmailTone(input.row.tone),
    origin: metadata.origin,
    revision: metadata.revision,
    versionCount: metadata.versions.length,
    approval: metadata.approval,
    delivery: metadata.delivery,
    generation: publicGeneration(metadata),
    deletable: draftCanBeDeleted(status, metadata),
    createdAt: input.row.createdAt.toISOString(),
    updatedAt: input.row.updatedAt.toISOString(),
  };
}

function draftDetail(input: {
  row: DraftRow;
  ownerName: string;
  clientById: Map<string, EmailClientOption>;
  clientByName: Map<string, EmailClientOption>;
}): EmailDraftDetail {
  const summary = draftSummary(input);
  const metadata = readEmailDraftMetadata(input.row);
  const body = decryptEmailText(input.row.body);
  const subject = decryptEmailText(input.row.title);
  const tone = cleanEmailTone(input.row.tone);
  const existingVersions = metadata.versions.map(publicEmailDraftVersion);
  const hasCurrentVersion = existingVersions.some(
    (version) => version.contentHash === metadata.contentHash,
  );
  const versions = hasCurrentVersion
    ? existingVersions
    : [
        ...existingVersions,
        {
          id: `current-${input.row.id}-${metadata.revision}`,
          version: metadata.revision,
          label: "Current working draft",
          origin: metadata.origin === "AI" ? ("AI" as const) : ("Imported" as const),
          subject,
          body,
          tone,
          contentHash: metadata.contentHash,
          strategy: null,
          researchSummary: null,
          sources: [],
          complianceNotes: readEmailComplianceNotes(input.row.complianceNotesJson),
          branding: metadata.branding,
          createdByUserId: input.row.userId,
          createdAt: input.row.updatedAt.toISOString(),
        },
      ];

  return {
    ...summary,
    body,
    contentHash: metadata.contentHash,
    selectedVersionId: metadata.selectedVersionId,
    humanEditCount: metadata.humanEditCount,
    lastHumanEditAt: metadata.lastHumanEditAt,
    versions: versions.sort((left, right) => right.version - left.version),
    complianceNotes: readEmailComplianceNotes(input.row.complianceNotesJson),
    branding: metadata.branding,
    editable:
      (metadata.origin !== "AI" ||
        metadata.generation.mode === "Polish" ||
        metadata.generation.status === "Completed") &&
      !["Queued", "Processing"].includes(summary.generation.status) &&
      !["Generating", "Generation Failed", "Sending", "Sent", "Simulated", "Archived"].includes(
        summary.status,
      ),
  };
}

function publicApproval(
  row: ApprovalRow,
  context: EmailCenterContext,
): EmailApprovalView {
  const payload = parseApprovalPayload(row.payloadJson);
  const canDecide =
    row.userId === context.user.id || context.canViewFirm;

  return {
    id: row.id,
    ownerUserId: row.userId,
    title: row.title,
    summary: row.summary,
    status: row.status,
    riskLevel: row.riskLevel,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvalNotes: row.approvalNotes,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    draftIds: payload?.drafts.map((draft) => draft.draftId) ?? [],
    recipientCount: payload?.drafts.length ?? 0,
    canDecide,
  };
}

function publicDelivery(row: DeliveryRow): EmailDeliveryView | null {
  const payload = parseEmailDeliveryPayload(row.payloadJson);
  if (!payload) return null;

  const recipientEmail = emailAddressFromEncrypted(row.destination);
  const status = row.status;

  return {
    id: row.id,
    ownerUserId: row.userId,
    draftId: payload.draftId,
    clientId: payload.clientId,
    clientName: payload.clientName,
    recipientEmail,
    subject: decryptEmailText(row.title),
    status,
    scheduledAt: payload.scheduledAt,
    sentAt: row.sentAt?.toISOString() ?? null,
    provider: row.provider,
    providerId: payload.providerId,
    approvalRequired: row.approvalRequired,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    jobId: payload.jobId,
    attemptHistory: payload.attemptHistory,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cancellable: ["Scheduled", "Email Queued"].includes(status),
    retryable: status === "Failed",
  };
}


function isEmailArchiveStatus(value: string): value is "Sent" | "Simulated" {
  return value === "Sent" || value === "Simulated";
}

function publicArchiveItem(input: {
  row: DeliveryRow;
  ownerName: string;
  approval: ApprovalRow | null;
}): EmailArchiveItem | null {
  const payload = parseEmailDeliveryPayload(input.row.payloadJson);

  if (!payload || !isEmailArchiveStatus(input.row.status)) {
    return null;
  }

  const recipientEmail = emailAddressFromEncrypted(input.row.destination);
  const sentAt = input.row.sentAt ?? input.row.updatedAt;
  const body = decryptEmailText(input.row.body);

  return {
    id: input.row.id,
    deliveryId: input.row.id,
    draftId: payload.draftId,
    ownerUserId: input.row.userId,
    ownerName: input.ownerName,
    subject: decryptEmailText(input.row.title),
    bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 280),
    recipients: [
      {
        clientId: payload.clientId,
        clientName: payload.clientName,
        email: recipientEmail,
      },
    ],
    status: input.row.status,
    approvedAt: input.row.approvedAt?.toISOString() ?? null,
    approvedBy: input.approval?.approvedBy ?? null,
    approvalNotes: input.approval?.approvalNotes ?? null,
    approvalId: payload.approvalId,
    sentAt: sentAt.toISOString(),
    scheduledAt: payload.scheduledAt,
    provider: input.row.provider,
    providerId: payload.providerId,
    revision: payload.draftRevision,
    attemptCount: payload.attemptHistory.length,
    createdAt: input.row.createdAt.toISOString(),
    updatedAt: input.row.updatedAt.toISOString(),
  };
}

function publicArchiveDetail(input: {
  row: DeliveryRow;
  ownerName: string;
  approval: ApprovalRow | null;
}): EmailArchiveDetail | null {
  const item = publicArchiveItem(input);
  const payload = parseEmailDeliveryPayload(input.row.payloadJson);

  if (!item || !payload) {
    return null;
  }

  return {
    ...item,
    body: decryptEmailText(input.row.body),
    html: decryptEmailText(payload.htmlEncrypted),
    attemptHistory: payload.attemptHistory,
    requestedByName: payload.requestedByName,
    contentHash: payload.contentHash,
  };
}

export async function listClientEmailArchive(
  user: EmailCenterUser,
  options: {
    scope?: "mine" | "firm";
    deliveryId?: string | null;
    cursor?: string | null;
    limit?: number | null;
  } = {},
): Promise<EmailArchivePayload> {
  const context = await requireEmailCenterContext({ userId: user.id });
  const scope = options.scope === "firm" && context.canViewFirm ? "firm" : "mine";
  const scopedWhere = draftScopeWhere(context, scope);
  const pageSize = archivePageSize(options.limit);
  const cursor = decodeArchiveCursor(options.cursor);
  const cursorDate = cursor ? dateFrom(cursor.updatedAt) : null;
  const archiveBaseWhere = {
    ...scopedWhere,
    channel: "Email",
    status: {
      in: ["Sent", "Simulated"],
    },
  };
  const pageWhere = cursor && cursorDate
    ? {
        ...archiveBaseWhere,
        OR: [
          { updatedAt: { lt: cursorDate } },
          { updatedAt: cursorDate, id: { lt: cursor.id } },
        ],
      }
    : archiveBaseWhere;

  const requestedDeliveryId = String(options.deliveryId ?? "").trim();
  const [pageCandidates, totalSent, liveSent, simulated] = await Promise.all([
    prisma.backendOutboundDelivery.findMany({
      where: pageWhere,
      select: deliverySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    }),
    prisma.backendOutboundDelivery.count({ where: archiveBaseWhere }),
    prisma.backendOutboundDelivery.count({
      where: {
        ...scopedWhere,
        channel: "Email",
        status: "Sent",
      },
    }),
    prisma.backendOutboundDelivery.count({
      where: {
        ...scopedWhere,
        channel: "Email",
        status: "Simulated",
      },
    }),
  ]);

  const hasMore = pageCandidates.length > pageSize;
  const pageRows = hasMore ? pageCandidates.slice(0, pageSize) : pageCandidates;
  let lookupRows = pageRows;

  if (requestedDeliveryId && !lookupRows.some((row) => row.id === requestedDeliveryId)) {
    const selected = await prisma.backendOutboundDelivery.findFirst({
      where: {
        ...archiveBaseWhere,
        id: requestedDeliveryId,
      },
      select: deliverySelect,
    });

    if (selected) {
      lookupRows = [selected, ...lookupRows];
    }
  }

  const parsedEntries: Array<[string, EmailDeliveryPayload]> = [];
  for (const row of lookupRows) {
    const payload = parseEmailDeliveryPayload(row.payloadJson);
    if (payload) parsedEntries.push([row.id, payload]);
  }
  const parsedPayloads = new Map<string, EmailDeliveryPayload>(parsedEntries);
  const approvalIds = Array.from(
    new Set(Array.from(parsedPayloads.values()).map((payload) => payload.approvalId)),
  );
  const ownerIds = Array.from(new Set(lookupRows.map((row) => row.userId)));
  const [approvalRows, owners] = await Promise.all([
    approvalIds.length
      ? prisma.backendApprovalItem.findMany({
          where: {
            id: { in: approvalIds },
            ...approvalScopeWhere(context, scope),
            actionType: "client_email.approval",
          },
          select: approvalSelect,
        })
      : Promise.resolve<ApprovalRow[]>([]),
    ownerIds.length
      ? prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve<Array<{ id: string; name: string; email: string }>>([]),
  ]);
  const typedApprovalRows = approvalRows as ApprovalRow[];
  const approvalById = new Map<string, ApprovalRow>(
    typedApprovalRows.map((row) => [row.id, row]),
  );
  const names = ownerNameMap(owners);
  const items = pageRows
    .map((row) => {
      const payload = parsedPayloads.get(row.id);
      return publicArchiveItem({
        row,
        ownerName: names.get(row.userId) ?? "Advisor",
        approval: payload ? approvalById.get(payload.approvalId) ?? null : null,
      });
    })
    .filter((item): item is EmailArchiveItem => Boolean(item))
    .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));
  const activeRow =
    lookupRows.find((row) => row.id === requestedDeliveryId) ?? lookupRows[0] ?? null;
  const activePayload = activeRow ? parsedPayloads.get(activeRow.id) : null;
  const activeItem = activeRow
    ? publicArchiveDetail({
        row: activeRow,
        ownerName: names.get(activeRow.userId) ?? "Advisor",
        approval: activePayload
          ? approvalById.get(activePayload.approvalId) ?? null
          : null,
      })
    : null;
  const uniqueRecipients = new Set(
    pageRows
      .map((row) => parsedPayloads.get(row.id)?.recipientEmailHash)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const finalPageRow = pageRows.at(-1) ?? null;

  return {
    ok: true,
    scope,
    items,
    activeItem,
    metrics: {
      totalSent,
      liveSent,
      simulated,
      uniqueRecipients,
      lastSentAt: items[0]?.sentAt ?? null,
    },
    pagination: {
      nextCursor: hasMore && finalPageRow ? encodeArchiveCursor(finalPageRow) : null,
      hasMore,
      pageSize,
    },
    generatedAt: new Date().toISOString(),
  };
}

type PublicEmailJobInput = {
  id: string;
  jobKey: string;
  jobName: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  progress: EmailJobView["progress"];
  error: string | null;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  payloadKeys: string[];
};

function publicJob(job: PublicEmailJobInput): EmailJobView {
  return {
    id: job.id,
    jobKey: job.jobKey,
    jobName: job.jobName,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    error: job.error,
    availableAt: job.availableAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    payloadKeys: job.payloadKeys,
  };
}

export async function listClientEmailCenter(
  user: EmailCenterUser,
  options: {
    scope?: "mine" | "firm";
    draftId?: string | null;
  } = {},
): Promise<EmailCenterPayload> {
  const context = await requireEmailCenterContext({ userId: user.id });
  const scope = options.scope === "firm" && context.canViewFirm ? "firm" : "mine";
  const [clients, branding] = await Promise.all([
    loadClientOptions(context),
    loadEmailBrandingPreference(context),
  ]);
  const draftWhere = draftScopeWhere(context, scope);
  const approvalWhere = approvalScopeWhere(context, scope);

  const [draftRows, approvalRows, deliveryRows, jobs, archiveCount] = await Promise.all([
    prisma.clientCommunicationDraft.findMany({
      where: draftWhere,
      select: draftSelect,
      orderBy: { updatedAt: "desc" },
      take: MAX_DRAFTS,
    }),
    prisma.backendApprovalItem.findMany({
      where: {
        ...approvalWhere,
        actionType: "client_email.approval",
      },
      select: approvalSelect,
      orderBy: { createdAt: "desc" },
      take: MAX_APPROVALS,
    }),
    prisma.backendOutboundDelivery.findMany({
      where: {
        ...draftWhere,
        channel: "Email",
        status: { notIn: ["Sent", "Simulated"] },
      },
      select: deliverySelect,
      orderBy: { createdAt: "desc" },
      take: MAX_DELIVERIES,
    }),
    listBackgroundJobs({
      ...(scope === "firm"
        ? { firmId: context.firmId }
        : { userId: context.user.id, firmId: context.firmId }),
      limit: MAX_EMAIL_JOBS,
    }),
    prisma.backendOutboundDelivery.count({
      where: {
        ...draftWhere,
        channel: "Email",
        status: { in: ["Sent", "Simulated"] },
      },
    }),
  ]);

  const ownerIds = Array.from(
    new Set([
      ...draftRows.map((draft) => draft.userId),
      ...approvalRows.map((approval) => approval.userId),
      ...deliveryRows.map((delivery) => delivery.userId),
    ]),
  );
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const names = ownerNameMap(owners);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const clientByName = new Map(
    clients.map((client) => [client.fullName.toLowerCase(), client]),
  );
  const drafts = draftRows.map((row) =>
    draftSummary({
      row,
      ownerName: names.get(row.userId) ?? "Advisor",
      clientById,
      clientByName,
    }),
  );
  const requestedDraftId = String(options.draftId ?? "").trim();
  const activeRow =
    draftRows.find((row) => row.id === requestedDraftId) ?? draftRows[0] ?? null;
  const activeDraft = activeRow
    ? draftDetail({
        row: activeRow,
        ownerName: names.get(activeRow.userId) ?? "Advisor",
        clientById,
        clientByName,
      })
    : null;
  const approvals = approvalRows.map((row) => publicApproval(row, context));
  const deliveries = deliveryRows
    .map(publicDelivery)
    .filter((delivery): delivery is EmailDeliveryView => Boolean(delivery));
  const emailJobs = jobs
    .filter((job) => job.jobKey === "email_ai_generate" || job.jobKey === "email_delivery")
    .map(publicJob);

  return {
    ok: true,
    scope,
    permissions: {
      canCreate: true,
      canApprove: true,
      canApproveBulk: context.canApproveBulk,
      canViewFirm: context.canViewFirm,
      canDeleteDrafts: context.canDeleteDrafts,
    },
    clients,
    branding,
    drafts,
    activeDraft,
    approvals,
    deliveries,
    jobs: emailJobs,
    metrics: {
      clientsWithEmail: clients.filter((client) => Boolean(client.email)).length,
      draftCount: drafts.filter((draft) => draft.status !== "Archived").length,
      generatingCount: drafts.filter((draft) => draft.status === "Generating").length,
      pendingApprovalCount: approvals.filter((approval) => approval.status === "Pending").length,
      approvedCount: drafts.filter((draft) => draft.status === "Approved").length,
      scheduledCount: deliveries.filter((delivery) => delivery.status === "Scheduled").length,
      sendingCount: deliveries.filter((delivery) =>
        ["Email Queued", "Processing"].includes(delivery.status),
      ).length,
      sentCount: archiveCount,
      archiveCount,
      failedCount: deliveries.filter((delivery) => delivery.status === "Failed").length,
    },
    generatedAt: new Date().toISOString(),
  };
}


function generationAgeMs(row: DraftRow, metadata: EmailDraftMetadata) {
  const requestedAt = metadata.generation.requestedAt
    ? Date.parse(metadata.generation.requestedAt)
    : Number.NaN;
  const base = Number.isFinite(requestedAt)
    ? requestedAt
    : row.createdAt.getTime();

  return Math.max(0, Date.now() - base);
}

async function markUnavailableGenerationFailed(input: {
  row: DraftRow;
  reason: string;
}) {
  const latest = await prisma.clientCommunicationDraft.findUnique({
    where: { id: input.row.id },
    select: draftSelect,
  });

  if (!latest) return null;

  const metadata = readEmailDraftMetadata(latest);

  if (["Completed", "Failed"].includes(metadata.generation.status)) {
    return latest;
  }

  if (metadata.generation.jobId) {
    await requestBackgroundJobCancellation({
      jobId: metadata.generation.jobId,
      userId: latest.userId,
      firmId: latest.firmId,
    }).catch(() => null);
  }

  await markAiGenerationFailed({
    draft: latest,
    error: new Error(
      safeEmailError(
        input.reason,
        "The custom AI worker did not produce a verified email.",
      ),
    ),
  });

  return prisma.clientCommunicationDraft.findUnique({
    where: { id: latest.id },
    select: draftSelect,
  });
}

export async function getClientEmailDraftProgress(
  user: EmailCenterUser,
  input: {
    draftId: string;
    scope?: "mine" | "firm";
  },
): Promise<EmailDraftProgressPayload> {
  const context = await requireEmailCenterContext({ userId: user.id });
  const scope = input.scope === "firm" && context.canViewFirm ? "firm" : "mine";
  const draftId = String(input.draftId ?? "").trim();

  if (!draftId) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DRAFT_ID_REQUIRED",
      message: "A draft is required to read generation progress.",
      expose: true,
    });
  }

  let row = await prisma.clientCommunicationDraft.findFirst({
    where: {
      ...draftScopeWhere(context, scope),
      id: draftId,
    },
    select: draftSelect,
  });

  if (!row) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DRAFT_NOT_FOUND",
      message: "The email draft is no longer available.",
      expose: true,
    });
  }

  let metadata = readEmailDraftMetadata(row);
  let rawJob = metadata.generation.jobId
    ? await getBackgroundJob({
        jobId: metadata.generation.jobId,
        ...(scope === "firm"
          ? { firmId: context.firmId }
          : { userId: context.user.id, firmId: context.firmId }),
        includePayload: false,
      })
    : null;

  const activeGeneration = ["Queued", "Processing"].includes(
    metadata.generation.status,
  );
  const ageMs = generationAgeMs(row, metadata);
  const stallLimitMs =
    metadata.generation.speedMode === "Researched"
      ? RESEARCHED_GENERATION_STALL_MS
      : QUICK_GENERATION_STALL_MS;
  const queuedJob = Boolean(
    rawJob && ["Queued", "Retrying"].includes(rawJob.status),
  );
  const wakeAlreadyRequested =
    rawJob?.progress.message === "Immediate worker recovery requested";

  /*
   * Old drafts that were left in the queue receive a targeted worker wake.
   * Slice never converts a deterministic starter into a successful AI result.
   */
  if (
    activeGeneration &&
    queuedJob &&
    !wakeAlreadyRequested &&
    ageMs >= QUEUED_GENERATION_WAKE_DELAY_MS &&
    rawJob
  ) {
    const woken = await requestBackgroundJobWake({
      jobId: rawJob.id,
      ...(scope === "firm"
        ? { firmId: context.firmId }
        : { userId: context.user.id, firmId: context.firmId }),
    }).catch(() => null);

    if (woken) {
      rawJob = woken;
    }
  }

  const jobTerminal = Boolean(
    rawJob && ["Failed", "DeadLetter", "Cancelled"].includes(rawJob.status),
  );
  const jobMissingTooLong =
    activeGeneration && !rawJob && ageMs >= MISSING_GENERATION_JOB_STALL_MS;
  const jobProgressUpdatedAt = rawJob?.progress.updatedAt
    ? Date.parse(rawJob.progress.updatedAt)
    : Number.NaN;
  const progressHeartbeatAgeMs = Number.isFinite(jobProgressUpdatedAt)
    ? Date.now() - jobProgressUpdatedAt
    : ageMs;
  const queuedRecoveryStalled = Boolean(
    activeGeneration &&
      rawJob &&
      ["Queued", "Retrying"].includes(rawJob.status) &&
      rawJob.progress.message === "Immediate worker recovery requested" &&
      progressHeartbeatAgeMs >= stallLimitMs,
  );
  const processingStalled = Boolean(
    activeGeneration &&
      rawJob?.status === "Processing" &&
      progressHeartbeatAgeMs >= stallLimitMs,
  );

  if (
    activeGeneration &&
    (jobTerminal ||
      jobMissingTooLong ||
      queuedRecoveryStalled ||
      processingStalled)
  ) {
    const failed = await markUnavailableGenerationFailed({
      row,
      reason: jobTerminal
        ? `The custom AI job ended with status ${rawJob?.status ?? "Failed"}.`
        : jobMissingTooLong
          ? "The custom AI job record was unavailable. Generate the email again."
          : queuedRecoveryStalled
            ? "The custom AI worker did not start after recovery was requested. Generate the email again."
            : "The custom AI worker stopped reporting progress before producing a verified email. Generate the email again.",
    });

    if (failed) {
      row = failed;
      metadata = readEmailDraftMetadata(row);
      rawJob = metadata.generation.jobId
        ? await getBackgroundJob({
            jobId: metadata.generation.jobId,
            ...(scope === "firm"
              ? { firmId: context.firmId }
              : { userId: context.user.id, firmId: context.firmId }),
            includePayload: false,
          })
        : null;
    }
  }

  const clientRows = metadata.recipient.clientId
    ? await prisma.clientProfile.findMany({
        where: {
          ...clientWhere(context),
          id: metadata.recipient.clientId,
        },
        select: clientOptionSelect,
        take: 1,
      })
    : [];
  const clients = clientRows.map((client) => clientOptionFromRow(client));
  const clientById = new Map(clients.map((client) => [client.id, client] as const));
  const clientByName = new Map(
    clients.map((client) => [client.fullName.toLowerCase(), client] as const),
  );
  const owner = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { name: true, email: true },
  });
  let draft = draftDetail({
    row,
    ownerName: owner?.name || owner?.email || "Advisor",
    clientById,
    clientByName,
  });

  const job = rawJob ? publicJob(rawJob) : null;

  if (
    job?.status === "Processing" &&
    draft.generation.status === "Queued"
  ) {
    draft = {
      ...draft,
      generation: {
        ...draft.generation,
        status: "Processing" as const,
      },
    };
  }

  const status = draft.generation.status;
  const terminal = ["Completed", "Completed With Fallback", "Failed"].includes(status);
  const value = terminal
    ? 100
    : Math.max(
        3,
        Math.min(
          99,
          Number(
            job?.progress.value ??
              (status === "Processing" ? 12 : 3),
          ),
        ),
      );
  const message = terminal
    ? status === "Completed"
      ? "Real custom AI email is complete and ready to edit"
      : status === "Completed With Fallback"
        ? "Legacy fallback detected. Retry Custom AI before editing or approval."
        : "Custom AI did not produce a verified email. Retry generation."
    : job?.progress.message ||
      (status === "Queued"
        ? "Waking the custom AI worker for this recipient"
        : status === "Processing"
          ? "Custom AI is writing the prompt-specific subject and complete email"
          : "Waiting for verified AI output");

  return {
    ok: true,
    draft,
    job,
    locked: !draft.editable,
    progress: {
      value,
      message,
      status,
      updatedAt: job?.progress.updatedAt ?? draft.updatedAt,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function retryAiClientEmailGeneration(input: {
  user: EmailCenterUser;
  request?: Request;
  draftId: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftId = String(input.draftId ?? "").trim();
  const draft = await findDraftForOwner(context, draftId);
  const metadata = readEmailDraftMetadata(draft);

  if (metadata.origin !== "AI") {
    throw new ApiError({
      status: 409,
      code: "EMAIL_AI_RETRY_NOT_APPLICABLE",
      message: "Only an AI-generated draft can be regenerated through Custom AI.",
      expose: true,
    });
  }

  const existingJob = metadata.generation.jobId
    ? await getBackgroundJob({
        jobId: metadata.generation.jobId,
        userId: context.user.id,
        firmId: context.firmId,
        includePayload: true,
      })
    : null;

  const rawPayload = existingJob?.payload;
  const generationPayload =
    rawPayload &&
    rawPayload.schemaVersion === 2 &&
    rawPayload.draftId === draft.id &&
    rawPayload.requestedByUserId === context.user.id
      ? (rawPayload as unknown as EmailAiGenerationPayload)
      : null;

  if (!generationPayload) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_AI_RETRY_CONTEXT_MISSING",
      message:
        "The original Custom AI prompt is no longer available for this draft. Return to AI Prompt and create a new email.",
      expose: true,
    });
  }

  let job: NonNullable<Awaited<ReturnType<typeof getBackgroundJob>>>;

  if (existingJob && ["Queued", "Retrying"].includes(existingJob.status)) {
    job =
      (await requestBackgroundJobWake({
        jobId: existingJob.id,
        userId: context.user.id,
        firmId: context.firmId,
      })) ?? existingJob;
  } else if (existingJob?.status === "Processing") {
    job = existingJob;
  } else if (
    existingJob &&
    ["Failed", "DeadLetter", "Cancelled"].includes(existingJob.status)
  ) {
    job = await retryBackgroundJob({
      jobId: existingJob.id,
      userId: context.user.id,
      firmId: context.firmId,
      resetAttempts: true,
    });
  } else {
    const queued = await enqueueBackgroundJob({
      context: {
        userId: context.user.id,
        firmId: context.firmId,
        actorName: context.user.name,
        actorEmail: context.user.email,
      },
      jobKey: "email_ai_generate",
      jobName: "AI Client Email Draft",
      payload: {
        ...(generationPayload as unknown as Record<string, unknown>),
        requestedAt: new Date().toISOString(),
      },
      idempotencyKey: `email-ai-regenerate:${draft.id}:${Date.now()}`,
      maxAttempts: 3,
      timeoutMs:
        generationPayload.speedMode === "Quick" ? 120_000 : 210_000,
      backoffMs:
        generationPayload.speedMode === "Quick" ? 5_000 : 12_000,
    });
    job = queued.job;
  }

  const requestedAt = new Date().toISOString();
  const nextMetadata: EmailDraftMetadata = {
    ...metadata,
    approval: {
      ...metadata.approval,
      status:
        metadata.approval.status === "None" ? "None" : "Superseded",
    },
    generation: {
      ...metadata.generation,
      jobId: job.id,
      status: "Queued",
      starterReady: false,
      provider: null,
      model: null,
      researchUsed: false,
      sources: [],
      error: null,
      requestedAt,
      completedAt: null,
    },
  };

  await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      status: "Generating",
    },
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.ai_generation_retried",
    title: "Custom AI email generation retried",
    detail:
      "The original advisor prompt was requeued for a real prompt-specific AI subject and email body.",
    metadata: {
      draftId: draft.id,
      jobId: job.id,
      speedMode: generationPayload.speedMode,
    },
  });

  return {
    ok: true,
    draftId: draft.id,
    jobId: job.id,
    status: job.status,
  };
}

async function accessibleClientsByIds(
  context: EmailCenterContext,
  clientIds: string[],
) {
  if (!clientIds.length) return [];

  const clients = await prisma.clientProfile.findMany({
    where: {
      ...clientWhere(context),
      id: { in: clientIds },
    },
    select: clientOptionSelect,
    orderBy: { fullName: "asc" },
  });

  if (clients.length !== clientIds.length) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_CLIENT_NOT_FOUND",
      message: "One or more selected clients are not available in your advisor scope.",
      expose: true,
    });
  }

  return clients.map((client) => ({
    ...client,
    decryptedEmail: accessibleClientEmail(client.email),
    clientOption: clientOptionFromRow(client),
  }));
}

async function auditEmailAction(input: {
  context: EmailCenterContext;
  request?: Request;
  eventType: string;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
  severity?: "Info" | "Low" | "Medium" | "High" | "Critical";
}) {
  await recordSecurityEvent({
    userId: input.context.user.id,
    eventType: input.eventType,
    severity: input.severity ?? "Medium",
    area: "Client Email Center",
    title: input.title,
    detail: input.detail,
    metadata: {
      firmId: input.context.firmId,
      ...input.metadata,
    },
    request: input.request,
  });
}

function metadataForNewDraft(input: {
  origin: "Manual" | "AI";
  userId: string;
  clientId: string | null;
  clientName: string | null;
  recipientEmail: string | null;
  subject: string;
  body: string;
  tone: string;
  versionLabel: string;
  branding: EmailBrandingPreference;
}) {
  let metadata = {
    ...createDefaultEmailDraftMetadata({
      origin: input.origin,
      subject: input.subject,
      body: input.body,
      tone: input.tone,
      clientId: input.clientId,
      clientName: input.clientName,
      recipientEmail: input.recipientEmail,
      branding: input.branding,
    }),
    revision: 0,
  };
  const initialVersion = createStoredEmailVersion({
    metadata,
    subject: input.subject,
    body: input.body,
    tone: input.tone,
    label: input.versionLabel,
    origin: input.origin === "AI" ? "AI" : "Manual",
    createdByUserId: input.userId,
  });
  metadata = appendStoredEmailVersion(metadata, initialVersion);
  metadata = {
    ...metadata,
    revision: 1,
    contentHash: initialVersion.contentHash,
    selectedVersionId: initialVersion.id,
  };

  return metadata;
}

export async function createManualClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  clientIds?: string[];
  subject: unknown;
  body: unknown;
  tone?: unknown;
  allowScratch?: boolean;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const branding = await loadEmailBrandingPreference(context);
  const clientIds = normalizeIds(input.clientIds, MAX_BATCH_DRAFTS);
  const subject = cleanEmailSubject(input.subject);
  const body = cleanEmailBody(input.body);
  const tone = cleanEmailTone(input.tone);

  if (!subject || !body) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DRAFT_CONTENT_REQUIRED",
      message: "A subject and message body are required.",
      expose: true,
    });
  }

  if (!clientIds.length && input.allowScratch !== true) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_RECIPIENT_REQUIRED",
      message: "Select at least one client or create an unassigned scratch draft.",
      expose: true,
    });
  }

  const clients = await accessibleClientsByIds(context, clientIds);
  const missingEmail = clients.filter((client) => !client.decryptedEmail);

  if (missingEmail.length) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_RECIPIENT_MISSING",
      message: `${missingEmail.length} selected client(s) do not have a valid email address.`,
      expose: true,
      details: {
        clientIds: missingEmail.map((client) => client.id),
      },
    });
  }

  const targets = clients.length
    ? clients
    : [
        {
          id: null,
          fullName: null,
          decryptedEmail: null,
        },
      ];
  const created: DraftRow[] = [];

  for (const client of targets) {
    const metadata = metadataForNewDraft({
      origin: "Manual",
      userId: context.user.id,
      clientId: client.id,
      clientName: client.fullName,
      recipientEmail: client.decryptedEmail,
      subject,
      body,
      tone,
      versionLabel: "Manual draft",
      branding,
    });

    const row = await prisma.clientCommunicationDraft.create({
      data: {
        userId: context.user.id,
        firmId: context.firmId,
        clientName: client.fullName,
        channel: "Email",
        audience: client.id ? "Client" : "Scratch",
        title: encryptEmailText(subject),
        body: encryptEmailText(body),
        sourceSummaryJson: writeEmailDraftMetadata(metadata),
        complianceNotesJson: writeEmailComplianceNotes([
          "Advisor review is required before external delivery.",
          "Confirm the recipient, factual claims, suitability context, and required disclosures.",
        ]),
        status: "Draft",
        tone,
      },
      select: draftSelect,
    });

    created.push(row);
  }

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.draft_created",
    title: "Client email draft created",
    detail: `${created.length} manual email draft(s) were created.`,
    metadata: {
      draftIds: created.map((draft) => draft.id),
      recipientCount: clients.length,
      scratch: clients.length === 0,
    },
  });

  return {
    ok: true,
    createdDraftIds: created.map((draft) => draft.id),
    activeDraftId: created[0]?.id ?? null,
  };
}

function aiRequestHash(input: {
  userId: string;
  clientId: string;
  topic: string;
  purpose: string;
  completePrompt: string;
  promptPlan: EmailPromptPlan;
  tone: string;
  advisorInstructions: string;
  callToAction: string;
  useResearch: boolean;
  speedMode: EmailGenerationSpeed;
  optionCount: number;
  mode: "Generate" | "Polish";
  revision?: number;
}) {
  return digest({
    ...input,
    bucket: Math.floor(Date.now() / (10 * 60_000)),
  });
}

async function enqueueAiDraftJob(input: {
  context: EmailCenterContext;
  draft: DraftRow;
  metadata: EmailDraftMetadata;
  generation: EmailAiGenerationPayload;
  idempotencyKey: string;
}) {
  const queued = await enqueueBackgroundJob({
    context: {
      userId: input.context.user.id,
      firmId: input.context.firmId,
      actorName: input.context.user.name,
      actorEmail: input.context.user.email,
    },
    jobKey: "email_ai_generate",
    jobName: "AI Client Email Draft",
    payload: input.generation as unknown as Record<string, unknown>,
    idempotencyKey: input.idempotencyKey,
    maxAttempts: 3,
    timeoutMs: input.generation.speedMode === "Quick" ? 120_000 : 210_000,
    backoffMs: input.generation.speedMode === "Quick" ? 5_000 : 12_000,
  });

  if (queued.duplicate) {
    const existing = await getBackgroundJob({
      jobId: queued.job.id,
      userId: input.context.user.id,
      firmId: input.context.firmId,
      includePayload: true,
    });
    const existingDraftId = String(existing?.payload?.draftId ?? "").trim();

    if (existingDraftId && existingDraftId !== input.draft.id) {
      await prisma.clientCommunicationDraft.delete({
        where: { id: input.draft.id },
      });

      return {
        job: queued.job,
        draftId: existingDraftId,
        duplicate: true,
      };
    }
  }

  const nextMetadata: EmailDraftMetadata = {
    ...input.metadata,
    generation: {
      ...input.metadata.generation,
      jobId: queued.job.id,
      status: "Queued",
    },
  };

  await prisma.clientCommunicationDraft.update({
    where: { id: input.draft.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      status: "Generating",
    },
  });

  return {
    job: queued.job,
    draftId: input.draft.id,
    duplicate: queued.duplicate,
  };
}

export async function createAiClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  clientIds: string[];
  prompt?: unknown;
  topic?: unknown;
  purpose?: unknown;
  tone?: unknown;
  advisorInstructions?: unknown;
  callToAction?: unknown;
  useResearch?: boolean;
  speedMode?: unknown;
  optionCount?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const branding = await loadEmailBrandingPreference(context);
  const clientIds = normalizeIds(input.clientIds, MAX_AI_CLIENTS);
  const tone = cleanEmailTone(input.tone);
  const promptPlan = compileEmailPrompt({
    prompt: input.prompt,
    tone,
    legacyTopic: input.topic,
    legacyPurpose: input.purpose,
    legacyInstructions: input.advisorInstructions,
    legacyCallToAction: input.callToAction,
  });
  const completePrompt = promptPlan.originalPrompt;
  const topic = cleanEmailSubject(promptPlan.subjectFocus);
  const purpose = promptPlan.communicationGoal.slice(0, 2_000);
  const advisorInstructions = String(input.advisorInstructions ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 4_000);
  const callToAction = promptPlan.callToAction.slice(0, 2_000);
  const speedMode: EmailGenerationSpeed =
    input.speedMode === "Researched" ? "Researched" : "Quick";
  const optionCount = Math.max(
    1,
    Math.min(
      3,
      Number(input.optionCount) || (speedMode === "Quick" ? 1 : 2),
    ),
  );
  const useResearch =
    speedMode === "Researched" &&
    (input.useResearch === true || promptPlan.currentFactsRequired);

  if (!clientIds.length) {
    throw new ApiError({
      status: 400,
      code: "AI_EMAIL_CLIENT_REQUIRED",
      message: "Select at least one client for AI draft generation.",
      expose: true,
    });
  }

  if (!completePrompt || completePrompt.length < 12) {
    throw new ApiError({
      status: 400,
      code: "AI_EMAIL_PROMPT_REQUIRED",
      message:
        "Describe the communication you want Slice to create, including its purpose and the next action for the client.",
      expose: true,
    });
  }

  const clients = await accessibleClientsByIds(context, clientIds);
  const missingEmail = clients.filter((client) => !client.decryptedEmail);

  if (missingEmail.length) {
    throw new ApiError({
      status: 400,
      code: "AI_EMAIL_RECIPIENT_MISSING",
      message: `${missingEmail.length} selected client(s) do not have a valid email address.`,
      expose: true,
      details: {
        clientIds: missingEmail.map((client) => client.id),
      },
    });
  }

  const createForClient = async (client: (typeof clients)[number]) => {
    const clientOption: EmailClientOption = {
      ...client.clientOption,
      email: client.decryptedEmail,
      emailMissing: !client.decryptedEmail,
    };
    const starter = buildImmediateEmailDraft({
      advisorName: context.user.name,
      client: clientOption,
      plan: promptPlan,
    });
    const requestHash = aiRequestHash({
      userId: context.user.id,
      clientId: client.id,
      topic,
      purpose,
      completePrompt,
      promptPlan,
      tone,
      advisorInstructions,
      callToAction,
      useResearch,
      speedMode,
      optionCount,
      mode: "Generate",
    });
    let metadata = metadataForNewDraft({
      origin: "AI",
      userId: context.user.id,
      clientId: client.id,
      clientName: client.fullName,
      recipientEmail: client.decryptedEmail,
      subject: starter.subject,
      body: starter.body,
      tone,
      versionLabel: "Instant tailored starter",
      branding,
    });
    metadata = {
      ...metadata,
      generation: {
        ...metadata.generation,
        status: "Queued",
        mode: "Generate",
        speedMode,
        starterReady: false,
        requestHash,
        optionCount,
        promptSummary: promptPlan.promptSummary,
        promptIntent: promptPlan.messageType,
        subjectStrategy: starter.strategy,
        qualityScore: null,
        requestedAt: new Date().toISOString(),
      },
    };

    const draft = await prisma.clientCommunicationDraft.create({
      data: {
        userId: context.user.id,
        firmId: context.firmId,
        clientName: client.fullName,
        channel: "Email",
        audience: "Client",
        title: encryptEmailText(starter.subject),
        body: encryptEmailText(starter.body),
        sourceSummaryJson: writeEmailDraftMetadata(metadata),
        complianceNotesJson: writeEmailComplianceNotes([
          "Slice stored a private preflight draft while OpenAI creates the final prompt-specific subject and message.",
          "Editing and approval remain locked until verified custom AI output completes.",
          "AI-generated content must be reviewed and edited by the advisor before approval.",
        ]),
        status: "Generating",
        tone,
      },
      select: draftSelect,
    });

    const generation: EmailAiGenerationPayload = {
      schemaVersion: 2,
      mode: "Generate",
      draftId: draft.id,
      topic,
      purpose,
      completePrompt,
      promptPlan,
      tone,
      advisorInstructions,
      callToAction,
      useResearch,
      speedMode,
      optionCount,
      requestedByUserId: context.user.id,
      requestedAt: new Date().toISOString(),
    };
    const queued = await enqueueAiDraftJob({
      context,
      draft,
      metadata,
      generation,
      idempotencyKey: `email-ai:${requestHash}`,
    });

    return {
      draftId: queued.draftId,
      jobId: queued.job.id,
      duplicate: queued.duplicate,
    };
  };

  const results: Array<{
    draftId: string;
    jobId: string;
    duplicate: boolean;
  }> = [];
  const concurrency = Math.min(4, clients.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < clients.length) {
        const index = cursor;
        cursor += 1;
        const client = clients[index];
        if (!client) continue;
        results[index] = await createForClient(client);
      }
    }),
  );

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.ai_generation_queued",
    title: "AI email generation queued",
    detail: `${results.length} tailored background AI draft job(s) were queued.`,
    metadata: {
      draftIds: results.map((result) => result.draftId),
      jobIds: results.map((result) => result.jobId),
      duplicateCount: results.filter((result) => result.duplicate).length,
      optionCount,
      speedMode,
      useResearch,
      messageType: promptPlan.messageType,
      currentFactsRequired: promptPlan.currentFactsRequired,
      subjectCandidateCount: promptPlan.subjectCandidates.length,
    },
  });

  const resultIds = results.map((result) => result.draftId).filter(Boolean);
  const createdRows: DraftRow[] = resultIds.length
    ? await prisma.clientCommunicationDraft.findMany({
        where: {
          id: { in: resultIds },
          firmId: context.firmId,
        },
        select: draftSelect,
      })
    : [];
  const rowById = new Map<string, DraftRow>(
    createdRows.map((row) => [row.id, row] as const),
  );
  const createdClientOptions: EmailClientOption[] = clients.map((client) => ({
    ...client.clientOption,
    email: client.decryptedEmail,
    emailMissing: !client.decryptedEmail,
  }));
  const clientById = new Map<string, EmailClientOption>(
    createdClientOptions.map((client) => [client.id, client] as const),
  );
  const clientByName = new Map<string, EmailClientOption>(
    createdClientOptions.map((client) => [client.fullName.toLowerCase(), client] as const),
  );
  const createdDrafts = results
    .map((result) => rowById.get(result.draftId))
    .filter((row): row is DraftRow => Boolean(row))
    .map((row) =>
      draftSummary({
        row,
        ownerName: context.user.name,
        clientById,
        clientByName,
      }),
    );
  const activeRow = results[0]?.draftId ? rowById.get(results[0].draftId) ?? null : null;
  const activeDraft = activeRow
    ? draftDetail({
        row: activeRow,
        ownerName: context.user.name,
        clientById,
        clientByName,
      })
    : null;

  return {
    ok: true,
    message:
      results.length === 1
        ? "Custom AI drafting started. The editor will unlock automatically when this email is complete."
        : `${results.length} custom AI drafts are being completed. Each editor unlocks independently when its email is ready.`,
    generationMode: speedMode,
    messageType: promptPlan.messageType,
    subjectCandidates: promptPlan.subjectCandidates,
    starterReady: false,
    results,
    createdDrafts,
    activeDraft,
    activeDraftId: activeDraft?.id ?? results[0]?.draftId ?? null,
  };
}

async function findDraftForOwner(context: EmailCenterContext, draftId: string) {
  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: draftId,
      firmId: context.firmId,
      userId: context.user.id,
    },
    select: draftSelect,
  });

  if (!draft) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DRAFT_NOT_FOUND",
      message: "Email draft not found.",
      expose: true,
    });
  }

  return draft;
}

async function cancelActiveDraftDelivery(input: {
  context: EmailCenterContext;
  metadata: EmailDraftMetadata;
}) {
  const deliveryId = input.metadata.delivery.deliveryId;
  const jobId = input.metadata.delivery.jobId;

  if (!deliveryId) return;

  const delivery = await prisma.backendOutboundDelivery.findFirst({
    where: {
      id: deliveryId,
      firmId: input.context.firmId,
    },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  if (!delivery || ["Sent", "Simulated", "Cancelled", "Failed"].includes(delivery.status)) {
    return;
  }

  if (delivery.status === "Processing") {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_ALREADY_PROCESSING",
      message: "This email is already being sent and can no longer be edited.",
      expose: true,
    });
  }

  if (jobId) {
    await requestBackgroundJobCancellation({
      jobId,
      userId: delivery.userId,
      firmId: input.context.firmId,
    }).catch(() => null);
  }

  await prisma.backendOutboundDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "Cancelled",
      failureReason: "Cancelled because the draft content changed.",
    },
  });
}


export async function updateClientEmailDraft(input: {
  user: EmailCenterUser;
  request?: Request;
  draftId: unknown;
  subject: unknown;
  body: unknown;
  tone?: unknown;
  branding?: unknown;
  expectedRevision?: unknown;
  checkpoint?: boolean;
  checkpointLabel?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftId = String(input.draftId ?? "").trim();
  const draft = await findDraftForOwner(context, draftId);
  const metadata = readEmailDraftMetadata(draft);
  const expectedRevision = Number(input.expectedRevision);

  if (Number.isInteger(expectedRevision) && expectedRevision !== metadata.revision) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DRAFT_VERSION_CONFLICT",
      message: "This draft changed in another tab. Refresh before saving again.",
      expose: true,
      details: {
        currentRevision: metadata.revision,
      },
    });
  }

  const currentStatus = normalizeEmailDraftStatus(draft.status);

  if (["Sending", "Sent", "Simulated", "Archived"].includes(currentStatus)) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DRAFT_LOCKED",
      message: `A ${currentStatus.toLowerCase()} draft cannot be edited.`,
      expose: true,
    });
  }

  const subject = cleanEmailSubject(input.subject);
  const body = cleanEmailBody(input.body);
  const tone = cleanEmailTone(input.tone, draft.tone);
  const branding = normalizeEmailBranding(input.branding, metadata.branding);

  if (!subject || !body) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DRAFT_CONTENT_REQUIRED",
      message: "A subject and message body are required.",
      expose: true,
    });
  }

  const contentHash = emailContentHash({ subject, body, tone, branding });

  if (contentHash === metadata.contentHash) {
    return {
      ok: true,
      unchanged: true,
      draftId: draft.id,
      revision: metadata.revision,
    };
  }

  await cancelActiveDraftDelivery({ context, metadata });

  let nextMetadata: EmailDraftMetadata = {
    ...metadata,
    revision: metadata.revision + 1,
    contentHash,
    branding,
    humanEditCount: metadata.humanEditCount + 1,
    lastHumanEditAt: new Date().toISOString(),
    approval: {
      ...metadata.approval,
      status: metadata.approval.status === "None" ? "None" : "Superseded",
    },
    delivery: {
      ...metadata.delivery,
      status:
        metadata.delivery.status === "None" ? "None" : "Cancelled",
      failureReason:
        metadata.delivery.status === "None"
          ? null
          : "Cancelled because the draft content changed.",
    },
  };

  if (input.checkpoint === true) {
    const version = createStoredEmailVersion({
      metadata: nextMetadata,
      subject,
      body,
      tone,
      label: String(input.checkpointLabel ?? "Advisor checkpoint"),
      origin: "Checkpoint",
      createdByUserId: context.user.id,
    });
    nextMetadata = appendStoredEmailVersion(nextMetadata, version);
  }

  const updated = await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      title: encryptEmailText(subject),
      body: encryptEmailText(body),
      tone,
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      status: currentStatus === "Generation Failed" ? "Draft" : "Edited",
    },
    select: draftSelect,
  });

  if (metadata.origin === "AI" && metadata.humanEditCount === 0) {
    await auditEmailAction({
      context,
      request: input.request,
      eventType: "client_email.ai_output_human_edited",
      title: "AI-generated email edited by advisor",
      detail:
        "The advisor changed AI-generated email content before approval or delivery.",
      metadata: {
        draftId: draft.id,
        previousRevision: metadata.revision,
        nextRevision: nextMetadata.revision,
      },
    });
  }

  if (input.checkpoint === true) {
    await auditEmailAction({
      context,
      request: input.request,
      eventType: "client_email.version_saved",
      title: "Email draft version saved",
      detail: "The advisor saved a named email-draft checkpoint.",
      metadata: {
        draftId: draft.id,
        revision: nextMetadata.revision,
        versionCount: nextMetadata.versions.length,
      },
    });
  }

  return {
    ok: true,
    draftId: updated.id,
    revision: nextMetadata.revision,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function selectClientEmailDraftVersion(input: {
  user: EmailCenterUser;
  request?: Request;
  draftId: unknown;
  versionId: unknown;
  expectedRevision?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draft = await findDraftForOwner(context, String(input.draftId ?? "").trim());
  const metadata = readEmailDraftMetadata(draft);
  const expectedRevision = Number(input.expectedRevision);

  if (Number.isInteger(expectedRevision) && expectedRevision !== metadata.revision) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DRAFT_VERSION_CONFLICT",
      message: "This draft changed before the version was selected. Refresh and retry.",
      expose: true,
    });
  }

  const versionId = String(input.versionId ?? "").trim();
  const version = metadata.versions.find((candidate) => candidate.id === versionId);

  if (!version) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_VERSION_NOT_FOUND",
      message: "Draft version not found.",
      expose: true,
    });
  }

  await cancelActiveDraftDelivery({ context, metadata });

  const subject = decryptEmailText(version.subjectEncrypted);
  const body = decryptEmailText(version.bodyEncrypted);
  const selectedBranding = normalizeEmailBranding(
    version.branding,
    metadata.branding,
  );
  const selectedContentHash = emailContentHash({
    subject,
    body,
    tone: version.tone,
    branding: selectedBranding,
  });
  const nextMetadata: EmailDraftMetadata = {
    ...metadata,
    revision: metadata.revision + 1,
    contentHash: selectedContentHash,
    branding: selectedBranding,
    selectedVersionId: version.id,
    humanEditCount: metadata.humanEditCount + 1,
    lastHumanEditAt: new Date().toISOString(),
    approval: {
      ...metadata.approval,
      status: metadata.approval.status === "None" ? "None" : "Superseded",
    },
    delivery: {
      ...metadata.delivery,
      status: metadata.delivery.status === "None" ? "None" : "Cancelled",
    },
  };

  await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      title: encryptEmailText(subject),
      body: encryptEmailText(body),
      tone: version.tone,
      complianceNotesJson: writeEmailComplianceNotes(version.complianceNotes ?? []),
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      status: "Edited",
    },
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.version_selected",
    title: "Preferred email version selected",
    detail: "The advisor selected a saved draft version as the active email.",
    metadata: {
      draftId: draft.id,
      versionId: version.id,
      revision: nextMetadata.revision,
    },
  });

  return {
    ok: true,
    draftId: draft.id,
    revision: nextMetadata.revision,
  };
}

export async function polishExistingClientEmailDraft(input: {
  user: EmailCenterUser;
  request?: Request;
  draftId: unknown;
  polishMode?: unknown;
  advisorInstructions?: unknown;
  optionCount?: unknown;
  speedMode?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draft = await findDraftForOwner(context, String(input.draftId ?? "").trim());
  const metadata = readEmailDraftMetadata(draft);
  const status = normalizeEmailDraftStatus(draft.status);

  if (["Sending", "Sent", "Simulated", "Archived"].includes(status)) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DRAFT_LOCKED",
      message: `A ${status.toLowerCase()} draft cannot be polished.`,
      expose: true,
    });
  }

  const topic = cleanEmailSubject(input.polishMode) || "Polish this advisor email";
  const advisorInstructions = String(input.advisorInstructions ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 4_000);
  const speedMode: EmailGenerationSpeed =
    input.speedMode === "Researched" ? "Researched" : "Quick";
  const optionCount = Math.max(
    1,
    Math.min(3, Number(input.optionCount) || (speedMode === "Quick" ? 1 : 2)),
  );
  const currentSubject = decryptEmailText(draft.title);
  const completePrompt = [
    `Polish the existing advisor-client email titled “${currentSubject}”.`,
    topic,
    advisorInstructions,
    "Preserve verified facts and the existing call to action unless the advisor explicitly requests a change.",
  ]
    .filter(Boolean)
    .join(" ");
  const promptPlan = compileEmailPrompt({
    prompt: completePrompt,
    tone: draft.tone,
    legacyTopic: currentSubject,
    legacyPurpose:
      "Improve clarity, structure, tone, and advisor-readiness while preserving facts.",
    legacyInstructions: advisorInstructions,
    legacyCallToAction:
      "Preserve the existing call to action unless the advisor requests a change.",
  });
  const requestHash = aiRequestHash({
    userId: context.user.id,
    clientId: metadata.recipient.clientId ?? `scratch:${draft.id}`,
    topic,
    purpose: promptPlan.communicationGoal,
    completePrompt,
    promptPlan,
    tone: draft.tone,
    advisorInstructions,
    callToAction: promptPlan.callToAction,
    useResearch: false,
    speedMode,
    optionCount,
    mode: "Polish",
    revision: metadata.revision,
  });
  const generation: EmailAiGenerationPayload = {
    schemaVersion: 2,
    mode: "Polish",
    draftId: draft.id,
    topic,
    purpose: promptPlan.communicationGoal,
    completePrompt,
    promptPlan,
    tone: draft.tone,
    advisorInstructions,
    callToAction: promptPlan.callToAction,
    useResearch: false,
    speedMode,
    optionCount,
    requestedByUserId: context.user.id,
    requestedAt: new Date().toISOString(),
  };
  const nextMetadata: EmailDraftMetadata = {
    ...metadata,
    generation: {
      ...metadata.generation,
      status: "Queued",
      mode: "Polish",
      requestHash,
      speedMode,
      starterReady: true,
      optionCount,
      promptSummary: promptPlan.promptSummary,
      promptIntent: promptPlan.messageType,
      subjectStrategy: "AI polish preserving the advisor-selected content and call to action.",
      qualityScore: null,
      requestedAt: generation.requestedAt,
      error: null,
    },
  };

  await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      status: "Generating",
    },
  });

  const queued = await enqueueAiDraftJob({
    context,
    draft,
    metadata: nextMetadata,
    generation,
    idempotencyKey: `email-polish:${requestHash}`,
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.polish_queued",
    title: "AI email polish queued",
    detail: "A background AI job was queued to create editable polish options.",
    metadata: {
      draftId: draft.id,
      jobId: queued.job.id,
      optionCount,
    },
  });

  return {
    ok: true,
    draftId: queued.draftId,
    jobId: queued.job.id,
    duplicate: queued.duplicate,
  };
}

async function currentRecipientForDraft(
  context: EmailCenterContext,
  metadata: EmailDraftMetadata,
) {
  const clientId = metadata.recipient.clientId;

  if (!clientId) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DRAFT_UNASSIGNED",
      message: "Assign this draft to a client before requesting approval or sending.",
      expose: true,
    });
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      ...clientWhere(context),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      status: true,
      assignedAdvisorMembershipId: true,
    },
  });

  if (!client) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_CLIENT_NOT_FOUND",
      message: "The client is no longer available in your advisor scope.",
      expose: true,
    });
  }

  const email = accessibleClientEmail(client.email);

  if (!email) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_RECIPIENT_MISSING",
      message: `${client.fullName} does not have a valid email address.`,
      expose: true,
    });
  }

  return {
    client,
    email,
    emailHash: emailAddressHash(email) ?? "",
  };
}

export async function queueClientEmailDraftsForApproval(input: {
  user: EmailCenterUser;
  request?: Request;
  draftIds: string[];
  approvalTitle?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftIds = normalizeIds(input.draftIds);

  if (!draftIds.length) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_APPROVAL_DRAFT_REQUIRED",
      message: "Select at least one draft for approval.",
      expose: true,
    });
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: draftIds },
      userId: context.user.id,
      firmId: context.firmId,
    },
    select: draftSelect,
  });

  if (drafts.length !== draftIds.length) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_APPROVAL_DRAFT_NOT_FOUND",
      message: "One or more selected drafts were not found.",
      expose: true,
    });
  }

  const snapshots: EmailApprovalDraftSnapshot[] = [];
  const updatedMetadata = new Map<string, EmailDraftMetadata>();

  for (const draft of drafts) {
    const status = normalizeEmailDraftStatus(draft.status);

    if (["Generating", "Sending", "Sent", "Simulated", "Archived"].includes(status)) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_APPROVAL_DRAFT_LOCKED",
        message: `${draft.clientName ?? "A selected draft"} is ${status.toLowerCase()} and cannot be submitted for approval.`,
        expose: true,
      });
    }

    let metadata = readEmailDraftMetadata(draft);

    if (
      metadata.origin === "AI" &&
      metadata.generation.mode === "Generate" &&
      metadata.generation.status !== "Completed"
    ) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_AI_VERIFIED_OUTPUT_REQUIRED",
        message:
          `${draft.clientName ?? "This draft"} does not yet contain a verified custom AI email. Retry generation before approval.`,
        expose: true,
      });
    }

    const recipient = await currentRecipientForDraft(context, metadata);
    const subject = decryptEmailText(draft.title);
    const body = decryptEmailText(draft.body);
    const tone = cleanEmailTone(draft.tone);
    const currentHash = emailContentHash({
      subject,
      body,
      tone,
      branding: metadata.branding,
    });

    if (!metadata.versions.some((version) => version.contentHash === currentHash)) {
      metadata = appendStoredEmailVersion(
        metadata,
        createStoredEmailVersion({
          metadata,
          subject,
          body,
          tone,
          label: "Submitted for approval",
          origin: "Checkpoint",
          createdByUserId: context.user.id,
          complianceNotes: readEmailComplianceNotes(draft.complianceNotesJson),
        }),
      );
    }

    snapshots.push({
      draftId: draft.id,
      ownerUserId: draft.userId,
      clientId: recipient.client.id,
      clientName: recipient.client.fullName,
      recipientEmailMasked: maskEmailAddress(recipient.email),
      recipientEmailHash: recipient.emailHash,
      revision: metadata.revision,
      contentHash: currentHash,
    });
    updatedMetadata.set(draft.id, metadata);
  }

  const pendingApprovals = await prisma.backendApprovalItem.findMany({
    where: {
      userId: context.user.id,
      firmId: context.firmId,
      actionType: "client_email.approval",
      status: "Pending",
    },
    select: {
      id: true,
      payloadJson: true,
    },
    take: MAX_APPROVALS,
  });
  const supersededIds = pendingApprovals
    .filter((approval) => {
      const payload = parseApprovalPayload(approval.payloadJson);
      return payload?.drafts.some((draft) => draftIds.includes(draft.draftId));
    })
    .map((approval) => approval.id);
  const now = new Date();
  const approvalPayload: EmailApprovalPayload = {
    schemaVersion: 2,
    drafts: snapshots,
    requestedAt: now.toISOString(),
  };
  const approval = await prisma.$transaction(async (transaction) => {
    if (supersededIds.length) {
      await transaction.backendApprovalItem.updateMany({
        where: { id: { in: supersededIds } },
        data: {
          status: "Superseded",
          decidedAt: now,
          approvalNotes: "Superseded by a newer draft revision.",
        },
      });
    }

    const created = await transaction.backendApprovalItem.create({
      data: {
        userId: context.user.id,
        firmId: context.firmId,
        title:
          cleanEmailSubject(input.approvalTitle) ||
          `${drafts.length} client email draft${drafts.length === 1 ? "" : "s"} awaiting approval`,
        actionType: "client_email.approval",
        riskLevel: drafts.length > MAX_BULK_WITHOUT_SUPERVISOR ? "High" : "Medium",
        summary: `Review the exact recipients, subject lines, message bodies, and compliance notes for ${drafts.length} client email draft(s).`,
        payloadJson: JSON.stringify(approvalPayload),
        requestedBy: context.user.name,
        status: "Pending",
      },
      select: approvalSelect,
    });

    for (const draft of drafts) {
      const metadata = updatedMetadata.get(draft.id)!;
      await transaction.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            approval: {
              approvalId: created.id,
              status: "Pending",
              revision: metadata.revision,
              contentHash: metadata.contentHash,
              recipientEmailHash:
                snapshots.find((snapshot) => snapshot.draftId === draft.id)
                  ?.recipientEmailHash ?? null,
              requestedAt: now.toISOString(),
              decidedAt: null,
              decidedBy: null,
              notes: null,
            },
          }),
          status: "Needs Advisor Approval",
        },
      });
    }

    return created;
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.approval_requested",
    title: "Client email approval requested",
    detail: `${drafts.length} draft(s) were submitted for explicit human approval.`,
    metadata: {
      approvalId: approval.id,
      draftIds,
      recipientCount: snapshots.length,
      supersededApprovalIds: supersededIds,
    },
  });

  return {
    ok: true,
    approval: publicApproval(approval, context),
  };
}

export async function decideClientEmailApproval(input: {
  user: EmailCenterUser;
  request?: Request;
  approvalId: unknown;
  decision: unknown;
  notes?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const approvalId = String(input.approvalId ?? "").trim();
  const decision = String(input.decision ?? "").trim().toLowerCase();

  if (decision !== "approve" && decision !== "reject") {
    throw new ApiError({
      status: 400,
      code: "EMAIL_APPROVAL_DECISION_INVALID",
      message: "Choose approve or reject.",
      expose: true,
    });
  }

  const approval = await prisma.backendApprovalItem.findFirst({
    where: {
      id: approvalId,
      firmId: context.firmId,
      actionType: "client_email.approval",
      ...(context.canViewFirm ? {} : { userId: context.user.id }),
    },
    select: approvalSelect,
  });

  if (!approval) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_APPROVAL_NOT_FOUND",
      message: "Email approval request not found.",
      expose: true,
    });
  }

  if (approval.status !== "Pending") {
    throw new ApiError({
      status: 409,
      code: "EMAIL_APPROVAL_ALREADY_DECIDED",
      message: `This approval is already ${approval.status.toLowerCase()}.`,
      expose: true,
    });
  }

  const payload = parseApprovalPayload(approval.payloadJson);

  if (!payload?.drafts.length) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_APPROVAL_PAYLOAD_INVALID",
      message: "The approval request no longer contains a valid draft snapshot.",
      expose: true,
    });
  }

  if (
    payload.drafts.length > MAX_BULK_WITHOUT_SUPERVISOR &&
    !context.canApproveBulk
  ) {
    throw new ApiError({
      status: 403,
      code: "EMAIL_BULK_APPROVAL_PERMISSION_REQUIRED",
      message: "Firm supervisory permission is required to approve this recipient volume.",
      expose: true,
    });
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: payload.drafts.map((snapshot) => snapshot.draftId) },
      firmId: context.firmId,
    },
    select: draftSelect,
  });

  if (drafts.length !== payload.drafts.length) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_APPROVAL_DRAFT_MISSING",
      message: "One or more drafts in this approval no longer exist.",
      expose: true,
    });
  }

  for (const draft of drafts) {
    const snapshot = payload.drafts.find((candidate) => candidate.draftId === draft.id)!;
    const metadata = readEmailDraftMetadata(draft);
    const contentHash = emailContentHash({
      subject: decryptEmailText(draft.title),
      body: decryptEmailText(draft.body),
      tone: cleanEmailTone(draft.tone),
      branding: metadata.branding,
    });

    if (metadata.revision !== snapshot.revision || contentHash !== snapshot.contentHash) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_APPROVAL_REVISION_CHANGED",
        message: "A draft changed after approval was requested. Submit the current version again.",
        expose: true,
        details: {
          draftId: draft.id,
          currentRevision: metadata.revision,
          approvedRevision: snapshot.revision,
        },
      });
    }
  }

  const notes = String(input.notes ?? "").replace(/\u0000/g, "").trim().slice(0, 2_000) || null;
  const now = new Date();
  const approved = decision === "approve";

  await prisma.$transaction(async (transaction) => {
    await transaction.backendApprovalItem.update({
      where: { id: approval.id },
      data: {
        status: approved ? "Approved" : "Rejected",
        approvedBy: context.user.name,
        approvalNotes: notes,
        decidedAt: now,
      },
    });

    for (const draft of drafts) {
      const metadata = readEmailDraftMetadata(draft);
      await transaction.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            approval: {
              ...metadata.approval,
              approvalId: approval.id,
              status: approved ? "Approved" : "Rejected",
              revision: metadata.revision,
              contentHash: metadata.contentHash,
              decidedAt: now.toISOString(),
              decidedBy: context.user.name,
              notes,
            },
          }),
          status: approved ? "Approved" : "Edited",
        },
      });
    }
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: approved
      ? "client_email.approval_approved"
      : "client_email.approval_rejected",
    title: approved ? "Client email approval granted" : "Client email approval rejected",
    detail: `${payload.drafts.length} draft(s) were ${approved ? "approved" : "rejected"}.`,
    metadata: {
      approvalId: approval.id,
      draftIds: payload.drafts.map((draft) => draft.draftId),
      notesProvided: Boolean(notes),
    },
  });

  return {
    ok: true,
    approvalId: approval.id,
    status: approved ? "Approved" : "Rejected",
  };
}

async function ownerBackendContext(userId: string, firmId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      platformStatus: { notIn: ["Banned", "Suspended"] },
    },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_OWNER_INACTIVE",
      message: "The draft owner is no longer active.",
      expose: true,
    });
  }

  return {
    userId: user.id,
    firmId,
    actorName: user.name,
    actorEmail: user.email,
  };
}

async function createEmailDeliveryRecord(input: {
  context: EmailCenterContext;
  draft: DraftRow;
  metadata: EmailDraftMetadata;
  recipient: Awaited<ReturnType<typeof currentRecipientForDraft>>;
  scheduledAt: Date;
  advisorName: string;
}) {
  const subject = decryptEmailText(input.draft.title);
  const body = decryptEmailText(input.draft.body);
  const tone = cleanEmailTone(input.draft.tone);
  const contentHash = emailContentHash({
    subject,
    body,
    tone,
    branding: input.metadata.branding,
  });
  const idempotencyIdentity = digest({
    draftId: input.draft.id,
    revision: input.metadata.revision,
    contentHash,
    scheduledAt: input.scheduledAt.toISOString(),
    recipientEmailHash: input.recipient.emailHash,
  });
  const eventKey = `client-email-delivery:${idempotencyIdentity}`;
  const payload: EmailDeliveryPayload = {
    schemaVersion: 2,
    kind: "client-email",
    draftId: input.draft.id,
    draftRevision: input.metadata.revision,
    contentHash,
    clientId: input.recipient.client.id,
    clientName: input.recipient.client.fullName,
    recipientEmailHash: input.recipient.emailHash,
    htmlEncrypted: encryptEmailText(
      emailHtml({
        subject,
        body,
        clientName: input.recipient.client.fullName,
        advisorName: input.advisorName,
        branding: input.metadata.branding,
      }),
    ),
    scheduledAt: input.scheduledAt.toISOString(),
    requestedByUserId: input.context.user.id,
    requestedByName: input.context.user.name,
    approvalId: input.metadata.approval.approvalId!,
    jobId: null,
    providerId: null,
    attemptHistory: [],
  };
  const status = input.scheduledAt.getTime() > Date.now() + 30_000
    ? "Scheduled"
    : "Email Queued";

  try {
    return await prisma.$transaction(async (transaction) => {
      const delivery = await transaction.backendOutboundDelivery.create({
        data: {
          userId: input.draft.userId,
          firmId: input.context.firmId,
          channel: "Email",
          destination: encryptEmailText(input.recipient.email),
          title: encryptEmailText(subject),
          body: encryptEmailText(body),
          payloadJson: JSON.stringify(payload),
          provider: "Resend",
          status,
          urgency: input.draft.status === "Approved" ? "Medium" : "High",
          score: 80,
          approvalRequired: true,
          approvedAt: new Date(input.metadata.approval.decidedAt ?? Date.now()),
        },
        select: deliverySelect,
      });

      await transaction.backendPlatformEvent.create({
        data: {
          userId: input.draft.userId,
          firmId: input.context.firmId,
          eventKey,
          eventType: "client_email.delivery_registered",
          area: "Client Email Center",
          actorName: input.context.user.name,
          title: `Email delivery registered: ${input.recipient.client.fullName}`,
          detail: "An approved client email was registered with durable duplicate protection.",
          severity: "Info",
          status,
          sourceType: "BackendOutboundDelivery",
          sourceId: delivery.id,
          metadataJson: JSON.stringify({
            draftId: input.draft.id,
            revision: input.metadata.revision,
            scheduledAt: input.scheduledAt.toISOString(),
          }),
        },
      });

      return { delivery, duplicate: false };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const event = await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId: input.draft.userId,
          eventKey,
        },
      },
      select: { sourceId: true },
    });
    const delivery = event?.sourceId
      ? await prisma.backendOutboundDelivery.findFirst({
          where: {
            id: event.sourceId,
            userId: input.draft.userId,
            firmId: input.context.firmId,
          },
          select: deliverySelect,
        })
      : null;

    if (!delivery) throw error;
    return { delivery, duplicate: true };
  }
}

export async function scheduleClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  draftIds: string[];
  scheduledAt?: unknown;
  confirmRecipients: boolean;
  confirmationText?: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftIds = normalizeIds(input.draftIds);

  if (!draftIds.length) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_SEND_DRAFT_REQUIRED",
      message: "Select at least one approved draft to send.",
      expose: true,
    });
  }

  if (!input.confirmRecipients) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_RECIPIENT_CONFIRMATION_REQUIRED",
      message: "Review and confirm the exact recipient list before sending.",
      expose: true,
    });
  }

  if (draftIds.length > MAX_BULK_WITHOUT_SUPERVISOR && !context.canApproveBulk) {
    throw new ApiError({
      status: 403,
      code: "EMAIL_BULK_SEND_PERMISSION_REQUIRED",
      message: "Firm supervisory permission is required for this recipient volume.",
      expose: true,
    });
  }

  if (
    draftIds.length > MAX_BULK_WITHOUT_SUPERVISOR &&
    String(input.confirmationText ?? "").trim() !== `SEND ${draftIds.length}`
  ) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_BULK_CONFIRMATION_INVALID",
      message: `Type SEND ${draftIds.length} to confirm this bulk delivery.`,
      expose: true,
    });
  }

  const scheduledAt = input.scheduledAt
    ? dateFrom(input.scheduledAt)
    : new Date();

  if (!scheduledAt) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_SCHEDULE_INVALID",
      message: "Enter a valid scheduled send time.",
      expose: true,
    });
  }

  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_SCHEDULE_IN_PAST",
      message: "The scheduled send time cannot be in the past.",
      expose: true,
    });
  }

  if (scheduledAt.getTime() > Date.now() + MAX_SCHEDULE_FUTURE_MS) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_SCHEDULE_TOO_FAR",
      message: "Schedule email delivery no more than one year in advance.",
      expose: true,
    });
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: draftIds },
      firmId: context.firmId,
      ...(context.canViewFirm ? {} : { userId: context.user.id }),
    },
    select: draftSelect,
  });

  if (drafts.length !== draftIds.length) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_SEND_DRAFT_NOT_FOUND",
      message: "One or more selected drafts were not found.",
      expose: true,
    });
  }

  const results: Array<{
    draftId: string;
    deliveryId: string;
    jobId: string;
    duplicate: boolean;
  }> = [];

  for (const draft of drafts) {
    const metadata = readEmailDraftMetadata(draft);
    const currentHash = emailContentHash({
      subject: decryptEmailText(draft.title),
      body: decryptEmailText(draft.body),
      tone: cleanEmailTone(draft.tone),
      branding: metadata.branding,
    });

    if (
      metadata.approval.status !== "Approved" ||
      !metadata.approval.approvalId ||
      metadata.approval.revision !== metadata.revision ||
      metadata.approval.contentHash !== currentHash
    ) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_APPROVAL_REQUIRED",
        message: `${draft.clientName ?? "A selected draft"} must be approved at its current revision before delivery.`,
        expose: true,
      });
    }

    const recipient = await currentRecipientForDraft(context, metadata);

    if (recipient.emailHash !== metadata.approval.recipientEmailHash) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_RECIPIENT_CHANGED",
        message: `${recipient.client.fullName}'s email changed after approval. Submit the updated recipient for approval again.`,
        expose: true,
      });
    }

    if (
      ["Scheduled", "Email Queued", "Processing"].includes(metadata.delivery.status) &&
      metadata.delivery.deliveryId &&
      metadata.delivery.jobId
    ) {
      results.push({
        draftId: draft.id,
        deliveryId: metadata.delivery.deliveryId,
        jobId: metadata.delivery.jobId,
        duplicate: true,
      });
      continue;
    }

    const backendContext = await ownerBackendContext(draft.userId, context.firmId);
    const registered = await createEmailDeliveryRecord({
      context,
      draft,
      metadata,
      recipient,
      scheduledAt,
      advisorName: backendContext.actorName ?? context.user.name,
    });
    let payload = parseEmailDeliveryPayload(registered.delivery.payloadJson)!;

    if (registered.duplicate && payload.jobId) {
      results.push({
        draftId: draft.id,
        deliveryId: registered.delivery.id,
        jobId: payload.jobId,
        duplicate: true,
      });
      continue;
    }

    const queued = await enqueueBackgroundJob({
      context: backendContext,
      jobKey: "email_delivery",
      jobName: "Client Email Delivery",
      payload: {
        deliveryId: registered.delivery.id,
        draftId: draft.id,
        revision: metadata.revision,
      },
      idempotencyKey: `email-delivery:${registered.delivery.id}`,
      availableAt: scheduledAt,
      maxAttempts: 3,
      timeoutMs: 30_000,
      backoffMs: 30_000,
    });
    payload = {
      ...payload,
      jobId: queued.job.id,
    };
    const deliveryStatus = scheduledAt.getTime() > Date.now() + 30_000
      ? "Scheduled"
      : "Email Queued";
    const nextMetadata: EmailDraftMetadata = {
      ...metadata,
      delivery: {
        deliveryId: registered.delivery.id,
        jobId: queued.job.id,
        status: deliveryStatus,
        scheduledAt: scheduledAt.toISOString(),
        sentAt: null,
        provider: "Resend",
        providerId: null,
        failureReason: null,
      },
    };

    await prisma.$transaction([
      prisma.backendOutboundDelivery.update({
        where: { id: registered.delivery.id },
        data: {
          payloadJson: JSON.stringify(payload),
          status: deliveryStatus,
          failureReason: null,
        },
      }),
      prisma.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
          status: deliveryStatus === "Scheduled" ? "Scheduled" : "Queued",
        },
      }),
    ]);

    results.push({
      draftId: draft.id,
      deliveryId: registered.delivery.id,
      jobId: queued.job.id,
      duplicate: registered.duplicate || queued.duplicate,
    });
  }

  await auditEmailAction({
    context,
    request: input.request,
    eventType: scheduledAt.getTime() > Date.now() + 30_000
      ? "client_email.scheduled"
      : "client_email.send_queued",
    title: scheduledAt.getTime() > Date.now() + 30_000
      ? "Client email delivery scheduled"
      : "Client email delivery queued",
    detail: `${results.length} approved email delivery job(s) were registered.`,
    metadata: {
      draftIds,
      deliveryIds: results.map((result) => result.deliveryId),
      jobIds: results.map((result) => result.jobId),
      scheduledAt: scheduledAt.toISOString(),
      recipientCount: results.length,
    },
  });

  return {
    ok: true,
    scheduledAt: scheduledAt.toISOString(),
    deliveries: results,
  };
}

export async function cancelClientEmailDelivery(input: {
  user: EmailCenterUser;
  request?: Request;
  deliveryId: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const deliveryId = String(input.deliveryId ?? "").trim();
  const delivery = await prisma.backendOutboundDelivery.findFirst({
    where: {
      id: deliveryId,
      firmId: context.firmId,
      channel: "Email",
      ...(context.canViewFirm ? {} : { userId: context.user.id }),
    },
    select: deliverySelect,
  });

  if (!delivery) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DELIVERY_NOT_FOUND",
      message: "Email delivery not found.",
      expose: true,
    });
  }

  const payload = parseEmailDeliveryPayload(delivery.payloadJson);
  if (!payload) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_PAYLOAD_INVALID",
      message: "This delivery is not managed by the client email center.",
      expose: true,
    });
  }

  if (!["Scheduled", "Email Queued"].includes(delivery.status)) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_NOT_CANCELLABLE",
      message: `A ${delivery.status.toLowerCase()} delivery can no longer be cancelled.`,
      expose: true,
    });
  }

  if (payload.jobId) {
    await requestBackgroundJobCancellation({
      jobId: payload.jobId,
      userId: delivery.userId,
      firmId: context.firmId,
    }).catch(() => null);
  }

  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: payload.draftId,
      firmId: context.firmId,
    },
    select: draftSelect,
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.backendOutboundDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "Cancelled",
        failureReason: "Cancelled by the advisor before delivery.",
      },
    });

    if (draft) {
      const metadata = readEmailDraftMetadata(draft);
      await transaction.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            delivery: {
              ...metadata.delivery,
              status: "Cancelled",
              failureReason: "Cancelled by the advisor before delivery.",
            },
          }),
          status: "Approved",
        },
      });
    }
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.delivery_cancelled",
    title: "Scheduled client email cancelled",
    detail: "The advisor cancelled an email before provider delivery began.",
    metadata: {
      deliveryId: delivery.id,
      draftId: payload.draftId,
      jobId: payload.jobId,
    },
  });

  return { ok: true, deliveryId: delivery.id, status: "Cancelled" };
}

export async function retryClientEmailDelivery(input: {
  user: EmailCenterUser;
  request?: Request;
  deliveryId: unknown;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const deliveryId = String(input.deliveryId ?? "").trim();
  const delivery = await prisma.backendOutboundDelivery.findFirst({
    where: {
      id: deliveryId,
      firmId: context.firmId,
      channel: "Email",
      ...(context.canViewFirm ? {} : { userId: context.user.id }),
    },
    select: deliverySelect,
  });

  if (!delivery) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DELIVERY_NOT_FOUND",
      message: "Email delivery not found.",
      expose: true,
    });
  }

  if (delivery.status !== "Failed") {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_NOT_RETRYABLE",
      message: "Only failed email deliveries can be retried.",
      expose: true,
    });
  }

  const payload = parseEmailDeliveryPayload(delivery.payloadJson);
  if (!payload?.jobId) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_JOB_MISSING",
      message: "The failed delivery does not have a recoverable background job.",
      expose: true,
    });
  }

  const retried = await retryBackgroundJob({
    jobId: payload.jobId,
    userId: delivery.userId,
    firmId: context.firmId,
    resetAttempts: true,
  });
  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: { id: payload.draftId, firmId: context.firmId },
    select: draftSelect,
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.backendOutboundDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "Email Queued",
        failureReason: null,
      },
    });

    if (draft) {
      const metadata = readEmailDraftMetadata(draft);
      await transaction.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            delivery: {
              ...metadata.delivery,
              status: "Email Queued",
              failureReason: null,
            },
          }),
          status: "Queued",
        },
      });
    }
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.delivery_retried",
    title: "Client email delivery retried",
    detail: "A failed email delivery was returned to the durable background queue.",
    metadata: {
      deliveryId: delivery.id,
      draftId: payload.draftId,
      jobId: retried.id,
    },
  });

  return {
    ok: true,
    deliveryId: delivery.id,
    jobId: retried.id,
    status: "Email Queued",
  };
}

export async function archiveClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  draftIds: string[];
  restore?: boolean;
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftIds = normalizeIds(input.draftIds);

  if (!draftIds.length) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_ARCHIVE_DRAFT_REQUIRED",
      message: "Select at least one draft.",
      expose: true,
    });
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: draftIds },
      userId: context.user.id,
      firmId: context.firmId,
    },
    select: draftSelect,
  });

  if (drafts.length !== draftIds.length) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_ARCHIVE_DRAFT_NOT_FOUND",
      message: "One or more selected drafts were not found.",
      expose: true,
    });
  }

  for (const draft of drafts) {
    const status = normalizeEmailDraftStatus(draft.status);

    if (!input.restore && ["Generating", "Sending", "Scheduled", "Queued"].includes(status)) {
      throw new ApiError({
        status: 409,
        code: "EMAIL_ARCHIVE_DRAFT_ACTIVE",
        message: "Cancel or finish active email work before archiving the draft.",
        expose: true,
      });
    }
  }

  await prisma.$transaction(
    drafts.map((draft) => {
      const metadata = readEmailDraftMetadata(draft);
      const nextStatus = input.restore
        ? metadata.archivedFromStatus && metadata.archivedFromStatus !== "Archived"
          ? metadata.archivedFromStatus
          : "Draft"
        : "Archived";

      return prisma.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          status: nextStatus,
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            archivedFromStatus: input.restore
              ? null
              : normalizeEmailDraftStatus(draft.status),
          }),
        },
      });
    }),
  );

  await auditEmailAction({
    context,
    request: input.request,
    eventType: input.restore
      ? "client_email.draft_restored"
      : "client_email.draft_archived",
    title: input.restore ? "Client email draft restored" : "Client email draft archived",
    detail: `${drafts.length} draft(s) were ${input.restore ? "restored" : "archived"}.`,
    metadata: { draftIds },
  });

  return {
    ok: true,
    draftIds,
    status: input.restore ? "Restored" : "Archived",
  };
}

export async function deleteClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  draftIds: string[];
}) {
  const context = await requireEmailCenterContext({ userId: input.user.id });
  const draftIds = normalizeIds(input.draftIds);

  if (!draftIds.length) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DELETE_DRAFT_REQUIRED",
      message: "Select at least one draft to delete.",
      expose: true,
    });
  }

  const drafts = await prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: draftIds },
      userId: context.user.id,
      firmId: context.firmId,
    },
    select: draftSelect,
  });

  if (drafts.length !== draftIds.length) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DELETE_DRAFT_NOT_FOUND",
      message: "One or more selected drafts were not found.",
      expose: true,
    });
  }

  const blocked = drafts.filter((draft) => {
    const metadata = readEmailDraftMetadata(draft);
    return !draftCanBeDeleted(normalizeEmailDraftStatus(draft.status), metadata);
  });

  if (blocked.length) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELETE_DRAFT_PROTECTED",
      message:
        "Only unapproved drafts without an active generation or delivery record can be permanently deleted. Archive approved, scheduled, sent, or audited communications instead.",
      expose: true,
      details: {
        blockedDraftIds: blocked.map((draft) => draft.id),
      },
    });
  }

  const deletionAudit = drafts.map((draft) => ({
    id: draft.id,
    status: normalizeEmailDraftStatus(draft.status),
    subjectHash: digest(decryptEmailText(draft.title)),
    clientNamePresent: Boolean(draft.clientName),
  }));

  const result = await prisma.clientCommunicationDraft.deleteMany({
    where: {
      id: { in: draftIds },
      userId: context.user.id,
      firmId: context.firmId,
    },
  });

  await auditEmailAction({
    context,
    request: input.request,
    eventType: "client_email.draft_deleted",
    title: "Client email draft deleted",
    detail: `${result.count} unapproved draft(s) were permanently deleted.`,
    metadata: {
      drafts: deletionAudit,
    },
    severity: "Medium",
  });

  return {
    ok: true,
    deletedDraftIds: draftIds,
    deletedCount: result.count,
  };
}

export async function sendApprovedClientEmailDrafts(input: {
  user: EmailCenterUser;
  request?: Request;
  approvalId: string;
  approvalNotes?: unknown;
}) {
  await decideClientEmailApproval({
    user: input.user,
    request: input.request,
    approvalId: input.approvalId,
    decision: "approve",
    notes: input.approvalNotes,
  });

  const approval = await prisma.backendApprovalItem.findUnique({
    where: { id: input.approvalId },
    select: { payloadJson: true },
  });
  const payload = parseApprovalPayload(approval?.payloadJson);

  if (!payload?.drafts.length) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_APPROVAL_PAYLOAD_INVALID",
      message: "The approval no longer contains valid drafts.",
      expose: true,
    });
  }

  return scheduleClientEmailDrafts({
    user: input.user,
    request: input.request,
    draftIds: payload.drafts.map((draft) => draft.draftId),
    confirmRecipients: true,
    confirmationText:
      payload.drafts.length > MAX_BULK_WITHOUT_SUPERVISOR
        ? `SEND ${payload.drafts.length}`
        : undefined,
  });
}

export async function getEmailDraftRowsForJob(input: {
  userId: string;
  firmId: string;
  draftIds: string[];
}) {
  return prisma.clientCommunicationDraft.findMany({
    where: {
      id: { in: input.draftIds },
      userId: input.userId,
      firmId: input.firmId,
    },
    select: draftSelect,
  });
}

export async function getEmailClientForJob(input: {
  context: EmailCenterContext;
  clientId: string;
}) {
  return prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      ...clientWhere(input.context),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      householdName: true,
      clientType: true,
      riskProfile: true,
      portfolioValue: true,
      liquidityNeeds: true,
      timeHorizon: true,
      objective: true,
      notes: true,
      assignedAdvisorMembershipId: true,
      holdings: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          symbol: true,
          assetName: true,
          assetClass: true,
          value: true,
          allocationPct: true,
          riskLevel: true,
          thesis: true,
        },
      },
    },
  });
}

export async function updateDraftAfterAiGeneration(input: {
  draft: DraftRow;
  metadata: EmailDraftMetadata;
  selectedSubject: string;
  selectedBody: string;
  selectedTone: string;
  versions: EmailDraftMetadata["versions"];
  complianceNotes: string[];
  provider: string;
  model: string | null;
  researchUsed: boolean;
  sources: EmailDraftMetadata["generation"]["sources"];
  fallbackUsed: boolean;
  error: string | null;
  qualityScore?: number;
  promptIntent?: EmailPromptPlan["messageType"];
  subjectStrategy?: string | null;
}) {
  const latest = await prisma.clientCommunicationDraft.findUnique({
    where: { id: input.draft.id },
    select: draftSelect,
  });

  if (!latest) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_AI_DRAFT_NOT_FOUND",
      message: "The AI email draft no longer exists.",
      expose: false,
    });
  }

  const latestMetadata = readEmailDraftMetadata(latest);
  const currentSubject = decryptEmailText(latest.title);
  const currentBody = decryptEmailText(latest.body);
  const currentTone = cleanEmailTone(latest.tone);
  const currentHash = emailContentHash({
    subject: currentSubject,
    body: currentBody,
    tone: currentTone,
    branding: latestMetadata.branding,
  });
  const approvalOrDeliveryLocked =
    ["Pending", "Approved"].includes(latestMetadata.approval.status) ||
    ["Scheduled", "Email Queued", "Processing", "Sent", "Simulated"].includes(
      String(latestMetadata.delivery.status ?? ""),
    );
  const advisorEditedWhileGenerating =
    latestMetadata.revision !== input.metadata.revision ||
    latestMetadata.humanEditCount > input.metadata.humanEditCount ||
    currentHash !== input.metadata.contentHash ||
    approvalOrDeliveryLocked;
  const mergedVersions = [
    ...latestMetadata.versions,
    ...input.versions,
  ]
    .filter(
      (version, index, values) =>
        values.findIndex((candidate) => candidate.id === version.id) === index,
    )
    .slice(-12);
  const selectedVersion = mergedVersions.find(
    (version) =>
      decryptEmailText(version.subjectEncrypted) === input.selectedSubject &&
      decryptEmailText(version.bodyEncrypted) === input.selectedBody &&
      cleanEmailTone(version.tone) === cleanEmailTone(input.selectedTone),
  );
  const selectedVersionBranding = normalizeEmailBranding(
    selectedVersion?.branding,
    latestMetadata.branding,
  );
  const selectedHash = emailContentHash({
    subject: input.selectedSubject,
    body: input.selectedBody,
    tone: input.selectedTone,
    branding: selectedVersionBranding,
  });
  const generation = {
    ...latestMetadata.generation,
    status: "Completed" as const,
    provider: input.provider,
    model: input.model,
    researchUsed: input.researchUsed,
    sources: input.sources,
    error: input.error,
    qualityScore: Number.isFinite(Number(input.qualityScore))
      ? Math.max(0, Math.min(100, Number(input.qualityScore)))
      : latestMetadata.generation.qualityScore ?? null,
    promptIntent: input.promptIntent ?? latestMetadata.generation.promptIntent ?? null,
    subjectStrategy:
      input.subjectStrategy ?? latestMetadata.generation.subjectStrategy ?? null,
    completedAt: new Date().toISOString(),
  };

  if (advisorEditedWhileGenerating) {
    return prisma.clientCommunicationDraft.update({
      where: { id: latest.id },
      data: {
        sourceSummaryJson: writeEmailDraftMetadata({
          ...latestMetadata,
          versions: mergedVersions,
          generation,
        }),
        complianceNotesJson: writeEmailComplianceNotes(
          Array.from(
            new Set([
              ...readEmailComplianceNotes(latest.complianceNotesJson),
              ...input.complianceNotes,
              "AI refinement completed without overwriting advisor edits made while generation was running.",
            ]),
          ).slice(0, 30),
        ),
        status: normalizeEmailDraftStatus(latest.status) === "Generating" ? "Edited" : latest.status,
      },
      select: draftSelect,
    });
  }

  const nextMetadata: EmailDraftMetadata = {
    ...latestMetadata,
    revision: latestMetadata.revision + 1,
    contentHash: selectedHash,
    branding: selectedVersionBranding,
    selectedVersionId: selectedVersion?.id ?? latestMetadata.selectedVersionId,
    versions: mergedVersions,
    generation,
  };

  return prisma.clientCommunicationDraft.update({
    where: { id: latest.id },
    data: {
      title: encryptEmailText(input.selectedSubject),
      body: encryptEmailText(input.selectedBody),
      tone: input.selectedTone,
      sourceSummaryJson: writeEmailDraftMetadata(nextMetadata),
      complianceNotesJson: writeEmailComplianceNotes(input.complianceNotes),
      status: "Draft",
    },
    select: draftSelect,
  });
}

export async function markAiGenerationFailed(input: {
  draft: DraftRow;
  error: unknown;
}) {
  const latest = await prisma.clientCommunicationDraft.findUnique({
    where: { id: input.draft.id },
    select: draftSelect,
  });

  if (!latest) {
    return null;
  }

  const metadata = readEmailDraftMetadata(latest);
  const message = safeEmailError(input.error, "AI draft refinement failed.");
  const currentStatus = normalizeEmailDraftStatus(latest.status);
  const existingDraftMayRemainEditable =
    metadata.generation.mode === "Polish" &&
    (currentStatus === "Edited" ||
      currentStatus === "Draft" ||
      metadata.humanEditCount > 0);

  return prisma.clientCommunicationDraft.update({
    where: { id: latest.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata({
        ...metadata,
        generation: {
          ...metadata.generation,
          status: "Failed",
          starterReady: existingDraftMayRemainEditable,
          error: message,
          completedAt: new Date().toISOString(),
        },
      }),
      status: existingDraftMayRemainEditable ? "Edited" : "Generation Failed",
    },
  });
}

export async function loadEmailDeliveryForJob(input: {
  userId: string;
  firmId: string;
  deliveryId: string;
}) {
  return prisma.backendOutboundDelivery.findFirst({
    where: {
      id: input.deliveryId,
      userId: input.userId,
      firmId: input.firmId,
      channel: "Email",
    },
    select: deliverySelect,
  });
}

export async function claimEmailDeliveryForJob(input: {
  userId: string;
  firmId: string;
  deliveryId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "BackendOutboundDelivery"
      WHERE "id" = ${input.deliveryId}
        AND "userId" = ${input.userId}
        AND "firmId" = ${input.firmId}
        AND "channel" = 'Email'
        AND "status" IN ('Scheduled', 'Email Queued', 'Failed')
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    if (!rows[0]) {
      return transaction.backendOutboundDelivery.findFirst({
        where: {
          id: input.deliveryId,
          userId: input.userId,
          firmId: input.firmId,
        },
        select: deliverySelect,
      });
    }

    return transaction.backendOutboundDelivery.update({
      where: { id: input.deliveryId },
      data: {
        status: "Processing",
        failureReason: null,
      },
      select: deliverySelect,
    });
  });
}

export async function completeEmailDelivery(input: {
  delivery: DeliveryRow;
  payload: EmailDeliveryPayload;
  status: "Sent" | "Simulated" | "Failed";
  provider: string;
  providerId?: string | null;
  requestId?: string | null;
  errorCode?: string | null;
  error?: string | null;
  attempt: number;
}) {
  const now = new Date();
  const attempt: EmailDeliveryAttempt = {
    attempt: input.attempt,
    status: input.status,
    provider: input.provider,
    providerId: input.providerId ?? null,
    requestId: input.requestId ?? null,
    errorCode: input.errorCode ?? null,
    error: input.error ? safeEmailError(input.error) : null,
    at: now.toISOString(),
  };
  const nextPayload: EmailDeliveryPayload = {
    ...input.payload,
    providerId: input.providerId ?? input.payload.providerId,
    attemptHistory: [...input.payload.attemptHistory, attempt].slice(-12),
  };
  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: input.payload.draftId,
      userId: input.delivery.userId,
      firmId: input.delivery.firmId,
    },
    select: draftSelect,
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.backendOutboundDelivery.update({
      where: { id: input.delivery.id },
      data: {
        payloadJson: JSON.stringify(nextPayload),
        status: input.status,
        provider: input.provider,
        sentAt: input.status === "Sent" || input.status === "Simulated" ? now : null,
        failureReason: input.error ? safeEmailError(input.error) : null,
      },
    });

    if (draft) {
      const metadata = readEmailDraftMetadata(draft);
      await transaction.clientCommunicationDraft.update({
        where: { id: draft.id },
        data: {
          sourceSummaryJson: writeEmailDraftMetadata({
            ...metadata,
            delivery: {
              ...metadata.delivery,
              status: input.status,
              sentAt:
                input.status === "Sent" || input.status === "Simulated"
                  ? now.toISOString()
                  : null,
              provider: input.provider,
              providerId: input.providerId ?? null,
              failureReason: input.error ? safeEmailError(input.error) : null,
            },
          }),
          status:
            input.status === "Sent"
              ? "Sent"
              : input.status === "Simulated"
                ? "Simulated"
                : "Delivery Failed",
        },
      });
    }
  });

  return nextPayload;
}

export async function markEmailDeliverySending(input: {
  delivery: DeliveryRow;
  payload: EmailDeliveryPayload;
}) {
  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: input.payload.draftId,
      userId: input.delivery.userId,
      firmId: input.delivery.firmId,
    },
    select: draftSelect,
  });

  if (!draft) return;

  const metadata = readEmailDraftMetadata(draft);
  await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata({
        ...metadata,
        delivery: {
          ...metadata.delivery,
          status: "Processing",
          failureReason: null,
        },
      }),
      status: "Sending",
    },
  });
}

export async function verifyDeliveryDraftAndRecipient(input: {
  context: EmailCenterContext;
  delivery: DeliveryRow;
  payload: EmailDeliveryPayload;
}) {
  const draft = await prisma.clientCommunicationDraft.findFirst({
    where: {
      id: input.payload.draftId,
      userId: input.delivery.userId,
      firmId: input.context.firmId,
    },
    select: draftSelect,
  });

  if (!draft) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_DRAFT_MISSING",
      message: "The source email draft no longer exists.",
      expose: false,
    });
  }

  const metadata = readEmailDraftMetadata(draft);
  const subject = decryptEmailText(draft.title);
  const body = decryptEmailText(draft.body);
  const tone = cleanEmailTone(draft.tone);
  const currentHash = emailContentHash({
    subject,
    body,
    tone,
    branding: metadata.branding,
  });

  if (
    metadata.revision !== input.payload.draftRevision ||
    currentHash !== input.payload.contentHash ||
    metadata.approval.status !== "Approved" ||
    metadata.approval.approvalId !== input.payload.approvalId
  ) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_APPROVAL_STALE",
      message: "The email changed after approval and must be reviewed again.",
      expose: false,
    });
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: input.payload.clientId,
      ...clientWhere(input.context),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  if (!client) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_CLIENT_SCOPE_CHANGED",
      message: "The client assignment changed before email delivery.",
      expose: false,
    });
  }

  const email = accessibleClientEmail(client.email);

  if (!email || emailAddressHash(email) !== input.payload.recipientEmailHash) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_RECIPIENT_CHANGED",
      message: "The recipient address changed after approval.",
      expose: false,
    });
  }

  return {
    draft,
    metadata,
    subject,
    body,
    tone,
    client,
    email,
    html: decryptEmailText(input.payload.htmlEncrypted),
  };
}

export async function recordEmailBackgroundEvent(input: {
  userId: string;
  request?: Request;
  eventType: string;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
  severity?: "Info" | "Low" | "Medium" | "High" | "Critical";
}) {
  return recordSecurityEvent({
    userId: input.userId,
    eventType: input.eventType,
    title: input.title,
    detail: input.detail,
    area: "Client Email Center",
    severity: input.severity ?? "Medium",
    metadata: input.metadata,
    request: input.request,
  });
}

export function emailServiceSafeError(error: unknown) {
  return safeEmailError(error);
}