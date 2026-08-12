export const DOCUMENT_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type DocumentAllowedContentType =
  (typeof DOCUMENT_ALLOWED_CONTENT_TYPES)[number];

export const DOCUMENT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".txt",
  ".csv",
  ".json",
  ".docx",
  ".xlsx",
] as const;

export type DocumentActorKind = "advisor" | "client";

export const DOCUMENT_VISIBILITIES = [
  "AdvisorOnly",
  "AdvisorAndClient",
] as const;

export type DocumentVisibility =
  (typeof DOCUMENT_VISIBILITIES)[number];

export const DOCUMENT_STATUSES = [
  "Uploading",
  "Processing",
  "Needs Review",
  "Approved",
  "Rejected",
  "Duplicate",
  "Deletion Requested",
  "Deleting",
  "Archived",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_PROCESSING_STATUSES = [
  "Queued",
  "Processing",
  "Complete",
  "Failed",
  "Not Required",
] as const;

export type DocumentProcessingStatus =
  (typeof DOCUMENT_PROCESSING_STATUSES)[number];

export const DOCUMENT_SECURITY_STATUSES = [
  "Pending",
  "Signature Verified",
  "Rejected",
  "Not Checked",
] as const;

export type DocumentSecurityStatus =
  (typeof DOCUMENT_SECURITY_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "General",
  "Account Statement",
  "Tax",
  "Estate Planning",
  "Insurance",
  "Identity",
  "Agreement",
  "Compliance",
  "Planning",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentUploadDeclaration = {
  actorHint: DocumentActorKind;
  clientId: string | null;
  originalFileName: string;
  declaredContentType: string;
  declaredSizeBytes: number;
  claimedSha256: string | null;
  documentType: DocumentType;
  visibility: DocumentVisibility;
  notes: string | null;
};

export type DocumentBlobReference = {
  url: string;
  pathname: string;
  contentType?: string | null;
  contentDisposition?: string | null;
  etag?: string | null;
};

export type DocumentClassification = {
  category: DocumentType;
  confidence: number;
  method: "filename-and-signature" | "filename-signature-and-text";
  textPreviewAvailable: boolean;
  requiresOcr: boolean | "undetermined";
  ocrStatus: "Not Required" | "Not Requested";
  malwareScan: {
    status: "Not Configured";
    note: string;
  };
  signals: string[];
};

export type DocumentAuditView = {
  id: string;
  action: string;
  actorType: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DocumentListItem = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  fileName: string;
  fileExtension: string | null;
  documentType: string;
  status: string;
  processingStatus: string;
  processingError: string | null;
  securityStatus: string;
  visibility: string;
  contentType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  claimedSha256: string | null;
  uploadedByType: string;
  uploadedByClientId: string | null;
  notes: string | null;
  extractedTextPreview: string | null;
  classification: DocumentClassification | Record<string, unknown>;
  metadata: Record<string, unknown>;
  approvedAt: string | null;
  approvedByUserId: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canDownload: boolean;
  canApprove: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canRequestDelete: boolean;
  canReprocess: boolean;
  audit: DocumentAuditView[];
};

export type DocumentClientOption = {
  id: string;
  fullName: string;
  householdName: string | null;
  status: string;
  assignedAdvisorMembershipId: string | null;
};

export type DocumentCenterMetrics = {
  total: number;
  processing: number;
  needsReview: number;
  approved: number;
  rejected: number;
  duplicates: number;
  deletionRequested: number;
};

export type DocumentCenterPayload = {
  ok: true;
  actor: {
    kind: DocumentActorKind;
    id: string;
    displayName: string;
    firmId: string;
  };
  permissions: {
    canUpload: boolean;
    canUploadFirmDocument: boolean;
    canApprove: boolean;
    canDelete: boolean;
    canViewFirmScope: boolean;
  };
  storage: {
    configured: boolean;
    provider: "Vercel Blob";
    access: "private";
    maximumSizeBytes: number;
    allowedContentTypes: readonly string[];
  };
  clients: DocumentClientOption[];
  documents: DocumentListItem[];
  metrics: DocumentCenterMetrics;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type DocumentActionResult = {
  ok: true;
  message: string;
  document?: DocumentListItem;
  accessUrl?: string;
  expiresAt?: string;
  duplicate?: boolean;
  existingDocumentId?: string;
};

export function normaliseDocumentType(value: unknown): DocumentType {
  const candidate = String(value ?? "").trim();

  return DOCUMENT_TYPES.includes(candidate as DocumentType)
    ? (candidate as DocumentType)
    : "General";
}

export function normaliseDocumentVisibility(
  value: unknown,
  actor: DocumentActorKind,
): DocumentVisibility {
  if (actor === "client") return "AdvisorAndClient";

  const candidate = String(value ?? "").trim();

  return DOCUMENT_VISIBILITIES.includes(candidate as DocumentVisibility)
    ? (candidate as DocumentVisibility)
    : "AdvisorOnly";
}

export function documentExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  const match = lower.match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] ?? null;
}

export function documentMaximumUploadBytes() {
  const parsed = Number(process.env.NEXT_PUBLIC_DOCUMENT_MAX_UPLOAD_BYTES);

  if (!Number.isFinite(parsed)) return 25 * 1024 * 1024;

  return Math.max(1 * 1024 * 1024, Math.min(100 * 1024 * 1024, Math.round(parsed)));
}

export function documentAcceptAttribute() {
  return [
    ...DOCUMENT_ALLOWED_CONTENT_TYPES,
    ...DOCUMENT_ALLOWED_EXTENSIONS,
  ].join(",");
}