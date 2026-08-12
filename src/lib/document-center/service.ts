import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-route";
import {
  clientScopeWhere,
  getAccessContextForUser,
  getCurrentAccessContext,
  hasFirmPermission,
  type AccessContext,
} from "@/lib/access-control";
import { enqueueBackgroundJob } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import {
  getCurrentClientPortalSession,
  type ClientPortalSessionContext,
} from "@/lib/client-portal-auth";
import {
  cleanEmail,
  cleanText,
} from "@/lib/client-data-security";
import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import {
  createCursorPage,
  decodeCursor,
  paginationScope,
  readPageSize,
  readSearch,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security";
import {
  DOCUMENT_ALLOWED_CONTENT_TYPES,
  documentExtension,
  normaliseDocumentType,
  normaliseDocumentVisibility,
  type DocumentActionResult,
  type DocumentActorKind,
  type DocumentAuditView,
  type DocumentBlobReference,
  type DocumentCenterPayload,
  type DocumentClassification,
  type DocumentListItem,
  type DocumentUploadDeclaration,
} from "@/lib/document-center/contracts";
import {
  deletePrivateDocumentBlob,
  documentMaximumUploadBytesServer,
  documentPathIsAllowed,
  documentStorageConfigured,
  headPrivateDocumentBlob,
  issueDocumentAccessToken,
  validateDocumentUploadDeclaration,
  verifyDocumentAccessToken,
} from "@/lib/document-center/storage";

const DOCUMENT_PROCESS_JOB_NAME = "Secure Document Processing";
const DOCUMENT_PROCESS_TIMEOUT_MS = 40_000;
const DOCUMENT_PROCESS_MAX_ATTEMPTS = 2;
const DOCUMENT_PROCESS_BACKOFF_MS = 20_000;
const MAX_DOCUMENT_LIST = 50;
const MAX_AUDIT_PER_DOCUMENT = 20;

const documentSelect = {
  id: true,
  userId: true,
  firmId: true,
  clientId: true,
  fileName: true,
  fileExtension: true,
  documentType: true,
  status: true,
  notes: true,
  storageProvider: true,
  storagePath: true,
  storageUrl: true,
  contentType: true,
  sizeBytes: true,
  etag: true,
  claimedSha256: true,
  sha256: true,
  visibility: true,
  uploadedByType: true,
  uploadedByClientId: true,
  processingStatus: true,
  processingError: true,
  securityStatus: true,
  classificationJson: true,
  metadataJson: true,
  extractedTextEncrypted: true,
  approvedAt: true,
  approvedByUserId: true,
  lastViewedAt: true,
  viewCount: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      fullName: true,
      firmId: true,
      assignedAdvisorMembershipId: true,
      status: true,
    },
  },
} as const;

const auditSelect = {
  id: true,
  documentId: true,
  actorType: true,
  action: true,
  detail: true,
  metadataJson: true,
  createdAt: true,
} as const;

type DocumentRow = Prisma.DocumentVaultItemGetPayload<{
  select: typeof documentSelect;
}>;

type AdvisorDocumentActor = {
  kind: "advisor";
  actorId: string;
  displayName: string;
  email: string;
  userId: string;
  ownerUserId: string;
  firmId: string;
  membershipId: string | null;
  access: AccessContext;
  canSupervise: boolean;
  canManage: boolean;
  canManageFirmDocuments: boolean;
};

type ClientDocumentActor = {
  kind: "client";
  actorId: string;
  displayName: string;
  email: string | null;
  clientId: string;
  userId: string;
  ownerUserId: string;
  firmId: string;
  membershipId: string;
  assignedAdvisorEmail: string;
  canSupervise: false;
  canManage: false;
  canManageFirmDocuments: false;
};

export type DocumentActor = AdvisorDocumentActor | ClientDocumentActor;

type TrustedUploadTokenPayload = {
  version: 1;
  actorKind: DocumentActorKind;
  actorId: string;
  userId: string;
  firmId: string;
  membershipId: string | null;
  clientId: string | null;
  declaration: DocumentUploadDeclaration;
  issuedAt: string;
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

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const output: Record<string, string | number | boolean | null | string[]> = {};

  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>,
  ).slice(0, 40)) {
    const key = cleanText(rawKey).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100);
    if (!key) continue;

    if (typeof rawValue === "string") {
      output[key] = cleanText(rawValue).slice(0, 1_000);
    } else if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      output[key] = rawValue;
    } else if (Array.isArray(rawValue)) {
      output[key] = rawValue
        .filter((item): item is string => typeof item === "string")
        .slice(0, 20)
        .map((item) => cleanText(item).slice(0, 300));
    }
  }

  return output;
}

function safeError(error: unknown) {
  if (error instanceof ApiError && error.expose) return error.message;
  return "The document operation could not be completed.";
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}

function actorBackendContext(actor: DocumentActor): BackendContext {
  return {
    userId: actor.ownerUserId,
    firmId: actor.firmId,
    actorName: actor.displayName,
    actorEmail: actor.email,
  };
}

function actorAuditIdentity(actor: DocumentActor) {
  return actor.kind === "advisor"
    ? {
        actorType: "Advisor",
        actorUserId: actor.userId,
        actorClientId: null,
      }
    : {
        actorType: "Client",
        actorUserId: null,
        actorClientId: actor.clientId,
      };
}

async function writeDocumentAudit(input: {
  documentId: string;
  actor: DocumentActor;
  clientId?: string | null;
  action: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const identity = actorAuditIdentity(input.actor);
  const resolvedClientId =
    input.clientId !== undefined
      ? input.clientId
      : input.actor.kind === "client"
        ? input.actor.clientId
        : (
            await prisma.documentVaultItem.findUnique({
              where: { id: input.documentId },
              select: { clientId: true },
            })
          )?.clientId ?? null;

  return prisma.documentAuditEvent.create({
    data: {
      documentId: input.documentId,
      firmId: input.actor.firmId,
      clientId: resolvedClientId,
      actorType: identity.actorType,
      actorUserId: identity.actorUserId,
      actorClientId: identity.actorClientId,
      action: cleanText(input.action).slice(0, 120),
      detail: input.detail ? cleanText(input.detail).slice(0, 1_000) : null,
      metadataJson: asJson(safeMetadata(input.metadata)),
    },
  });
}

async function advisorActorFromContext(
  context: AccessContext,
): Promise<AdvisorDocumentActor> {
  if (!context.firm) {
    throw new ApiError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
      expose: true,
    });
  }

  const canRead =
    context.isFounder || hasFirmPermission(context, "clients.read");

  if (!canRead) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ACCESS_DENIED",
      message: "You do not have access to firm documents.",
      expose: true,
    });
  }

  const canSupervise =
    context.isFounder || hasFirmPermission(context, "clients.supervise");
  const canManage =
    context.isFounder || hasFirmPermission(context, "clients.manage");
  const canManageFirmDocuments =
    context.isFounder ||
    hasFirmPermission(context, "firm.manage") ||
    hasFirmPermission(context, "security.review");

  return {
    kind: "advisor",
    actorId: context.user.id,
    displayName: context.user.name,
    email: context.user.email,
    userId: context.user.id,
    ownerUserId: context.user.id,
    firmId: context.firm.id,
    membershipId: context.membership?.id ?? null,
    access: context,
    canSupervise,
    canManage,
    canManageFirmDocuments,
  };
}

