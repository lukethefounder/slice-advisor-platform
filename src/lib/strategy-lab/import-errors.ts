import { StrategyError } from "./contracts";
/** Provider messages are classified without echoing request URLs or private credentials. */
export function assertProviderSuccess(value: unknown, retryAfterSeconds = 60): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const root = value as Record<string, unknown>;
  const raw = [root.Note, root.Information, root["Error Message"]].filter(x => typeof x === "string").join(" ").toLowerCase();
  if (!raw) return;
  if (/premium|subscription|entitlement|subscribe|premium endpoint/.test(raw))
    throw new StrategyError("PROVIDER_ENTITLEMENT", "Alpha Vantage has not granted this endpoint to the configured key. Slice beta removes only Slice allowances; use an entitled daily-adjusted account or an already verified saved dataset.", 403);
  if (/invalid.{0,30}(key|api)|apikey.{0,30}(invalid|missing)|api key.{0,30}(invalid|missing)/.test(raw))
    throw new StrategyError("PROVIDER_CREDENTIAL", "Alpha Vantage rejected the server credential. Ask the administrator to verify the private key.", 401);
  if (/rate|frequency|limit|requests per|calls per|call volume|quota/.test(raw))
    throw new StrategyError("PROVIDER_RATE_LIMIT", "Alpha Vantage is limiting these requests. Completed imports are preserved. Resume after the provider allowance reopens; beta cannot bypass it.", 429, Math.max(1, Math.min(86400, retryAfterSeconds)));
  throw new StrategyError("PROVIDER_REJECTED", "Alpha Vantage did not return the requested dataset. Check the exact symbol and provider endpoint access; no replacement data was generated.", 502);
}
export function blocksImportQueue(code: string): boolean {
  return ["PROVIDER_ENTITLEMENT", "PROVIDER_CREDENTIAL", "PROVIDER_NOT_CONFIGURED", "DAILY_QUOTA", "RATE_LIMITED", "PROVIDER_RATE_LIMIT", "PROVIDER_HTTP_429", "IMPORT_BUSY", "RESEARCH_STORAGE_MISSING", "RESEARCH_STORAGE_ACCESS"].includes(code);
}
