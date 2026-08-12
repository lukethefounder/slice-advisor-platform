import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import type {
  EmailBrandingPreference,
  EmailDraftApprovalState,
  EmailDraftDeliveryState,
  EmailDraftGenerationState,
  EmailDraftMetadata,
  EmailDraftStatus,
  EmailDraftVersion,
  EmailResearchSource,
  StoredEmailDraftVersion,
} from "@/lib/email-center/contracts";

export const MAX_EMAIL_DRAFT_VERSIONS = 12;
export const MAX_EMAIL_SUBJECT_LENGTH = 180;
export const MAX_EMAIL_BODY_LENGTH = 30_000;
export const MAX_EMAIL_TONE_LENGTH = 160;

export type ClientCommunicationDraftRow = {
  id: string;
  userId: string;
  firmId: string | null;
  clientName: string | null;
  channel: string;
  audience: string;
  title: string;
  body: string;
  sourceSummaryJson: string;
  complianceNotesJson: string;
  status: string;
  tone: string;
  createdAt: Date;
  updatedAt: Date;
};

const EMPTY_GENERATION: EmailDraftGenerationState = {
  jobId: null,
  status: "None",
  mode: "Generate",
  speedMode: "Quick",
  starterReady: false,
  requestHash: null,
  optionCount: 1,
  promptSummary: null,
  promptIntent: null,
  subjectStrategy: null,
  qualityScore: null,
  provider: null,
  model: null,
  researchUsed: false,
  sources: [],
  error: null,
  requestedAt: null,
  completedAt: null,
};

const EMPTY_APPROVAL: EmailDraftApprovalState = {
  approvalId: null,
  status: "None",
  revision: null,
  contentHash: null,
  recipientEmailHash: null,
  requestedAt: null,
  decidedAt: null,
  decidedBy: null,
  notes: null,
};

