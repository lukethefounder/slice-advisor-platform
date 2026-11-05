import "server-only";
import { createHash } from "node:crypto";
import type { Entitlement } from "./contracts";
export function marketConfiguration() {
  const key = (process.env.ALPHA_VANTAGE_API_KEY || "").trim();
  const mode = (process.env.ALPHA_VANTAGE_ENTITLEMENT || "").trim().toLowerCase();
  const entitlement: Entitlement = mode === "realtime" || mode === "delayed" ? mode : "historical";
  return { key, entitlement, fingerprint: createHash("sha256").update(key).digest("hex") };
}