function clientActorFromCurrent(
  current: ClientPortalSessionContext,
): ClientDocumentActor {
  const email = current.client.email
    ? cleanEmail(decryptSensitiveText(current.client.email))
    : null;

  return {
    kind: "client",
    actorId: current.client.id,
    displayName: current.client.fullName,
    email,
    clientId: current.client.id,
    userId: current.assignment.userId,
    ownerUserId: current.assignment.userId,
    firmId: current.assignment.firmId,
    membershipId: current.assignment.id,
    assignedAdvisorEmail: current.assignment.user.email,
    canSupervise: false,
    canManage: false,
    canManageFirmDocuments: false,
  };
}

export async function resolveDocumentActor(
  hint?: DocumentActorKind | null,
): Promise<DocumentActor> {
  if (hint === "client") {
    const current = await getCurrentClientPortalSession();

    if (!current) {
      throw new ApiError({
        status: 401,
        code: "CLIENT_PORTAL_SESSION_REQUIRED",
        message: "Client portal session required.",
        expose: true,
      });
    }

    return clientActorFromCurrent(current);
  }

  if (hint === "advisor") {
    const context = await getCurrentAccessContext();

    if (!context) {
      throw new ApiError({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required.",
        expose: true,
      });
    }

    return advisorActorFromContext(context);
  }

  const context = await getCurrentAccessContext();
  if (context?.firm) return advisorActorFromContext(context);

  const current = await getCurrentClientPortalSession();
  if (current) return clientActorFromCurrent(current);

  throw new ApiError({
    status: 401,
    code: "DOCUMENT_AUTHENTICATION_REQUIRED",
    message: "Authentication required.",
    expose: true,
  });
}

async function clientForAdvisorUpload(
  actor: AdvisorDocumentActor,
  clientId: string,
) {
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      ...clientScopeWhere(actor.access),
    },
    select: {
      id: true,
      fullName: true,
      firmId: true,
      assignedAdvisorMembershipId: true,
      status: true,
    },
  });

  if (!client || client.firmId !== actor.firmId) {
    throw new ApiError({
      status: 404,
      code: "DOCUMENT_CLIENT_NOT_FOUND",
      message: "Client not found.",
      expose: true,
    });
  }

  return client;
}

async function validateUploadScope(input: {
  actor: DocumentActor;
  declaration: DocumentUploadDeclaration;
}) {
  if (!documentStorageConfigured()) {
    throw new ApiError({
      status: 503,
      code: "DOCUMENT_STORAGE_NOT_CONFIGURED",
      message: "Secure document storage is not configured.",
      expose: true,
    });
  }

  if (input.actor.kind === "client") {
    if (
      input.declaration.clientId &&
      input.declaration.clientId !== input.actor.clientId
    ) {
      throw new ApiError({
        status: 403,
        code: "DOCUMENT_CLIENT_SCOPE_INVALID",
        message: "Client document scope is invalid.",
        expose: true,
      });
    }

    return {
      clientId: input.actor.clientId,
      visibility: "AdvisorAndClient" as const,
    };
  }

  if (!input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_UPLOAD_PERMISSION_DENIED",
      message: "You do not have permission to upload client documents.",
      expose: true,
    });
  }

  if (input.declaration.clientId) {
    const client = await clientForAdvisorUpload(
      input.actor,
      input.declaration.clientId,
    );

    return {
      clientId: client.id,
      visibility: normaliseDocumentVisibility(
        input.declaration.visibility,
        "advisor",
      ),
    };
  }

  if (!input.actor.canManageFirmDocuments) {
    throw new ApiError({
      status: 403,
      code: "FIRM_DOCUMENT_PERMISSION_DENIED",
      message: "Firm-level document uploads require firm-management access.",
      expose: true,
    });
  }

  return {
    clientId: null,
    visibility: "AdvisorOnly" as const,
  };
}

async function findDuplicateDocument(input: {
  actor: DocumentActor;
  clientId: string | null;
  claimedSha256: string | null;
  sizeBytes: number;
}) {
  if (!input.claimedSha256) return null;

  return prisma.documentVaultItem.findFirst({
    where: {
      firmId: input.actor.firmId,
      clientId: input.clientId,
      deletedAt: null,
      sizeBytes: input.sizeBytes,
      status: {
        notIn: ["Rejected", "Duplicate", "Archived"],
      },
      OR: [
        { sha256: input.claimedSha256 },
        { claimedSha256: input.claimedSha256 },
      ],
    },
    select: {
      id: true,
      status: true,
      processingStatus: true,
      createdAt: true,
    },
  });
}

export async function prepareDocumentUpload(input: {
  declaration: unknown;
}): Promise<{
  actor: DocumentActor;
  declaration: DocumentUploadDeclaration;
  tokenPayload: string;
  maximumSizeInBytes: number;
}> {
  const declaration = validateDocumentUploadDeclaration(input.declaration);
  const actor = await resolveDocumentActor(declaration.actorHint);
  const scope = await validateUploadScope({ actor, declaration });
  const scopedDeclaration: DocumentUploadDeclaration = {
    ...declaration,
    actorHint: actor.kind,
    clientId: scope.clientId,
    visibility: scope.visibility,
  };
  const duplicate = await findDuplicateDocument({
    actor,
    clientId: scope.clientId,
    claimedSha256: scopedDeclaration.claimedSha256,
    sizeBytes: scopedDeclaration.declaredSizeBytes,
  });

  if (duplicate) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_DUPLICATE",
      message: "An identical document is already stored for this client.",
      expose: true,
      details: {
        existingDocumentId: duplicate.id,
        existingStatus: duplicate.status,
      },
    });
  }

  const trusted: TrustedUploadTokenPayload = {
    version: 1,
    actorKind: actor.kind,
    actorId: actor.actorId,
    userId: actor.ownerUserId,
    firmId: actor.firmId,
    membershipId: actor.membershipId,
    clientId: scope.clientId,
    declaration: scopedDeclaration,
    issuedAt: new Date().toISOString(),
  };

  return {
    actor,
    declaration: scopedDeclaration,
    tokenPayload: JSON.stringify(trusted),
    maximumSizeInBytes: documentMaximumUploadBytesServer(),
  };
}