const EMPTY_DELIVERY: EmailDraftDeliveryState = {
  deliveryId: null,
  jobId: null,
  status: "None",
  scheduledAt: null,
  sentAt: null,
  provider: null,
  providerId: null,
  failureReason: null,
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

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanSingleLine(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}


const DEFAULT_EMAIL_DISCLOSURE =
  "This communication is provided for informational and planning purposes and is subject to the advisor's professional review. It is not a guarantee of performance, an automatic trade instruction, or standalone legal or tax advice.";

function cleanHttpsUrl(value: unknown) {
  const raw = cleanSingleLine(value, 1_200);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function cleanWebsite(value: unknown) {
  const raw = cleanSingleLine(value, 320);
  if (!raw) return "";

  try {
    const withProtocol = /^https:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanAccentColor(value: unknown) {
  const raw = cleanSingleLine(value, 16);
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : "#059669";
}

export function defaultEmailBranding(input?: {
  advisorName?: string | null;
  advisorEmail?: string | null;
  firmName?: string | null;
}): EmailBrandingPreference {
  const firmName = cleanSingleLine(input?.firmName, 180) || "Wealth Management Team";

  return {
    schemaVersion: 1,
    showSliceBrand: true,
    firmName,
    firmLogoUrl: null,
    accentColor: "#059669",
    signature: {
      signOff: "Warm regards,",
      name: cleanSingleLine(input?.advisorName, 180) || "Your Advisor",
      title: "Financial Advisor",
      company: firmName,
      phone: "",
      email: cleanSingleLine(input?.advisorEmail, 320).toLowerCase(),
      website: "",
    },
    disclosure: DEFAULT_EMAIL_DISCLOSURE,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeEmailBranding(
  value: unknown,
  fallback?: EmailBrandingPreference,
): EmailBrandingPreference {
  const base = fallback ?? defaultEmailBranding();
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const signature = record.signature && typeof record.signature === "object" && !Array.isArray(record.signature)
    ? (record.signature as Record<string, unknown>)
    : {};

  return {
    schemaVersion: 1,
    showSliceBrand: record.showSliceBrand !== false,
    firmName: cleanSingleLine(record.firmName, 180) || base.firmName,
    firmLogoUrl: cleanHttpsUrl(record.firmLogoUrl),
    accentColor: cleanAccentColor(record.accentColor || base.accentColor),
    signature: {
      signOff: cleanSingleLine(signature.signOff, 120) || base.signature.signOff,
      name: cleanSingleLine(signature.name, 180) || base.signature.name,
      title: cleanSingleLine(signature.title, 180),
      company: cleanSingleLine(signature.company, 180) || base.signature.company,
      phone: cleanSingleLine(signature.phone, 80),
      email: cleanSingleLine(signature.email, 320).toLowerCase(),
      website: cleanWebsite(signature.website),
    },
    disclosure:
      cleanSingleLine(record.disclosure, 1_200) || base.disclosure || DEFAULT_EMAIL_DISCLOSURE,
    updatedAt:
      cleanSingleLine(record.updatedAt, 80) || base.updatedAt || new Date().toISOString(),
  };
}

function emailBrandingHashValue(branding: EmailBrandingPreference) {
  const normalized = normalizeEmailBranding(branding);
  return JSON.stringify({
    showSliceBrand: normalized.showSliceBrand,
    firmName: normalized.firmName,
    firmLogoUrl: normalized.firmLogoUrl,
    accentColor: normalized.accentColor,
    signature: normalized.signature,
    disclosure: normalized.disclosure,
  });
}

export function cleanEmailSubject(value: unknown) {
  return cleanSingleLine(value, MAX_EMAIL_SUBJECT_LENGTH);
}

export function cleanEmailTone(value: unknown, fallback = "Professional and reassuring") {
  return cleanSingleLine(value, MAX_EMAIL_TONE_LENGTH) || fallback;
}

export function cleanEmailBody(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_EMAIL_BODY_LENGTH);
}

export function normalizeEmailDraftStatus(value: unknown): EmailDraftStatus {
  const clean = cleanSingleLine(value, 80);

  const aliases: Record<string, EmailDraftStatus> = {
    "Needs Approval": "Needs Advisor Approval",
    "Pending Approval": "Needs Advisor Approval",
    "Delivery Queued": "Queued",
    "Email Queued": "Queued",
    "Processing": "Sending",
    "Failed": "Delivery Failed",
  };

  const normalized = aliases[clean] ?? clean;

  const allowed: EmailDraftStatus[] = [
    "Draft",
    "Generating",
    "Generation Failed",
    "Edited",
    "Needs Advisor Approval",
    "Approved",
    "Scheduled",
    "Queued",
    "Sending",
    "Sent",
    "Simulated",
    "Delivery Failed",
    "Cancelled",
    "Archived",
  ];

  return allowed.includes(normalized as EmailDraftStatus)
    ? (normalized as EmailDraftStatus)
    : "Draft";
}

export function encryptEmailText(value: string) {
  return encryptSensitiveText(value) ?? value;
}

export function decryptEmailText(value: string | null | undefined) {
  return String(decryptSensitiveText(value) ?? "");
}

export function emailContentHash(input: {
  subject: string;
  body: string;
  tone: string;
  branding?: EmailBrandingPreference;
}) {
  const branding = normalizeEmailBranding(input.branding);

  return createHash("sha256")
    .update(
      [
        input.subject,
        input.body,
        input.tone,
        emailBrandingHashValue(branding),
      ].join("\u241f"),
    )
    .digest("hex");
}

export function emailAddressHash(value: string | null | undefined) {
  const clean = String(value ?? "").trim().toLowerCase();
  return clean
    ? createHash("sha256").update(clean).digest("hex")
    : null;
}

export function maskEmailAddress(value: string | null | undefined) {
  const clean = String(value ?? "").trim().toLowerCase();
  const [name, domain] = clean.split("@");

  if (!name || !domain) return null;

  if (name.length <= 2) return `${name[0] ?? "*"}*@${domain}`;
  return `${name.slice(0, 2)}${"*".repeat(Math.min(8, name.length - 2))}@${domain}`;
}

function safeStringArray(value: unknown, limit = 20, itemLimit = 600) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanSingleLine(item, itemLimit))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function safeSources(value: unknown): EmailResearchSource[] {
  if (!Array.isArray(value)) return [];

  const sources: EmailResearchSource[] = [];

  for (const item of value.slice(0, 20)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const title = cleanSingleLine(record.title, 300);
    const rawUrl = cleanSingleLine(record.url, 2_000);

    if (!title || !rawUrl) continue;

    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;

      sources.push({
        title,
        url: url.toString(),
        type: cleanSingleLine(record.type, 80) || undefined,
      });
    } catch {
      continue;
    }
  }

  return sources;
}

function safeGeneration(value: unknown): EmailDraftGenerationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_GENERATION };
  }

  const record = value as Partial<EmailDraftGenerationState>;
  const allowedStatuses = new Set<EmailDraftGenerationState["status"]>([
    "None",
    "Queued",
    "Processing",
    "Completed",
    "Completed With Fallback",
    "Failed",
  ]);

  return {
    ...EMPTY_GENERATION,
    jobId: cleanSingleLine(record.jobId, 160) || null,
    status: allowedStatuses.has(record.status as EmailDraftGenerationState["status"])
      ? (record.status as EmailDraftGenerationState["status"])
      : "None",
    mode: record.mode === "Polish" ? "Polish" : "Generate",
    speedMode: record.speedMode === "Researched" ? "Researched" : "Quick",
    starterReady: record.starterReady === true,
    requestHash: cleanSingleLine(record.requestHash, 128) || null,
    optionCount: Math.max(1, Math.min(3, Number(record.optionCount) || 1)),
    promptSummary: cleanSingleLine(record.promptSummary, 500) || null,
    promptIntent:
      record.promptIntent === "Market Update" ||
      record.promptIntent === "Portfolio Review" ||
      record.promptIntent === "Planning Update" ||
      record.promptIntent === "Meeting Follow-up" ||
      record.promptIntent === "Scheduling" ||
      record.promptIntent === "Document Request" ||
      record.promptIntent === "General Update"
        ? record.promptIntent
        : null,
    subjectStrategy: cleanSingleLine(record.subjectStrategy, 600) || null,
    qualityScore: Number.isFinite(Number(record.qualityScore))
      ? Math.max(0, Math.min(100, Number(record.qualityScore)))
      : null,
    provider: cleanSingleLine(record.provider, 160) || null,
    model: cleanSingleLine(record.model, 160) || null,
    researchUsed: record.researchUsed === true,
    sources: safeSources(record.sources),
    error: cleanSingleLine(record.error, 1_000) || null,
    requestedAt: cleanSingleLine(record.requestedAt, 80) || null,
    completedAt: cleanSingleLine(record.completedAt, 80) || null,
  };
}

