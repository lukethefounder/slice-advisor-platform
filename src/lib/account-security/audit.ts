import "server-only";
import { buildSecurityMetadata, getClientIp, getUserAgent, hashForSecurity } from "@/lib/security";

/** Supply this to the mutation's transaction so the change and its audit agree. */
export function securityAuditData(userId: string, eventType: string, title: string, request: Request, detail: string | null = null, severity = "Info") {
  return { userId, eventType, severity, area: "Security", title, detail, metadataJson: JSON.stringify(buildSecurityMetadata(request)), ipAddress: hashForSecurity(getClientIp(request)), userAgent: getUserAgent(request) };
}
