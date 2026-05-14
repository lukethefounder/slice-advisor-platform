export type IntegrationStatus = {
  key: string;
  label: string;
  category: string;
  configured: boolean;
  liveEnabled?: boolean;
  requiredEnv: string[];
  safeStatus: "Ready" | "Missing" | "Disabled" | "Simulated";
  note: string;
};

export function boolEnv(key: string, fallback = false) {
  const value = process.env[key];

  if (value === undefined) return fallback;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export function getRequiredEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getOptionalEnv(key: string) {
  return process.env[key] || "";
}

export function isConfigured(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  const liveEmail = boolEnv("ENABLE_LIVE_EMAIL");
  const liveSms = boolEnv("ENABLE_LIVE_SMS");

  return [
    {
      key: "openai",
      label: "OpenAI",
      category: "AI",
      configured: isConfigured(["OPENAI_API_KEY"]),
      requiredEnv: ["OPENAI_API_KEY"],
      safeStatus: isConfigured(["OPENAI_API_KEY"]) ? "Ready" : "Missing",
      note: isConfigured(["OPENAI_API_KEY"])
        ? "AI provider configured."
        : "OPENAI_API_KEY is missing. Bot will use local/template behavior only.",
    },
    {
      key: "alpha_vantage",
      label: "Alpha Vantage",
      category: "Market Data",
      configured: isConfigured(["ALPHA_VANTAGE_API_KEY"]),
      requiredEnv: ["ALPHA_VANTAGE_API_KEY"],
      safeStatus: isConfigured(["ALPHA_VANTAGE_API_KEY"]) ? "Ready" : "Missing",
      note: isConfigured(["ALPHA_VANTAGE_API_KEY"])
        ? "Market quote provider configured."
        : "ALPHA_VANTAGE_API_KEY is missing. Live price checks cannot trigger real market alerts.",
    },
    {
      key: "resend",
      label: "Resend",
      category: "Email",
      configured: isConfigured(["RESEND_API_KEY", "RESEND_FROM"]),
      liveEnabled: liveEmail,
      requiredEnv: ["RESEND_API_KEY", "RESEND_FROM"],
      safeStatus: !isConfigured(["RESEND_API_KEY", "RESEND_FROM"])
        ? "Missing"
        : liveEmail
          ? "Ready"
          : "Simulated",
      note: !isConfigured(["RESEND_API_KEY", "RESEND_FROM"])
        ? "Resend email configuration is missing."
        : liveEmail
          ? "Live email delivery is enabled."
          : "Email provider is configured but ENABLE_LIVE_EMAIL is false.",
    },
    {
      key: "twilio",
      label: "Twilio",
      category: "SMS",
      configured:
        isConfigured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]) &&
        Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
      liveEnabled: liveSms,
      requiredEnv: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID",
      ],
      safeStatus:
        !isConfigured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]) ||
        !Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
          ? "Missing"
          : liveSms
            ? "Ready"
            : "Simulated",
      note:
        !isConfigured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]) ||
        !Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
          ? "Twilio SMS configuration is missing."
          : liveSms
            ? "Live SMS delivery is enabled."
            : "Twilio is configured but ENABLE_LIVE_SMS is false.",
    },
    {
      key: "vercel_blob",
      label: "Vercel Blob",
      category: "Storage",
      configured: isConfigured(["BLOB_READ_WRITE_TOKEN"]),
      requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
      safeStatus: isConfigured(["BLOB_READ_WRITE_TOKEN"]) ? "Ready" : "Missing",
      note: isConfigured(["BLOB_READ_WRITE_TOKEN"])
        ? "Blob storage configured."
        : "BLOB_READ_WRITE_TOKEN is missing. File/report storage will remain metadata-only.",
    },
  ];
}