function parseTrustedUploadToken(value: string): TrustedUploadTokenPayload {
  let parsed: Partial<TrustedUploadTokenPayload>;

  try {
    parsed = JSON.parse(value) as Partial<TrustedUploadTokenPayload>;
  } catch {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_TOKEN_INVALID",
      message: "The document upload token is invalid.",
      expose: false,
    });
  }

  if (
    parsed.version !== 1 ||
    (parsed.actorKind !== "advisor" && parsed.actorKind !== "client") ||
    typeof parsed.actorId !== "string" ||
    typeof parsed.userId !== "string" ||
    typeof parsed.firmId !== "string" ||
    !parsed.declaration ||
    typeof parsed.issuedAt !== "string"
  ) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_TOKEN_INVALID",
      message: "The document upload token is invalid.",
      expose: false,
    });
  }

  const issuedAt = Date.parse(parsed.issuedAt);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 2 * 60 * 60 * 1_000) {
    throw new ApiError({
      status: 410,
      code: "DOCUMENT_UPLOAD_TOKEN_EXPIRED",
      message: "The document upload token has expired.",
      expose: false,
    });
  }

  return parsed as TrustedUploadTokenPayload;
}

async function actorFromTrustedUpload(
  trusted: TrustedUploadTokenPayload,
): Promise<DocumentActor> {
  if (trusted.actorKind === "advisor") {
    const context = await getAccessContextForUser({
      userId: trusted.userId,
      firmId: trusted.firmId,
    });

    if (!context?.firm) {
      throw new ApiError({
        status: 409,
        code: "DOCUMENT_UPLOAD_ACTOR_INACTIVE",
        message: "The document upload actor is no longer active.",
        expose: false,
      });
    }

    const actor = await advisorActorFromContext(context);

    if (
      trusted.membershipId &&
      actor.membershipId !== trusted.membershipId &&
      !actor.canSupervise
    ) {
      throw new ApiError({
        status: 409,
        code: "DOCUMENT_UPLOAD_MEMBERSHIP_CHANGED",
        message: "The document upload membership changed before completion.",
        expose: false,
      });
    }

    return actor;
  }

  if (!trusted.clientId || trusted.actorId !== trusted.clientId) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_CLIENT_MISSING",
      message: "The client upload context is invalid.",
      expose: false,
    });
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: trusted.clientId,
      firmId: trusted.firmId,
      portalEnabled: true,
      assignedAdvisorMembershipId: {
        not: null,
      },
    },
    select: {
      id: true,
      userId: true,
      firmId: true,
      assignedAdvisorMembershipId: true,
      assignedAdvisorAt: true,
      assignedByUserId: true,
      fullName: true,
      email: true,
      phone: true,
      householdName: true,
      preferredContactMethod: true,
      clientType: true,
      riskProfile: true,
      liquidityNeeds: true,
      timeHorizon: true,
      objective: true,
      portfolioValue: true,
      status: true,
      notes: true,
      portalEnabled: true,
      portalInviteCodeHash: true,
      portalInviteExpiresAt: true,
      portalOnboardingStatus: true,
      portalLastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!client?.firmId || !client.assignedAdvisorMembershipId) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_UPLOAD_CLIENT_INACTIVE",
      message: "Client portal access changed before upload completion.",
      expose: false,
    });
  }

  const assignment = await prisma.firmMembership.findFirst({
    where: {
      id: client.assignedAdvisorMembershipId,
      firmId: client.firmId,
      status: "Active",
      firm: {
        platformStatus: "Active",
      },
      user: {
        platformStatus: {
          notIn: ["Banned", "Suspended"],
        },
      },
    },
    select: {
      id: true,
      firmId: true,
      userId: true,
      role: true,
      status: true,
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: true,
      calendarColor: true,
      calendlyUrl: true,
      calendlyLabel: true,
      calendlyEnabled: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          platformStatus: true,
        },
      },
      firm: {
        select: {
          id: true,
          name: true,
          firmEmail: true,
          firmCode: true,
          platformStatus: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_UPLOAD_ADVISOR_INACTIVE",
      message: "The assigned advisor changed before upload completion.",
      expose: false,
    });
  }

  return {
    kind: "client",
    actorId: client.id,
    displayName: client.fullName,
    email: client.email ? cleanEmail(decryptSensitiveText(client.email)) : null,
    clientId: client.id,
    userId: assignment.userId,
    ownerUserId: assignment.userId,
    firmId: assignment.firmId,
    membershipId: assignment.id,
    assignedAdvisorEmail: assignment.user.email,
    canSupervise: false,
    canManage: false,
    canManageFirmDocuments: false,
  };
}

async function enqueueDocumentProcessing(input: {
  actor: DocumentActor;
  documentId: string;
  etag: string | null;
}) {
  return enqueueBackgroundJob({
    context: actorBackendContext(input.actor),
    jobKey: "document_process",
    jobName: DOCUMENT_PROCESS_JOB_NAME,
    payload: {
      documentId: input.documentId,
    },
    idempotencyKey: `document-process:${input.documentId}:${input.etag ?? "no-etag"}`,
    maxAttempts: DOCUMENT_PROCESS_MAX_ATTEMPTS,
    timeoutMs: DOCUMENT_PROCESS_TIMEOUT_MS,
    backoffMs: DOCUMENT_PROCESS_BACKOFF_MS,
  });
}

