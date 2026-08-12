Phase 3 Prisma schema index declarations

These declarations are inserted into prisma/schema.prisma by npm run db:phase3:prepare. Do not paste the whole document into one model. Each block belongs immediately before the closing brace of the named model.

Session

  @@index([userId, expiresAt], map: "Session_userId_expiresAt_idx")
  @@index([expiresAt], map: "Session_expiresAt_idx")

FirmMembership

  @@index([userId, status, createdAt(sort: Desc)], map: "FirmMembership_user_status_createdAt_idx")
  @@index([firmId, status, createdAt(sort: Desc)], map: "FirmMembership_firm_status_createdAt_idx")

ClientProfile

  @@index([firmId, status, fullName], map: "ClientProfile_firm_status_fullName_idx")
  @@index([firmId, assignedAdvisorMembershipId, status, fullName], map: "ClientProfile_firm_advisor_status_name_idx")

AdvisorClientInboxItem

  @@index([firmId, assignedAdvisorMembershipId, createdAt(sort: Desc)], map: "AdvisorInbox_firm_advisor_createdAt_idx")
  @@index([firmId, clientId, status, createdAt(sort: Desc)], map: "AdvisorInbox_firm_client_status_createdAt_idx")

AdvisorClientInboxReply

  @@index([inboxItemId, createdAt], map: "AdvisorInboxReply_item_createdAt_idx")

ClientAdvisorAssignmentAudit

  @@index([clientId, createdAt(sort: Desc)], map: "ClientAssignmentAudit_client_createdAt_idx")

NotificationDelivery

  @@index([userId, status, createdAt(sort: Desc)], map: "NotificationDelivery_user_status_createdAt_idx")
  @@index([status, createdAt], map: "NotificationDelivery_status_createdAt_idx")

AlertEvent

  @@index([userId, status, createdAt(sort: Desc)], map: "AlertEvent_user_status_createdAt_idx")

AuditLog

  @@index([userId, createdAt(sort: Desc)], map: "AuditLog_user_createdAt_idx")

MeetingTask

  @@index([userId, status, dueDate], map: "MeetingTask_user_status_dueDate_idx")
  @@index([clientId, createdAt(sort: Desc)], map: "MeetingTask_client_createdAt_idx")

PortfolioHolding

  @@index([clientId, createdAt(sort: Desc)], map: "PortfolioHolding_client_createdAt_idx")

AdvisorNote

  @@index([clientId, createdAt(sort: Desc)], map: "AdvisorNote_client_createdAt_idx")

RiskReview

  @@index([clientId, createdAt(sort: Desc)], map: "RiskReview_client_createdAt_idx")

DocumentVaultItem

  @@index([userId, status, createdAt(sort: Desc)], map: "DocumentVault_user_status_createdAt_idx")
  @@index([clientId, createdAt(sort: Desc)], map: "DocumentVault_client_createdAt_idx")

RealtimePriceSnapshot

  @@index([symbol, provider, createdAt(sort: Desc)], map: "RealtimePrice_symbol_provider_createdAt_idx")
  @@index([userId, symbol, createdAt(sort: Desc)], map: "RealtimePrice_user_symbol_createdAt_idx")

RealtimeInvestorNotification

  @@index([userId, status, createdAt(sort: Desc)], map: "RealtimeInvestorNotification_user_status_createdAt_idx")