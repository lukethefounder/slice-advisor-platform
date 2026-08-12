export const PHASE_3_INDEXES = [
  {
    model: "Session",
    table: "Session",
    name: "Session_userId_expiresAt_idx",
    fields: ["userId", "expiresAt"],
    prisma: '@@index([userId, expiresAt], map: "Session_userId_expiresAt_idx")',
    columns: ['"userId"', '"expiresAt"'],
  },
  {
    model: "Session",
    table: "Session",
    name: "Session_expiresAt_idx",
    fields: ["expiresAt"],
    prisma: '@@index([expiresAt], map: "Session_expiresAt_idx")',
    columns: ['"expiresAt"'],
  },
  {
    model: "FirmMembership",
    table: "FirmMembership",
    name: "FirmMembership_user_status_createdAt_idx",
    fields: ["userId", "status", "createdAt"],
    prisma:
      '@@index([userId, status, createdAt(sort: Desc)], map: "FirmMembership_user_status_createdAt_idx")',
    columns: ['"userId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "FirmMembership",
    table: "FirmMembership",
    name: "FirmMembership_firm_status_createdAt_idx",
    fields: ["firmId", "status", "createdAt"],
    prisma:
      '@@index([firmId, status, createdAt(sort: Desc)], map: "FirmMembership_firm_status_createdAt_idx")',
    columns: ['"firmId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "ClientProfile",
    table: "ClientProfile",
    name: "ClientProfile_firm_status_fullName_idx",
    fields: ["firmId", "status", "fullName"],
    prisma:
      '@@index([firmId, status, fullName], map: "ClientProfile_firm_status_fullName_idx")',
    columns: ['"firmId"', '"status"', '"fullName"'],
  },
  {
    model: "ClientProfile",
    table: "ClientProfile",
    name: "ClientProfile_firm_advisor_status_name_idx",
    fields: ["firmId", "assignedAdvisorMembershipId", "status", "fullName"],
    prisma:
      '@@index([firmId, assignedAdvisorMembershipId, status, fullName], map: "ClientProfile_firm_advisor_status_name_idx")',
    columns: [
      '"firmId"',
      '"assignedAdvisorMembershipId"',
      '"status"',
      '"fullName"',
    ],
  },
  {
    model: "AdvisorClientInboxItem",
    table: "AdvisorClientInboxItem",
    name: "AdvisorInbox_firm_advisor_createdAt_idx",
    fields: ["firmId", "assignedAdvisorMembershipId", "createdAt"],
    prisma:
      '@@index([firmId, assignedAdvisorMembershipId, createdAt(sort: Desc)], map: "AdvisorInbox_firm_advisor_createdAt_idx")',
    columns: ['"firmId"', '"assignedAdvisorMembershipId"', '"createdAt" DESC'],
  },
  {
    model: "AdvisorClientInboxItem",
    table: "AdvisorClientInboxItem",
    name: "AdvisorInbox_firm_client_status_createdAt_idx",
    fields: ["firmId", "clientId", "status", "createdAt"],
    prisma:
      '@@index([firmId, clientId, status, createdAt(sort: Desc)], map: "AdvisorInbox_firm_client_status_createdAt_idx")',
    columns: ['"firmId"', '"clientId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "AdvisorClientInboxReply",
    table: "AdvisorClientInboxReply",
    name: "AdvisorInboxReply_item_createdAt_idx",
    fields: ["inboxItemId", "createdAt"],
    prisma:
      '@@index([inboxItemId, createdAt], map: "AdvisorInboxReply_item_createdAt_idx")',
    columns: ['"inboxItemId"', '"createdAt"'],
  },
  {
    model: "ClientAdvisorAssignmentAudit",
    table: "ClientAdvisorAssignmentAudit",
    name: "ClientAssignmentAudit_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "ClientAssignmentAudit_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "NotificationDelivery",
    table: "NotificationDelivery",
    name: "NotificationDelivery_user_status_createdAt_idx",
    fields: ["userId", "status", "createdAt"],
    prisma:
      '@@index([userId, status, createdAt(sort: Desc)], map: "NotificationDelivery_user_status_createdAt_idx")',
    columns: ['"userId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "NotificationDelivery",
    table: "NotificationDelivery",
    name: "NotificationDelivery_status_createdAt_idx",
    fields: ["status", "createdAt"],
    prisma:
      '@@index([status, createdAt], map: "NotificationDelivery_status_createdAt_idx")',
    columns: ['"status"', '"createdAt"'],
  },
  {
    model: "AlertEvent",
    table: "AlertEvent",
    name: "AlertEvent_user_status_createdAt_idx",
    fields: ["userId", "status", "createdAt"],
    prisma:
      '@@index([userId, status, createdAt(sort: Desc)], map: "AlertEvent_user_status_createdAt_idx")',
    columns: ['"userId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "AuditLog",
    table: "AuditLog",
    name: "AuditLog_user_createdAt_idx",
    fields: ["userId", "createdAt"],
    prisma:
      '@@index([userId, createdAt(sort: Desc)], map: "AuditLog_user_createdAt_idx")',
    columns: ['"userId"', '"createdAt" DESC'],
  },
  {
    model: "MeetingTask",
    table: "MeetingTask",
    name: "MeetingTask_user_status_dueDate_idx",
    fields: ["userId", "status", "dueDate"],
    prisma:
      '@@index([userId, status, dueDate], map: "MeetingTask_user_status_dueDate_idx")',
    columns: ['"userId"', '"status"', '"dueDate"'],
  },
  {
    model: "PortfolioHolding",
    table: "PortfolioHolding",
    name: "PortfolioHolding_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "PortfolioHolding_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "AdvisorNote",
    table: "AdvisorNote",
    name: "AdvisorNote_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "AdvisorNote_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "MeetingTask",
    table: "MeetingTask",
    name: "MeetingTask_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "MeetingTask_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "RiskReview",
    table: "RiskReview",
    name: "RiskReview_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "RiskReview_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "DocumentVaultItem",
    table: "DocumentVaultItem",
    name: "DocumentVault_user_status_createdAt_idx",
    fields: ["userId", "status", "createdAt"],
    prisma:
      '@@index([userId, status, createdAt(sort: Desc)], map: "DocumentVault_user_status_createdAt_idx")',
    columns: ['"userId"', '"status"', '"createdAt" DESC'],
  },
  {
    model: "DocumentVaultItem",
    table: "DocumentVaultItem",
    name: "DocumentVault_client_createdAt_idx",
    fields: ["clientId", "createdAt"],
    prisma:
      '@@index([clientId, createdAt(sort: Desc)], map: "DocumentVault_client_createdAt_idx")',
    columns: ['"clientId"', '"createdAt" DESC'],
  },
  {
    model: "RealtimePriceSnapshot",
    table: "RealtimePriceSnapshot",
    name: "RealtimePrice_symbol_provider_createdAt_idx",
    fields: ["symbol", "provider", "createdAt"],
    prisma:
      '@@index([symbol, provider, createdAt(sort: Desc)], map: "RealtimePrice_symbol_provider_createdAt_idx")',
    columns: ['"symbol"', '"provider"', '"createdAt" DESC'],
  },
  {
    model: "RealtimePriceSnapshot",
    table: "RealtimePriceSnapshot",
    name: "RealtimePrice_user_symbol_createdAt_idx",
    fields: ["userId", "symbol", "createdAt"],
    prisma:
      '@@index([userId, symbol, createdAt(sort: Desc)], map: "RealtimePrice_user_symbol_createdAt_idx")',
    columns: ['"userId"', '"symbol"', '"createdAt" DESC'],
  },
  {
    model: "RealtimeInvestorNotification",
    table: "RealtimeInvestorNotification",
    name: "RealtimeInvestorNotification_user_status_createdAt_idx",
    fields: ["userId", "status", "createdAt"],
    prisma:
      '@@index([userId, status, createdAt(sort: Desc)], map: "RealtimeInvestorNotification_user_status_createdAt_idx")',
    columns: ['"userId"', '"status"', '"createdAt" DESC'],
  },
];

export function createIndexSql(index, options = {}) {
  const concurrently = options.concurrently ? " CONCURRENTLY" : "";

  return `CREATE INDEX${concurrently} IF NOT EXISTS "${index.name}" ON "${index.table}" (${index.columns.join(", ")});`;
}