async function notifyAssignedAdvisorOfClientUpload(input: {
  actor: ClientDocumentActor;
  documentId: string;
  fileName: string;
  documentType: string;
}) {
  const sourceEventId = `document-upload:${input.documentId}`;
  let inboxItem: { id: string } | null = null;

  try {
    inboxItem = await prisma.advisorClientInboxItem.create({
      data: {
        firmId: input.actor.firmId,
        clientId: input.actor.clientId,
        assignedAdvisorMembershipId: input.actor.membershipId,
        kind: "Document",
        title: `${input.actor.displayName} uploaded a document`,
        body: `${input.fileName} was submitted to the secure document vault for advisor review.`,
        status: "Unread",
        priority: "Medium",
        sourceEventId,
        senderName: input.actor.displayName,
        senderEmail: input.actor.email
          ? encryptSensitiveText(input.actor.email)
          : null,
        metadataJson: asJson({
          documentId: input.documentId,
          documentType: input.documentType,
          actionUrl: `/workspace/documents?documentId=${encodeURIComponent(
            input.documentId,
          )}`,
        }),
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    inboxItem = await prisma.advisorClientInboxItem.findUnique({
      where: {
        firmId_sourceEventId: {
          firmId: input.actor.firmId,
          sourceEventId,
        },
      },
      select: {
        id: true,
      },
    });
  }

  await queueBackendDelivery(actorBackendContext(input.actor), {
    channel: "Dashboard",
    destination: input.actor.assignedAdvisorEmail,
    title: `${input.actor.displayName} uploaded a document`,
    body: `${input.fileName} is ready for secure processing and advisor review.`,
    urgency: "Medium",
    score: 76,
    idempotencyKey: `client-document-upload:${input.documentId}`,
    payload: {
      documentId: input.documentId,
      clientId: input.actor.clientId,
      inboxItemId: inboxItem?.id ?? null,
      actionUrl: `/workspace/documents?documentId=${encodeURIComponent(
        input.documentId,
      )}`,
    },
  });
}

function storedUploadMetadata(input: {
  actor: DocumentActor;
  blob: Awaited<ReturnType<typeof headPrivateDocumentBlob>>;
  declaration: DocumentUploadDeclaration;
  jobId?: string | null;
}) {
  return {
    schemaVersion: 1,
    provider: "Vercel Blob",
    upload: {
      actorKind: input.actor.kind,
      actorId: input.actor.actorId,
      declaredContentType: input.declaration.declaredContentType,
      declaredSizeBytes: input.declaration.declaredSizeBytes,
      uploadedAt:
        input.blob.uploadedAt?.toISOString() ?? new Date().toISOString(),
      processingJobId: input.jobId ?? null,
    },
  };
}

async function publicDocumentById(input: {
  actor: DocumentActor;
  documentId: string;
}) {
  const row = await findDocumentForActor({
    actor: input.actor,
    documentId: input.documentId,
    includeDeleted: true,
  });

  if (!row) {
    throw new ApiError({
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
      message: "Document not found.",
      expose: true,
    });
  }

  const audits = await prisma.documentAuditEvent.findMany({
    where: {
      documentId: row.id,
    },
    select: auditSelect,
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_AUDIT_PER_DOCUMENT,
  });

  return mapDocument(row, input.actor, audits);
}

async function registerUploadedDocument(input: {
  actor: DocumentActor;
  declaration: DocumentUploadDeclaration;
  blob: DocumentBlobReference;
}) {
  if (!documentPathIsAllowed(input.blob.pathname)) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_STORAGE_PATH_INVALID",
      message: "The uploaded document path is invalid.",
      expose: false,
    });
  }

  const scope = await validateUploadScope({
    actor: input.actor,
    declaration: input.declaration,
  });
  const blob = await headPrivateDocumentBlob(input.blob.pathname);

  if (blob.size !== input.declaration.declaredSizeBytes) {
    await deletePrivateDocumentBlob(blob.pathname).catch(() => undefined);
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_SIZE_MISMATCH",
      message: "The uploaded document size did not match the approved upload.",
      expose: true,
    });
  }

  const existing = await prisma.documentVaultItem.findUnique({
    where: {
      storagePath: blob.pathname,
    },
    select: {
      id: true,
      processingStatus: true,
      etag: true,
    },
  });

  if (existing) {
    if (["Queued", "Failed"].includes(existing.processingStatus)) {
      await enqueueDocumentProcessing({
        actor: input.actor,
        documentId: existing.id,
        etag: existing.etag ?? blob.etag,
      });
    }

    return {
      document: await publicDocumentById({
        actor: input.actor,
        documentId: existing.id,
      }),
      duplicate: true,
    };
  }

  const encryptedFileName =
    encryptSensitiveText(input.declaration.originalFileName) ??
    input.declaration.originalFileName;
  const encryptedNotes = encryptSensitiveText(input.declaration.notes);
  let created: { id: string };

  try {
    created = await prisma.documentVaultItem.create({
      data: {
        userId: input.actor.ownerUserId,
        firmId: input.actor.firmId,
        clientId: scope.clientId,
        fileName: encryptedFileName,
        fileExtension: documentExtension(input.declaration.originalFileName),
        documentType: input.declaration.documentType,
        status: "Processing",
        notes: encryptedNotes,
        storageProvider: "Vercel Blob",
        storagePath: blob.pathname,
        storageUrl: blob.url,
        contentType: blob.contentType ?? input.declaration.declaredContentType,
        sizeBytes: blob.size,
        etag: blob.etag,
        claimedSha256: input.declaration.claimedSha256,
        visibility: scope.visibility,
        uploadedByType: input.actor.kind === "client" ? "Client" : "Advisor",
        uploadedByClientId:
          input.actor.kind === "client" ? input.actor.clientId : null,
        processingStatus: "Queued",
        processingError: null,
        securityStatus: "Pending",
        classificationJson: "{}",
        metadataJson: asJson(
          storedUploadMetadata({
            actor: input.actor,
            blob,
            declaration: input.declaration,
          }),
        ),
        extractedTextEncrypted: null,
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const duplicatePath = await prisma.documentVaultItem.findUnique({
      where: {
        storagePath: blob.pathname,
      },
      select: {
        id: true,
      },
    });

    if (!duplicatePath) throw error;
    created = duplicatePath;
  }

  const queued = await enqueueDocumentProcessing({
    actor: input.actor,
    documentId: created.id,
    etag: blob.etag,
  });

  await prisma.documentVaultItem.update({
    where: {
      id: created.id,
    },
    data: {
      metadataJson: asJson(
        storedUploadMetadata({
          actor: input.actor,
          blob,
          declaration: input.declaration,
          jobId: queued.job.id,
        }),
      ),
    },
  });

  await writeDocumentAudit({
    documentId: created.id,
    actor: input.actor,
    action: "document.uploaded",
    detail: "A document was uploaded to private object storage.",
    metadata: {
      clientId: scope.clientId,
      contentType: blob.contentType,
      sizeBytes: blob.size,
      documentType: input.declaration.documentType,
      visibility: scope.visibility,
      processingJobId: queued.job.id,
      duplicateJob: queued.duplicate,
    },
  });

  if (input.actor.kind === "client") {
    await notifyAssignedAdvisorOfClientUpload({
      actor: input.actor,
      documentId: created.id,
      fileName: input.declaration.originalFileName,
      documentType: input.declaration.documentType,
    });
  }

  return {
    document: await publicDocumentById({
      actor: input.actor,
      documentId: created.id,
    }),
    duplicate: false,
  };
}

export async function finalizeDocumentUploadFromToken(input: {
  tokenPayload: string;
  blob: DocumentBlobReference;
}) {
  const trusted = parseTrustedUploadToken(input.tokenPayload);
  const actor = await actorFromTrustedUpload(trusted);

  return registerUploadedDocument({
    actor,
    declaration: trusted.declaration,
    blob: input.blob,
  });
}

function advisorDocumentWhere(actor: AdvisorDocumentActor) {
  if (actor.canSupervise) {
    return {
      OR: [
        { firmId: actor.firmId },
        {
          firmId: null,
          userId: actor.userId,
        },
      ],
    };
  }

  if (!actor.membershipId) {
    return {
      userId: actor.userId,
      firmId: actor.firmId,
    };
  }

  return {
    OR: [
      {
        firmId: actor.firmId,
        client: {
          is: {
            firmId: actor.firmId,
            assignedAdvisorMembershipId: actor.membershipId,
          },
        },
      },
      {
        firmId: actor.firmId,
        clientId: null,
        userId: actor.userId,
      },
      {
        firmId: null,
        userId: actor.userId,
      },
    ],
  };
}

function clientDocumentWhere(actor: ClientDocumentActor) {
  return {
    firmId: actor.firmId,
    clientId: actor.clientId,
    visibility: "AdvisorAndClient",
    OR: [
      {
        uploadedByType: "Client",
        uploadedByClientId: actor.clientId,
      },
      {
        approvedAt: {
          not: null,
        },
      },
    ],
  };
}

function documentWhereForActor(actor: DocumentActor) {
  return actor.kind === "advisor"
    ? advisorDocumentWhere(actor)
    : clientDocumentWhere(actor);
}

async function findDocumentForActor(input: {
  actor: DocumentActor;
  documentId: string;
  includeDeleted?: boolean;
}) {
  return prisma.documentVaultItem.findFirst({
    where: {
      id: input.documentId,
      ...documentWhereForActor(input.actor),
      ...(input.includeDeleted ? {} : { deletedAt: null }),
    },
    select: documentSelect,
  });
}

function auditView(row: {
  id: string;
  action: string;
  actorType: string;
  detail: string | null;
  metadataJson: string;
  createdAt: Date;
}): DocumentAuditView {
  return {
    id: row.id,
    action: row.action,
    actorType: row.actorType,
    detail: row.detail,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function clientCanDownload(row: NonNullable<DocumentRow>, actor: ClientDocumentActor) {
  return Boolean(
    row.storagePath &&
      row.securityStatus === "Signature Verified" &&
      row.status !== "Rejected" &&
      row.status !== "Duplicate" &&
      row.status !== "Archived" &&
      row.status !== "Deleting" &&
      row.deletedAt === null &&
      row.clientId === actor.clientId &&
      row.visibility === "AdvisorAndClient" &&
      (row.uploadedByClientId === actor.clientId || row.approvedAt),
  );
}

function advisorCanDownload(row: NonNullable<DocumentRow>) {
  return Boolean(
    row.storagePath &&
      row.securityStatus === "Signature Verified" &&
      row.status !== "Rejected" &&
      row.status !== "Duplicate" &&
      row.status !== "Archived" &&
      row.status !== "Deletion Requested" &&
      row.status !== "Deleting" &&
      row.deletedAt === null,
  );
}

function mapDocument(
  row: NonNullable<DocumentRow>,
  actor: DocumentActor,
  audits: Array<{
    id: string;
    action: string;
    actorType: string;
    detail: string | null;
    metadataJson: string;
    createdAt: Date;
  }> = [],
): DocumentListItem {
  const classification = parseJson<DocumentClassification | Record<string, unknown>>(
    row.classificationJson,
    {},
  );
  const canDownload =
    actor.kind === "client"
      ? clientCanDownload(row, actor)
      : advisorCanDownload(row);
  const canApprove =
    actor.kind === "advisor" &&
    actor.canManage &&
    row.processingStatus === "Complete" &&
    row.securityStatus === "Signature Verified" &&
    Boolean(row.storagePath) &&
    row.deletedAt === null &&
    !["Duplicate", "Archived", "Deletion Requested", "Deleting"].includes(
      row.status,
    );

  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.fullName ?? null,
    fileName: decryptSensitiveText(row.fileName) ?? "Document",
    fileExtension: row.fileExtension,
    documentType: row.documentType,
    status: row.status,
    processingStatus: row.processingStatus,
    processingError: row.processingError,
    securityStatus: row.securityStatus,
    visibility: row.visibility,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    claimedSha256: row.claimedSha256,
    uploadedByType: row.uploadedByType,
    uploadedByClientId: row.uploadedByClientId,
    notes: decryptSensitiveText(row.notes) ?? null,
    extractedTextPreview:
      (decryptSensitiveText(row.extractedTextEncrypted) ?? null)?.slice(0, 1_000) ?? null,
    classification,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByUserId: row.approvedByUserId,
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canDownload,
    canApprove,
    canArchive:
      actor.kind === "advisor" &&
      actor.canManage &&
      row.deletedAt === null &&
      !["Deletion Requested", "Deleting"].includes(row.status) &&
      !["Queued", "Processing"].includes(row.processingStatus),
    canDelete:
      actor.kind === "advisor" &&
      actor.canManage &&
      (actor.canSupervise || row.userId === actor.userId) &&
      row.deletedAt === null &&
      row.status !== "Deleting" &&
      !["Queued", "Processing"].includes(row.processingStatus),
    canRequestDelete:
      actor.kind === "client" &&
      row.uploadedByClientId === actor.clientId &&
      row.deletedAt === null &&
      !["Deletion Requested", "Deleting"].includes(row.status),
    canReprocess:
      actor.kind === "advisor" &&
      actor.canManage &&
      Boolean(row.storagePath) &&
      row.deletedAt === null &&
      !["Archived", "Deletion Requested", "Deleting", "Rejected", "Duplicate"].includes(
        row.status,
      ) &&
      ["Failed", "Complete"].includes(row.processingStatus),
    audit: audits.map(auditView),
  };
}

async function advisorClientOptions(actor: AdvisorDocumentActor) {
  const rows = await prisma.clientProfile.findMany({
    where: clientScopeWhere(actor.access),
    select: {
      id: true,
      fullName: true,
      householdName: true,
      status: true,
      assignedAdvisorMembershipId: true,
    },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    take: 250,
  });

  return rows;
}

function searchWhere(query: string) {
  if (!query) return {};

  return {
    OR: [
      {
        documentType: {
          contains: query,
          mode: "insensitive" as const,
        },
      },
      {
        status: {
          contains: query,
          mode: "insensitive" as const,
        },
      },
      {
        contentType: {
          contains: query,
          mode: "insensitive" as const,
        },
      },
      {
        client: {
          is: {
            fullName: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
        },
      },
    ],
  };
}

export async function listDocumentCenter(input: {
  requestUrl: string;
}): Promise<DocumentCenterPayload> {
  const url = new URL(input.requestUrl);
  const hint = url.searchParams.get("actor") === "client" ? "client" : "advisor";
  const actor = await resolveDocumentActor(hint);
  const limit = readPageSize(url.searchParams, {
    fallback: 25,
    maximum: MAX_DOCUMENT_LIST,
  });
  const query = readSearch(url.searchParams, "q", 120);
  const requestedStatus = cleanText(url.searchParams.get("status"));
  const requestedType = cleanText(url.searchParams.get("documentType"));
  const requestedClientId = cleanText(url.searchParams.get("clientId"));
  const includeArchived =
    actor.kind === "advisor" &&
    actor.canSupervise &&
    url.searchParams.get("includeArchived") === "1";
  const scope = paginationScope({
    actorKind: actor.kind,
    actorId: actor.actorId,
    firmId: actor.firmId,
    query,
    requestedStatus,
    requestedType,
    requestedClientId,
    includeArchived,
  });
  const cursor = decodeCursor(url.searchParams.get("cursor"), scope);
  const baseWhere: Prisma.DocumentVaultItemWhereInput = {
    AND: [
      documentWhereForActor(actor),
      ...(includeArchived
        ? []
        : [
            {
              deletedAt: null,
              status: {
                not: "Archived",
              },
            } satisfies Prisma.DocumentVaultItemWhereInput,
          ]),
    ],
  };
  const filteredConditions: Prisma.DocumentVaultItemWhereInput[] = [baseWhere];

  if (requestedStatus) filteredConditions.push({ status: requestedStatus });
  if (requestedType) filteredConditions.push({ documentType: requestedType });
  if (requestedClientId) filteredConditions.push({ clientId: requestedClientId });
  if (query) filteredConditions.push(searchWhere(query));

  const filteredWhere: Prisma.DocumentVaultItemWhereInput = {
    AND: filteredConditions,
  };
  const scopedWhere = (
    extra: Prisma.DocumentVaultItemWhereInput,
  ): Prisma.DocumentVaultItemWhereInput => ({
    AND: [baseWhere, extra],
  });

  const [rows, total, processing, needsReview, approved, rejected, duplicates, deletionRequested] =
    await Promise.all([
      prisma.documentVaultItem.findMany({
        where: filteredWhere,
        select: documentSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
      }),
      prisma.documentVaultItem.count({ where: baseWhere }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          processingStatus: {
            in: ["Queued", "Processing"],
          },
        }),
      }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          status: "Needs Review",
        }),
      }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          status: "Approved",
        }),
      }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          status: "Rejected",
        }),
      }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          status: "Duplicate",
        }),
      }),
      prisma.documentVaultItem.count({
        where: scopedWhere({
          status: {
            in: ["Deletion Requested", "Deleting"],
          },
        }),
      }),
    ]);

  const page = createCursorPage({
    rows,
    pageSize: limit,
    scope,
  });
  const auditRows = page.items.length
    ? await prisma.documentAuditEvent.findMany({
        where: {
          documentId: {
            in: page.items.map((row) => row.id),
          },
        },
        select: auditSelect,
        orderBy: {
          createdAt: "desc",
        },
        take: page.items.length * MAX_AUDIT_PER_DOCUMENT,
      })
    : [];
  const auditsByDocument = new Map<string, typeof auditRows>();

  for (const audit of auditRows) {
    const current = auditsByDocument.get(audit.documentId) ?? [];
    if (current.length < MAX_AUDIT_PER_DOCUMENT) {
      current.push(audit);
      auditsByDocument.set(audit.documentId, current);
    }
  }

  const clients =
    actor.kind === "advisor" ? await advisorClientOptions(actor) : [];

  return {
    ok: true,
    actor: {
      kind: actor.kind,
      id: actor.actorId,
      displayName: actor.displayName,
      firmId: actor.firmId,
    },
    permissions: {
      canUpload: actor.kind === "client" || actor.canManage,
      canUploadFirmDocument:
        actor.kind === "advisor" && actor.canManageFirmDocuments,
      canApprove: actor.kind === "advisor" && actor.canManage,
      canDelete: actor.kind === "advisor" && actor.canManage,
      canViewFirmScope: actor.kind === "advisor" && actor.canSupervise,
    },
    storage: {
      configured: documentStorageConfigured(),
      provider: "Vercel Blob",
      access: "private",
      maximumSizeBytes: documentMaximumUploadBytesServer(),
      allowedContentTypes: DOCUMENT_ALLOWED_CONTENT_TYPES,
    },
    clients,
    documents: page.items.map((row) =>
      mapDocument(row, actor, auditsByDocument.get(row.id) ?? []),
    ),
    metrics: {
      total,
      processing,
      needsReview,
      approved,
      rejected,
      duplicates,
      deletionRequested,
    },
    pagination: page.pagination,
  };
}

