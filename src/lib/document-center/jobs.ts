import "server-only";

import { ApiError } from "@/lib/api-route";
import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import {
  deletePrivateDocumentBlob,
  inspectPrivateDocumentBlob,
} from "@/lib/document-center/storage";
import { prisma } from "@/lib/prisma";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

function safeProcessingError(error: unknown) {
  if (error instanceof ApiError && error.expose) {
    return error.message.slice(0, 1_000);
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "Document processing was interrupted.";
  }

  return "Document processing failed. Retry the job or inspect the storage provider.";
}

async function writeSystemAudit(input: {
  documentId: string;
  firmId: string | null;
  clientId: string | null;
  userId: string;
  action: string;
  detail: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.documentAuditEvent.create({
    data: {
      documentId: input.documentId,
      firmId: input.firmId,
      clientId: input.clientId,
      actorType: "System",
      actorUserId: input.userId,
      actorClientId: null,
      action: input.action,
      detail: input.detail,
      metadataJson: asJson(input.metadata ?? {}),
    },
  });
}

async function loadProcessingDocument(input: {
  context: BackendContext;
  documentId: string;
}) {
  const document = await prisma.documentVaultItem.findFirst({
    where: {
      id: input.documentId,
      userId: input.context.userId,
      firmId: input.context.firmId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      firmId: true,
      clientId: true,
      fileName: true,
      documentType: true,
      status: true,
      storagePath: true,
      contentType: true,
      sizeBytes: true,
      etag: true,
      claimedSha256: true,
      metadataJson: true,
      uploadedByType: true,
      uploadedByClientId: true,
      processingStatus: true,
      securityStatus: true,
    },
  });

  if (!document) {
    throw new ApiError({
      status: 404,
      code: "DOCUMENT_PROCESSING_TARGET_NOT_FOUND",
      message: "Document processing target not found.",
      expose: false,
    });
  }

  const storagePath = document.storagePath;

  if (!storagePath) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_STORAGE_OBJECT_MISSING",
      message: "The original document object is unavailable.",
      expose: false,
    });
  }

  /*
   * Prisma correctly models storagePath as nullable because archived, rejected,
   * duplicate, and retained audit records may no longer have a Blob object.
   * A processing job, however, cannot proceed without the original object.
   * Returning a copied object with the validated local value establishes that
   * stronger invariant for every downstream processing helper.
   */
  return {
    ...document,
    storagePath,
  };
}

async function markRejected(input: {
  document: Awaited<ReturnType<typeof loadProcessingDocument>>;
  context: BackendContext;
  reason: string;
  sha256?: string | null;
  actualSize?: number | null;
  actualContentType?: string | null;
  signal?: AbortSignal;
}) {
  const pathname = input.document.storagePath;

  await deletePrivateDocumentBlob(pathname, input.signal).catch(() => undefined);

  const metadata = parseJson<Record<string, unknown>>(
    input.document.metadataJson,
    {},
  );

  await prisma.documentVaultItem.update({
    where: {
      id: input.document.id,
    },
    data: {
      status: "Rejected",
      processingStatus: "Failed",
      processingError: input.reason,
      securityStatus: "Rejected",
      sha256: input.sha256 ?? undefined,
      sizeBytes: input.actualSize ?? undefined,
      contentType: input.actualContentType ?? undefined,
      storagePath: null,
      storageUrl: null,
      etag: null,
      metadataJson: asJson({
        ...metadata,
        rejection: {
          reason: input.reason,
          rejectedAt: new Date().toISOString(),
          storageObjectDeleted: true,
        },
      }),
    },
  });

  await writeSystemAudit({
    documentId: input.document.id,
    firmId: input.document.firmId,
    clientId: input.document.clientId,
    userId: input.context.userId,
    action: "document.rejected",
    detail: input.reason,
    metadata: {
      sha256: input.sha256 ?? null,
      actualSize: input.actualSize ?? null,
      actualContentType: input.actualContentType ?? null,
      storageObjectDeleted: true,
    },
  });

  await queueBackendDelivery(input.context, {
    channel: "Dashboard",
    destination: input.context.actorEmail ?? "Dashboard",
    title: "Document rejected during secure processing",
    body: input.reason,
    urgency: "High",
    score: 92,
    idempotencyKey: `document-rejected:${input.document.id}:${input.reason}`,
    payload: {
      documentId: input.document.id,
      clientId: input.document.clientId,
      actionUrl: `/workspace/documents?documentId=${encodeURIComponent(
        input.document.id,
      )}`,
    },
  });
}

