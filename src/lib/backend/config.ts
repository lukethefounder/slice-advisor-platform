export type BackendContext = {
  userId: string;
  firmId: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
};

export function backendOwnerKey(context: BackendContext, key: string) {
  return `${context.userId}:${context.firmId ?? "personal"}:${key}`;
}

export function envConfigured(key?: string | null) {
  if (!key) return false;
  return Boolean(process.env[key]);
}

export const BACKEND_VENDOR_DEFINITIONS = [
  {
    vendorKey: "alpha_vantage",
    vendorName: "Alpha Vantage",
    category: "Market Data",
    purpose: "Quotes, candles, market visuals, and watchlist price-alert checks.",
    envKeyName: "ALPHA_VANTAGE_API_KEY",
    riskLevel: "Medium",
    dataAccess: ["Ticker symbols", "Market quote requests"],
    fallbackBehavior: "Use demo charts but do not trigger live price alerts.",
  },
  {
    vendorKey: "openai",
    vendorName: "OpenAI",
    category: "AI",
    purpose: "Bot reasoning, structured commands, report drafting, client summaries, and source interpretation.",
    envKeyName: "OPENAI_API_KEY",
    riskLevel: "High",
    dataAccess: ["Advisor prompts", "Client-safe summaries", "Platform context"],
    fallbackBehavior: "Use local template-based bot actions until connected.",
  },
  {
    vendorKey: "resend",
    vendorName: "Resend",
    category: "Email",
    purpose: "Transactional and advisor-approved email delivery.",
    envKeyName: "RESEND_API_KEY",
    riskLevel: "High",
    dataAccess: ["Recipient emails", "Approved message body"],
    fallbackBehavior: "Queue simulated dashboard delivery only.",
  },
  {
    vendorKey: "sendgrid",
    vendorName: "SendGrid",
    category: "Email",
    purpose: "Alternative transactional email delivery provider.",
    envKeyName: "SENDGRID_API_KEY",
    riskLevel: "High",
    dataAccess: ["Recipient emails", "Approved message body"],
    fallbackBehavior: "Queue simulated dashboard delivery only.",
  },
  {
    vendorKey: "twilio",
    vendorName: "Twilio",
    category: "SMS",
    purpose: "Advisor-approved text delivery and urgent notification routing.",
    envKeyName: "TWILIO_ACCOUNT_SID",
    riskLevel: "High",
    dataAccess: ["Phone numbers", "Approved text body"],
    fallbackBehavior: "Queue simulated dashboard delivery only.",
  },
  {
    vendorKey: "storage",
    vendorName: "Object Storage",
    category: "Storage",
    purpose: "Report exports, PDFs, evidence attachments, and source snapshots.",
    envKeyName: "BLOB_READ_WRITE_TOKEN",
    riskLevel: "Medium",
    dataAccess: ["Reports", "PDFs", "Evidence files"],
    fallbackBehavior: "Store metadata only until configured.",
  },
];

export const BACKEND_FEATURE_FLAGS = [
  {
    flagKey: "live_market_data",
    flagName: "Live Market Data",
    category: "Market Data",
    description: "Enable live quote/candle checks from configured providers.",
    requiresProvider: true,
    requiredVendorKey: "alpha_vantage",
  },
  {
    flagKey: "watchlist_price_alerts",
    flagName: "Watchlist Price Alerts",
    category: "Notifications",
    description: "Check high/low targets for watchlist symbols and queue notifications.",
    requiresProvider: true,
    requiredVendorKey: "alpha_vantage",
  },
  {
    flagKey: "ai_command_execution",
    flagName: "AI Command Execution",
    category: "AI",
    description: "Allow the personal bot to call structured backend tools.",
    requiresProvider: false,
  },
  {
    flagKey: "client_brain",
    flagName: "Client Brain",
    category: "Advisor OS",
    description: "Generate living client intelligence profiles.",
    requiresProvider: false,
  },
  {
    flagKey: "advisor_day",
    flagName: "Advisor Day",
    category: "Advisor OS",
    description: "Generate the daily next-best-action operating brief.",
    requiresProvider: false,
  },
  {
    flagKey: "email_delivery",
    flagName: "Email Delivery",
    category: "Communication",
    description: "Send advisor-approved email communications.",
    requiresProvider: true,
    requiredVendorKey: "resend",
  },
  {
    flagKey: "sms_delivery",
    flagName: "SMS Delivery",
    category: "Communication",
    description: "Send advisor-approved SMS communications.",
    requiresProvider: true,
    requiredVendorKey: "twilio",
  },
  {
    flagKey: "background_jobs",
    flagName: "Background Jobs",
    category: "Automation",
    description: "Run scheduled scanning, alerts, digests, and health checks.",
    requiresProvider: false,
  },
];

export const BACKEND_JOB_DEFINITIONS = [
  {
    jobKey: "vendor_health",
    jobName: "Vendor Health Check",
    category: "System",
    description: "Check market data, AI, email, SMS, and storage provider readiness.",
    scheduleLabel: "Hourly",
    cadence: "Cron",
  },
  {
    jobKey: "watchlist_price_check",
    jobName: "Watchlist Price Check",
    category: "Market Data",
    description: "Check high/low price targets for active watchlist price alerts.",
    scheduleLabel: "Every 5 minutes during market hours",
    cadence: "Cron",
  },
  {
    jobKey: "notification_delivery",
    jobName: "Notification Delivery",
    category: "Notifications",
    description: "Process queued dashboard/email/SMS delivery records.",
    scheduleLabel: "Every minute",
    cadence: "Queue",
  },
  {
    jobKey: "data_quality_sweep",
    jobName: "Data Quality Sweep",
    category: "Data Quality",
    description: "Identify stale, missing, fallback, or low-confidence platform data.",
    scheduleLabel: "Hourly",
    cadence: "Cron",
  },
  {
    jobKey: "advisor_day",
    jobName: "Advisor Day",
    category: "Advisor OS",
    description: "Generate a daily advisor operating brief from tasks, alerts, clients, and drafts.",
    scheduleLabel: "Weekdays at 7:00 AM",
    cadence: "Cron",
  },
  {
    jobKey: "market_scan",
    jobName: "Market Scan",
    category: "Market Data",
    description: "Refresh market visuals and market-data checkpoints.",
    scheduleLabel: "Every 5 minutes during market hours",
    cadence: "Cron",
  },
  {
    jobKey: "news_scan",
    jobName: "News Scan",
    category: "Intelligence",
    description: "Scan news sources and create retained alerts/opportunities.",
    scheduleLabel: "Every 15 minutes",
    cadence: "Cron",
  },
];