async function requireDocument(input: {
  actor: DocumentActor;
  documentId: string;
  includeDeleted?: boolean;
}) {
  const document = await findDocumentForActor(input);

  if (!document) {
    throw new ApiError({
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
      message: "Document not found.",
      expose: true,
    });
  }

  return document;
}

export async function createDocumentAccessUrl(input: {
  actor: DocumentActor;
  documentId: string;
  disposition?: "inline" | "attachment";
  requestUrl: string;
}): Promise<DocumentActionResult> {
  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });
  const publicDocument = mapDocument(document, input.actor);

  if (!publicDocument.canDownload) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_NOT_READY_FOR_ACCESS",
      message:
        document.processingStatus !== "Complete"
          ? "The document is still being processed."
          : "The document is not available for download.",
      expose: true,
    });
  }

  const issued = issueDocumentAccessToken({
    documentId: document.id,
    actorKind: input.actor.kind,
    actorId: input.actor.actorId,
    disposition: input.disposition,
  });
  const url = new URL(
    `/api/documents/${encodeURIComponent(document.id)}/download`,
    input.requestUrl,
  );
  url.searchParams.set("token", issued.token);

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.access_link_created",
    detail: "A short-lived authenticated document access link was created.",
    metadata: {
      disposition: input.disposition ?? "attachment",
      expiresAt: issued.expiresAt.toISOString(),
    },
  });

  return {
    ok: true,
    message: "Secure document access link created.",
    accessUrl: url.toString(),
    expiresAt: issued.expiresAt.toISOString(),
  };
}