async function markDuplicate(input: {
  document: Awaited<ReturnType<typeof loadProcessingDocument>>;
  duplicateId: string;
  context: BackendContext;
  sha256: string;
  sizeBytes: number;
  contentType: string;
  signal?: AbortSignal;
}) {
  await deletePrivateDocumentBlob(input.document.storagePath, input.signal).catch(
    () => undefined,
  );

  const metadata = parseJson<Record<string, unknown>>(
    input.document.metadataJson,
    {},
  );

  await prisma.documentVaultItem.update({
    where: {
      id: input.document.id,
    },
    data: {
      status: "Duplicate",
      processingStatus: "Complete",
      processingError: null,
      securityStatus: "Signature Verified",
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      storagePath: null,
      storageUrl: null,
      etag: null,
      metadataJson: asJson({
        ...metadata,
        duplicate: {
          duplicateOfDocumentId: input.duplicateId,
          detectedAt: new Date().toISOString(),
          storageObjectDeleted: true,
        },
      }),
    },
  });

  await writeSystemAudit({
    documentId: input.document.id,
    firmId: input.document.firmId,
    clientId: input.document.clientId,
    userId: input.context.userId,
    action: "document.duplicate_detected",
    detail:
      "An identical document already exists in the same firm and client scope. The duplicate object was removed from storage.",
    metadata: {
      duplicateOfDocumentId: input.duplicateId,
      sha256: input.sha256,
      storageObjectDeleted: true,
    },
  });
}

