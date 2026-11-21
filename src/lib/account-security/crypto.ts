import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api-route";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(bytes: Buffer): string {
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
export function base32Decode(input: string): Buffer {
  const text = input.toUpperCase().replace(/=+$/, "");
  if (!/^[A-Z2-7]+$/.test(text)) throw new Error("Invalid authenticator key encoding.");
  let bits = 0, value = 0; const output: number[] = [];
  for (const char of text) {
    value = (value << 5) | ALPHABET.indexOf(char); bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

/** RFC 6238 / RFC 4226; six digits and a 30-second step for authenticator apps. */
export function totpCode(secret: string, step: number, digits = 6): string {
  if (!Number.isSafeInteger(step) || step < 0 || ![6, 8].includes(digits)) throw new Error("Invalid authenticator time step.");
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}
export function matchingTotpStep(secret: string, code: unknown, nowMs = Date.now(), lastUsedStep: number | null = null): number | null {
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim()) || !Number.isFinite(nowMs)) return null;
  const current = Math.floor(nowMs / 30_000), supplied = Buffer.from(code.trim());
  for (const step of [current, current - 1, current + 1]) {
    if (step < 0 || (lastUsedStep !== null && step <= lastUsedStep)) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), supplied)) return step;
  }
  return null;
}
function encryptionKey(): Buffer {
  const raw = String(process.env.MFA_ENCRYPTION_KEY ?? "").trim();
  const key = /^[a-fA-F0-9]{64}$/.test(raw) ? Buffer.from(raw, "hex") : /^[A-Za-z0-9+/]{43}=$/.test(raw) ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) throw new ApiError({ status: 503, code: "MFA_CONFIGURATION_REQUIRED", message: "Authenticator setup requires a 32-byte MFA_ENCRYPTION_KEY on the server. Ask the platform owner to configure it.", expose: true });
  return key;
}
export function mfaEncryptionConfigured(): boolean { try { encryptionKey(); return true; } catch { return false; } }
export function createAuthenticatorSecret(): string { return base32Encode(randomBytes(20)); }
export function encryptAuthenticatorSecret(secret: string, userId: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`slice-authenticator-v1:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(".");
}
export function decryptAuthenticatorSecret(ciphertext: string, userId: string): string {
  const [version, iv, tag, payload, extra] = ciphertext.split(".");
  if (version !== "v1" || extra !== undefined || !/^[a-f0-9]{24}$/.test(iv ?? "") || !/^[a-f0-9]{32}$/.test(tag ?? "") || !/^[a-f0-9]{2,256}$/.test(payload ?? "") || payload.length % 2) throw new Error("The authenticator key could not be verified.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(`slice-authenticator-v1:${userId}`)); decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "hex")), decipher.final()]).toString("utf8");
}
export function recoveryCodeHash(value: string, userId: string): string { return createHash("sha256").update(`slice-recovery-v1:${userId}:${value.replace(/[\s-]/g, "").toUpperCase()}`).digest("hex"); }
export function createRecoveryCodes(userId: string) {
  const codes = Array.from({ length: 10 }, () => randomBytes(12).toString("hex").toUpperCase().match(/.{1,6}/g)!.join("-"));
  return { codes, hashes: codes.map(value => recoveryCodeHash(value, userId)) };
}
export function parseRecoveryHashes(raw: string): string[] {
  try { const data: unknown = JSON.parse(raw); return Array.isArray(data) && data.length <= 10 && data.every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) ? data : []; } catch { return []; }
}