export async function loadDocumentForSignedAccess(input: {
  token: string;
}) {
  const verified = verifyDocumentAccessToken(input.token);
  const actor = await resolveDocumentActor(verified.actorKind);

  if (actor.actorId !== verified.actorId) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ACCESS_ACTOR_MISMATCH",
      message: "This document access link belongs to another session.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor,
    documentId: verified.documentId,
  });
  const publicDocument = mapDocument(document, actor);

  if (!publicDocument.canDownload || !document.storagePath) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_NOT_READY_FOR_ACCESS",
      message: "The document is not available for download.",
      expose: true,
    });
  }

  return {
    actor,
    document,
    disposition: verified.disposition,
    fileName: decryptSensitiveText(document.fileName) ?? "document",
    storagePath: document.storagePath,
  };
}

export async function recordDocumentAccess(input: {
  actor: DocumentActor;
  documentId: string;
  clientId: string | null;
  disposition: "inline" | "attachment";
}) {
  await prisma.$transaction([
    prisma.documentVaultItem.update({
      where: {
        id: input.documentId,
      },
      data: {
        lastViewedAt: new Date(),
        viewCount: {
          increment: 1,
        },
      },
    }),
    prisma.documentAuditEvent.create({
      data: {
        documentId: input.documentId,
        firmId: input.actor.firmId,
        clientId: input.clientId,
        ...actorAuditIdentity(input.actor),
        action:
          input.disposition === "inline"
            ? "document.viewed"
            : "document.downloaded",
        detail:
          input.disposition === "inline"
            ? "The document was opened through a signed access route."
            : "The document was downloaded through a signed access route.",
        metadataJson: asJson({
          disposition: input.disposition,
        }),
      },
    }),
  ]);
}