async function runDocumentProcessingJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const payload = asObject(runtime.payload);
  const documentId = String(payload.documentId ?? "").trim();

  if (!documentId) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_PROCESSING_PAYLOAD_INVALID",
      message: "Document processing payload is invalid.",
      expose: false,
    });
  }

  await runtime.reportProgress(5, "Loading secure document metadata");
  const document = await loadProcessingDocument({
    context,
    documentId,
  });
  const fileName = decryptSensitiveText(document.fileName) ?? "document";

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      status: "Processing",
      processingStatus: "Processing",
      processingError: null,
      securityStatus: "Pending",
    },
  });

  await runtime.throwIfCancelled();
  await runtime.reportProgress(15, "Reading the private storage object");

  const inspection = await inspectPrivateDocumentBlob({
    pathname: document.storagePath,
    fileName,
    declaredContentType: document.contentType,
    signal: runtime.signal,
  });

  await runtime.throwIfCancelled();
  await runtime.reportProgress(65, "Verifying document signature and fingerprint");

  if (!inspection.signatureValid) {
    await markRejected({
      document,
      context,
      reason: inspection.securityMessage,
      sha256: inspection.sha256,
      actualSize: inspection.sizeBytes,
      actualContentType: inspection.contentType,
      signal: runtime.signal,
    });

    await runtime.reportProgress(99, "Document rejected safely");

    return {
      documentId: document.id,
      status: "Rejected",
      reason: inspection.securityMessage,
      sha256: inspection.sha256,
    };
  }

  if (
    document.claimedSha256 &&
    document.claimedSha256 !== inspection.sha256
  ) {
    const reason =
      "The uploaded document fingerprint did not match the fingerprint approved before upload.";

    await markRejected({
      document,
      context,
      reason,
      sha256: inspection.sha256,
      actualSize: inspection.sizeBytes,
      actualContentType: inspection.contentType,
      signal: runtime.signal,
    });

    await runtime.reportProgress(99, "Document rejected safely");

    return {
      documentId: document.id,
      status: "Rejected",
      reason,
      sha256: inspection.sha256,
    };
  }

  const duplicate = await prisma.documentVaultItem.findFirst({
    where: {
      id: {
        not: document.id,
      },
      firmId: document.firmId,
      clientId: document.clientId,
      deletedAt: null,
      sha256: inspection.sha256,
      sizeBytes: inspection.sizeBytes,
      securityStatus: "Signature Verified",
      status: {
        notIn: ["Rejected", "Duplicate", "Archived"],
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    await markDuplicate({
      document,
      duplicateId: duplicate.id,
      context,
      sha256: inspection.sha256,
      sizeBytes: inspection.sizeBytes,
      contentType: inspection.contentType,
      signal: runtime.signal,
    });

    await runtime.reportProgress(99, "Duplicate document removed safely");

    return {
      documentId: document.id,
      status: "Duplicate",
      duplicateOfDocumentId: duplicate.id,
      sha256: inspection.sha256,
    };
  }

  await runtime.reportProgress(82, "Classifying document metadata");
  const metadata = parseJson<Record<string, unknown>>(
    document.metadataJson,
    {},
  );
  const nextType =
    document.documentType === "General"
      ? inspection.classification.category
      : document.documentType;

  await prisma.documentVaultItem.update({
    where: {
      id: document.id,
    },
    data: {
      documentType: nextType,
      status: "Needs Review",
      processingStatus: "Complete",
      processingError: null,
      securityStatus: "Signature Verified",
      contentType: inspection.contentType,
      sizeBytes: inspection.sizeBytes,
      etag: inspection.blob.etag,
      sha256: inspection.sha256,
      classificationJson: asJson(inspection.classification),
      extractedTextEncrypted: encryptSensitiveText(inspection.textPreview),
      metadataJson: asJson({
        ...metadata,
        processing: {
          completedAt: new Date().toISOString(),
          signatureMessage: inspection.securityMessage,
          textPreviewAvailable: Boolean(inspection.textPreview),
          malwareScanningConfigured: false,
        },
      }),
    },
  });

  await writeSystemAudit({
    documentId: document.id,
    firmId: document.firmId,
    clientId: document.clientId,
    userId: context.userId,
    action: "document.processed",
    detail:
      "The original object was fingerprinted, signature-checked, and classified for advisor review.",
    metadata: {
      sha256: inspection.sha256,
      sizeBytes: inspection.sizeBytes,
      contentType: inspection.contentType,
      category: nextType,
      confidence: inspection.classification.confidence,
      textPreviewAvailable: Boolean(inspection.textPreview),
      requiresOcr: inspection.classification.requiresOcr,
      malwareScanningConfigured: false,
    },
  });

  await runtime.reportProgress(99, "Document ready for advisor review");

  return {
    documentId: document.id,
    status: "Needs Review",
    securityStatus: "Signature Verified",
    sha256: inspection.sha256,
    sizeBytes: inspection.sizeBytes,
    contentType: inspection.contentType,
    category: nextType,
    classificationConfidence: inspection.classification.confidence,
    textPreviewAvailable: Boolean(inspection.textPreview),
  };
}

export async function executeDocumentProcessingJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  try {
    return await runDocumentProcessingJob(context, runtime);
  } catch (error) {
    const documentId = String(asObject(runtime.payload).documentId ?? "").trim();

    if (documentId) {
      try {
        const document = await prisma.documentVaultItem.findFirst({
          where: {
            id: documentId,
            userId: context.userId,
            firmId: context.firmId,
            deletedAt: null,
          },
          select: {
            id: true,
            firmId: true,
            clientId: true,
            status: true,
            processingStatus: true,
            securityStatus: true,
          },
        });

        if (
          document &&
          document.status !== "Rejected" &&
          document.status !== "Duplicate"
        ) {
          const message = safeProcessingError(error);

          await prisma.documentVaultItem.update({
            where: {
              id: document.id,
            },
            data: {
              status: "Needs Review",
              processingStatus: "Failed",
              processingError: message,
              securityStatus:
                document.securityStatus === "Signature Verified"
                  ? "Signature Verified"
                  : "Not Checked",
            },
          });

          await writeSystemAudit({
            documentId: document.id,
            firmId: document.firmId,
            clientId: document.clientId,
            userId: context.userId,
            action: "document.processing_failed",
            detail: message,
            metadata: {
              attempt: runtime.attempt,
            },
          });
        }
      } catch {
        // The durable background-job failure remains visible even when the
        // document status could not be updated.
      }
    }

    throw error;
  }
}