function safeApproval(value: unknown): EmailDraftApprovalState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_APPROVAL };
  }

  const record = value as Partial<EmailDraftApprovalState>;
  const allowedStatuses = new Set<EmailDraftApprovalState["status"]>([
    "None",
    "Pending",
    "Approved",
    "Rejected",
    "Superseded",
  ]);

  return {
    ...EMPTY_APPROVAL,
    approvalId: cleanSingleLine(record.approvalId, 160) || null,
    status: allowedStatuses.has(record.status as EmailDraftApprovalState["status"])
      ? (record.status as EmailDraftApprovalState["status"])
      : "None",
    revision: Number.isInteger(record.revision) ? Number(record.revision) : null,
    contentHash: cleanSingleLine(record.contentHash, 128) || null,
    recipientEmailHash: cleanSingleLine(record.recipientEmailHash, 128) || null,
    requestedAt: cleanSingleLine(record.requestedAt, 80) || null,
    decidedAt: cleanSingleLine(record.decidedAt, 80) || null,
    decidedBy: cleanSingleLine(record.decidedBy, 200) || null,
    notes: cleanSingleLine(record.notes, 2_000) || null,
  };
}

function safeDelivery(value: unknown): EmailDraftDeliveryState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_DELIVERY };
  }

  const record = value as Partial<EmailDraftDeliveryState>;
  const allowedStatuses = new Set<EmailDraftDeliveryState["status"]>([
    "None",
    "Scheduled",
    "Email Queued",
    "Processing",
    "Sent",
    "Simulated",
    "Failed",
    "Cancelled",
  ]);
  const status = cleanSingleLine(record.status, 80);

  return {
    ...EMPTY_DELIVERY,
    deliveryId: cleanSingleLine(record.deliveryId, 160) || null,
    jobId: cleanSingleLine(record.jobId, 160) || null,
    status: allowedStatuses.has(status as EmailDraftDeliveryState["status"])
      ? (status as EmailDraftDeliveryState["status"])
      : "None",
    scheduledAt: cleanSingleLine(record.scheduledAt, 80) || null,
    sentAt: cleanSingleLine(record.sentAt, 80) || null,
    provider: cleanSingleLine(record.provider, 160) || null,
    providerId: cleanSingleLine(record.providerId, 300) || null,
    failureReason: cleanSingleLine(record.failureReason, 1_000) || null,
  };
}

