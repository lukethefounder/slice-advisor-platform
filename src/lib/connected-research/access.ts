import "server-only";
import { ApiError } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { checkRateLimit, getClientIp, hashForSecurity, isPotentiallyCrossSiteUnsafeRequest } from "@/lib/security";
import type { Scope } from "./contracts";
export async function connectedAccess(request: Request, write = false): Promise<Scope> {
  if (write && isPotentiallyCrossSiteUnsafeRequest(request)) throw new ApiError({ status: 403, code: "CROSS_SITE_BLOCKED", message: "Cross-site writes are blocked.", expose: true });
  const context = await requireCurrentAccessContext({ requireFirm: true });
  if (!context.firm) throw new ApiError({ status: 403, code: "FIRM_REQUIRED", message: "An active firm is required.", expose: true });
  const rate = checkRateLimit({ key: `connected:${context.firm.id}:${context.user.id}:${write ? "write" : "read"}:${hashForSecurity(getClientIp(request))}`, limit: write ? 20 : 90, windowMs: 60000 });
  if (!rate.allowed) throw new ApiError({ status: 429, code: "RATE_LIMITED", message: "Too many requests. Retry shortly.", expose: true });
  return { userId: context.user.id, firmId: context.firm.id };
}
