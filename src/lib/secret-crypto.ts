import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getEncryptionKey() {
  const raw = process.env.SLICE_SECRET_ENCRYPTION_KEY;

  if (raw) {
    if (/^[a-f0-9]{64}$/i.test(raw)) {
      return Buffer.from(raw, "hex");
    }

    try {
      const base64 = Buffer.from(raw, "base64");
      if (base64.length === 32) return base64;
    } catch {
      // Fall through to hash-based derivation.
    }

    return createHash("sha256").update(raw).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing SLICE_SECRET_ENCRYPTION_KEY. Production must not store advisor source secrets without an encryption key."
    );
  }

  return createHash("sha256")
    .update("slice-development-only-secret-key-change-before-production")
    .digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string | null | undefined) {
  if (!payload) return "";

  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(":");

  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivRaw, "base64");
  const tag = Buffer.from(tagRaw, "base64");
  const encrypted = Buffer.from(encryptedRaw, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "";

  if (value.length <= 8) {
    return "••••";
  }

  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}