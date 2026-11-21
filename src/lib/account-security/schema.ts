import "server-only";
import { ApiError } from "@/lib/api-route";

/** Explain a missing additive migration without exposing database internals. */
export async function withSecuritySchema<T>(operation: Promise<T>): Promise<T> {
  try { return await operation; }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2021", "P2022"].includes(String(error.code))) {
      throw new ApiError({ status: 503, code: "SECURITY_SCHEMA_UPGRADE_REQUIRED", message: "The account security database update has not been applied. Run the included db:security-upgrade command, then restart Slice.", expose: true });
    }
    throw error;
  }
}