function safeStoredVersion(value: unknown): StoredEmailDraftVersion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Partial<StoredEmailDraftVersion>;
  const id = cleanSingleLine(record.id, 160);
  const subjectEncrypted = String(record.subjectEncrypted ?? "");
  const bodyEncrypted = String(record.bodyEncrypted ?? "");
  const contentHash = cleanSingleLine(record.contentHash, 128);

  if (!id || !subjectEncrypted || !bodyEncrypted || !contentHash) return null;

  const allowedOrigins = new Set<StoredEmailDraftVersion["origin"]>([
    "Manual",
    "AI",
    "Checkpoint",
    "Imported",
    "Polished",
  ]);

  return {
    id,
    version: Math.max(1, Number(record.version) || 1),
    label: cleanSingleLine(record.label, 180) || "Draft version",
    origin: allowedOrigins.has(record.origin as StoredEmailDraftVersion["origin"])
      ? (record.origin as StoredEmailDraftVersion["origin"])
      : "Imported",
    subjectEncrypted,
    bodyEncrypted,
    tone: cleanEmailTone(record.tone),
    contentHash,
    strategy: cleanSingleLine(record.strategy, 2_000) || null,
    researchSummary: cleanSingleLine(record.researchSummary, 3_000) || null,
    sources: safeSources(record.sources),
    complianceNotes: safeStringArray(record.complianceNotes),
    branding: normalizeEmailBranding(record.branding),
    createdByUserId: cleanSingleLine(record.createdByUserId, 160) || "unknown",
    createdAt: cleanSingleLine(record.createdAt, 80) || new Date().toISOString(),
  };
}

export function createDefaultEmailDraftMetadata(input: {
  origin?: EmailDraftMetadata["origin"];
  subject: string;
  body: string;
  tone: string;
  clientId?: string | null;
  clientName?: string | null;
  recipientEmail?: string | null;
  branding?: EmailBrandingPreference;
}) : EmailDraftMetadata {
  return {
    schemaVersion: 2,
    origin: input.origin ?? "Manual",
    revision: 1,
    contentHash: emailContentHash({
      subject: input.subject,
      body: input.body,
      tone: input.tone,
      branding: input.branding,
    }),
    selectedVersionId: null,
    humanEditCount: 0,
    lastHumanEditAt: null,
    recipient: {
      clientId: cleanSingleLine(input.clientId, 160) || null,
      clientName: cleanSingleLine(input.clientName, 300) || null,
      emailEncrypted: input.recipientEmail
        ? encryptEmailText(input.recipientEmail.trim().toLowerCase())
        : null,
      emailHash: emailAddressHash(input.recipientEmail),
    },
    branding: normalizeEmailBranding(input.branding),
    versions: [],
    generation: { ...EMPTY_GENERATION },
    approval: { ...EMPTY_APPROVAL },
    delivery: { ...EMPTY_DELIVERY },
    archivedFromStatus: null,
  };
}

export function readEmailDraftMetadata(row: ClientCommunicationDraftRow): EmailDraftMetadata {
  const parsed = parseJsonObject(row.sourceSummaryJson);
  const subject = decryptEmailText(row.title);
  const body = decryptEmailText(row.body);
  const tone = cleanEmailTone(row.tone);
  const branding = normalizeEmailBranding(parsed.branding);

  if (parsed.schemaVersion === 2) {
    const versions = Array.isArray(parsed.versions)
      ? parsed.versions
          .map(safeStoredVersion)
          .filter((item): item is StoredEmailDraftVersion => Boolean(item))
          .slice(-MAX_EMAIL_DRAFT_VERSIONS)
      : [];

    const recipient =
      parsed.recipient &&
      typeof parsed.recipient === "object" &&
      !Array.isArray(parsed.recipient)
        ? (parsed.recipient as Record<string, unknown>)
        : {};

    return {
      schemaVersion: 2,
      origin:
        parsed.origin === "AI" || parsed.origin === "Imported"
          ? parsed.origin
          : "Manual",
      revision: Math.max(1, Number(parsed.revision) || 1),
      contentHash:
        parsed.branding
          ? cleanSingleLine(parsed.contentHash, 128) ||
            emailContentHash({ subject, body, tone, branding })
          : emailContentHash({ subject, body, tone, branding }),
      selectedVersionId: cleanSingleLine(parsed.selectedVersionId, 160) || null,
      humanEditCount: Math.max(0, Number(parsed.humanEditCount) || 0),
      lastHumanEditAt: cleanSingleLine(parsed.lastHumanEditAt, 80) || null,
      recipient: {
        clientId: cleanSingleLine(recipient.clientId, 160) || null,
        clientName:
          cleanSingleLine(recipient.clientName, 300) || row.clientName || null,
        emailEncrypted: String(recipient.emailEncrypted ?? "") || null,
        emailHash: cleanSingleLine(recipient.emailHash, 128) || null,
      },
      branding,
      versions,
      generation: safeGeneration(parsed.generation),
      approval: safeApproval(parsed.approval),
      delivery: safeDelivery(parsed.delivery),
      archivedFromStatus: parsed.archivedFromStatus
        ? normalizeEmailDraftStatus(parsed.archivedFromStatus)
        : null,
    };
  }

  const legacyClientId = cleanSingleLine(parsed.clientId, 160) || null;
  const legacyOrigin = parsed.ai || parsed.aiGenerated ? "AI" : parsed.manualDraft ? "Manual" : "Imported";

  return {
    ...createDefaultEmailDraftMetadata({
      origin: legacyOrigin,
      subject,
      body,
      tone,
      clientId: legacyClientId,
      clientName: row.clientName,
      recipientEmail: null,
      branding,
    }),
    revision: 1,
  };
}

