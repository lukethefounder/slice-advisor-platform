import "server-only";

/**
 * Backward-compatible facade for the consolidated Phase 8 email center.
 * Existing imports can keep using @/lib/client-email-center while the
 * implementation is split into typed contracts, storage, services, and jobs.
 */
export * from "@/lib/email-center/contracts";
export {
  archiveClientEmailDrafts,
  cancelClientEmailDelivery,
  createAiClientEmailDrafts,
  createManualClientEmailDrafts,
  decideClientEmailApproval,
  deleteClientEmailDrafts,
  emailServiceSafeError,
  getClientEmailDraftProgress,
  listClientEmailArchive,
  listClientEmailCenter,
  polishExistingClientEmailDraft,
  queueClientEmailDraftsForApproval,
  retryAiClientEmailGeneration,
  retryClientEmailDelivery,
  saveClientEmailBranding,
  scheduleClientEmailDrafts,
  selectClientEmailDraftVersion,
  sendApprovedClientEmailDrafts,
  updateClientEmailDraft,
} from "@/lib/email-center/service";