export async function approveDocument(input: {
  actor: DocumentActor;
  documentId: string;
  request?: Request;
}) {
  if (input.actor.kind !== "advisor" || !input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_APPROVAL_PERMISSION_DENIED",
      message: "Advisor document approval permission is required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });

  if (document.status === "Approved" && document.approvedAt) {
    return publicDocumentById({
      actor: input.actor,
      documentId: document.id,
    });
  }

  if (
    document.processingStatus !== "Complete" ||
    document.securityStatus !== "Signature Verified" ||
    !document.storagePath ||
    ["Archived", "Deletion Requested", "Deleting", "Rejected", "Duplicate"].includes(
      document.status,
    )
  ) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_NOT_READY_FOR_APPROVAL",
      message: "Complete secure processing before approving this document.",
      expose: true,
    });
  }

  const now = new Date();

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: "Approved",
      approvedAt: now,
      approvedByUserId: input.actor.userId,
    },
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.approved",
    detail: "An advisor approved the processed document.",
    metadata: {
      previousStatus: document.status,
      approvedAt: now.toISOString(),
    },
  });

  await recordSecurityEvent({
    userId: input.actor.userId,
    eventType: "document.approved",
    severity: "Medium",
    area: "Document Vault",
    title: "Document approved",
    detail: "A processed document was approved for its configured visibility.",
    metadata: {
      documentId: document.id,
      clientId: document.clientId,
    },
    request: input.request,
  });

  return publicDocumentById({
    actor: input.actor,
    documentId: document.id,
  });
}

export async function updateDocumentMetadata(input: {
  actor: DocumentActor;
  documentId: string;
  documentType?: unknown;
  visibility?: unknown;
  notes?: unknown;
}) {
  if (input.actor.kind !== "advisor" || !input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_UPDATE_PERMISSION_DENIED",
      message: "Advisor document-management permission is required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });
  if (
    document.deletedAt ||
    ["Archived", "Deletion Requested", "Deleting", "Rejected", "Duplicate"].includes(
      document.status,
    )
  ) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_METADATA_UPDATE_UNAVAILABLE",
      message: "This document cannot be edited in its current state.",
      expose: true,
    });
  }

  const nextType = normaliseDocumentType(input.documentType ?? document.documentType);
  const nextVisibility = normaliseDocumentVisibility(
    input.visibility ?? document.visibility,
    "advisor",
  );
  const nextNotes =
    typeof input.notes === "string"
      ? encryptSensitiveText(cleanText(input.notes).slice(0, 5_000) || null)
      : undefined;
  const visibilityChanged = nextVisibility !== document.visibility;

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      documentType: nextType,
      visibility: nextVisibility,
      notes: nextNotes,
      ...(visibilityChanged
        ? {
            status: "Needs Review",
            approvedAt: null,
            approvedByUserId: null,
          }
        : {}),
    },
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.metadata_updated",
    detail: "Document classification, visibility, or notes were updated.",
    metadata: {
      previousDocumentType: document.documentType,
      nextDocumentType: nextType,
      previousVisibility: document.visibility,
      nextVisibility,
      notesChanged: typeof input.notes === "string",
      approvalSuperseded: visibilityChanged && Boolean(document.approvedAt),
    },
  });

  return publicDocumentById({
    actor: input.actor,
    documentId: document.id,
  });
}

export async function archiveDocument(input: {
  actor: DocumentActor;
  documentId: string;
  restore?: boolean;
}) {
  if (input.actor.kind !== "advisor" || !input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_ARCHIVE_PERMISSION_DENIED",
      message: "Advisor document-management permission is required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
    includeDeleted: false,
  });

  if (input.restore && document.status !== "Archived") {
    return publicDocumentById({
      actor: input.actor,
      documentId: document.id,
    });
  }

  if (!input.restore && document.status === "Archived") {
    return publicDocumentById({
      actor: input.actor,
      documentId: document.id,
    });
  }

  if (
    ["Deletion Requested", "Deleting"].includes(document.status) ||
    ["Queued", "Processing"].includes(document.processingStatus)
  ) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_PROCESSING_IN_PROGRESS",
      message:
        ["Deletion Requested", "Deleting"].includes(document.status)
          ? "Resolve the document deletion request before changing archive state."
          : "Wait for secure document processing to finish before archiving it.",
      expose: true,
    });
  }

  const nextStatus = input.restore
    ? document.approvedAt
      ? "Approved"
      : "Needs Review"
    : "Archived";

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: nextStatus,
    },
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: input.restore ? "document.restored" : "document.archived",
    detail: input.restore
      ? "The document was restored to the active vault."
      : "The document was archived without deleting the original file.",
    metadata: {
      previousStatus: document.status,
      nextStatus,
    },
  });

  return publicDocumentById({
    actor: input.actor,
    documentId: document.id,
  });
}

export async function requestDocumentDeletion(input: {
  actor: DocumentActor;
  documentId: string;
}) {
  if (input.actor.kind !== "client") {
    throw new ApiError({
      status: 403,
      code: "CLIENT_DOCUMENT_SESSION_REQUIRED",
      message: "Client portal session required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });

  if (document.uploadedByClientId !== input.actor.clientId) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_DELETE_REQUEST_DENIED",
      message: "Only client-uploaded documents can be submitted for deletion.",
      expose: true,
    });
  }

  if (document.status === "Deletion Requested") {
    return publicDocumentById({
      actor: input.actor,
      documentId: document.id,
    });
  }

  if (
    ["Archived", "Rejected", "Duplicate", "Deleting"].includes(document.status) ||
    ["Queued", "Processing"].includes(document.processingStatus)
  ) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_DELETE_REQUEST_UNAVAILABLE",
      message:
        ["Queued", "Processing"].includes(document.processingStatus)
          ? "Wait for secure document processing to finish before requesting deletion."
          : "This document is no longer available for a client deletion request.",
      expose: true,
    });
  }

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: "Deletion Requested",
    },
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.deletion_requested",
    detail: "The client requested deletion of an uploaded document.",
  });

  await queueBackendDelivery(actorBackendContext(input.actor), {
    channel: "Dashboard",
    destination: input.actor.assignedAdvisorEmail,
    title: `${input.actor.displayName} requested document deletion`,
    body: "Review the document retention and deletion request in the secure document center.",
    urgency: "High",
    score: 88,
    idempotencyKey: `document-deletion-request:${document.id}`,
    payload: {
      documentId: document.id,
      clientId: input.actor.clientId,
      actionUrl: `/workspace/documents?documentId=${encodeURIComponent(
        document.id,
      )}`,
    },
  });

  return publicDocumentById({
    actor: input.actor,
    documentId: document.id,
  });
}