export function writeEmailDraftMetadata(metadata: EmailDraftMetadata) {
  return JSON.stringify({
    ...metadata,
    branding: normalizeEmailBranding(metadata.branding),
    versions: metadata.versions.slice(-MAX_EMAIL_DRAFT_VERSIONS),
    generation: safeGeneration(metadata.generation),
    approval: safeApproval(metadata.approval),
    delivery: safeDelivery(metadata.delivery),
  });
}

export function readEmailComplianceNotes(value: string | null | undefined) {
  return safeStringArray(parseJsonList(value), 30, 800);
}

export function writeEmailComplianceNotes(value: string[]) {
  return JSON.stringify(safeStringArray(value, 30, 800));
}

export function createStoredEmailVersion(input: {
  metadata: EmailDraftMetadata;
  subject: string;
  body: string;
  tone: string;
  label: string;
  origin: StoredEmailDraftVersion["origin"];
  createdByUserId: string;
  strategy?: string | null;
  researchSummary?: string | null;
  sources?: EmailResearchSource[];
  complianceNotes?: string[];
  createdAt?: Date;
}) : StoredEmailDraftVersion {
  const subject = cleanEmailSubject(input.subject);
  const body = cleanEmailBody(input.body);
  const tone = cleanEmailTone(input.tone);
  const nextVersion = Math.max(
    input.metadata.revision,
    ...input.metadata.versions.map((version) => version.version),
    0,
  ) + 1;

  return {
    id: randomUUID(),
    version: nextVersion,
    label: cleanSingleLine(input.label, 180) || `Version ${nextVersion}`,
    origin: input.origin,
    subjectEncrypted: encryptEmailText(subject),
    bodyEncrypted: encryptEmailText(body),
    tone,
    contentHash: emailContentHash({
      subject,
      body,
      tone,
      branding: input.metadata.branding,
    }),
    strategy: cleanSingleLine(input.strategy, 2_000) || null,
    researchSummary: cleanSingleLine(input.researchSummary, 3_000) || null,
    sources: safeSources(input.sources),
    complianceNotes: safeStringArray(input.complianceNotes),
    branding: normalizeEmailBranding(input.metadata.branding),
    createdByUserId: cleanSingleLine(input.createdByUserId, 160) || "unknown",
    createdAt: (input.createdAt ?? new Date()).toISOString(),
  };
}

export function appendStoredEmailVersion(
  metadata: EmailDraftMetadata,
  version: StoredEmailDraftVersion,
) {
  const withoutDuplicate = metadata.versions.filter(
    (candidate) => candidate.contentHash !== version.contentHash,
  );

  return {
    ...metadata,
    versions: [...withoutDuplicate, version].slice(-MAX_EMAIL_DRAFT_VERSIONS),
    selectedVersionId: version.id,
  };
}

export function publicEmailDraftVersion(
  version: StoredEmailDraftVersion,
): EmailDraftVersion {
  return {
    id: version.id,
    version: version.version,
    label: version.label,
    origin: version.origin,
    subject: decryptEmailText(version.subjectEncrypted),
    body: decryptEmailText(version.bodyEncrypted),
    tone: version.tone,
    contentHash: version.contentHash,
    strategy: version.strategy ?? null,
    researchSummary: version.researchSummary ?? null,
    sources: safeSources(version.sources),
    complianceNotes: safeStringArray(version.complianceNotes),
    branding: normalizeEmailBranding(version.branding),
    createdByUserId: version.createdByUserId,
    createdAt: version.createdAt,
  };
}

