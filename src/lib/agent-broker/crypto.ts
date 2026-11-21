import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { AgentBrokerError, type BrokerMode } from "./contracts";

export type BrokerCredentials = { key: string; secret: string };
export function brokerEncryptionConfigured(): boolean {
  return /^[a-fA-F0-9]{64}$/.test(process.env.SLICE_BROKER_ENCRYPTION_KEY?.trim() ?? "");
}
function encryptionKey(): Buffer {
  if (!brokerEncryptionConfigured()) throw new AgentBrokerError("BROKER_ENCRYPTION_REQUIRED", "Set SLICE_BROKER_ENCRYPTION_KEY to a dedicated 64-character hexadecimal encryption key before connecting a broker.", 503);
  return Buffer.from(process.env.SLICE_BROKER_ENCRYPTION_KEY!.trim(), "hex");
}
export function validateBrokerCredentials(key: unknown, secret: unknown): BrokerCredentials {
  if (typeof key !== "string" || typeof secret !== "string" || !/^[A-Za-z0-9_-]{12,128}$/.test(key) || !/^[A-Za-z0-9_-]{20,256}$/.test(secret))
    throw new AgentBrokerError("INVALID_BROKER_CREDENTIALS", "Enter your Alpaca API key and secret for the selected environment. Brokerage login passwords are not accepted.", 400);
  return { key, secret };
}
const aad = (scope: DeskScope, mode: BrokerMode) => Buffer.from(JSON.stringify({ purpose: "slice-alpaca-v1", owner: scope.userId, firm: scope.firmId, mode }));
export function encryptBrokerCredentials(scope: DeskScope, mode: BrokerMode, credentials: BrokerCredentials): string {
  validateBrokerCredentials(credentials.key, credentials.secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(aad(scope, mode));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptBrokerCredentials(scope: DeskScope, mode: BrokerMode, encrypted: string): BrokerCredentials {
  const key = encryptionKey();
  try {
    const parts = encrypted.split(".");
    if (parts.length !== 4 || parts[0] !== "v1" || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error("format");
    const iv = Buffer.from(parts[1], "base64url"), tag = Buffer.from(parts[2], "base64url"), ciphertext = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 1024) throw new Error("length");
    const cipher = createDecipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad(scope, mode)); cipher.setAuthTag(tag);
    const decoded: unknown = JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8"));
    if (!decoded || typeof decoded !== "object" || !("key" in decoded) || !("secret" in decoded)) throw new Error("payload");
    return validateBrokerCredentials(decoded.key, decoded.secret);
  } catch {
    throw new AgentBrokerError("BROKER_CREDENTIALS_UNREADABLE", "Stored broker credentials failed their integrity check. Restore the original encryption key or reconnect the same account.", 503);
  }
}