export async function deleteDocument(input: {
  actor: DocumentActor;
  documentId: string;
  request?: Request;
}) {
  if (input.actor.kind !== "advisor" || !input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_DELETE_PERMISSION_DENIED",
      message: "Advisor document-management permission is required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });

  if (["Queued", "Processing"].includes(document.processingStatus)) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_PROCESSING_IN_PROGRESS",
      message: "Wait for secure document processing to finish before deleting it.",
      expose: true,
    });
  }

  if (!input.actor.canSupervise && document.userId !== input.actor.userId) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_DELETE_PERMISSION_DENIED",
      message: "Only the document owner or a supervisor can delete this document.",
      expose: true,
    });
  }

  const pathname = document.storagePath;
  const metadata = parseJson<Record<string, unknown>>(document.metadataJson, {});
  const deletionStartedAt = new Date();

  const deletionClaim = await prisma.documentVaultItem.updateMany({
    where: {
      id: document.id,
      deletedAt: null,
      status: {
        not: "Deleting",
      },
    },
    data: {
      status: "Deleting",
      processingError: null,
      metadataJson: asJson({
        ...metadata,
        deletion: {
          startedAt: deletionStartedAt.toISOString(),
          requestedByUserId: input.actor.userId,
        },
      }),
    },
  });

  if (!deletionClaim.count) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_DELETION_ALREADY_IN_PROGRESS",
      message: "Document deletion is already in progress.",
      expose: true,
    });
  }

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.deletion_started",
    detail: "An authorized advisor started deletion of the private storage object.",
    metadata: {
      clientId: document.clientId,
      previousStatus: document.status,
      storageObjectPresent: Boolean(pathname),
    },
  });

  try {
    if (pathname) await deletePrivateDocumentBlob(pathname);
  } catch {
    const failureMessage =
      "Private storage did not confirm deletion. The document remains in deletion review and can be retried.";

    await prisma.documentVaultItem.update({
      where: {
        id: document.id,
      },
      data: {
        status: "Deletion Requested",
        processingError: failureMessage,
      },
    });

    await writeDocumentAudit({
      documentId: document.id,
      actor: input.actor,
      action: "document.deletion_failed",
      detail: failureMessage,
      metadata: {
        clientId: document.clientId,
      },
    });

    throw new ApiError({
      status: 502,
      code: "DOCUMENT_STORAGE_DELETE_FAILED",
      message: failureMessage,
      expose: true,
    });
  }

  const now = new Date();

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: "Archived",
      deletedAt: now,
      storagePath: null,
      storageUrl: null,
      etag: null,
      processingError: null,
      metadataJson: asJson({
        ...metadata,
        deletion: {
          startedAt: deletionStartedAt.toISOString(),
          deletedAt: now.toISOString(),
          requestedByUserId: input.actor.userId,
          storageObjectDeleted: Boolean(pathname),
          storagePathHash: pathname
            ? createHash("sha256").update(pathname).digest("hex")
            : null,
        },
      }),
    },
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.deleted",
    detail: "The private storage object was deleted and the audit record retained.",
    metadata: {
      clientId: document.clientId,
      storageObjectDeleted: Boolean(pathname),
      deletedAt: now.toISOString(),
    },
  });

  await recordSecurityEvent({
    userId: input.actor.userId,
    eventType: "document.deleted",
    severity: "High",
    area: "Document Vault",
    title: "Secure document deleted",
    detail:
      "A document object was removed from private storage while its audit record was retained.",
    metadata: {
      documentId: document.id,
      clientId: document.clientId,
    },
    request: input.request,
  });

  return {
    id: document.id,
    deletedAt: now.toISOString(),
  };
}

export async function reprocessDocument(input: {
  actor: DocumentActor;
  documentId: string;
}) {
  if (input.actor.kind !== "advisor" || !input.actor.canManage) {
    throw new ApiError({
      status: 403,
      code: "DOCUMENT_REPROCESS_PERMISSION_DENIED",
      message: "Advisor document-management permission is required.",
      expose: true,
    });
  }

  const document = await requireDocument({
    actor: input.actor,
    documentId: input.documentId,
  });

  if (
    document.deletedAt ||
    ["Archived", "Deletion Requested", "Deleting", "Rejected", "Duplicate"].includes(
      document.status,
    ) ||
    ["Queued", "Processing"].includes(document.processingStatus)
  ) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_REPROCESS_UNAVAILABLE",
      message: "This document cannot be reprocessed in its current state.",
      expose: true,
    });
  }

  if (!document.storagePath) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_STORAGE_OBJECT_MISSING",
      message: "The original storage object is no longer available.",
      expose: true,
    });
  }

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: "Processing",
      processingStatus: "Queued",
      processingError: null,
      securityStatus: "Pending",
      approvedAt: null,
      approvedByUserId: null,
    },
  });

  const queued = await enqueueDocumentProcessing({
    actor: input.actor,
    documentId: document.id,
    etag: `${document.etag ?? "no-etag"}:reprocess:${Date.now()}`,
  });

  await writeDocumentAudit({
    documentId: document.id,
    actor: input.actor,
    action: "document.reprocessing_queued",
    detail: "Secure document processing was queued again.",
    metadata: {
      jobId: queued.job.id,
    },
  });

  return publicDocumentById({
    actor: input.actor,
    documentId: document.id,
  });
}

export async function handleDocumentAction(input: {
  request: Request;
  body: Record<string, unknown>;
  actor?: DocumentActor;
}): Promise<DocumentActionResult> {
  const actorHint = input.body.actorHint === "client" ? "client" : "advisor";
  const actor = input.actor ?? (await resolveDocumentActor(actorHint));
  const action = cleanText(input.body.action);
  const documentId = cleanText(input.body.documentId);

  if (!documentId) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_ID_REQUIRED",
      message: "Document ID is required.",
      expose: true,
    });
  }

  if (action === "createAccessUrl") {
    return createDocumentAccessUrl({
      actor,
      documentId,
      disposition: input.body.disposition === "inline" ? "inline" : "attachment",
      requestUrl: input.request.url,
    });
  }

  if (action === "approve") {
    return {
      ok: true,
      message: "Document approved.",
      document: await approveDocument({
        actor,
        documentId,
        request: input.request,
      }),
    };
  }

  if (action === "updateMetadata") {
    return {
      ok: true,
      message: "Document details saved.",
      document: await updateDocumentMetadata({
        actor,
        documentId,
        documentType: input.body.documentType,
        visibility: input.body.visibility,
        notes: input.body.notes,
      }),
    };
  }

  if (action === "archive" || action === "restore") {
    return {
      ok: true,
      message: action === "restore" ? "Document restored." : "Document archived.",
      document: await archiveDocument({
        actor,
        documentId,
        restore: action === "restore",
      }),
    };
  }

  if (action === "requestDelete") {
    return {
      ok: true,
      message: "Document deletion request submitted for advisor review.",
      document: await requestDocumentDeletion({
        actor,
        documentId,
      }),
    };
  }

  if (action === "delete") {
    await deleteDocument({
      actor,
      documentId,
      request: input.request,
    });

    return {
      ok: true,
      message: "Document deleted from private storage. The audit record was retained.",
    };
  }

  if (action === "reprocess") {
    return {
      ok: true,
      message: "Document processing queued.",
      document: await reprocessDocument({
        actor,
        documentId,
      }),
    };
  }

  throw new ApiError({
    status: 400,
    code: "DOCUMENT_ACTION_UNSUPPORTED",
    message: "Unsupported document action.",
    expose: true,
    details: {
      supportedActions: [
        "createAccessUrl",
        "approve",
        "updateMetadata",
        "archive",
        "restore",
        "requestDelete",
        "delete",
        "reprocess",
      ],
    },
  });
}

export function documentServiceError(error: unknown) {
  return safeError(error);
}