export function emailHtml(input: {
  subject: string;
  body: string;
  clientName: string;
  advisorName: string;
  branding: EmailBrandingPreference;
}) {
  const escape = (value: string) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const branding = normalizeEmailBranding(input.branding, {
    ...defaultEmailBranding({ advisorName: input.advisorName }),
    signature: {
      ...defaultEmailBranding({ advisorName: input.advisorName }).signature,
      name: input.advisorName,
    },
  });
  const accent = branding.accentColor;
  const paragraphs = cleanEmailBody(input.body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;color:#334155;line-height:1.78;font-size:15px;">${escape(
          paragraph,
        ).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
  const website = branding.signature.website;
  const websiteLabel = website
    ? website.replace(/^https:\/\//i, "").replace(/\/$/, "")
    : "";
  const firmLogo = branding.firmLogoUrl
    ? `<img src="${escape(branding.firmLogoUrl)}" alt="${escape(
        branding.firmName,
      )} logo" style="display:block;max-height:46px;max-width:180px;width:auto;height:auto;border:0;" />`
    : `<div style="font-size:13px;line-height:1.25;font-weight:800;color:#ffffff;text-align:right;">${escape(
        branding.firmName,
      )}</div>`;
  const sliceBrand = branding.showSliceBrand
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle;"><div style="width:34px;height:34px;border-radius:11px;background:#ffffff;position:relative;overflow:hidden;"><div style="position:absolute;left:-6px;top:14px;width:46px;height:7px;background:${accent};transform:rotate(-28deg);"></div><div style="position:absolute;right:5px;top:5px;width:9px;height:9px;border-radius:50%;background:${accent};"></div></div></td><td style="padding-left:10px;vertical-align:middle;"><div style="font-size:18px;font-weight:900;letter-spacing:.02em;color:#ffffff;">SLICE</div><div style="margin-top:2px;font-size:8px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#a7f3d0;">Advisor communication</div></td></tr></table>`
    : "";
  const contactBits = [
    branding.signature.title,
    branding.signature.company,
    branding.signature.phone,
    branding.signature.email,
    websiteLabel,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escape(cleanEmailSubject(input.subject))}</title>
  </head>
  <body style="margin:0;padding:0;background:#edf3f0;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf3f0;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:760px;border-collapse:separate;overflow:hidden;border:1px solid #d7e3dc;border-radius:26px;background:#ffffff;box-shadow:0 24px 70px rgba(15,23,42,.10);">
            <tr>
              <td style="padding:0;background:#042f2b;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:24px 28px;vertical-align:middle;">${sliceBrand}</td>
                    <td align="right" style="padding:24px 28px;vertical-align:middle;">${firmLogo}</td>
                  </tr>
                </table>
                <div style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 34px 12px;">
                <div style="font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:${accent};">Prepared for ${escape(
                  input.clientName,
                )}</div>
                <h1 style="margin:10px 0 0;color:#0f172a;font-size:29px;line-height:1.28;letter-spacing:-.02em;">${escape(
                  cleanEmailSubject(input.subject),
                )}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px 8px;">${paragraphs}</td>
            </tr>
            <tr>
              <td style="padding:12px 34px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #dce7e0;">
                  <tr>
                    <td style="padding-top:22px;">
                      <div style="font-size:14px;line-height:1.6;color:#475569;">${escape(
                        branding.signature.signOff,
                      )}</div>
                      <div style="margin-top:5px;font-size:17px;line-height:1.4;font-weight:900;color:#0f172a;">${escape(
                        branding.signature.name || input.advisorName,
                      )}</div>
                      <div style="margin-top:5px;font-size:12px;line-height:1.7;color:#64748b;">${contactBits
                        .map(escape)
                        .join(" &nbsp;·&nbsp; ")}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px 24px;background:#f7faf8;border-top:1px solid #e2ebe6;">
                <p style="margin:0;color:#64748b;font-size:10px;line-height:1.65;">${escape(
                  branding.disclosure,
                )}</p>
                <p style="margin:10px 0 0;color:#94a3b8;font-size:9px;line-height:1.5;">Prepared and reviewed through Slice. Client-specific communications remain subject to the wealth manager's approval and firm policies.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function safeEmailError(value: unknown, fallback = "The email operation failed.") {
  return String(value instanceof Error ? value.message : value ?? fallback)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|token|secret|password)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000) || fallback;
}